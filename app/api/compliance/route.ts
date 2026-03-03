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

// PATCH - update status unui raport
export async function PATCH(req: NextRequest) {
  const { data: { user } } = await getSupabase().auth.getUser()
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 })

  const { leadId, reportTypeId, year, month, status, note } = await req.json()
  const db = admin()

  const { data, error } = await db.from('compliance_reports').upsert({
    lead_id: leadId,
    report_type_id: reportTypeId,
    year, month, status,
    note: note || null,
    completed_at: status === 'done' ? new Date().toISOString() : null,
    completed_by: status === 'done' ? user.id : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'lead_id,report_type_id,year,month' }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// POST - setează obligațiile unui client
export async function POST(req: NextRequest) {
  const { data: { user } } = await getSupabase().auth.getUser()
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 })

  const { leadId, reportTypeIds } = await req.json()
  const db = admin()

  // Șterge obligațiile vechi
  await db.from('client_obligations').delete().eq('lead_id', leadId)

  // Inserează obligațiile noi
  if (reportTypeIds.length > 0) {
    const rows = reportTypeIds.map((id: string) => ({ lead_id: leadId, report_type_id: id }))
    const { error } = await db.from('client_obligations').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
