'use client'
// app/(app)/admin/users/UsersClient.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Profile, Invitation } from '@/lib/supabase/types'
import { toast } from 'sonner'
import {
  UserPlus, Mail, ShieldCheck, User, CheckCircle,
  XCircle, Clock, Loader2, Send, Copy, MoreVertical,
  PowerOff, Power
} from 'lucide-react'
import { format } from 'date-fns'
import { ro } from 'date-fns/locale'

interface Props {
  currentUserId: string
  users: Profile[]
  invitations: (Invitation & { inviter: { full_name: string } | null })[]
}

const AVATAR_COLORS = [
  '#3a7bd5','#e05050','#c9a84c','#8b5cf6',
  '#00c48c','#f97316','#ec4899','#06b6d4',
]

export default function UsersClient({ currentUserId, users, invitations }: Props) {
  const router = useRouter()
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'user' | 'admin'>('user')
  const [inviteSending, setInviteSending] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  async function handleSendInvite() {
    if (!inviteEmail) return
    setInviteSending(true)
    try {
      const res = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success(`Invitație trimisă la ${inviteEmail}`)
      setShowInviteModal(false)
      setInviteEmail('')
      router.refresh()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setInviteSending(false)
    }
  }

  async function handleToggleUser(userId: string, currentActive: boolean, name: string) {
    setToggling(userId)
    try {
      const res = await fetch(`/api/admin/users/${userId}/toggle`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success(json.is_active ? `${name} — cont reactivat` : `${name} — cont dezactivat`)
      router.refresh()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setToggling(null)
    }
  }

  const activeUsers = users.filter(u => u.is_active)
  const inactiveUsers = users.filter(u => !u.is_active)

  return (
    <div className="flex-1 overflow-auto">
      {/* Topbar */}
      <div className="bg-white border-b border-gray-200 px-6 h-14 flex items-center justify-between flex-shrink-0">
        <h1 className="text-base font-semibold text-gray-900">Echipă & Utilizatori</h1>
        <button onClick={() => setShowInviteModal(true)} className="btn-primary">
          <UserPlus size={15} />
          Invită utilizator
        </button>
      </div>

      <div className="p-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard icon={<User size={18} />} label="Total utilizatori" value={users.length} color="blue" />
          <StatCard icon={<CheckCircle size={18} />} label="Conturi active" value={activeUsers.length} color="green" />
          <StatCard icon={<Clock size={18} />} label="Invitații în așteptare" value={invitations.length} color="amber" />
        </div>

        {/* Utilizatori activi */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <CheckCircle size={15} className="text-green-500" />
            Utilizatori activi ({activeUsers.length})
          </h2>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Utilizator</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Rol</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Înregistrat</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Ultima autentificare</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Acțiuni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activeUsers.map(u => (
                  <UserRow
                    key={u.id}
                    user={u}
                    isSelf={u.id === currentUserId}
                    toggling={toggling === u.id}
                    onToggle={() => handleToggleUser(u.id, u.is_active, u.full_name)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Invitații în așteptare */}
        {invitations.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Clock size={15} className="text-amber-500" />
              Invitații în așteptare ({invitations.length})
            </h2>
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Rol</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Invitat de</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Expiră</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invitations.map(inv => (
                    <tr key={inv.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Mail size={14} className="text-gray-400 flex-shrink-0" />
                          <span className="text-sm font-medium text-gray-900">{inv.email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <RoleBadge role={inv.role as 'admin' | 'user'} />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {inv.inviter?.full_name || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-amber-600 font-medium">
                        {format(new Date(inv.expires_at), 'd MMM yyyy', { locale: ro })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Utilizatori dezactivați */}
        {inactiveUsers.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <XCircle size={15} className="text-red-400" />
              Conturi dezactivate ({inactiveUsers.length})
            </h2>
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Utilizator</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Rol</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Înregistrat</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Acțiuni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 opacity-60">
                  {inactiveUsers.map(u => (
                    <UserRow
                      key={u.id}
                      user={u}
                      isSelf={false}
                      toggling={toggling === u.id}
                      onToggle={() => handleToggleUser(u.id, u.is_active, u.full_name)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

      </div>

      {/* Modal Invitație */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-base font-semibold">Invită utilizator nou</h2>
              <button onClick={() => setShowInviteModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="label">Email *</label>
                <input
                  type="email"
                  className="input"
                  placeholder="maria@taxflow.md"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="label">Rol *</label>
                <div className="grid grid-cols-2 gap-3 mt-1">
                  <RoleOption
                    value="user"
                    selected={inviteRole === 'user'}
                    onClick={() => setInviteRole('user')}
                    icon={<User size={18} />}
                    label="Utilizator"
                    desc="Vede doar lead-urile proprii"
                  />
                  <RoleOption
                    value="admin"
                    selected={inviteRole === 'admin'}
                    onClick={() => setInviteRole('admin')}
                    icon={<ShieldCheck size={18} />}
                    label="Administrator"
                    desc="Acces complet + gestionare echipă"
                  />
                </div>
              </div>

              <div className="bg-[#e8f0ee] rounded-lg p-3 text-xs text-[#004437]">
                <p className="font-medium mb-1">📧 Ce se întâmplă:</p>
                <ol className="space-y-1 list-decimal list-inside text-[#004437]/80">
                  <li>Se trimite un email cu link de înregistrare</li>
                  <li>Link-ul expiră în 7 zile</li>
                  <li>Utilizatorul setează parola și are acces imediat</li>
                </ol>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setShowInviteModal(false)} className="btn-ghost">Anulează</button>
              <button
                onClick={handleSendInvite}
                disabled={inviteSending || !inviteEmail}
                className="btn-primary"
              >
                {inviteSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {inviteSending ? 'Se trimite...' : 'Trimite invitația'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── SUB-COMPONENTE ────────────────────────────────────────────

function UserRow({
  user, isSelf, toggling, onToggle
}: {
  user: Profile
  isSelf: boolean
  toggling: boolean
  onToggle: () => void
}) {
  const initials = user.full_name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{ background: user.avatar_color }}
          >
            {initials}
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
              {user.full_name}
              {isSelf && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">tu</span>}
            </div>
            <div className="text-xs text-gray-500">{user.email}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <RoleBadge role={user.role} />
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {format(new Date(user.created_at), 'd MMM yyyy', { locale: ro })}
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">
        {user.last_login_at
          ? format(new Date(user.last_login_at), 'd MMM · HH:mm', { locale: ro })
          : <span className="text-gray-400">Niciodată</span>}
      </td>
      <td className="px-4 py-3">
        {!isSelf && (
          <button
            onClick={onToggle}
            disabled={toggling}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              user.is_active
                ? 'bg-red-50 text-red-600 hover:bg-red-100'
                : 'bg-green-50 text-green-700 hover:bg-green-100'
            }`}
          >
            {toggling
              ? <Loader2 size={12} className="animate-spin" />
              : user.is_active
                ? <PowerOff size={12} />
                : <Power size={12} />
            }
            {user.is_active ? 'Dezactivează' : 'Reactivează'}
          </button>
        )}
      </td>
    </tr>
  )
}

function RoleBadge({ role }: { role: 'admin' | 'user' }) {
  return role === 'admin' ? (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[#e8f0ee] text-[#004437]">
      <ShieldCheck size={11} /> Administrator
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
      <User size={11} /> Utilizator
    </span>
  )
}

function RoleOption({
  value, selected, onClick, icon, label, desc
}: {
  value: string; selected: boolean; onClick: () => void
  icon: React.ReactNode; label: string; desc: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-3 rounded-xl border-2 text-left transition-all ${
        selected
          ? 'border-[#004437] bg-[#e8f0ee]'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className={`mb-1 ${selected ? 'text-[#004437]' : 'text-gray-500'}`}>{icon}</div>
      <div className="text-sm font-semibold text-gray-900">{label}</div>
      <div className="text-xs text-gray-500 mt-0.5 leading-snug">{desc}</div>
    </button>
  )
}

function StatCard({
  icon, label, value, color
}: {
  icon: React.ReactNode; label: string; value: number
  color: 'blue' | 'green' | 'amber'
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-[#e8f0ee] text-[#004437]',
    amber: 'bg-amber-50 text-amber-600',
  }
  return (
    <div className="card p-4">
      <div className={`inline-flex p-2 rounded-lg ${colors[color]} mb-3`}>{icon}</div>
      <div className="text-2xl font-bold text-gray-900 font-serif">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}
