// app/(app)/layout.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, is_active, avatar_color')
    .eq('id', user.id)
    .single()

  const profile = profileData as {
    id: string
    full_name: string
    email: string
    role: 'admin' | 'user'
    is_active: boolean
    avatar_color: string
  } | null

  if (!profile?.is_active) redirect('/auth/login?error=account_disabled')

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar profile={profile!} />
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  )
}
