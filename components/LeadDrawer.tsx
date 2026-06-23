'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { X, Save, Trash2, MessageCircle, Phone, Mail, Building2, User, Tag, Calendar, FileText, Clock, Landmark, Hash, Briefcase, Pencil, FileSignature, Download, Send, Plus as PlusIcon, ClipboardCheck, AlertTriangle, ArrowRight } from 'lucide-react'
import { QUALIFICATION_FIELDS, computeQualification, QualificationAnswers, PACKAGE_NAME_TO_TYPE } from '@/lib/qualification/scoring'
import { useRouter } from 'next/navigation'
import BankingTab from '@/components/BankingTab'

const STATUSES = ['Nou','Contactat','Întâlnire programată','Ofertă trimisă','Client activ','Pierdut','Nu se califică']
const SOURCES = ['Meta Ads','WhatsApp','Organic','Referință','Site web','Import']
const FISCAL_REGIMES = ['non-TVA','TVA']
const SERVICE_TYPES = ['Contabilitate lunară','Înregistrare SRL','Consultanță fiscală','Salarizare','Audit','Altele']
const ST_COLORS: Record<string,string> = {
  'Nou':'#94a3b8','Contactat':'#3a7bd5','Întâlnire programată':'#c9a84c',
  'Ofertă trimisă':'#8b5cf6','Client activ':'#00c48c','Pierdut':'#e05050','Nu se califică':'#f97316'
}

interface Props {
  leadId: string | null
  onClose: () => void
  team?: any[]
  isAdmin?: boolean
  initialTab?: 'info'|'note'|'history'|'banking'|'fiscal'|'offers'|'qualification'
  initialOfferId?: string | null
}

export default function LeadDrawer({ leadId, onClose, team = [], isAdmin = false, initialTab, initialOfferId }: Props) {
  const router = useRouter()
  const [lead, setLead] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState('')
  const [tab, setTab] = useState<'info'|'note'|'history'|'banking'|'fiscal'|'offers'|'qualification'>('info')
  const [form, setForm] = useState<any>({})
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string|null>(null)
  const [editingNoteText, setEditingNoteText] = useState('')
  const [reportTypes, setReportTypes] = useState<any[]>([])
  const [clientObligations, setClientObligations] = useState<string[]>([])
  const [savingObligations, setSavingObligations] = useState(false)

  // Oferte
  const [offerTemplates, setOfferTemplates] = useState<any[]>([])
  const [clientOffers, setClientOffers] = useState<any[]>([])
  const [offerStep, setOfferStep] = useState<'list'|'edit'>('list')
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null)
  const [offerForm, setOfferForm] = useState<any>(null)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [savingOffer, setSavingOffer] = useState(false)

  // Calificare client
  const [qualAnswers, setQualAnswers] = useState<QualificationAnswers>({})
  const [savingQual, setSavingQual] = useState(false)
  const [qualUpdatedAt, setQualUpdatedAt] = useState<string | null>(null)

  useEffect(() => {
    if (!leadId) return
    setLoading(true)
    setTab('info')
    setConfirmDelete(false)
    loadLead(leadId)
  }, [leadId])

  async function loadLead(id: string) {
    const supabase = createClient()
    const { data } = await (supabase as any)
      .from('leads')
      .select('*, assignee:assigned_to(id, full_name, avatar_color)')
      .eq('id', id)
      .single()
    const { data: hist } = await (supabase as any)
      .from('lead_history')
      .select('*, author:created_by(full_name, avatar_color)')
      .eq('lead_id', id)
      .order('created_at', { ascending: false })
    setLead(data)
    setHistory(hist || [])
    setForm({
      name: data?.name || '',
      company: data?.company || '',
      phone: data?.phone || '',
      email: data?.email || '',
      source: data?.source || 'Meta Ads',
      status: data?.status || 'Nou',
      assigned_to: data?.assigned_to || '',
      note: data?.note || '',
      reminder_at: data?.reminder_at ? data.reminder_at.slice(0,16) : '',
      idno: data?.idno || '',
      fiscal_regime: data?.fiscal_regime || 'non-TVA',
      employees_count: data?.employees_count ?? '',
      contract_value: data?.contract_value ?? '',
      service_type: data?.service_type || '',
    })

    // Încarcă tipuri rapoarte și obligații client
    const [{ data: rt }, { data: obls }] = await Promise.all([
      (supabase as any).from('report_types').select('*').order('sort_order'),
      (supabase as any).from('client_obligations').select('report_type_id').eq('lead_id', id).eq('is_active', true),
    ])
    setReportTypes(rt || [])
    setClientObligations((obls || []).map((o: any) => o.report_type_id))
    setLoading(false)

    // Încarcă date oferte (nu blocant pentru restul UI)
    fetch('/api/offer-templates').then(r => r.json()).then(j => setOfferTemplates(j.data || []))
    fetch(`/api/offers?lead_id=${id}`).then(r => r.json()).then(j => {
      const loadedOffers = j.data || []
      setClientOffers(loadedOffers)
      if (initialOfferId) {
        const target = loadedOffers.find((o: any) => o.id === initialOfferId)
        if (target) {
          editOffer(target)
          setTab('offers')
          return
        }
      }
      if (initialTab) setTab(initialTab)
    })
    setOfferStep('list')
    setOfferForm(null)
    setSelectedTemplate(null)

    // Încarcă date calificare
    fetch(`/api/qualification?lead_id=${id}`).then(r => r.json()).then(j => {
      if (j.data) {
        setQualAnswers({
          employees: j.data.employees, revenue: j.data.revenue, vat_regime: j.data.vat_regime,
          activities_count: j.data.activities_count, monthly_documents: j.data.monthly_documents,
          current_reporting: j.data.current_reporting, financial_decision_basis: j.data.financial_decision_basis,
          financial_manager: j.data.financial_manager, main_expectation: j.data.main_expectation,
          delegation_level: j.data.delegation_level, structure_reaction: j.data.structure_reaction,
          special_project: j.data.special_project,
        })
        setQualUpdatedAt(j.data.updated_at)
      } else {
        setQualAnswers({})
        setQualUpdatedAt(null)
      }
    })
  }

  async function handleSave() {
    if (!leadId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          reminder_at: form.reminder_at || null,
          assigned_to: form.assigned_to || null,
          idno: form.idno || null,
          fiscal_regime: form.fiscal_regime || null,
          employees_count: form.employees_count !== '' ? Number(form.employees_count) : null,
          contract_value: form.contract_value !== '' ? Number(form.contract_value) : null,
          service_type: form.service_type || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success('Contact salvat')
      setLead({ ...lead, ...form })
      router.refresh()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleAddNote() {
    if (!note.trim() || !leadId) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await (supabase as any).from('lead_history').insert({
      lead_id: leadId, type: 'note', action: note.trim(), content: note.trim(),
      created_by: user?.id, user_id: user?.id,
    })
    if (error) { toast.error(error.message); return }
    toast.success('Notă adăugată')
    setNote('')
    loadLead(leadId)
    setTab('history')
  }

  async function handleEditNote(noteId: string) {
    if (!editingNoteText.trim()) return
    const supabase = createClient()
    const { error } = await (supabase as any)
      .from('lead_history')
      .update({ content: editingNoteText.trim(), action: editingNoteText.trim() })
      .eq('id', noteId)
    if (error) { toast.error(error.message); return }
    toast.success('Notă actualizată')
    setEditingNoteId(null)
    setEditingNoteText('')
    if (leadId) loadLead(leadId)
  }

  async function handleDeleteNote(noteId: string) {
    const supabase = createClient()
    const { error } = await (supabase as any)
      .from('lead_history')
      .delete()
      .eq('id', noteId)
    if (error) { toast.error(error.message); return }
    toast.success('Notă ștearsă')
    if (leadId) loadLead(leadId)
  }

  async function saveObligations(selectedIds: string[]) {
    if (!leadId) return
    setSavingObligations(true)
    try {
      const res = await fetch('/api/compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, reportTypeIds: selectedIds }),
      })
      if (!res.ok) throw new Error()
      setClientObligations(selectedIds)
      toast.success('Obligații salvate')
    } catch {
      toast.error('Eroare la salvare')
    } finally {
      setSavingObligations(false)
    }
  }

  // ── Oferte ──

  async function loadOffersData() {
    if (!leadId) return
    const [tplRes, offRes] = await Promise.all([
      fetch('/api/offer-templates'),
      fetch(`/api/offers?lead_id=${leadId}`),
    ])
    const tplJson = await tplRes.json()
    const offJson = await offRes.json()
    setOfferTemplates(tplJson.data || [])
    setClientOffers(offJson.data || [])
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

  const OFFER_STATUS_CFG: Record<string, { label: string; cls: string }> = {
    draft: { label: 'Draft', cls: 'bg-gray-100 text-gray-600' },
    sent: { label: 'Trimis', cls: 'bg-blue-50 text-blue-600' },
    accepted: { label: 'Acceptat', cls: 'bg-green-50 text-green-700' },
    rejected: { label: 'Refuzat', cls: 'bg-red-50 text-red-600' },
  }

  // ── Calificare client ──

  const qualResult = computeQualification(qualAnswers)

  function updateQualField(key: string, value: string) {
    setQualAnswers(a => ({ ...a, [key]: value }))
  }

  async function handleSaveQualification() {
    if (!leadId) return
    setSavingQual(true)
    try {
      const res = await fetch('/api/qualification', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId, ...qualAnswers }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setQualUpdatedAt(json.data.updated_at)
      toast.success('Calificare salvată')
    } catch (err: any) {
      toast.error(err.message || 'Eroare la salvare')
    } finally {
      setSavingQual(false)
    }
  }

  function goToOfferWithRecommendation() {
    const pkgType = PACKAGE_NAME_TO_TYPE[qualResult.recommendedPackage]
    const template = offerTemplates.find((t: any) => t.package_type === pkgType)
    if (template) {
      startNewOffer(template)
      setTab('offers')
    } else {
      toast.error('Șablonul recomandat nu a fost găsit')
    }
  }

  async function handleDelete() {
    if (!leadId) return
    const res = await fetch(`/api/leads/${leadId}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Contact șters'); onClose(); router.refresh() }
    else toast.error('Eroare la ștergere')
  }

  async function openWhatsApp() {
    if (!lead?.phone) { toast.error('Niciun număr de telefon'); return }
    try {
      const res = await fetch('/api/whatsapp/conversation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, phone: lead.phone, name: lead.name }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      onClose()
      router.push(`/whatsapp?conv=${json.conversationId}`)
    } catch (err: any) { toast.error(err.message) }
  }

  const f = (field: string) => ({
    value: form[field] ?? '',
    onChange: (e: any) => setForm((p: any) => ({ ...p, [field]: e.target.value })),
    className: 'input',
  })

  if (!leadId) return null

  const sc = ST_COLORS[lead?.status] || '#94a3b8'
  const ini = lead?.name?.split(' ').map((w: string) => w[0]).join('').substring(0,2).toUpperCase() || '??'

  const TABS = [
    { id: 'info', label: 'Informații' },
    { id: 'note', label: 'Adaugă notă' },
    { id: 'history', label: `Istoric (${history.length})` },
    { id: 'qualification', label: '✅ Calificare' },
    { id: 'fiscal', label: '📋 Fiscal' },
    { id: 'offers', label: `📄 Oferte${clientOffers.length ? ` (${clientOffers.length})` : ''}` },
    { id: 'banking', label: '🏦 Bancă' },
  ]

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[480px] bg-white shadow-2xl z-50 flex flex-col">

        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          {loading ? <div className="h-5 w-40 bg-gray-200 rounded animate-pulse" /> : (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                style={{ background: lead?.assignee?.avatar_color || '#3a7bd5' }}>{ini}</div>
              <div>
                <div className="font-semibold text-gray-900 text-sm">{lead?.name}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: sc }} />
                  <span className="text-xs" style={{ color: sc }}>{lead?.status}</span>
                  {lead?.idno && <span className="text-[10px] text-gray-400 font-mono">· {lead.idno}</span>}
                  {lead?.contract_value && (
                    <span className="text-[10px] text-emerald-600 font-medium">
                      · {Number(lead.contract_value).toLocaleString('ro-RO')} MDL
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            {lead?.phone && (
              <button onClick={openWhatsApp} title="Deschide în WhatsApp CRM"
                className="w-8 h-8 rounded-lg border border-green-200 flex items-center justify-center text-green-600 hover:bg-green-50 transition-colors">
                <MessageCircle size={15} />
              </button>
            )}
            {lead?.phone && (
              <a href={`tel:${lead.phone}`}
                className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors">
                <Phone size={15} />
              </a>
            )}
            <button onClick={onClose} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-gray-50 transition-colors">
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="px-6 border-b border-gray-200 flex gap-1 flex-shrink-0 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={`px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${tab===t.id?'border-[#004437] text-[#004437]':'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1,2,3,4].map(i => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
            </div>
          ) : (
            <>
              {tab === 'info' && (
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="label flex items-center gap-1.5"><User size={12} />Nume complet *</label>
                      <input {...f('name')} placeholder="Ion Popescu" />
                    </div>
                    <div>
                      <label className="label flex items-center gap-1.5"><Building2 size={12} />Companie</label>
                      <input {...f('company')} placeholder="SRL..." />
                    </div>
                    <div>
                      <label className="label flex items-center gap-1.5"><Hash size={12} />IDNO</label>
                      <input {...f('idno')} placeholder="1234567890123" maxLength={13} className="input font-mono tracking-wider" />
                    </div>
                    <div>
                      <label className="label flex items-center gap-1.5"><Phone size={12} />Telefon</label>
                      <input {...f('phone')} placeholder="+373..." />
                    </div>
                    <div>
                      <label className="label flex items-center gap-1.5"><Mail size={12} />Email</label>
                      <input {...f('email')} type="email" placeholder="ion@firma.md" />
                    </div>
                    <div>
                      <label className="label flex items-center gap-1.5"><Tag size={12} />Sursă</label>
                      <select {...f('source')} className="input">{SOURCES.map(s => <option key={s}>{s}</option>)}</select>
                    </div>
                    <div>
                      <label className="label">Serviciu solicitat</label>
                      <select {...f('service_type')} className="input">
                        <option value="">— selectează —</option>
                        {SERVICE_TYPES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Status</label>
                      <select {...f('status')} className="input">{STATUSES.map(s => <option key={s}>{s}</option>)}</select>
                    </div>
                    {isAdmin && team.length > 0 && (
                      <div>
                        <label className="label flex items-center gap-1.5"><User size={12} />Responsabil</label>
                        <select {...f('assigned_to')} className="input">
                          <option value="">— nealocate —</option>
                          {team.map((m: any) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="label flex items-center gap-1.5"><Calendar size={12} />🔔 Reminder</label>
                      <input {...f('reminder_at')} type="datetime-local" className="input" />
                    </div>
                  </div>

                  {form.status === 'Client activ' && (
                    <div className="border-t border-gray-100 pt-4">
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                        <Briefcase size={11} /> Date fiscale
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="label">Regim fiscal</label>
                          <select {...f('fiscal_regime')} className="input">
                            {FISCAL_REGIMES.map(r => <option key={r}>{r}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="label flex items-center gap-1.5"><User size={12} />Nr. angajați</label>
                          <input {...f('employees_count')} type="number" min="0" placeholder="0" className="input" />
                        </div>
                        <div className="col-span-2">
                          <label className="label flex items-center gap-1.5"><Landmark size={12} />Valoare contract lunar (MDL)</label>
                          <input {...f('contract_value')} type="number" min="0" placeholder="0" className="input" />
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="label flex items-center gap-1.5"><FileText size={12} />Notă generală</label>
                    <textarea {...f('note')} className="input resize-none" rows={3} placeholder="Context, servicii dorite..." />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    {!confirmDelete ? (
                      <button onClick={() => setConfirmDelete(true)}
                        className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition-colors">
                        <Trash2 size={13} />Șterge contact
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-red-600 font-medium">Ești sigur?</span>
                        <button onClick={handleDelete} className="text-xs bg-red-500 text-white px-3 py-1 rounded-lg hover:bg-red-600">Da, șterge</button>
                        <button onClick={() => setConfirmDelete(false)} className="text-xs border border-gray-200 px-3 py-1 rounded-lg hover:bg-gray-50">Anulează</button>
                      </div>
                    )}
                    <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-1.5 text-sm">
                      <Save size={14} />{saving ? 'Se salvează...' : 'Salvează'}
                    </button>
                  </div>
                </div>
              )}

              {tab === 'note' && (
                <div className="p-6">
                  <label className="label">Notă nouă</label>
                  <textarea className="input resize-none w-full" rows={5}
                    placeholder="Scrie ce s-a discutat, ce urmează..."
                    value={note} onChange={e => setNote(e.target.value)} autoFocus />
                  <div className="flex justify-end mt-3">
                    <button onClick={handleAddNote} disabled={!note.trim()} className="btn-primary">Adaugă notă</button>
                  </div>
                </div>
              )}

              {tab === 'history' && (
                <div className="p-4 space-y-2">
                  {history.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <Clock size={28} className="mx-auto mb-2 opacity-40" />
                      <p className="text-sm">Niciun istoric</p>
                    </div>
                  ) : history.map((h: any) => {
                    const isStatusChange = h.type === 'status_change'
                    const isNote = h.type === 'note'
                    const isEditingThis = editingNoteId === h.id

                    if (isStatusChange) {
                      const parts = (h.content || h.action || '').split(': ')
                      const transition = parts[1] || ''
                      return (
                        <div key={h.id} className="flex items-center gap-2 py-1">
                          <div className="w-px h-4 bg-gray-200 ml-3 flex-shrink-0" />
                          <div className="flex items-center gap-2 flex-1 bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5">
                            <span className="text-[10px] text-blue-500 font-mono font-semibold">{transition}</span>
                            <span className="flex-1" />
                            <span className="text-[10px] text-gray-400">{h.author?.full_name || 'Sistem'}</span>
                            <span className="text-[10px] text-gray-300">·</span>
                            <span className="text-[10px] text-gray-400">
                              {new Date(h.created_at).toLocaleDateString('ro-RO', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                            </span>
                          </div>
                        </div>
                      )
                    }

                    return (
                      <div key={h.id} className="flex gap-3 group/note">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5"
                          style={{ background: h.author?.avatar_color || '#94a3b8' }}>
                          {h.author?.full_name?.split(' ').map((w: string) => w[0]).join('').substring(0,2) || '?'}
                        </div>
                        <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2.5">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-gray-700">{h.author?.full_name || 'Sistem'}</span>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-gray-400">
                                {new Date(h.created_at).toLocaleDateString('ro-RO', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                              </span>
                              {isAdmin && isNote && !isEditingThis && (
                                <div className="flex items-center gap-0.5 opacity-0 group-hover/note:opacity-100 transition-opacity ml-1">
                                  <button onClick={() => { setEditingNoteId(h.id); setEditingNoteText(h.content || h.action || '') }}
                                    className="p-1 rounded text-gray-400 hover:text-[#004437] transition-colors" title="Editează">
                                    <Pencil size={11} />
                                  </button>
                                  <button onClick={() => handleDeleteNote(h.id)}
                                    className="p-1 rounded text-gray-400 hover:text-red-500 transition-colors" title="Șterge">
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          {isEditingThis ? (
                            <div className="space-y-2">
                              <textarea className="input resize-none w-full text-xs" rows={3}
                                value={editingNoteText} onChange={e => setEditingNoteText(e.target.value)} autoFocus />
                              <div className="flex justify-end gap-2">
                                <button onClick={() => { setEditingNoteId(null); setEditingNoteText('') }}
                                  className="text-xs border border-gray-200 px-2.5 py-1 rounded-lg hover:bg-gray-50">Anulează</button>
                                <button onClick={() => handleEditNote(h.id)} disabled={!editingNoteText.trim()}
                                  className="text-xs bg-[#004437] text-white px-2.5 py-1 rounded-lg hover:bg-[#005a47] disabled:opacity-40">Salvează</button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-600 leading-relaxed">{h.content || h.action}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {tab === 'qualification' && (
                <div className="p-4 space-y-4">
                  <div className="space-y-3">
                    {QUALIFICATION_FIELDS.map(field => (
                      <div key={field.key}>
                        <label className="label">{field.label}</label>
                        <select
                          value={(qualAnswers as any)[field.key] || ''}
                          onChange={e => updateQualField(field.key, e.target.value)}
                          className="input">
                          <option value="">— selectează —</option>
                          {field.options.map(o => (
                            <option key={o.value} value={o.value}>{o.value}{o.note ? ` — ${o.note}` : ''}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>

                  {/* Scoruri agregate */}
                  <div className="border-t border-gray-100 pt-3">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Scoruri agregate</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-gray-50 rounded-lg p-2.5">
                        <div className="text-[10px] text-gray-400">Dimensiune</div>
                        <div className="text-lg font-bold text-gray-700">{qualResult.scoreDimension ?? '—'}</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2.5">
                        <div className="text-[10px] text-gray-400">Complexitate</div>
                        <div className="text-lg font-bold text-gray-700">{qualResult.scoreComplexity ?? '—'}</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2.5">
                        <div className="text-[10px] text-gray-400">Maturitate</div>
                        <div className="text-lg font-bold text-gray-700">{qualResult.scoreMaturity ?? '—'}</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2.5">
                        <div className="text-[10px] text-gray-400">Fit TaxFlow</div>
                        <div className="text-lg font-bold text-gray-700">{qualResult.scoreFit ?? '—'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Recomandare */}
                  {qualResult.recommendedPackage && (
                    <div className="bg-[#e8f5f0] border border-[#004437]/20 rounded-xl p-3.5">
                      <div className="flex items-center gap-2 mb-1">
                        <ClipboardCheck size={14} className="text-[#004437]" />
                        <span className="text-[11px] font-semibold text-[#004437] uppercase tracking-wide">Recomandare automată</span>
                      </div>
                      <div className="text-base font-bold text-[#004437]">{qualResult.recommendedPackage}</div>
                      <div className="text-xs text-gray-500 mt-0.5">OverallScore: {qualResult.overallScore}</div>

                      {qualResult.riskFlags.length > 0 && (
                        <div className="mt-2.5 space-y-1">
                          {qualResult.riskFlags.map((flag, i) => (
                            <div key={i} className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5">
                              <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                              <span>{flag}</span>
                            </div>
                          ))}
                          <p className="text-[10px] text-gray-400 italic mt-1">
                            Recomandarea automată e un punct de plecare. Cu flaguri risc, se face call de aliniere înainte de ofertare.
                          </p>
                        </div>
                      )}

                      <button onClick={goToOfferWithRecommendation}
                        className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs bg-[#004437] text-white px-3 py-2 rounded-lg hover:bg-[#005a47] transition-colors">
                        Generează ofertă cu {qualResult.recommendedPackage} <ArrowRight size={12} />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    {qualUpdatedAt && (
                      <span className="text-[10px] text-gray-400">
                        Salvat {new Date(qualUpdatedAt).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    <button onClick={handleSaveQualification} disabled={savingQual}
                      className="btn-primary flex items-center gap-1.5 text-sm ml-auto">
                      <Save size={14} />{savingQual ? 'Se salvează...' : 'Salvează calificarea'}
                    </button>
                  </div>
                </div>
              )}

              {tab === 'fiscal' && (
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Obligații fiscale</p>
                    <span className="text-[10px] text-gray-400">{clientObligations.length} active</span>
                  </div>
                  {reportTypes.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">
                      Niciun tip de raport configurat
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {reportTypes.map((t: any) => {
                        const isChecked = clientObligations.includes(t.id)
                        const freqLabel: Record<string,string> = {
                          monthly: 'lunar', quarterly: 'trimestrial',
                          semi: 'semestrial', annual: 'anual'
                        }
                        return (
                          <label key={t.id}
                            className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors ${isChecked ? 'bg-[#e8f5f0] border border-[#004437]/20' : 'bg-gray-50 border border-transparent hover:border-gray-200'}`}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={e => {
                                const newIds = e.target.checked
                                  ? [...clientObligations, t.id]
                                  : clientObligations.filter((id: string) => id !== t.id)
                                saveObligations(newIds)
                              }}
                              className="w-4 h-4 accent-[#004437] flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-gray-700 font-mono">{t.code}</span>
                                <span className="text-xs text-gray-500 truncate">{t.label}</span>
                              </div>
                              {(t.frequency || t.deadline_day) && (
                                <div className="flex items-center gap-2 mt-0.5">
                                  {t.frequency && (
                                    <span className="text-[10px] text-gray-400 capitalize">
                                      {freqLabel[t.frequency] || t.frequency}
                                    </span>
                                  )}
                                  {t.deadline_day && (
                                    <span className="text-[10px] text-gray-400">
                                      · termen: {t.deadline_day}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            {isChecked && (
                              <span className="text-[10px] text-[#004437] font-medium flex-shrink-0">Activ</span>
                            )}
                          </label>
                        )
                      })}
                    </div>
                  )}
                  {savingObligations && (
                    <p className="text-xs text-gray-400 text-center">Se salvează...</p>
                  )}
                </div>
              )}

              {tab === 'offers' && (
                <div className="p-4">
                  {offerStep === 'list' && (
                    <div className="space-y-4">
                      {/* Lista oferte existente */}
                      {clientOffers.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Oferte trimise</p>
                          {clientOffers.map((o: any) => {
                            const cfg = OFFER_STATUS_CFG[o.status] || OFFER_STATUS_CFG.draft
                            return (
                              <div key={o.id} className="border border-gray-200 rounded-xl p-3 hover:border-gray-300 transition-colors">
                                <div className="flex items-center justify-between">
                                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => editOffer(o)}>
                                    <div className="text-sm font-medium text-gray-800">{o.content_json?.packageName || o.template?.name}</div>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cfg.cls}`}>{cfg.label}</span>
                                      <span className="text-[10px] text-gray-400">{Number(o.price).toLocaleString('ro-RO')} {o.price_unit}</span>
                                      <span className="text-[10px] text-gray-400">· {new Date(o.created_at).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' })}</span>
                                    </div>
                                  </div>
                                  <button onClick={() => handleDeleteOffer(o.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1">
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Selectare șablon nou */}
                      <div>
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Generează ofertă nouă</p>
                        <div className="space-y-2">
                          {offerTemplates.map((t: any) => (
                            <button key={t.id} onClick={() => startNewOffer(t)}
                              className="w-full text-left border border-gray-200 rounded-xl p-3 hover:border-[#004437] hover:bg-[#f8fffd] transition-colors group">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-sm font-semibold text-gray-800 group-hover:text-[#004437]">{t.name}</div>
                                  <div className="text-xs text-gray-400 mt-0.5">{t.tagline}</div>
                                </div>
                                <div className="text-xs text-emerald-600 font-medium whitespace-nowrap ml-2">
                                  {Number(t.price_min).toLocaleString('ro-RO')}–{Number(t.price_max).toLocaleString('ro-RO')} {t.price_unit}
                                </div>
                              </div>
                            </button>
                          ))}
                          {offerTemplates.length === 0 && (
                            <div className="text-center py-6 text-gray-400 text-sm">Niciun șablon disponibil</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {offerStep === 'edit' && offerForm && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <button onClick={() => setOfferStep('list')} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                          ← Înapoi la listă
                        </button>
                        {offerForm.status && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${(OFFER_STATUS_CFG[offerForm.status] || OFFER_STATUS_CFG.draft).cls}`}>
                            {(OFFER_STATUS_CFG[offerForm.status] || OFFER_STATUS_CFG.draft).label}
                          </span>
                        )}
                      </div>

                      <div>
                        <label className="label">Destinat (sector / companie)</label>
                        <input value={offerForm.sector} onChange={e => updateOfferField('sector', e.target.value)} className="input" placeholder="ex: Tutungerie / Retail" />
                      </div>

                      {/* Probleme identificate */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="label !mb-0">Probleme identificate</label>
                          <button onClick={addProblem} className="text-[10px] text-[#004437] font-medium flex items-center gap-1 hover:underline">
                            <PlusIcon size={10} /> Adaugă
                          </button>
                        </div>
                        <div className="space-y-2">
                          {offerForm.problems.map((p: any, i: number) => (
                            <div key={i} className="bg-gray-50 rounded-xl p-2.5 space-y-1.5">
                              <div className="flex items-center gap-2">
                                <input value={p.title} onChange={e => updateProblem(i, 'title', e.target.value)}
                                  placeholder="Titlu problemă" className="input text-xs flex-1" />
                                <button onClick={() => removeProblem(i)} className="text-gray-300 hover:text-red-500 flex-shrink-0">
                                  <Trash2 size={12} />
                                </button>
                              </div>
                              <textarea value={p.text} onChange={e => updateProblem(i, 'text', e.target.value)}
                                placeholder="Descriere și consecințe..." className="input text-xs resize-none" rows={2} />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Pachet + preț */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="label">Pachet</label>
                          <select
                            value={offerForm.template_id || ''}
                            onChange={e => handlePackageChange(e.target.value)}
                            className="input">
                            {(!offerForm.template_id || !offerTemplates.some((t: any) => t.id === offerForm.template_id)) && (
                              <option value="">{offerForm.packageName || '— selectează —'}</option>
                            )}
                            {offerTemplates.map((t: any) => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="label">Preț (MDL/lună)</label>
                          <input value={offerForm.price} onChange={e => updateOfferField('price', e.target.value)} type="number" min="0" className="input" />
                        </div>
                        <div>
                          <label className="label">Contract minim (luni)</label>
                          <input value={offerForm.contractMonths} onChange={e => updateOfferField('contractMonths', e.target.value)} type="number" min="1" className="input" />
                        </div>
                        <div>
                          <label className="label">Valabilă până la</label>
                          <input value={offerForm.validUntil} onChange={e => updateOfferField('validUntil', e.target.value)} placeholder="DD.MM.YYYY" className="input" />
                        </div>
                      </div>

                      {/* Categorii de servicii */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="label !mb-0">Servicii incluse</label>
                          <button onClick={handleReloadServicesFromPackage}
                            className="text-[10px] text-gray-400 hover:text-[#004437] underline flex-shrink-0">
                            ↻ Reîncarcă din pachet
                          </button>
                        </div>
                        <p className="text-[10px] text-gray-400 -mt-2">Descrierea apare în glosarul PDF (pagină separată, font mic)</p>
                        {offerForm.categories.map((cat: any, ci: number) => (
                          <div key={ci} className="bg-gray-50 rounded-xl p-3">
                            <div className="text-xs font-semibold text-gray-700 mb-2">{cat.title}</div>
                            <div className="space-y-2">
                              {cat.items.map((item: any, ii: number) => (
                                <div key={ii} className="bg-white rounded-lg p-2 border border-gray-100 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <input value={item.title} onChange={e => updateCategoryItem(ci, ii, 'title', e.target.value)}
                                      placeholder="Titlu serviciu" className="input text-xs flex-1 font-medium" />
                                    <button onClick={() => removeCategoryItem(ci, ii)} className="text-gray-300 hover:text-red-500 flex-shrink-0">
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                  <input value={item.description || ''} onChange={e => updateCategoryItem(ci, ii, 'description', e.target.value)}
                                    placeholder="Descriere pentru glosar (opțional, dar recomandat)" className="input text-[11px] text-gray-500 w-full" />
                                </div>
                              ))}
                              <button onClick={() => addCategoryItem(ci)} className="text-[10px] text-[#004437] font-medium hover:underline flex items-center gap-1">
                                <PlusIcon size={10} /> Adaugă serviciu
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Ce nu este inclus */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="label !mb-0">Ce nu este inclus</label>
                          <button onClick={addExcluded} className="text-[10px] text-[#004437] font-medium flex items-center gap-1 hover:underline">
                            <PlusIcon size={10} /> Adaugă
                          </button>
                        </div>
                        <div className="space-y-1.5">
                          {offerForm.excluded.map((e: string, i: number) => (
                            <div key={i} className="flex items-center gap-2">
                              <input value={e} onChange={ev => updateExcluded(i, ev.target.value)} className="input text-xs flex-1" />
                              <button onClick={() => removeExcluded(i)} className="text-gray-300 hover:text-red-500 flex-shrink-0">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Acțiuni */}
                      <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                        <button onClick={() => handleSaveOfferDraft('draft')} disabled={savingOffer}
                          className="text-xs border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors flex-1">
                          {savingOffer ? 'Se salvează...' : 'Salvează draft'}
                        </button>
                        <button onClick={handleDownloadPdf} disabled={generatingPdf}
                          className="text-xs bg-gray-700 text-white px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-1.5 flex-1">
                          <Download size={13} /> {generatingPdf ? 'Se generează...' : 'Download PDF'}
                        </button>
                        <button onClick={handleSendEmail} disabled={sendingEmail}
                          className="text-xs bg-[#004437] text-white px-3 py-2 rounded-lg hover:bg-[#005a47] transition-colors flex items-center justify-center gap-1.5 flex-1">
                          <Send size={13} /> {sendingEmail ? 'Se trimite...' : 'Trimite email'}
                        </button>
                      </div>
                      {!lead?.email && (
                        <p className="text-[10px] text-amber-600 text-center">Clientul nu are email salvat — completează în tab Informații pentru trimitere directă.</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {tab === 'banking' && leadId && (
                <BankingTab leadId={leadId} isAdmin={isAdmin} />
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
