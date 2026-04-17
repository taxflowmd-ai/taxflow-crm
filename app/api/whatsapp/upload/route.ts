// app/api/whatsapp/upload/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const admin = () => createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

function getSupabase() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return (cookieStore as any).getAll() },
        setAll(c: { name: string; value: string; options?: any }[]) {
          c.forEach(({ name, value, options }) => (cookieStore as any).set(name, value, options))
        }
      }
    }
  )
}

export async function POST(req: NextRequest) {
  try {
    const { data: { user } } = await getSupabase().auth.getUser()
    if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File
    const conversationId = formData.get('conversationId') as string

    if (!file || !conversationId) {
      return NextResponse.json({ error: 'Date lipsă' }, { status: 400 })
    }

    const db = admin()

    // Validare tip fișier
    const allowedTypes = ['image/jpeg','image/png','image/webp','image/gif','application/pdf',
      'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: `Tip fișier nepermis: ${file.type}` }, { status: 400 })
    }

    // Validare dimensiune (max 16MB)
    if (file.size > 16 * 1024 * 1024) {
      return NextResponse.json({ error: 'Fișierul depășește 16MB' }, { status: 400 })
    }

    // Obține conversația pentru wa_phone
    const { data: conv } = await db
      .from('whatsapp_conversations')
      .select('wa_phone')
      .eq('id', conversationId)
      .single()

    if (!conv) return NextResponse.json({ error: 'Conversație negăsită' }, { status: 404 })

    // Step 1: Upload fișier spre Meta pentru a obține media_id
    const metaFormData = new FormData()
    metaFormData.append('file', file, file.name)
    metaFormData.append('type', file.type)
    metaFormData.append('messaging_product', 'whatsapp')

    const uploadRes = await fetch(
      `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/media`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` },
        body: metaFormData,
      }
    )

    const uploadData = await uploadRes.json()
    if (!uploadRes.ok) {
      return NextResponse.json({ error: uploadData.error?.message || 'Eroare upload Meta' }, { status: 400 })
    }

    const mediaId = uploadData.id

    // Step 2: Trimite fișierul spre destinatar
    const isImage = file.type.startsWith('image/')
    const messageType = isImage ? 'image' : 'document'

    const sendBody: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: (conv as any).wa_phone,
      type: messageType,
    }

    if (isImage) {
      sendBody.image = { id: mediaId, caption: file.name }
    } else {
      sendBody.document = { id: mediaId, filename: file.name }
    }

    const sendRes = await fetch(
      `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sendBody),
      }
    )

    const sendData = await sendRes.json()
    if (!sendRes.ok) {
      return NextResponse.json({ error: sendData.error?.message || 'Eroare trimitere' }, { status: 400 })
    }

    const waMessageId = sendData.messages?.[0]?.id
    const bodyText = isImage ? `📷 ${file.name}` : `📄 ${file.name}`

    // Salvează în DB
    await db.from('whatsapp_messages').insert({
      conversation_id: conversationId,
      wa_message_id: waMessageId,
      direction: 'outbound',
      message_type: messageType,
      body: bodyText,
      status: 'sent',
      sent_by: user.id,
    } as any)

    await db.from('whatsapp_conversations').update({
      last_message: bodyText,
      last_message_at: new Date().toISOString(),
    } as any).eq('id', conversationId)

    return NextResponse.json({ success: true, messageId: waMessageId })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
