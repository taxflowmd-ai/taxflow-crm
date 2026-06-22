import { NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

// Forțează ruta să fie dinamică — fără cache, mereu date proaspete din DB
export const dynamic = 'force-dynamic'
export const revalidate = 0

const admin = () => createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET() {
  const { data } = await admin()
    .from('leads')
    .select('id,name,company,assigned_to')
    .eq('status', 'Client activ')
    .order('company')

  return NextResponse.json(
    { data },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  )
}
