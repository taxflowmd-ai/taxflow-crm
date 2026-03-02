'use client'
// app/auth/invite/[token]/page.tsx
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Invitation } from '@/lib/supabase/types'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2, CheckCircle, XCircle } from 'lucide-react'

interface Props {
  params: { token: string }
}

type InviteState = 'loading' | 'valid' | 'invalid' | 'expired' | 'used' | 'success'

export default function InvitePage({ params }: Props) {
  const router = useRouter()
  const [state, setState] = useState<InviteState>('loading')
  const [invitation, setInvitation] = useState<{ email: string; role: string } | null>(null)
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function validateToken() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('invitations')
        .select('email, role, accepted_at, expires_at')
        .eq('token', params.token)
        .single() as { data: Pick<Invitation, 'email' | 'role' | 'accepted_at' | 'expires_at'> | null; error: unknown }

      if (error || !data) { setState('invalid'); return }
      if (data.accepted_at) { setState('used'); return }
      if (new Date(data.expires_at) < new Date()) { setState('expired'); return }
      setInvitation({ email: data.email, role: data.role })
      setState('valid')
    }
    validateToken()
  }, [params.token])

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { toast.error('Parola trebuie sa aiba minim 8 caractere'); return }
    if (password !== confirmPass) { toast.error('Parolele nu coincid'); return }
    if (!fullName.trim()) { toast.error('Introdu numele complet'); return }

    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: params.token,
          email: invitation!.email,
          password,
          fullName: fullName.trim(),
          role: invitation!.role,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Eroare necunoscuta')
      setState('success')
      setTimeout(() => router.push('/auth/login'), 2500)
    } catch (err: any) {
      toast.error(err.message)
      setSubmitting(false)
    }
  }

  if (state === 'loading') return (
    <Screen>
      <div className="flex flex-col items-center gap-3">
        <Loader2 size={32} className="animate-spin text-[#004437]" />
        <p className="text-gray-500 text-sm">Se verifica invitatia...</p>
      </div>
    </Screen>
  )

  if (state === 'invalid') return (
    <Screen>
      <XCircle size={48} className="text-red-400 mx-auto mb-4" />
      <h2 className="text-xl font-semibold text-gray-900 mb-2 text-center">Link invalid</h2>
      <p className="text-gray-500 text-sm text-center">Acest link de invitatie nu exista sau a fost deja folosit.</p>
    </Screen>
  )

  if (state === 'expired') return (
    <Screen>
      <XCircle size={48} className="text-amber-400 mx-auto mb-4" />
      <h2 className="text-xl font-semibold text-gray-900 mb-2 text-center">Link expirat</h2>
      <p className="text-gray-500 text-sm text-center">Invitatia a expirat (valabila 7 zile). Solicita o noua invitatie.</p>
    </Screen>
  )

  if (state === 'used') return (
    <Screen>
      <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
      <h2 className="text-xl font-semibold text-gray-900 mb-2 text-center">Deja inregistrat</h2>
      <p className="text-gray-500 text-sm text-center mb-4">Aceasta invitatie a fost deja acceptata.</p>
      <button onClick={() => router.push('/auth/login')} className="btn-primary mx-auto">
        Intra in cont
      </button>
    </Screen>
  )

  if (state === 'success') return (
    <Screen>
      <CheckCircle size={48} className="text-[#00c48c] mx-auto mb-4" />
      <h2 className="text-xl font-semibold text-gray-900 mb-2 text-center">Cont creat cu succes!</h2>
      <p className="text-gray-500 text-sm text-center">Te redirectionam catre login...</p>
    </Screen>
  )

  return (
    <div className="min-h-screen bg-[#002e25] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-serif text-4xl text-white mb-1">TaxFlow</h1>
          <p className="text-xs text-white/40 uppercase tracking-[2px]">CRM</p>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="px-8 pt-8 pb-2">
            <div className="inline-flex items-center gap-2 bg-[#e8f0ee] text-[#004437] text-xs font-medium px-3 py-1.5 rounded-full mb-4">
              Invitatie acceptata
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-1">Creeaza contul tau</h2>
            <p className="text-sm text-gray-500 mb-6">
              Email: <span className="font-medium text-gray-700">{invitation?.email}</span>
            </p>
          </div>
          <form onSubmit={handleRegister} className="px-8 pb-8 space-y-4">
            <div>
              <label className="label">Nume complet *</label>
              <input
                type="text"
                className="input"
                placeholder="Ion Popescu"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label">Parola * (minim 8 caractere)</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="label">Confirma parola *</label>
              <input
                type="password"
                className={`input ${confirmPass && password !== confirmPass ? 'border-red-400' : ''}`}
                placeholder="password"
                value={confirmPass}
                onChange={e => setConfirmPass(e.target.value)}
                required
              />
              {confirmPass && password !== confirmPass && (
                <p className="text-xs text-red-500 mt-1">Parolele nu coincid</p>
              )}
            </div>
            <button
              type="submit"
              disabled={submitting || !fullName || !password || password !== confirmPass}
              className="w-full bg-[#004437] text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-[#005a47] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              {submitting ? 'Se creeaza contul...' : 'Creeaza contul'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#002e25] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-sm">
        {children}
      </div>
    </div>
  )
}
