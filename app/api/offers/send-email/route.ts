// app/api/offers/send-email/route.ts
// Trimitere ofertă PDF pe email — folosește Resend (RESEND_API_KEY deja configurat în Vercel)
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { generateOfferPdfBuffer, OfferPdfData } from '@/lib/pdf/offer-pdf'
import { syncLeadStatusOnOfferSent } from '@/lib/offers/sync-lead-status'

export const dynamic = 'force-dynamic'

const REPLY_TO_EMAIL = 'contact@taxflow.md'

const admin = () => createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

function getSupabase() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return (cookieStore as any).getAll() }, setAll() {} } }
  )
}

export async function POST(req: NextRequest) {
  try {
    const { data: { user } } = await getSupabase().auth.getUser()
    if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 })

    const { offerId, leadId, email, pdfData, clientName } = await req.json()

    if (!email) return NextResponse.json({ error: 'Adresă email lipsă' }, { status: 400 })
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'Trimiterea pe email nu este configurată (RESEND_API_KEY lipsă)' }, { status: 400 })
    }

    const buffer = await generateOfferPdfBuffer(pdfData as OfferPdfData)
    const base64Pdf = buffer.toString('base64')

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'TaxFlow <noreply@taxflow.md>',
        reply_to: REPLY_TO_EMAIL,
        to: [email],
        subject: `Ofertă comercială TaxFlow — ${clientName || 'Client nou'}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
            <div style="background: #004437; padding: 24px; border-radius: 8px 8px 0 0;">
              <h1 style="color: #fff; margin: 0; font-size: 22px;">TaxFlow</h1>
              <p style="color: #fff; opacity: 0.85; margin: 4px 0 0; font-size: 13px;">Partener în structurarea financiară</p>
            </div>
            <div style="padding: 24px; background: #f8fafc; border-radius: 0 0 8px 8px;">
              <p style="color: #334155; font-size: 14px; line-height: 1.6;">
                Bună ziua${clientName ? `, ${clientName}` : ''},<br/><br/>
                Vă transmitem oferta comercială personalizată, atașată acestui email în format PDF.<br/><br/>
                Pentru orice întrebări, ne puteți răspunde direct la acest email sau scrie la
                <a href="mailto:${REPLY_TO_EMAIL}" style="color:#004437;">${REPLY_TO_EMAIL}</a>.
              </p>
              <p style="color: #64748b; font-size: 12px; margin-top: 20px;">
                TaxFlow · taxflow.md · Chișinău, Moldova
              </p>
            </div>
          </div>
        `,
        attachments: [
          { filename: 'Oferta_TaxFlow.pdf', content: base64Pdf },
        ],
      }),
    })

    const json = await res.json()
    if (!res.ok) {
      return NextResponse.json({ error: json.message || 'Eroare trimitere email' }, { status: 400 })
    }

    // Actualizează statusul ofertei la 'sent' + sincronizează statusul lead-ului
    if (offerId) {
      await admin().from('offers').update({
        status: 'sent',
        sent_at: new Date().toISOString(),
      } as any).eq('id', offerId)
    }
    if (leadId) {
      await syncLeadStatusOnOfferSent(admin(), leadId, user.id)
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Email send error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
