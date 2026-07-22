'use client'
// Toată logica modulului Oferte din LeadDrawer: șabloane, listă,
// editor, PDF, email. Extras din LeadDrawer.tsx la refactorizare.
import { useState } from 'react'
import { toast } from 'sonner'

export function useOfferEditor(leadId: string | null, lead: any) {
  const [offerTemplates, setOfferTemplates] = useState<any[]>([])
  const [clientOffers, setClientOffers] = useState<any[]>([])
  const [offerStep, setOfferStep] = useState<'list'|'edit'>('list')
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null)
  const [offerForm, setOfferForm] = useState<any>(null)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [savingOffer, setSavingOffer] = useState(false)

  function reset() {
    setOfferStep('list')
    setOfferForm(null)
    setSelectedTemplate(null)
  }

  async function loadOffersData(): Promise<any[]> {
    if (!leadId) return []
    const [tplRes, offRes] = await Promise.all([
      fetch('/api/offer-templates'),
      fetch(`/api/offers?lead_id=${leadId}`),
    ])
    const tplJson = await tplRes.json()
    const offJson = await offRes.json()
    setOfferTemplates(tplJson.data || [])
    setClientOffers(offJson.data || [])
    return offJson.data || []
  }

  // Normalizează categoriile — acceptă atât items ca string-uri (formate vechi),
  // cât și items ca {title, description} (format curent) — evită câmpuri goale
  function normalizeCategories(categories: any[]): any[] {
    if (!Array.isArray(categories)) return []
    return categories.map((cat: any) => ({
      title: cat?.title || '',
      items: (cat?.items || []).map((item: any) =>
        typeof item === 'string'
          ? { title: item, description: '' }
          : { title: item?.title || '', description: item?.description || '' }
      ),
    }))
  }

  function startNewOffer(template: any) {
    setSelectedTemplate(template)
    const today = new Date()
    const validUntil = new Date(today)
    validUntil.setDate(validUntil.getDate() + 14)

    setOfferForm({
      sector: lead?.company || lead?.name || '',
      date: today.toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' }),
      problems: [{ title: '', text: '' }],
      packageName: template.name,
      categories: normalizeCategories(JSON.parse(JSON.stringify(template.content_json?.categories || []))),
      price: template.price_min || 0,
      priceUnit: template.price_unit || 'MDL/lună',
      contractMonths: 6,
      excluded: [
        'Recuperarea perioadelor contabile anterioare neacoperite (se tratează separat, la tarif proiect)',
        'Dosarele de personal (se tratează separat, tarif per dosar)',
      ],
      steps: [
        'Ședință inițială — 30 min, fără cost',
        'Semnare contract abonament lunar',
        'Acces la sisteme: 1C, case de marcat, declarații fiscale',
        'Startarea proceselor de evidență și gestiune',
      ],
      validUntil: validUntil.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      template_id: template.id,
    })
    setOfferStep('edit')
  }

  function editOffer(offer: any) {
    setSelectedTemplate(offer.template)
    setOfferForm({
      id: offer.id,
      sector: offer.sector || '',
      date: new Date(offer.created_at).toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' }),
      problems: offer.problems_json?.length ? offer.problems_json : [{ title: '', text: '' }],
      packageName: offer.content_json?.packageName || offer.template?.name || '',
      categories: normalizeCategories(offer.content_json?.categories || []),
      price: offer.price || 0,
      priceUnit: offer.price_unit || 'MDL/lună',
      contractMonths: offer.contract_months || 6,
      excluded: offer.excluded_json || [],
      steps: offer.content_json?.steps || [],
      validUntil: offer.valid_until ? new Date(offer.valid_until).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '',
      template_id: offer.template_id,
      status: offer.status,
    })
    setOfferStep('edit')
  }

  function buildPdfData() {
    return {
      sector: offerForm.sector,
      date: offerForm.date,
      problems: offerForm.problems.filter((p: any) => p.title || p.text),
      packageName: offerForm.packageName,
      categories: offerForm.categories,
      price: Number(offerForm.price),
      priceUnit: offerForm.priceUnit,
      contractMonths: Number(offerForm.contractMonths),
      excluded: offerForm.excluded.filter((e: string) => e.trim()),
      steps: offerForm.steps.filter((s: string) => s.trim()),
      validUntil: offerForm.validUntil,
    }
  }

  async function handleSaveOfferDraft(status: 'draft' | 'sent' = 'draft') {
    if (!leadId || !offerForm) return
    setSavingOffer(true)
    try {
      const payload = {
        lead_id: leadId,
        template_id: offerForm.template_id,
        status,
        sector: offerForm.sector,
        problems: offerForm.problems.filter((p: any) => p.title || p.text),
        content: { packageName: offerForm.packageName, categories: offerForm.categories, steps: offerForm.steps },
        excluded: offerForm.excluded.filter((e: string) => e.trim()),
        price: Number(offerForm.price),
        price_unit: offerForm.priceUnit,
        contract_months: Number(offerForm.contractMonths),
        valid_until: offerForm.validUntil ? offerForm.validUntil.split('.').reverse().join('-') : null,
      }

      if (offerForm.id) {
        await fetch('/api/offers', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: offerForm.id, ...payload }) })
      } else {
        const res = await fetch('/api/offers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        const json = await res.json()
        if (json.data) setOfferForm((f: any) => ({ ...f, id: json.data.id }))
      }
      toast.success(status === 'sent' ? 'Ofertă marcată ca trimisă' : 'Ofertă salvată')
      loadOffersData()
    } catch {
      toast.error('Eroare la salvare')
    } finally {
      setSavingOffer(false)
    }
  }

  async function handleDownloadPdf() {
    setGeneratingPdf(true)
    try {
      const res = await fetch('/api/offers/generate-pdf', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPdfData()),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error) }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Oferta_TaxFlow_${(lead?.name || 'client').replace(/\s+/g, '_')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      if (!offerForm.id) await handleSaveOfferDraft('draft')
    } catch (err: any) {
      toast.error(err.message || 'Eroare generare PDF')
    } finally {
      setGeneratingPdf(false)
    }
  }

  async function handleSendEmail() {
    if (!lead?.email) { toast.error('Clientul nu are adresă de email salvată'); return }
    setSendingEmail(true)
    try {
      if (!offerForm.id) await handleSaveOfferDraft('draft')
      const res = await fetch('/api/offers/send-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId: offerForm.id, leadId, email: lead.email, clientName: lead.name, pdfData: buildPdfData() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success('Ofertă trimisă pe email')
      handleSaveOfferDraft('sent')
    } catch (err: any) {
      toast.error(err.message || 'Eroare trimitere email')
    } finally {
      setSendingEmail(false)
    }
  }

  async function handleDeleteOffer(id: string) {
    if (!confirm('Ștergi această ofertă?')) return
    await fetch('/api/offers', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    toast.success('Ofertă ștearsă')
    loadOffersData()
  }

  function updateOfferField(field: string, value: any) {
    setOfferForm((f: any) => ({ ...f, [field]: value }))
  }

  // La selectarea unui alt pachet din dropdown — actualizează numele, prețul
  // ȘI lista de servicii (se înlocuiește cu serviciile reale ale pachetului ales)
  function handlePackageChange(templateId: string) {
    const template = offerTemplates.find((t: any) => t.id === templateId)
    if (!template) return
    setOfferForm((f: any) => ({
      ...f,
      packageName: template.name,
      price: template.price_min || 0,
      priceUnit: template.price_unit || 'MDL/lună',
      template_id: template.id,
      categories: normalizeCategories(JSON.parse(JSON.stringify(template.content_json?.categories || []))),
    }))
    toast.success(`Pachet schimbat → ${template.name}`)
  }

  // Resincronizează lista de servicii cu pachetul curent selectat — util dacă ai
  // editat manual serviciile și vrei să revii la varianta standard a pachetului
  function handleReloadServicesFromPackage() {
    const template = offerTemplates.find((t: any) => t.id === offerForm.template_id)
    if (!template) { toast.error('Selectează mai întâi un pachet'); return }
    if (!confirm('Înlocuiești lista actuală de servicii cu cea din pachetul selectat? Editările manuale se vor pierde.')) return
    setOfferForm((f: any) => ({
      ...f,
      categories: normalizeCategories(JSON.parse(JSON.stringify(template.content_json?.categories || []))),
    }))
    toast.success('Servicii resincronizate din pachet')
  }

  function updateProblem(idx: number, field: 'title'|'text', value: string) {
    setOfferForm((f: any) => {
      const problems = [...f.problems]
      problems[idx] = { ...problems[idx], [field]: value }
      return { ...f, problems }
    })
  }

  function addProblem() {
    setOfferForm((f: any) => ({ ...f, problems: [...f.problems, { title: '', text: '' }] }))
  }

  function removeProblem(idx: number) {
    setOfferForm((f: any) => ({ ...f, problems: f.problems.filter((_: any, i: number) => i !== idx) }))
  }

  function updateCategoryItem(catIdx: number, itemIdx: number, field: 'title'|'description', value: string) {
    setOfferForm((f: any) => {
      const categories = [...f.categories]
      const items = [...categories[catIdx].items]
      items[itemIdx] = { ...items[itemIdx], [field]: value }
      categories[catIdx] = { ...categories[catIdx], items }
      return { ...f, categories }
    })
  }

  function removeCategoryItem(catIdx: number, itemIdx: number) {
    setOfferForm((f: any) => {
      const categories = [...f.categories]
      categories[catIdx] = { ...categories[catIdx], items: categories[catIdx].items.filter((_: any, i: number) => i !== itemIdx) }
      return { ...f, categories }
    })
  }

  function addCategoryItem(catIdx: number) {
    setOfferForm((f: any) => {
      const categories = [...f.categories]
      categories[catIdx] = { ...categories[catIdx], items: [...categories[catIdx].items, { title: '', description: '' }] }
      return { ...f, categories }
    })
  }

  function updateExcluded(idx: number, value: string) {
    setOfferForm((f: any) => {
      const excluded = [...f.excluded]
      excluded[idx] = value
      return { ...f, excluded }
    })
  }

  function addExcluded() {
    setOfferForm((f: any) => ({ ...f, excluded: [...f.excluded, ''] }))
  }

  function removeExcluded(idx: number) {
    setOfferForm((f: any) => ({ ...f, excluded: f.excluded.filter((_: any, i: number) => i !== idx) }))
  }

  return {
    offerTemplates, clientOffers, offerStep, setOfferStep, selectedTemplate,
    offerForm, generatingPdf, sendingEmail, savingOffer,
    reset, loadOffersData, startNewOffer, editOffer,
    handleSaveOfferDraft, handleDownloadPdf, handleSendEmail, handleDeleteOffer,
    updateOfferField, handlePackageChange, handleReloadServicesFromPackage,
    updateProblem, addProblem, removeProblem,
    updateCategoryItem, removeCategoryItem, addCategoryItem,
    updateExcluded, addExcluded, removeExcluded,
  }
}

export type OfferEditor = ReturnType<typeof useOfferEditor>
