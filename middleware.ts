// middleware.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as any)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const publicRoutes = ['/auth/login', '/auth/invite', '/api/whatsapp/webhook', '/api/calendar/feed']
  const isPublic = publicRoutes.some(r => pathname.startsWith(r))

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  if (user && pathname.startsWith('/auth/login')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (user && !isPublic) {
    // role + is_active vin din app_metadata (sincronizate prin trigger
    // pe profiles — migrarea 004), fără query suplimentar la DB.
    let profile = user.app_metadata as { role?: string; is_active?: boolean }

    if (profile?.role === undefined || profile?.is_active === undefined) {
      // Fallback pentru conturi create înainte de sincronizare
      const { data } = await supabase
        .from('profiles')
        .select('role, is_active')
        .eq('id', user.id)
        .single()
      profile = (data as { role: string; is_active: boolean } | null) ?? {}
    }

    if (profile && profile.is_active === false) {
      await supabase.auth.signOut()
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      url.searchParams.set('error', 'account_disabled')
      return NextResponse.redirect(url)
    }

    if (pathname.startsWith('/admin') && profile?.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
