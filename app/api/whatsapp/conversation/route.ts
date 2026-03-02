import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient as createAdmin } from '@supabase/supabase-js'

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
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
}

export async function POST(req: NextRequest) {
  const { data: { user } } = await getSupabase().auth.getUser()
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 })

  const { leadId, phone, name } = await req.json()
  if (!phone) return NextResponse.json({ error: 'Telefon lipsă' }, { status: 400 })

  const db = admin()
  const cleanPhone = phone.replace(/\D/g, '')

  const { data: existing } = await db.from('whatsapp_conversations').select('id').eq('wa_phone', cleanPhone).single()

  if (existing) {
    if (leadId) await db.from('whatsapp_conversations').update({ lead_id: leadId, wa_name: name } as any).eq('id', (existing as any).id)
    return NextResponse.json({ conversationId: (existing as any).id })
  }

  const { data: newConv, error } = await db.from('whatsapp_conversations').insert({
    wa_phone: cleanPhone, wa_name: name || cleanPhone,
    lead_id: leadId || null, unread_count: 0,
  } as any).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ conversationId: (newConv as any).id })
}
