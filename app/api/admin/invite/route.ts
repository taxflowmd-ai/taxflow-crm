// app/api/admin/invite/route.ts
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendInvitationEmail } from '@/lib/email'

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

    const { data: profileData } = await supabase
      .from('profiles')
      .select('role, full_name, is_active')
      .eq('id', user.id)
      .single()

    const profile = profileData as { role: string; full_name: string; is_active: boolean } | null

    if (profile?.role !== 'admin' || !profile?.is_active) {
      return NextResponse.json({ error: 'Acces interzis' }, { status: 403 })
    }

    const { email, role } = await request.json()
    if (!email || !role) return NextResponse.json({ error: 'Date incomplete' }, { status: 400 })

    const adminSupabase = createAdminClient()

    const { data: existing } = await (adminSupabase as any)
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Există deja un cont cu acest email' }, { status: 409 })
    }

    const { data: existingInvite } = await (adminSupabase as any)
      .from('invitations')
      .select('id')
      .eq('email', email)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (existingInvite) {
      return NextResponse.json({ error: 'Există deja o invitație activă pentru acest email' }, { status: 409 })
    }

    const { data: invite, error: invErr } = await (adminSupabase as any)
      .from('invitations')
      .insert({ email, role, invited_by: user.id })
      .select()
      .single()

    if (invErr || !invite) {
      throw new Error(invErr?.message || 'Eroare creare invitație')
    }

    const inviteData = invite as { token: string; id: string }

    await sendInvitationEmail({
      to: email,
      token: inviteData.token,
      invitedByName: profile.full_name,
      role,
    })

    return NextResponse.json({ success: true, inviteId: inviteData.id })
  } catch (err: any) {
    console.error('invite error:', err)
    return NextResponse.json({ error: err.message || 'Eroare server' }, { status: 500 })
  }
}
