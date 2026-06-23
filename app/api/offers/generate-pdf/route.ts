// app/api/offers/generate-pdf/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { generateOfferPdfBuffer, OfferPdfData } from '@/lib/pdf/offer-pdf'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const data: OfferPdfData = await req.json()

    if (!data.packageName || !data.categories || data.price == null) {
      return NextResponse.json({ error: 'Date incomplete pentru generare PDF' }, { status: 400 })
    }

    const buffer = await generateOfferPdfBuffer(data)

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Oferta_TaxFlow_${(data.sector || 'client').replace(/\s+/g, '_')}.pdf"`,
      },
    })
  } catch (err: any) {
    console.error('PDF generation error:', err)
    return NextResponse.json({ error: err.message || 'Eroare generare PDF' }, { status: 500 })
  }
}
