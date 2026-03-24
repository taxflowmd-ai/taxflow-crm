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

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { data: { user } } = await getSupabase().auth.getUser()
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 })

  const body = await req.json()
  const db = admin()

  // Citește statusul curent înainte de update
  const { data: current } = await db
    .from('leads')
    .select('status')
    .eq('id', params.id)
    .single()

  // Execută update-ul
  const { data, error } = await db
    .from('leads')
    .update(body)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Dacă statusul s-a schimbat — înregistrează în istoric
  if (body.status && current?.status && body.status !== current.status) {
    await db.from('lead_history').insert({
      lead_id: params.id,
      type: 'status_change',
      action: `Status schimbat: ${current.status} → ${body.status}`,
      content: `Status schimbat: ${current.status} → ${body.status}`,
      created_by: user.id,
      user_id: user.id,
    })
  }

  return NextResponse.json({ data })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { data: { user } } = await getSupabase().auth.getUser()
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 })

  const { error } = await admin().from('leads').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
