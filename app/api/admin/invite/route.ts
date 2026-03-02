// app/api/admin/invite/route.ts
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { sendInvitationEmail } from '@/lib/email'

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

export async function POST(request: Request) {
  try {
    const supabase = getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

    const { data: profileData } = await (supabase as any)
      .from('profiles').select('role, full_name, is_active').eq('id', user.id).single()

    const profile = profileData as { role: string; full_name: string; is_active: boolean } | null
    if (profile?.role !== 'admin' || !profile?.is_active) {
      return NextResponse.json({ error: 'Acces interzis' }, { status: 403 })
    }

    const { email, role } = await request.json()
    if (!email || !role) return NextResponse.json({ error: 'Date incomplete' }, { status: 400 })

    const db = adminClient()

    const { data: existing } = await db.from('profiles').select('id').eq('email', email).single()
    if (existing) return NextResponse.json({ error: 'Există deja un cont cu acest email' }, { status: 409 })

    const { data: existingInvite } = await db.from('invitations').select('id')
      .eq('email', email).is('accepted_at', null).gt('expires_at', new Date().toISOString()).single()
    if (existingInvite) return NextResponse.json({ error: 'Există deja o invitație activă' }, { status: 409 })

    const { data: invite, error: invErr } = await db.from('invitations')
      .insert({ email, role, invited_by: user.id } as any).select().single()
    if (invErr || !invite) throw new Error((invErr as any)?.message || 'Eroare creare invitație')

    const inviteData = invite as { token: string; id: string }
    await sendInvitationEmail({ to: email, token: inviteData.token, invitedByName: profile.full_name, role })

    return NextResponse.json({ success: true, inviteId: inviteData.id })
  } catch (err: any) {
    console.error('invite error:', err)
    return NextResponse.json({ error: err.message || 'Eroare server' }, { status: 500 })
  }
}
