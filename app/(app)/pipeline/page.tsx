// app/(app)/pipeline/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PipelineClient from './PipelineClient'

export default async function PipelinePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profileData } = await supabase
    .from('profiles').select('role, full_name').eq('id', user.id).single()
  const profile = profileData as { role: string; full_name: string } | null

  const { data: leadsData } = await supabase
    .from('leads')
    .select('*, assignee:assigned_to(id, full_name, avatar_color)')
    .order('created_at', { ascending: false })

  const { data: teamData } = profile?.role === 'admin'
    ? await supabase.from('profiles').select('id, full_name, avatar_color').eq('is_active', true)
    : { data: [] }

  const leads = (leadsData || []) as any[]
  const team = (teamData || []) as any[]

  return <PipelineClient leads={leads} team={team} isAdmin={profile?.role === 'admin'} currentUserId={user.id} />
}
