// app/(app)/admin/users/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profile, Invitation } from '@/lib/supabase/types'
import UsersClient from './UsersClient'

export default async function AdminUsersPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  const profile = profileData as { role: string; full_name: string } | null
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: usersData } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  const users = (usersData || []) as Profile[]

  const { data: invitationsData } = await supabase
    .from('invitations')
    .select('*, inviter:invited_by(full_name)')
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  const invitations = (invitationsData || []) as (Invitation & { inviter: { full_name: string } | null })[]

  return (
    <UsersClient
      currentUserId={user.id}
      users={users}
      invitations={invitations}
    />
  )
}
