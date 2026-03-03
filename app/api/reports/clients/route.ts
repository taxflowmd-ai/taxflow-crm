import { NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

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
  return NextResponse.json({ data })
}
