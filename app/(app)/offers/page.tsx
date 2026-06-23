// app/(app)/offers/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OffersClient from './OffersClient'

export default async function OffersPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profileData } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const profile = profileData as { role: string } | null
  const isAdmin = profile?.role === 'admin'

  const { data: teamData } = isAdmin
    ? await supabase.from('profiles').select('id, full_name, avatar_color').eq('is_active', true)
    : { data: [] }

  return (
    <OffersClient
      isAdmin={isAdmin}
      team={(teamData || []) as any[]}
    />
  )
}
