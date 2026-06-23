// app/api/offers/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { syncLeadStatusOnOfferSent } from '@/lib/offers/sync-lead-status'

export const dynamic = 'force-dynamic'

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
    { cookies: { getAll() { return (cookieStore as any).getAll() }, setAll() {} } }
  )
}

// GET - lista oferte (cu filtru opțional lead_id sau status)
export async function GET(req: NextRequest) {
  const { data: { user } } = await getSupabase().auth.getUser()
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 })

  const leadId = req.nextUrl.searchParams.get('lead_id')
  const status = req.nextUrl.searchParams.get('status')

  let query = admin()
    .from('offers')
    .select('*, lead:lead_id(name,company,phone,email), template:template_id(name,package_type)')
    .order('created_at', { ascending: false })

  if (leadId) query = query.eq('lead_id', leadId)
  if (status && status !== 'all') query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } })
}

// POST - creează ofertă nouă (draft sau direct trimisă)
export async function POST(req: NextRequest) {
  const { data: { user } } = await getSupabase().auth.getUser()
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 })

  const body = await req.json()
  const payload = {
    lead_id: body.lead_id,
    template_id: body.template_id || null,
    status: body.status || 'draft',
    sector: body.sector || null,
    problems_json: body.problems || [],
    content_json: body.content || {},
    excluded_json: body.excluded || [],
    price: body.price,
    price_unit: body.price_unit || 'MDL/lună',
    contract_months: body.contract_months || 6,
    valid_until: body.valid_until || null,
    sent_at: body.status === 'sent' ? new Date().toISOString() : null,
    created_by: user.id,
  }

  const { data, error } = await admin().from('offers').insert(payload).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (payload.status === 'sent') {
    await syncLeadStatusOnOfferSent(admin(), payload.lead_id, user.id)
  }

  return NextResponse.json({ data })
}

// PATCH - actualizează ofertă (status, conținut)
export async function PATCH(req: NextRequest) {
  const { data: { user } } = await getSupabase().auth.getUser()
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 })

  const { id, ...fields } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID lipsă' }, { status: 400 })

  const updates: any = { ...fields, updated_at: new Date().toISOString() }
  if (fields.status === 'sent' && !fields.sent_at) {
    updates.sent_at = new Date().toISOString()
  }

  const { data, error } = await admin().from('offers').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (fields.status === 'sent' && data?.lead_id) {
    await syncLeadStatusOnOfferSent(admin(), data.lead_id, user.id)
  }

  return NextResponse.json({ data })
}

// DELETE - șterge ofertă
export async function DELETE(req: NextRequest) {
  const { data: { user } } = await getSupabase().auth.getUser()
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 })

  const { id } = await req.json()
  const { error } = await admin().from('offers').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
