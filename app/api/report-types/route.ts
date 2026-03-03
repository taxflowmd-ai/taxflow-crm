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

// POST - adaugă tip nou
export async function POST(req: NextRequest) {
  const { data: { user } } = await getSupabase().auth.getUser()
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 })
  const { code, label, sort_order } = await req.json()
  if (!code || !label) return NextResponse.json({ error: 'Cod și denumire obligatorii' }, { status: 400 })
  const { data, error } = await admin().from('report_types').insert({ code: code.toUpperCase().trim(), label: label.trim(), sort_order: sort_order || 99 }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// PATCH - editează tip existent
export async function PATCH(req: NextRequest) {
  const { data: { user } } = await getSupabase().auth.getUser()
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 })
  const { id, code, label, sort_order } = await req.json()
  const { data, error } = await admin().from('report_types').update({ code: code.toUpperCase().trim(), label: label.trim(), sort_order }).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// DELETE - șterge tip
export async function DELETE(req: NextRequest) {
  const { data: { user } } = await getSupabase().auth.getUser()
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 })
  const { id } = await req.json()
  const { error } = await admin().from('report_types').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
