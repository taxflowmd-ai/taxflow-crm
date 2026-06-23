// app/api/qualification/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { computeQualification, QualificationAnswers } from '@/lib/qualification/scoring'

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

// GET - obține calificarea unui client
export async function GET(req: NextRequest) {
  const { data: { user } } = await getSupabase().auth.getUser()
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 })

  const leadId = req.nextUrl.searchParams.get('lead_id')
  if (!leadId) return NextResponse.json({ error: 'lead_id necesar' }, { status: 400 })

  const { data, error } = await admin()
    .from('client_qualifications')
    .select('*')
    .eq('lead_id', leadId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } })
}

// POST - salvează/actualizează calificarea (upsert)
export async function POST(req: NextRequest) {
  const { data: { user } } = await getSupabase().auth.getUser()
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 })

  const body = await req.json()
  const { lead_id, ...answers } = body as { lead_id: string } & QualificationAnswers

  if (!lead_id) return NextResponse.json({ error: 'lead_id necesar' }, { status: 400 })

  const result = computeQualification(answers)

  const payload = {
    lead_id,
    employees: answers.employees || null,
    revenue: answers.revenue || null,
    vat_regime: answers.vat_regime || null,
    activities_count: answers.activities_count || null,
    monthly_documents: answers.monthly_documents || null,
    current_reporting: answers.current_reporting || null,
    financial_decision_basis: answers.financial_decision_basis || null,
    financial_manager: answers.financial_manager || null,
    main_expectation: answers.main_expectation || null,
    delegation_level: answers.delegation_level || null,
    structure_reaction: answers.structure_reaction || null,
    special_project: answers.special_project || null,
    score_dimension: result.scoreDimension,
    score_complexity: result.scoreComplexity,
    score_maturity: result.scoreMaturity,
    score_fit: result.scoreFit,
    overall_score: result.overallScore,
    recommended_package: result.recommendedPackage || null,
    risk_flags: result.riskFlags.join('; ') || null,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await admin()
    .from('client_qualifications')
    .upsert(payload, { onConflict: 'lead_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, result })
}
