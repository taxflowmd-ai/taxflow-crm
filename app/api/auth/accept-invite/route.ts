// app/api/auth/accept-invite/route.ts

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { token, email, password, fullName, role } = body

    if (!token || !email || !password || !fullName) {
      return NextResponse.json({ error: 'Date incomplete' }, { status: 400 })
    }

    // Admin client fără tipuri generice
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verifică invitația
    const { data: inviteData, error: invErr } = await supabase
      .from('invitations')
      .select('id, email, accepted_at, expires_at')
      .eq('token', token)
      .single()

    if (invErr || !inviteData) {
      return NextResponse.json({ error: 'Token invalid' }, { status: 400 })
    }

    const invite = inviteData as any

    if (invite.accepted_at) {
      return NextResponse.json({ error: 'Invitație deja folosită' }, { status: 400 })
    }
    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Invitație expirată' }, { status: 400 })
    }
    if (invite.email !== email) {
      return NextResponse.json({ error: 'Email nepotrivit' }, { status: 400 })
    }

    // Creează utilizatorul în Supabase Auth
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: role || 'user' },
    })

    if (authErr) {
      if (authErr.message.includes('already registered')) {
        return NextResponse.json({ error: 'Există deja un cont cu acest email' }, { status: 409 })
      }
      return NextResponse.json({ error: authErr.message }, { status: 500 })
    }

    // Marchează invitația ca acceptată
    await supabase
      .from('invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('token', token)

    // Actualizează profilul cu rolul corect
    if (authData.user) {
      await supabase
        .from('profiles')
        .update({ role: role || 'user', full_name: fullName })
        .eq('id', authData.user.id)
    }

    return NextResponse.json({ success: true, userId: authData.user?.id })

  } catch (err: any) {
    console.error('accept-invite error:', err)
    return NextResponse.json({ error: err.message || 'Eroare server' }, { status: 500 })
  }
}
