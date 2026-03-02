import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

const admin = () => createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 })

  const { leadId, phone, name } = await req.json()
  if (!phone) return NextResponse.json({ error: 'Telefon lipsă' }, { status: 400 })

  const db = admin()
  const cleanPhone = phone.replace(/\D/g, '')

  // Caută conversație existentă
  const { data: existing } = await db
    .from('whatsapp_conversations')
    .select('id')
    .eq('wa_phone', cleanPhone)
    .single()

  if (existing) {
    if (leadId) {
      await db.from('whatsapp_conversations')
        .update({ lead_id: leadId, wa_name: name } as any)
        .eq('id', (existing as any).id)
    }
    return NextResponse.json({ conversationId: (existing as any).id })
  }

  // Creează conversație nouă
  const { data: newConv, error } = await db
    .from('whatsapp_conversations')
    .insert({
      wa_phone: cleanPhone,
      wa_name: name || cleanPhone,
      lead_id: leadId || null,
      unread_count: 0,
    } as any)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ conversationId: (newConv as any).id })
}
