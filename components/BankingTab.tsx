'use client'
import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import {
  Plus, Copy, Eye, EyeOff, Check, Pencil, Trash2,
  Building2, User, ChevronDown, ChevronUp, Lock,
  ToggleLeft, ToggleRight, KeyRound, X, Save
} from 'lucide-react'

interface BankingUser {
  id: string
  banking_id: string
  label: string
  login: string | null
  password: string | null
  password_envelope: string | null
  notes: string | null
  is_active: boolean
  password_updated_at: string | null
}

interface Bank {
  id: string
  lead_id: string
  bank_name: string
  is_active: boolean
  users: BankingUser[]
}

interface Props {
  leadId: string
  isAdmin: boolean
}

// Parola master pentru a vedea credențialele
const MASTER_PASSWORD = 'taxflow2024' // schimbă după implementare

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button onClick={copy} className="p-1 rounded text-gray-400 hover:text-[#004437] transition-colors" title="Copiază">
      {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
    </button>
  )
}

function PasswordField({ value, unlocked }: { value: string; unlocked: boolean }) {
  if (!value) return <span className="text-gray-300 text-xs italic">—</span>
  if (!unlocked) return <span className="text-gray-400 text-xs tracking-widest">••••••••</span>
  return <span className="text-xs font-mono text-gray-800 select-all">{value}</span>
}

export default function BankingTab({ leadId, isAdmin }: Props) {
  const [banks, setBanks] = useState<Bank[]>([])
  const [loading, setLoading] = useState(true)
  const [unlocked, setUnlocked] = useState(false)
  const [masterInput, setMasterInput] = useState('')
  const [showMasterInput, setShowMasterInput] = useState(false)
  const [masterError, setMasterError] = useState(false)
  const [expandedBanks, setExpandedBanks] = useState<Set<string>>(new Set())

  // Modal adaugă bancă
  const [showAddBank, setShowAddBank] = useState(false)
  const [newBankName, setNewBankName] = useState('')

  // Modal adaugă/editează user
  const [showUserModal, setShowUserModal] = useState(false)
  const [editingUser, setEditingUser] = useState<BankingUser | null>(null)
  const [userForm, setUserForm] = useState({ banking_id: '', label: '', login: '', password: '', password_envelope: '', notes: '' })

  // Confirm delete
  const [confirmDeleteBank, setConfirmDeleteBank] = useState<string | null>(null)
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const res = await fetch(`/api/banking?leadId=${leadId}`)
    const json = await res.json()
    setBanks(json.data || [])
    // Expandează automat prima bancă
    if (json.data?.length > 0) {
      setExpandedBanks(new Set([json.data[0].id]))
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [leadId])

  function toggleExpand(bankId: string) {
    setExpandedBanks(prev => {
      const next = new Set(prev)
      if (next.has(bankId)) next.delete(bankId)
      else next.add(bankId)
      return next
    })
  }

  function attemptUnlock() {
    if (masterInput === MASTER_PASSWORD) {
      setUnlocked(true)
      setShowMasterInput(false)
      setMasterInput('')
      setMasterError(false)
    } else {
      setMasterError(true)
      setTimeout(() => setMasterError(false), 2000)
    }
  }

  async function addBank() {
    if (!newBankName.trim()) return
    const res = await fetch('/api/banking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: leadId, bank_name: newBankName.trim() }),
    })
    if (res.ok) {
      toast.success('Bancă adăugată')
      setNewBankName('')
      setShowAddBank(false)
      load()
    } else {
      const j = await res.json()
      toast.error(j.error)
    }
  }

  async function toggleBankActive(bank: Bank) {
    if (!isAdmin) return
    await fetch('/api/banking', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'bank', id: bank.id, is_active: !bank.is_active }),
    })
    setBanks(bs => bs.map(b => b.id === bank.id ? { ...b, is_active: !b.is_active } : b))
  }

  async function toggleUserActive(user: BankingUser) {
    if (!isAdmin) return
    await fetch('/api/banking', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'user', id: user.id, is_active: !user.is_active }),
    })
    setBanks(bs => bs.map(b => ({
      ...b,
      users: b.users.map(u => u.id === user.id ? { ...u, is_active: !u.is_active } : u)
    })))
  }

  async function deleteBank(bankId: string) {
    if (!isAdmin) return
    const res = await fetch('/api/banking', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'bank', id: bankId }),
    })
    if (res.ok) {
      toast.success('Bancă ștearsă')
      setConfirmDeleteBank(null)
      load()
    }
  }

  async function deleteUser(userId: string) {
    if (!isAdmin) return
    const res = await fetch('/api/banking', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'user', id: userId }),
    })
    if (res.ok) {
      toast.success('Utilizator șters')
      setConfirmDeleteUser(null)
      load()
    }
  }

  function openAddUser(bankingId: string) {
    setEditingUser(null)
    const bankUsers = banks.find(b => b.id === bankingId)?.users || []
    setUserForm({
      banking_id: bankingId,
      label: `Utilizator ${bankUsers.length + 1}`,
      login: '', password: '', password_envelope: '', notes: ''
    })
    setShowUserModal(true)
  }

  function openEditUser(user: BankingUser) {
    setEditingUser(user)
    setUserForm({
      banking_id: user.banking_id,
      label: user.label,
      login: user.login || '',
      password: user.password || '',
      password_envelope: user.password_envelope || '',
      notes: user.notes || '',
    })
    setShowUserModal(true)
  }

  async function saveUser() {
    if (editingUser) {
      const res = await fetch('/api/banking', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'user', id: editingUser.id, ...userForm }),
      })
      if (res.ok) { toast.success('Utilizator actualizat'); setShowUserModal(false); load() }
      else { const j = await res.json(); toast.error(j.error) }
    } else {
      const res = await fetch('/api/banking/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userForm),
      })
      if (res.ok) { toast.success('Utilizator adăugat'); setShowUserModal(false); load() }
      else { const j = await res.json(); toast.error(j.error) }
    }
  }

  if (loading) return (
    <div className="p-6 space-y-3">
      {[1,2].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
    </div>
  )

  return (
    <div className="p-4 space-y-3">

      {/* Header cu buton deblocare + adaugă bancă */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Credențiale bancare</span>
          {unlocked && (
            <span className="flex items-center gap-1 text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-medium">
              <Eye size={10} /> Deblocat
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!unlocked ? (
            <button
              onClick={() => setShowMasterInput(v => !v)}
              className="flex items-center gap-1.5 text-xs border border-gray-200 px-3 py-1.5 rounded-lg text-gray-600 hover:border-[#004437] hover:text-[#004437] transition-colors">
              <Lock size={12} /> Deblochează
            </button>
          ) : (
            <button
              onClick={() => setUnlocked(false)}
              className="flex items-center gap-1.5 text-xs border border-green-200 px-3 py-1.5 rounded-lg text-green-600 hover:bg-green-50 transition-colors">
              <EyeOff size={12} /> Blochează
            </button>
          )}
          <button
            onClick={() => setShowAddBank(true)}
            className="flex items-center gap-1 text-xs bg-[#004437] text-white px-3 py-1.5 rounded-lg hover:bg-[#005a47] transition-colors">
            <Plus size={12} /> Bancă nouă
          </button>
        </div>
      </div>

      {/* Input parolă master */}
      {showMasterInput && !unlocked && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
          <KeyRound size={14} className="text-amber-600 flex-shrink-0" />
          <input
            type="password"
            className={`flex-1 bg-transparent text-sm outline-none placeholder:text-amber-400 ${masterError ? 'text-red-500' : 'text-gray-700'}`}
            placeholder="Introdu parola de acces..."
            value={masterInput}
            onChange={e => setMasterInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && attemptUnlock()}
            autoFocus
          />
          <button onClick={attemptUnlock} className="text-xs bg-amber-600 text-white px-3 py-1 rounded-lg hover:bg-amber-700">
            OK
          </button>
          {masterError && <span className="text-xs text-red-500 flex-shrink-0">Parolă incorectă</span>}
        </div>
      )}

      {/* Lista bănci */}
      {banks.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <Building2 size={28} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">Niciun cont bancar înregistrat</p>
          <button onClick={() => setShowAddBank(true)} className="mt-3 text-xs text-[#004437] hover:underline">
            + Adaugă prima bancă
          </button>
        </div>
      ) : banks.map(bank => (
        <div key={bank.id} className={`border rounded-xl overflow-hidden transition-all ${bank.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>

          {/* Header bancă */}
          <div
            className={`flex items-center gap-3 px-4 py-3 cursor-pointer select-none ${bank.is_active ? 'bg-gray-50 hover:bg-gray-100' : 'bg-gray-50'}`}
            onClick={() => toggleExpand(bank.id)}>
            <Building2 size={15} className={bank.is_active ? 'text-[#004437]' : 'text-gray-400'} />
            <span className={`flex-1 text-sm font-semibold ${bank.is_active ? 'text-gray-800' : 'text-gray-400'}`}>
              {bank.bank_name}
            </span>
            <span className="text-[10px] text-gray-400 mr-1">{bank.users.filter(u => u.is_active).length} utilizatori</span>

            {/* Toggle activ/inactiv — doar admin */}
            {isAdmin && (
              <button
                onClick={e => { e.stopPropagation(); toggleBankActive(bank) }}
                className="text-gray-400 hover:text-[#004437] transition-colors mr-1"
                title={bank.is_active ? 'Dezactivează' : 'Activează'}>
                {bank.is_active
                  ? <ToggleRight size={18} className="text-[#004437]" />
                  : <ToggleLeft size={18} />}
              </button>
            )}

            {/* Șterge bancă — doar admin */}
            {isAdmin && (
              <button
                onClick={e => { e.stopPropagation(); setConfirmDeleteBank(bank.id) }}
                className="text-gray-300 hover:text-red-500 transition-colors mr-1"
                title="Șterge banca">
                <Trash2 size={13} />
              </button>
            )}

            {expandedBanks.has(bank.id)
              ? <ChevronUp size={14} className="text-gray-400" />
              : <ChevronDown size={14} className="text-gray-400" />}
          </div>

          {/* Confirmare ștergere bancă */}
          {confirmDeleteBank === bank.id && (
            <div className="px-4 py-2.5 bg-red-50 border-t border-red-100 flex items-center gap-3">
              <span className="text-xs text-red-600 flex-1">Ștergi banca și toți utilizatorii?</span>
              <button onClick={() => deleteBank(bank.id)} className="text-xs bg-red-500 text-white px-3 py-1 rounded-lg">Șterge</button>
              <button onClick={() => setConfirmDeleteBank(null)} className="text-xs border border-gray-200 px-3 py-1 rounded-lg">Anulează</button>
            </div>
          )}

          {/* Utilizatori */}
          {expandedBanks.has(bank.id) && (
            <div className="divide-y divide-gray-100">
              {bank.users.length === 0 ? (
                <div className="px-4 py-3 text-xs text-gray-400 italic">Niciun utilizator. Adaugă mai jos.</div>
              ) : bank.users.map(u => (
                <div key={u.id} className={`px-4 py-3 ${u.is_active ? '' : 'opacity-50'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <User size={12} className="text-gray-400" />
                      <span className="text-xs font-semibold text-gray-700">{u.label}</span>
                      {!u.is_active && <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded">Inactiv</span>}
                      {u.password_updated_at && (
                        <span className="text-[10px] text-gray-400">
                          parola: {new Date(u.password_updated_at).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {isAdmin && (
                        <button onClick={() => toggleUserActive(u)} className="text-gray-400 hover:text-[#004437] transition-colors" title={u.is_active ? 'Dezactivează' : 'Activează'}>
                          {u.is_active ? <ToggleRight size={16} className="text-[#004437]" /> : <ToggleLeft size={16} />}
                        </button>
                      )}
                      <button onClick={() => openEditUser(u)} className="p-1 rounded text-gray-400 hover:text-[#004437] transition-colors">
                        <Pencil size={12} />
                      </button>
                      {isAdmin && (
                        <button onClick={() => setConfirmDeleteUser(u.id)} className="p-1 rounded text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Confirmare ștergere user */}
                  {confirmDeleteUser === u.id && (
                    <div className="mb-2 bg-red-50 rounded-lg px-3 py-2 flex items-center gap-2">
                      <span className="text-xs text-red-600 flex-1">Ștergi utilizatorul?</span>
                      <button onClick={() => deleteUser(u.id)} className="text-xs bg-red-500 text-white px-2 py-0.5 rounded">Da</button>
                      <button onClick={() => setConfirmDeleteUser(null)} className="text-xs border border-gray-200 px-2 py-0.5 rounded">Nu</button>
                    </div>
                  )}

                  {/* Câmpuri credențiale */}
                  <div className="space-y-1.5">
                    {/* Login */}
                    <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                      <span className="text-[10px] text-gray-400 w-20 flex-shrink-0">Login</span>
                      <span className="flex-1 text-xs font-mono text-gray-700 select-all">{u.login || <span className="text-gray-300 italic">—</span>}</span>
                      {u.login && <CopyButton value={u.login} />}
                    </div>

                    {/* Parolă */}
                    <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                      <span className="text-[10px] text-gray-400 w-20 flex-shrink-0">Parolă</span>
                      <span className="flex-1">
                        <PasswordField value={u.password || ''} unlocked={unlocked} />
                      </span>
                      {u.password && unlocked && <CopyButton value={u.password} />}
                      {u.password && !unlocked && (
                        <button onClick={() => setShowMasterInput(true)} className="p-1 text-gray-300 hover:text-amber-500 transition-colors" title="Deblochează pentru a vedea">
                          <Lock size={12} />
                        </button>
                      )}
                    </div>

                    {/* Parola plic */}
                    {(u.password_envelope || unlocked) && (
                      <div className="flex items-center gap-2 bg-amber-50 rounded-lg px-3 py-2">
                        <span className="text-[10px] text-amber-600 w-20 flex-shrink-0">Parolă plic</span>
                        <span className="flex-1">
                          <PasswordField value={u.password_envelope || ''} unlocked={unlocked} />
                        </span>
                        {u.password_envelope && unlocked && <CopyButton value={u.password_envelope} />}
                      </div>
                    )}

                    {/* Note */}
                    {u.notes && (
                      <div className="bg-blue-50 rounded-lg px-3 py-2">
                        <span className="text-[10px] text-blue-400 block mb-0.5">Notă</span>
                        <span className="text-xs text-gray-600">{u.notes}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Buton adaugă utilizator */}
              <div className="px-4 py-2">
                <button
                  onClick={() => openAddUser(bank.id)}
                  className="w-full py-1.5 border border-dashed border-gray-200 rounded-lg text-xs text-gray-400 hover:border-[#004437] hover:text-[#004437] transition-colors">
                  + Utilizator nou
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Modal adaugă bancă */}
      {showAddBank && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Bancă nouă</h3>
              <button onClick={() => setShowAddBank(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <label className="label">Denumirea băncii</label>
            <input
              className="input w-full"
              placeholder="ex: Maib, Moldindconbank, BCR..."
              value={newBankName}
              onChange={e => setNewBankName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addBank()}
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowAddBank(false)} className="btn-ghost text-sm">Anulează</button>
              <button onClick={addBank} disabled={!newBankName.trim()} className="btn-primary text-sm">Adaugă</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal adaugă/editează utilizator */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">{editingUser ? 'Editează utilizatorul' : 'Utilizator nou'}</h3>
              <button onClick={() => setShowUserModal(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Etichetă</label>
                <input className="input w-full" placeholder="Utilizator 1, Contabil, Director..." value={userForm.label}
                  onChange={e => setUserForm(f => ({ ...f, label: e.target.value }))} />
              </div>
              <div>
                <label className="label">Login</label>
                <input className="input w-full" placeholder="utilizator@email.md sau cod..." value={userForm.login}
                  onChange={e => setUserForm(f => ({ ...f, login: e.target.value }))} />
              </div>
              <div>
                <label className="label">Parolă</label>
                <input className="input w-full" placeholder="Parolă cont..." value={userForm.password}
                  onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))} />
                {editingUser?.password_updated_at && (
                  <p className="text-[10px] text-gray-400 mt-1">
                    Ultima modificare: {new Date(editingUser.password_updated_at).toLocaleDateString('ro-RO')}
                  </p>
                )}
              </div>
              <div>
                <label className="label">Parolă plic</label>
                <input className="input w-full" placeholder="Parola din plic..." value={userForm.password_envelope}
                  onChange={e => setUserForm(f => ({ ...f, password_envelope: e.target.value }))} />
              </div>
              <div>
                <label className="label">Notă</label>
                <textarea className="input w-full resize-none" rows={2} placeholder="Observații..."
                  value={userForm.notes} onChange={e => setUserForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowUserModal(false)} className="btn-ghost text-sm">Anulează</button>
              <button onClick={saveUser} className="btn-primary text-sm flex items-center gap-1.5">
                <Save size={13} /> {editingUser ? 'Salvează' : 'Adaugă'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
