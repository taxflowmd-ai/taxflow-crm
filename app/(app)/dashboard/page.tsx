// app/(app)/dashboard/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import { ro } from 'date-fns/locale'
import Link from 'next/link'
import { Target, CheckSquare, Calendar, TrendingUp } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  const profile = profileData as { full_name: string; role: string } | null
  const isAdmin = profile?.role === 'admin'

  const today = new Date()
  const startOfDay = new Date(today); startOfDay.setHours(0,0,0,0)
  const endOfDay = new Date(today); endOfDay.setHours(23,59,59,999)

  const [
    { data: activeLeads },
    { data: todayEvents },
    { data: pendingTasks },
    { data: offers },
    { data: recentLeads },
  ] = await Promise.all([
    supabase.from('leads').select('id').neq('status', 'Pierdut').neq('status', 'Client activ'),
    supabase.from('events').select('id, title, type, starts_at').gte('starts_at', startOfDay.toISOString()).lte('starts_at', endOfDay.toISOString()).order('starts_at'),
    supabase.from('tasks').select('id, title, priority, due_at').eq('is_done', false).order('due_at'),
    supabase.from('leads').select('id').eq('status', 'Ofertă trimisă'),
    supabase.from('leads').select('id, name, company, status, source, created_at, assignee:assigned_to(full_name, avatar_color)').order('created_at', { ascending: false }).limit(5),
  ])

  const overdueCount = (pendingTasks || []).filter((t: any) => t.due_at && new Date(t.due_at) < today).length

  const days = ['Duminică','Luni','Marți','Miercuri','Joi','Vineri','Sâmbătă']
  const months = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie']

  return (
    <div className="flex-1 overflow-auto">
      <div className="bg-white border-b border-gray-200 px-6 h-14 flex items-center flex-shrink-0">
        <div>
          <h1 className="text-base font-semibold text-gray-900">
            Bună ziua, {profile?.full_name?.split(' ')[0]}! 👋
          </h1>
          <p className="text-xs text-gray-400">
            {days[today.getDay()]}, {today.getDate()} {months[today.getMonth()]} {today.getFullYear()}
            {!isAdmin && <span className="ml-2 text-[#004437] font-medium">· Afișezi doar datele tale</span>}
          </p>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-4 gap-4">
          <StatCard icon={<Target size={18} />} label="Lead-uri active" value={activeLeads?.length || 0} sub="în pipeline" color="green" />
          <StatCard icon={<Calendar size={18} />} label="Întâlniri azi" value={todayEvents?.length || 0} sub={(todayEvents as any)?.[0] ? format(new Date((todayEvents as any)[0].starts_at), 'HH:mm') : 'Nimic azi'} color="blue" />
          <StatCard icon={<CheckSquare size={18} />} label="Sarcini active" value={pendingTasks?.length || 0} sub={overdueCount > 0 ? `${overdueCount} expirate` : 'La zi ✓'} color={overdueCount > 0 ? 'red' : 'green'} />
          <StatCard icon={<TrendingUp size={18} />} label="Oferte trimise" value={offers?.length || 0} sub="Răspuns așteptat" color="amber" />
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Sarcini urgente</h2>
              <Link href="/tasks" className="text-xs text-[#004437] font-medium hover:underline">Toate →</Link>
            </div>
            <div>
              {(pendingTasks || []).slice(0, 5).map((t: any) => {
                const isOverdue = t.due_at && new Date(t.due_at) < today
                return (
                  <div key={t.id} className="px-4 py-3 border-b border-gray-100 last:border-0 flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${t.priority === 'high' ? 'bg-red-500' : t.priority === 'medium' ? 'bg-amber-400' : 'bg-green-400'}`} />
                    <span className="text-sm text-gray-800 flex-1 truncate">{t.title}</span>
                    {t.due_at && (
                      <span className={`text-xs flex-shrink-0 ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                        {format(new Date(t.due_at), 'd MMM', { locale: ro })}
                      </span>
                    )}
                  </div>
                )
              })}
              {!pendingTasks?.length && <div className="px-4 py-8 text-center text-sm text-gray-400">Nicio sarcină activă 🎉</div>}
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">
                {isAdmin ? 'Lead-uri recente (tot echipa)' : 'Lead-urile mele recente'}
              </h2>
              <Link href="/pipeline" className="text-xs text-[#004437] font-medium hover:underline">Pipeline →</Link>
            </div>
            <div>
              {(recentLeads || []).map((l: any) => {
                const statusColors: Record<string,string> = {'Nou':'#94a3b8','Contactat':'#3a7bd5','Întâlnire programată':'#c9a84c','Ofertă trimisă':'#8b5cf6','Client activ':'#00c48c','Pierdut':'#e05050'}
                return (
                  <div key={l.id} className="px-4 py-3 border-b border-gray-100 last:border-0 flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: statusColors[l.status] || '#94a3b8' }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{l.name}</div>
                      <div className="text-xs text-gray-400">{l.company || l.source}</div>
                    </div>
                    {isAdmin && l.assignee && (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0" style={{ background: l.assignee.avatar_color }} title={l.assignee.full_name}>
                        {l.assignee.full_name.split(' ').map((w: string) => w[0]).join('').substring(0,2)}
                      </div>
                    )}
                  </div>
                )
              })}
              {!recentLeads?.length && <div className="px-4 py-8 text-center text-sm text-gray-400">Niciun lead încă</div>}
            </div>
          </div>
        </div>

        {(todayEvents?.length || 0) > 0 && (
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Evenimente azi</h2>
              <Link href="/events" className="text-xs text-[#004437] font-medium hover:underline">Calendar →</Link>
            </div>
            <div className="flex flex-wrap gap-3 p-4">
              {(todayEvents || []).map((e: any) => (
                <div key={e.id} className="flex items-center gap-2 bg-[#e8f0ee] rounded-lg px-3 py-2">
                  <span>{e.type === 'meeting' ? '🤝' : e.type === 'call' ? '📞' : '⏰'}</span>
                  <div>
                    <div className="text-xs font-semibold text-[#004437]">{e.title}</div>
                    <div className="text-xs text-[#004437]/60">{format(new Date(e.starts_at), 'HH:mm')}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: number; sub: string; color: 'green'|'blue'|'red'|'amber' }) {
  const top = { green:'bg-[#00c48c]', blue:'bg-blue-500', red:'bg-red-500', amber:'bg-amber-400' }
  const ico = { green:'bg-[#e8f0ee] text-[#004437]', blue:'bg-blue-50 text-blue-600', red:'bg-red-50 text-red-500', amber:'bg-amber-50 text-amber-600' }
  return (
    <div className="card relative overflow-hidden">
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${top[color]}`} />
      <div className="p-4">
        <div className={`inline-flex p-2 rounded-lg mb-3 ${ico[color]}`}>{icon}</div>
        <div className="text-2xl font-bold text-gray-900 font-serif">{value}</div>
        <div className="text-xs text-gray-500 mt-0.5">{label}</div>
        <div className={`text-xs mt-1 font-medium ${color === 'red' && sub.includes('expir') ? 'text-red-500' : 'text-gray-400'}`}>{sub}</div>
      </div>
    </div>
  )
}
