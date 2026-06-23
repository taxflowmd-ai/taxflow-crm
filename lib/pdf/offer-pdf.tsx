// lib/pdf/offer-pdf.tsx
// Generator PDF ofertă comercială — branding TaxFlow
// Necesită fonturile Poppins în /public/fonts/ (Regular, Medium, Bold)

import React from 'react'
import { Document, Page, Text, View, StyleSheet, Font, Link } from '@react-pdf/renderer'
import path from 'path'

// Înregistrare font Poppins (suport diacritice RO complet) — o singură dată
let fontsRegistered = false
function registerFonts() {
  if (fontsRegistered) return
  const fontsDir = path.join(process.cwd(), 'public', 'fonts')
  Font.register({
    family: 'Poppins',
    fonts: [
      { src: path.join(fontsDir, 'Poppins-Regular.ttf'), fontWeight: 'normal' },
      { src: path.join(fontsDir, 'Poppins-Medium.ttf'), fontWeight: 500 },
      { src: path.join(fontsDir, 'Poppins-Bold.ttf'), fontWeight: 'bold' },
    ],
  })
  fontsRegistered = true
}

const SITE_URL = 'https://taxflow.md'

const GREEN_DARK = '#004437'
const GREEN_MID = '#2d7a6b'
const GREEN_LIGHT = '#e8f5f0'
const GREEN_BRIGHT = '#00c48c'
const GRAY_TEXT = '#334155'
const GRAY_LIGHT_BG = '#f8fafc'
const GRAY_SOFT = '#64748b'

const styles = StyleSheet.create({
  page: { padding: 0, paddingTop: 28, paddingBottom: 60, fontFamily: 'Poppins', fontSize: 10, color: GRAY_TEXT },
  header: { flexDirection: 'row', height: 80 },
  headerLeft: { backgroundColor: GREEN_DARK, width: '60%', padding: 20, justifyContent: 'center' },
  headerRight: { backgroundColor: GREEN_MID, width: '40%', padding: 20, justifyContent: 'center', alignItems: 'flex-end' },
  brandName: { color: '#FFFFFF', fontSize: 22, fontFamily: 'Poppins', fontWeight: 'bold' },
  brandTagline: { color: '#FFFFFF', fontSize: 9, marginTop: 2, opacity: 0.9 },
  brandMetaLink: { color: '#FFFFFF', fontSize: 8, marginTop: 2, opacity: 0.85, textDecoration: 'none' },
  offerLabel: { color: '#FFFFFF', fontSize: 12, fontFamily: 'Poppins', fontWeight: 'bold', textAlign: 'right' },
  offerMeta: { color: '#FFFFFF', fontSize: 8, marginTop: 2, textAlign: 'right', opacity: 0.9 },
  body: { padding: 30 },
  problemBox: { backgroundColor: GREEN_LIGHT, padding: 12, marginBottom: 10, borderRadius: 4 },
  problemTitle: { fontFamily: 'Poppins', fontWeight: 'bold', color: GREEN_DARK, fontSize: 10 },
  problemText: { fontSize: 9.5, lineHeight: 1.4, marginTop: 2 },
  sectionTitle: { fontSize: 14, fontFamily: 'Poppins', fontWeight: 'bold', color: GREEN_DARK, marginTop: 18, marginBottom: 4 },
  sectionDivider: { borderBottomWidth: 1.5, borderBottomColor: GREEN_MID, marginBottom: 10 },
  categoryTitle: { fontSize: 11.5, fontFamily: 'Poppins', fontWeight: 'bold', marginTop: 12, marginBottom: 6 },
  bulletRow: { flexDirection: 'row', marginBottom: 4, paddingLeft: 4 },
  bulletDot: { width: 10, fontSize: 9.5 },
  bulletText: { flex: 1, fontSize: 9.5, lineHeight: 1.4 },
  priceBox: { flexDirection: 'row', marginTop: 16, minHeight: 50 },
  priceBoxLeft: { backgroundColor: GREEN_DARK, width: '65%', padding: 12, justifyContent: 'center' },
  priceBoxRight: { backgroundColor: GREEN_BRIGHT, width: '35%', padding: 12, justifyContent: 'center', alignItems: 'flex-end' },
  priceLabel: { color: '#FFFFFF', fontSize: 11, fontFamily: 'Poppins', fontWeight: 'bold' },
  priceSubLabel: { color: '#FFFFFF', fontSize: 8, opacity: 0.85, marginTop: 1 },
  priceValue: { color: GREEN_DARK, fontSize: 15, fontFamily: 'Poppins', fontWeight: 'bold' },
  excludedBox: { backgroundColor: GRAY_LIGHT_BG, padding: 12, marginBottom: 4 },
  excludedItem: { fontSize: 9.5, marginBottom: 4 },
  stepRow: { flexDirection: 'row', marginBottom: 6, backgroundColor: GRAY_LIGHT_BG, alignItems: 'center' },
  stepNum: { backgroundColor: GREEN_DARK, color: '#FFFFFF', width: 22, height: 22, borderRadius: 3, textAlign: 'center', fontSize: 10, fontFamily: 'Poppins', fontWeight: 'bold', marginLeft: 8, marginRight: 10, paddingTop: 5 },
  stepText: { fontSize: 9.5, paddingVertical: 8 },
  footer: { backgroundColor: GREEN_DARK, padding: 14, alignItems: 'center', position: 'absolute', bottom: 0, left: 0, right: 0 },
  footerText: { color: '#FFFFFF', fontSize: 8, opacity: 0.9 },
  footerLink: { color: '#FFFFFF', fontSize: 8, opacity: 0.95, textDecoration: 'none' },
  validUntil: { fontSize: 9, marginTop: 14, textAlign: 'center', color: GRAY_TEXT },
  // Glosar (pagina de explicații, font mai mic, informativ)
  glossaryHeader: { padding: 24, paddingBottom: 10 },
  glossaryTitle: { fontSize: 13, fontFamily: 'Poppins', fontWeight: 'bold', color: GREEN_DARK },
  glossarySubtitle: { fontSize: 8, color: GRAY_SOFT, marginTop: 3, lineHeight: 1.4 },
  glossaryBody: { paddingHorizontal: 24, paddingBottom: 10 },
  glossaryCategory: { fontSize: 9.5, fontFamily: 'Poppins', fontWeight: 'bold', color: GREEN_MID, marginTop: 10, marginBottom: 4 },
  glossaryItem: { marginBottom: 5 },
  glossaryItemTitle: { fontSize: 8, fontFamily: 'Poppins', fontWeight: 500, color: GRAY_TEXT },
  glossaryItemDesc: { fontSize: 7.5, color: GRAY_SOFT, lineHeight: 1.35, marginTop: 0.5 },
})

export interface OfferProblem { title: string; text: string }
export interface OfferServiceItem { title: string; description?: string }
export interface OfferCategory { title: string; items: OfferServiceItem[] }
export interface OfferPdfData {
  sector: string                // afișat ca "Destinat:" în document
  date: string                  // ex: "Iunie 2026"
  problems: OfferProblem[]
  packageName: string           // ex: "TAXFLOW CONTROL"
  categories: OfferCategory[]
  price: number
  priceUnit: string             // ex: "MDL/lună"
  contractMonths: number
  excluded: string[]
  steps: string[]
  validUntil: string            // ex: "23.06.2026"
}

const DEFAULT_STEPS = [
  'Ședință inițială — 30 min, fără cost',
  'Semnare contract abonament',
  'Acces la sisteme: 1C, case de marcat, declarații fiscale',
  'Startarea proceselor de evidență și gestiune',
]

function HeaderBlock({ data }: { data: OfferPdfData }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Text style={styles.brandName}>TaxFlow</Text>
        <Text style={styles.brandTagline}>Partener în structurarea financiară</Text>
        <Link src={SITE_URL} style={styles.brandMetaLink}>taxflow.md | Chișinău, Moldova</Link>
      </View>
      <View style={styles.headerRight}>
        <Text style={styles.offerLabel}>OFERTĂ COMERCIALĂ</Text>
        <Text style={styles.offerMeta}>Destinat: {data.sector}</Text>
        <Text style={styles.offerMeta}>Data: {data.date}</Text>
      </View>
    </View>
  )
}

function FooterBlock() {
  return (
    <View style={styles.footer} fixed>
      <Link src={SITE_URL} style={styles.footerLink}>taxflow.md  |  Chișinău, Moldova</Link>
      <Text style={styles.footerText}>Document confidențial — elaborat exclusiv pentru clientul desemnat</Text>
    </View>
  )
}

function OfferDocument({ data }: { data: OfferPdfData }) {
  const steps = data.steps?.length ? data.steps : DEFAULT_STEPS
  // Doar categoriile/itemii cu descriere completată merg în glosar
  const glossaryCategories = data.categories
    .map(cat => ({ title: cat.title, items: cat.items.filter(i => i.description && i.description.trim()) }))
    .filter(cat => cat.items.length > 0)
  const hasGlossary = glossaryCategories.length > 0

  return (
    <Document>
      {/* Pagina 1+ — Oferta principală */}
      <Page size="A4" style={styles.page}>
        <HeaderBlock data={data} />

        <View style={styles.body}>
          {data.problems?.map((p, i) => (
            <View style={styles.problemBox} key={i} wrap={false}>
              <Text style={styles.problemTitle}>Problemă {i + 1} — {p.title}</Text>
              <Text style={styles.problemText}>{p.text}</Text>
            </View>
          ))}

          <Text style={styles.sectionTitle}>Pachet Lunar — {data.packageName}</Text>
          <View style={styles.sectionDivider} />

          {data.categories.map((cat, ci) => (
            <View key={ci}>
              <Text style={styles.categoryTitle} minPresenceAhead={40}>{cat.title}</Text>
              {cat.items.map((item, ii) => (
                <View style={styles.bulletRow} key={ii} wrap={false}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>{item.title}</Text>
                </View>
              ))}
            </View>
          ))}

          <View style={styles.priceBox} wrap={false}>
            <View style={styles.priceBoxLeft}>
              <Text style={styles.priceLabel}>Abonament lunar — {data.packageName}</Text>
              <Text style={styles.priceSubLabel}>Contract minim: {data.contractMonths} luni</Text>
            </View>
            <View style={styles.priceBoxRight}>
              <Text style={styles.priceValue}>{data.price.toLocaleString('ro-RO')} {data.priceUnit}</Text>
            </View>
          </View>

          {data.excluded?.length > 0 && (
            <>
              <Text style={styles.sectionTitle} minPresenceAhead={60}>Ce nu este inclus</Text>
              <View style={styles.sectionDivider} />
              <View style={styles.excludedBox} wrap={false}>
                {data.excluded.map((e, i) => (
                  <Text style={styles.excludedItem} key={i}>• {e}</Text>
                ))}
              </View>
            </>
          )}

          <Text style={styles.sectionTitle} minPresenceAhead={60}>Pași următori</Text>
          <View style={styles.sectionDivider} />
          {steps.map((s, i) => (
            <View style={styles.stepRow} key={i} wrap={false}>
              <Text style={styles.stepNum}>{i + 1}</Text>
              <Text style={styles.stepText}>{s}</Text>
            </View>
          ))}

          <Text style={styles.validUntil}>Oferta este valabilă până pe data de {data.validUntil}.</Text>
        </View>

        <FooterBlock />
      </Page>

      {/* Pagină separată — Glosar servicii (informativ, font mic) */}
      {hasGlossary && (
        <Page size="A4" style={styles.page}>
          <View style={styles.glossaryHeader}>
            <Text style={styles.glossaryTitle}>Ce înseamnă serviciile de mai sus</Text>
            <Text style={styles.glossarySubtitle}>
              Pagină informativă — explică în termeni simpli fiecare serviciu inclus în pachetul {data.packageName}.
            </Text>
          </View>
          <View style={styles.glossaryBody}>
            {glossaryCategories.map((cat, ci) => (
              <View key={ci}>
                <Text style={styles.glossaryCategory} minPresenceAhead={30}>{cat.title}</Text>
                {cat.items.map((item, ii) => (
                  <View style={styles.glossaryItem} key={ii} wrap={false}>
                    <Text style={styles.glossaryItemTitle}>{item.title}</Text>
                    <Text style={styles.glossaryItemDesc}>{item.description}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
          <FooterBlock />
        </Page>
      )}
    </Document>
  )
}

export async function generateOfferPdfBuffer(data: OfferPdfData): Promise<Buffer> {
  registerFonts()
  const { renderToBuffer } = await import('@react-pdf/renderer')
  const buffer = await renderToBuffer(<OfferDocument data={data} />)
  return buffer as unknown as Buffer
}
