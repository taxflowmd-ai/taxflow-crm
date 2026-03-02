// app/api/whatsapp/send/route.ts
// Trimite mesaj din CRM către client

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    // Verifică autentificare
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 })

    const { conversationId, message } = await req.json()
    if (!conversationId || !message?.trim()) {
      return NextResponse.json({ error: 'Date lipsă' }, { status: 400 })
    }

    // Găsește conversația
    const { data: conv, error: convErr } = await supabaseAdmin
      .from('whatsapp_conversations')
      .select('wa_phone')
      .eq('id', conversationId)
      .single()

    if (convErr || !conv) {
      return NextResponse.json({ error: 'Conversație negăsită' }, { status: 404 })
    }

    const waPhone = (conv as any).wa_phone

    // Trimite mesajul prin Meta API
    const metaRes = await fetch(
      `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: waPhone,
          type: 'text',
          text: { body: message.trim() },
        }),
      }
    )

    const metaData = await metaRes.json()

    if (!metaRes.ok) {
      console.error('Meta API error:', metaData)
      return NextResponse.json(
        { error: metaData.error?.message || 'Eroare Meta API' },
        { status: 400 }
      )
    }

    const waMessageId = metaData.messages?.[0]?.id

    // Salvează mesajul în DB
    await supabaseAdmin
      .from('whatsapp_messages')
      .insert({
        conversation_id: conversationId,
        wa_message_id: waMessageId,
        direction: 'outbound',
        message_type: 'text',
        body: message.trim(),
        status: 'sent',
        sent_by: user.id,
      } as any)

    // Actualizează conversația
    await supabaseAdmin
      .from('whatsapp_conversations')
      .update({
        last_message: message.trim(),
        last_message_at: new Date().toISOString(),
      } as any)
      .eq('id', conversationId)

    return NextResponse.json({ success: true, messageId: waMessageId })
  } catch (err: any) {
    console.error('Send error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
