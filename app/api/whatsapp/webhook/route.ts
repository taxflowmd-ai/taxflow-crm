import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const admin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

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

export async function POST(req: NextRequest) {
  try {
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
    const value = body.entry?.[0]?.changes?.[0]?.value
    if (!value) return NextResponse.json({ status: 'no_value' })

    if (value.messages) {
      for (const msg of value.messages) {
        await processInboundMessage(msg, value.contacts?.[0])
      }
    }
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
  const waPhone = msg.from
  const waName = contact?.profile?.name || waPhone
  const waMessageId = msg.id
  const db = admin()

  let body = ''
  let mediaUrl = null
  let mediaMimeType = null
  const messageType = msg.type || 'text'

  if (msg.type === 'text') body = msg.text?.body || ''
  else if (msg.type === 'image') { body = msg.image?.caption || '📷 Imagine'; mediaUrl = msg.image?.id; mediaMimeType = msg.image?.mime_type }
  else if (msg.type === 'document') { body = msg.document?.filename || '📄 Document'; mediaUrl = msg.document?.id; mediaMimeType = msg.document?.mime_type }
  else if (msg.type === 'audio') { body = '🎵 Mesaj vocal'; mediaUrl = msg.audio?.id }
  else if (msg.type === 'location') body = `📍 ${msg.location?.name || msg.location?.address || 'Locație'}`
  else body = `[${msg.type}]`

  let { data: conv } = await db.from('whatsapp_conversations').select('id, unread_count').eq('wa_phone', waPhone).single()

  if (!conv) {
    const cleanPhone = '+' + waPhone
    const { data: existingLead } = await db.from('leads').select('id').or(`phone.eq.${cleanPhone},phone.eq.${waPhone}`).single()

    const { data: newConv } = await db.from('whatsapp_conversations').insert({
      wa_phone: waPhone, wa_name: waName,
      lead_id: existingLead?.id || null,
      last_message: body, last_message_at: new Date().toISOString(), unread_count: 1,
    } as any).select().single()

    conv = newConv as any

    if (!existingLead && conv) {
      // Găsește primul admin activ pentru a asigna lead-ul nou
      const { data: adminUser } = await db
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
        .eq('is_active', true)
        .order('created_at')
        .limit(1)
        .single()

      const { data: newLead } = await db.from('leads').insert({
        name: waName,
        phone: '+' + waPhone,
        source: 'WhatsApp',
        status: 'Nou',
        assigned_to: adminUser?.id || null,
      } as any).select().single()
      if (newLead) await db.from('whatsapp_conversations').update({ lead_id: (newLead as any).id } as any).eq('id', (conv as any).id)
    }
  } else {
    await db.from('whatsapp_conversations').update({
      last_message: body, last_message_at: new Date().toISOString(),
      unread_count: ((conv as any).unread_count || 0) + 1, wa_name: waName,
    } as any).eq('id', (conv as any).id)
  }

  if (!conv) return

  await db.from('whatsapp_messages').upsert({
    conversation_id: (conv as any).id, wa_message_id: waMessageId,
    direction: 'inbound', message_type: messageType,
    body, media_url: mediaUrl, media_mime_type: mediaMimeType,
  } as any, { onConflict: 'wa_message_id' })
}

async function updateMessageStatus(status: any) {
  if (!status.id) return
  await admin().from('whatsapp_messages').update({ status: status.status } as any).eq('wa_message_id', status.id)
}
