// app/api/banking/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c: { name: string; value: string; options?: any }[]) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  )
}

// GET /api/banking?leadId=xxx
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const leadId = req.nextUrl.searchParams.get('leadId')
  if (!leadId) return NextResponse.json({ error: 'leadId required' }, { status: 400 })

  const { data: banks, error } = await (supabase as any)
    .from('client_banking')
    .select('*, users:client_banking_users(*)')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: banks })
}

// POST /api/banking — adaugă bancă nouă
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { lead_id, bank_name } = body

  const { data, error } = await (supabase as any)
    .from('client_banking')
    .insert({ lead_id, bank_name })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// PATCH /api/banking — update bancă sau user
export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { type, id, ...fields } = body

  if (type === 'bank') {
    if (fields.updated_at !== undefined) delete fields.updated_at
    const { error } = await (supabase as any)
      .from('client_banking')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else if (type === 'user') {
    if (fields.password !== undefined) fields.password_updated_at = new Date().toISOString()
    const { error } = await (supabase as any)
      .from('client_banking_users')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// DELETE /api/banking
export async function DELETE(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verifică dacă e admin
  const { data: prof } = await (supabase as any).from('profiles').select('role').eq('id', user.id).single()
  if ((prof as any)?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { type, id } = body

  if (type === 'bank') {
    await (supabase as any).from('client_banking_users').delete().eq('banking_id', id)
    await (supabase as any).from('client_banking').delete().eq('id', id)
  } else if (type === 'user') {
    await (supabase as any).from('client_banking_users').delete().eq('id', id)
  }

  return NextResponse.json({ ok: true })
}
