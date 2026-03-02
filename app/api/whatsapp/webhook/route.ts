// app/api/whatsapp/webhook/route.ts
// Primește mesaje de la Meta în timp real

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── GET: Verificare webhook de către Meta ──
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    console.log('✅ WhatsApp webhook verificat cu succes')
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: 'Token invalid' }, { status: 403 })
}

// ── POST: Primire mesaje noi ──
export async function POST(req: NextRequest) {
  try {
    // Verifică semnătura Meta pentru securitate
    const rawBody = await req.text()
    const signature = req.headers.get('x-hub-signature-256')

    if (process.env.META_APP_SECRET && signature) {
      const expectedSig = 'sha256=' + crypto
        .createHmac('sha256', process.env.META_APP_SECRET)
        .update(rawBody)
        .digest('hex')

      if (signature !== expectedSig) {
        console.error('❌ Semnătură Meta invalidă')
        return NextResponse.json({ error: 'Semnătură invalidă' }, { status: 401 })
      }
    }

    const body = JSON.parse(rawBody)

    // Structura Meta webhook
    const entry = body.entry?.[0]
    const changes = entry?.changes?.[0]
    const value = changes?.value

    if (!value) {
      return NextResponse.json({ status: 'no_value' })
    }

    // ── Procesează mesaje primite ──
    if (value.messages) {
      for (const msg of value.messages) {
        await processInboundMessage(msg, value.contacts?.[0])
      }
    }

    // ── Procesează status updates (delivered, read) ──
    if (value.statuses) {
      for (const status of value.statuses) {
        await updateMessageStatus(status)
      }
    }

    return NextResponse.json({ status: 'ok' })
  } catch (err: any) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

async function processInboundMessage(msg: any, contact: any) {
  const waPhone = msg.from // ex: "37369123456"
  const waName = contact?.profile?.name || waPhone
  const waMessageId = msg.id

  // Extrage textul mesajului în funcție de tip
  let body = ''
  let mediaUrl = null
  let mediaMimeType = null
  const messageType = msg.type || 'text'

  if (msg.type === 'text') {
    body = msg.text?.body || ''
  } else if (msg.type === 'image') {
    body = msg.image?.caption || '📷 Imagine'
    mediaUrl = msg.image?.id // Media ID Meta (fetch separat dacă trebuie)
    mediaMimeType = msg.image?.mime_type
  } else if (msg.type === 'document') {
    body = msg.document?.filename || '📄 Document'
    mediaUrl = msg.document?.id
    mediaMimeType = msg.document?.mime_type
  } else if (msg.type === 'audio') {
    body = '🎵 Mesaj vocal'
    mediaUrl = msg.audio?.id
  } else if (msg.type === 'location') {
    body = `📍 Locație: ${msg.location?.name || msg.location?.address || 'Vezi harta'}`
  } else {
    body = `[${msg.type}]`
  }

  // 1. Găsește sau creează conversația
  let { data: conv } = await supabaseAdmin
    .from('whatsapp_conversations')
    .select('id, lead_id')
    .eq('wa_phone', waPhone)
    .single()

  if (!conv) {
    // Caută dacă există un lead cu acest număr
    const cleanPhone = '+' + waPhone
    const { data: existingLead } = await supabaseAdmin
      .from('leads')
      .select('id')
      .or(`phone.eq.${cleanPhone},phone.eq.${waPhone}`)
      .single()

    // Creează conversație nouă
    const { data: newConv } = await supabaseAdmin
      .from('whatsapp_conversations')
      .insert({
        wa_phone: waPhone,
        wa_name: waName,
        lead_id: existingLead?.id || null,
        last_message: body,
        last_message_at: new Date().toISOString(),
        unread_count: 1,
      } as any)
      .select()
      .single()

    conv = newConv as any

    // Dacă nu există lead → creează automat
    if (!existingLead && conv) {
      const { data: newLead } = await supabaseAdmin
        .from('leads')
        .insert({
          name: waName,
          phone: '+' + waPhone,
          source: 'WhatsApp',
          status: 'Nou',
        } as any)
        .select()
        .single()

      if (newLead) {
        await supabaseAdmin
          .from('whatsapp_conversations')
          .update({ lead_id: (newLead as any).id } as any)
          .eq('id', (conv as any).id)
      }
    }
  } else {
    // Actualizează conversația existentă
    await supabaseAdmin
      .from('whatsapp_conversations')
      .update({
        last_message: body,
        last_message_at: new Date().toISOString(),
        unread_count: ((conv as any).unread_count || 0) + 1,
        wa_name: waName,
      } as any)
      .eq('id', (conv as any).id)
  }

  if (!conv) return

  // 2. Salvează mesajul (deduplicare prin wa_message_id)
  await supabaseAdmin
    .from('whatsapp_messages')
    .upsert({
      conversation_id: (conv as any).id,
      wa_message_id: waMessageId,
      direction: 'inbound',
      message_type: messageType,
      body,
      media_url: mediaUrl,
      media_mime_type: mediaMimeType,
    } as any, { onConflict: 'wa_message_id' })
}

async function updateMessageStatus(status: any) {
  if (!status.id) return
  await supabaseAdmin
    .from('whatsapp_messages')
    .update({ status: status.status } as any)
    .eq('wa_message_id', status.id)
}
