// app/api/admin/users/[id]/toggle/route.ts
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendAccountDeactivatedEmail, sendAccountReactivatedEmail } from '@/lib/email'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

    const { data: adminData } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single()

    const adminProfile = adminData as { role: string; is_active: boolean } | null

    if (adminProfile?.role !== 'admin' || !adminProfile?.is_active) {
      return NextResponse.json({ error: 'Acces interzis' }, { status: 403 })
    }

    if (params.id === user.id) {
      return NextResponse.json({ error: 'Nu poți dezactiva propriul cont' }, { status: 400 })
    }

    const adminSupabase = createAdminClient()

    const { data: targetData, error: profileErr } = await (adminSupabase as any)
      .from('profiles')
      .select('full_name, email, is_active')
      .eq('id', params.id)
      .single()

    const targetProfile = targetData as { full_name: string; email: string; is_active: boolean } | null

    if (profileErr || !targetProfile) {
      return NextResponse.json({ error: 'Utilizator negăsit' }, { status: 404 })
    }

    const newStatus = !targetProfile.is_active

    await (adminSupabase as any)
      .from('profiles')
      .update({ is_active: newStatus })
      .eq('id', params.id)

    if (!newStatus) {
      await adminSupabase.auth.admin.signOut(params.id)
      await sendAccountDeactivatedEmail(targetProfile.email, targetProfile.full_name)
    } else {
      await sendAccountReactivatedEmail(targetProfile.email, targetProfile.full_name)
    }

    return NextResponse.json({ success: true, is_active: newStatus })
  } catch (err: any) {
    console.error('toggle user error:', err)
    return NextResponse.json({ error: err.message || 'Eroare server' }, { status: 500 })
  }
}
