// app/api/whatsapp/media/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const mediaId = req.nextUrl.searchParams.get('id')
  if (!mediaId) return NextResponse.json({ error: 'ID lipsă' }, { status: 400 })

  try {
    // Pas 1: obține URL-ul real al fișierului
    const metaRes = await fetch(
      `https://graph.facebook.com/v19.0/${mediaId}`,
      { headers: { 'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` } }
    )
    const metaData = await metaRes.json()
    if (!metaRes.ok || !metaData.url) {
      return NextResponse.json({ error: 'Media negăsit' }, { status: 404 })
    }

    // Pas 2: descarcă fișierul de la Meta
    const fileRes = await fetch(metaData.url, {
      headers: { 'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` }
    })

    if (!fileRes.ok) {
      return NextResponse.json({ error: 'Eroare download' }, { status: 500 })
    }

    const contentType = fileRes.headers.get('content-type') || 'application/octet-stream'
    const buffer = await fileRes.arrayBuffer()

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
