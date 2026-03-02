'use client'
// components/layout/Sidebar.tsx

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/supabase/types'
import {
  LayoutDashboard, Target, Users, CheckSquare,
  Calendar, MessageCircle, Upload, Settings,
  LogOut, Bell, ShieldCheck
} from 'lucide-react'
import { toast } from 'sonner'
import clsx from 'clsx'

interface Props {
  profile: Pick<Profile, 'id' | 'full_name' | 'email' | 'role' | 'avatar_color'>
}

// Nav items pentru USER
const userNav = [
  { label: 'Dashboard',   href: '/dashboard',  icon: LayoutDashboard },
  { label: 'Pipeline',    href: '/pipeline',   icon: Target },
  { label: 'Contacte',    href: '/contacts',   icon: Users },
  { label: 'Sarcini',     href: '/tasks',      icon: CheckSquare },
  { label: 'Evenimente',  href: '/events',     icon: Calendar },
  { label: 'WhatsApp',    href: '/whatsapp',   icon: MessageCircle },
  { label: 'Import',      href: '/import',     icon: Upload },
]

// Nav items EXTRA pentru ADMIN
const adminNav = [
  { label: 'Echipă & Utilizatori', href: '/admin/users', icon: ShieldCheck },
]

export default function Sidebar({ profile }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const isAdmin = profile.role === 'admin'

  const initials = profile.full_name
    .split(' ')
    .map(w => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success('La revedere!')
    router.push('/auth/login')
    router.refresh()
  }

  const allNav = isAdmin ? [...userNav, ...adminNav] : userNav

  return (
    <aside className="w-[220px] min-w-[220px] bg-[#002e25] flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/[0.08]">
        <div className="font-serif text-xl text-white tracking-tight">TaxFlow</div>
        <div className="text-[10px] text-white/40 uppercase tracking-[1.5px] mt-0.5">
          CRM · Partner financiar
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2.5 py-4 overflow-y-auto scrollbar-thin space-y-0.5">
        {/* Secțiune: Principal */}
        <p className="text-[10px] uppercase tracking-[1.2px] text-white/30 font-medium px-2.5 py-2">
          Principal
        </p>
        {userNav.slice(0, 3).map(item => (
          <NavItem key={item.href} {...item} active={pathname.startsWith(item.href)} />
        ))}

        {/* Secțiune: Activitate */}
        <p className="text-[10px] uppercase tracking-[1.2px] text-white/30 font-medium px-2.5 py-2 mt-2">
          Activitate
        </p>
        {userNav.slice(3, 5).map(item => (
          <NavItem key={item.href} {...item} active={pathname.startsWith(item.href)} />
        ))}

        {/* Secțiune: Instrumente */}
        <p className="text-[10px] uppercase tracking-[1.2px] text-white/30 font-medium px-2.5 py-2 mt-2">
          Instrumente
        </p>
        {userNav.slice(5).map(item => (
          <NavItem key={item.href} {...item} active={pathname.startsWith(item.href)} />
        ))}

        {/* Secțiune: Admin — VIZIBIL DOAR PENTRU ADMIN */}
        {isAdmin && (
          <>
            <p className="text-[10px] uppercase tracking-[1.2px] text-white/30 font-medium px-2.5 py-2 mt-2">
              Administrare
            </p>
            {adminNav.map(item => (
              <NavItem key={item.href} {...item} active={pathname.startsWith(item.href)} />
            ))}
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="px-4 py-3.5 border-t border-white/[0.08] flex items-center gap-2.5">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
          style={{ background: profile.avatar_color }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] text-white font-medium truncate">{profile.full_name}</div>
          <div className="text-[11px] text-white/40 truncate">
            {isAdmin ? '⚡ Administrator' : 'Utilizator'}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleLogout}
            className="text-white/40 hover:text-white/80 transition-colors p-1"
            title="Ieșire"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  )
}

function NavItem({
  href, label, icon: Icon, active
}: {
  href: string; label: string; icon: any; active: boolean
}) {
  return (
    <Link
      href={href}
      className={clsx(
        'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] transition-all',
        active
          ? 'bg-[#00c48c]/15 text-[#00c48c] font-medium'
          : 'text-white/60 hover:bg-white/[0.07] hover:text-white'
      )}
    >
      <Icon size={16} className="flex-shrink-0" />
      {label}
    </Link>
  )
}
