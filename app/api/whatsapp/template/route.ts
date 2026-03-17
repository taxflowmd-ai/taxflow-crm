// app/api/whatsapp/template/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const admin = () => createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() {},
        },
      }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 })

    const { conversationId, templateName, languageCode } = await req.json()
    if (!conversationId || !templateName) {
      return NextResponse.json({ error: 'Date lipsă' }, { status: 400 })
    }

    const db = admin()
    const { data: conv } = await db
      .from('whatsapp_conversations')
      .select('wa_phone')
      .eq('id', conversationId)
      .single()

    if (!conv) return NextResponse.json({ error: 'Conversație negăsită' }, { status: 404 })

    const waPhone = (conv as any).wa_phone

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
          type: 'template',
          template: {
            name: templateName,
            language: { code: languageCode || 'ro' },
          },
        }),
      }
    )

    const metaData = await metaRes.json()
    console.log('TEMPLATE RESPONSE:', JSON.stringify(metaData))

    if (!metaRes.ok) {
      return NextResponse.json({ error: metaData.error?.message || 'Eroare Meta API' }, { status: 400 })
    }

    const waMessageId = metaData.messages?.[0]?.id

    // Salvează mesajul template în conversație
    await db.from('whatsapp_messages').insert({
      conversation_id: conversationId,
      wa_message_id: waMessageId,
      direction: 'outbound',
      message_type: 'template',
      body: `[Template: ${templateName}]`,
      status: 'sent',
      sent_by: user.id,
    } as any)

    await db.from('whatsapp_conversations').update({
      last_message: `[Template: ${templateName}]`,
      last_message_at: new Date().toISOString(),
    } as any).eq('id', conversationId)

    return NextResponse.json({ success: true, messageId: waMessageId })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
