// app/api/banking/users/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c: { name: string; value: string; options?: any }[]) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  )
}

// POST /api/banking/users — adaugă utilizator la o bancă
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { banking_id, label, login, password, password_envelope, notes } = body

  const { data, error } = await (supabase as any)
    .from('client_banking_users')
    .insert({
      banking_id,
      label: label || 'Utilizator 1',
      login: login || null,
      password: password || null,
      password_envelope: password_envelope || null,
      notes: notes || null,
      password_updated_at: password ? new Date().toISOString() : null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
