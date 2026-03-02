// app/api/admin/users/[id]/toggle/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient as createAdmin } from '@supabase/supabase-js'

function getSupabase() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
}

const adminClient = () => createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

    const { data: profileData } = await (supabase as any)
      .from('profiles').select('role').eq('id', user.id).single()
    if ((profileData as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Acces interzis' }, { status: 403 })
    }

    const db = adminClient()
    const { data: target } = await db.from('profiles').select('is_active').eq('id', params.id).single()
    if (!target) return NextResponse.json({ error: 'Utilizator negăsit' }, { status: 404 })

    const newActive = !(target as any).is_active
    await db.from('profiles').update({ is_active: newActive } as any).eq('id', params.id)

    return NextResponse.json({ success: true, is_active: newActive })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
