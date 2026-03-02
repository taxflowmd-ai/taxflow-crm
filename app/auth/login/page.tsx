'use client'
// app/auth/login/page.tsx
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const error = params.get('error')
    if (error === 'account_disabled') {
      toast.error('Contul tau a fost dezactivat. Contacteaza administratorul.')
    }
  }, [params])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      toast.error(
        error.message.includes('Invalid login')
          ? 'Email sau parola incorecta'
          : error.message
      )
      setLoading(false)
      return
    }

    // Actualizeaza last_login_at
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await (supabase.from('profiles') as any)
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', user.id)
    }

    const redirect = params.get('redirect') || '/dashboard'
    router.push(redirect)
    router.refresh()
  }

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <h1 className="font-serif text-4xl text-white mb-1">TaxFlow</h1>
        <p className="text-xs text-white/40 uppercase tracking-[2px]">CRM</p>
      </div>
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-8 pt-8 pb-2">
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Buna ziua</h2>
          <p className="text-sm text-gray-500 mb-6">Intra in contul tau TaxFlow CRM</p>
        </div>
        <form onSubmit={handleLogin} className="px-8 pb-8 space-y-4">
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              placeholder="ion@taxflow.md"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="label">Parola</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                className="input pr-10"
                placeholder="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
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
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#004437] text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-[#005a47] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? 'Se verifica...' : 'Intra in CRM'}
          </button>
        </form>
      </div>
      <p className="text-center text-xs text-white/30 mt-6">
        Nu ai cont? Solicita o invitatie administratorului.
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#002e25] flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-white">Se incarca...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
