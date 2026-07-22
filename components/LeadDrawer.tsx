'use client'
// Drawer-ul fișei de lead: shell + orchestrare. Conținutul taburilor
// și logica ofertelor sunt în components/lead-drawer/.
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { X, MessageCircle, Phone } from 'lucide-react'
import { computeQualification, QualificationAnswers, PACKAGE_NAME_TO_TYPE } from '@/lib/qualification/scoring'
import { useRouter } from 'next/navigation'
import BankingTab from '@/components/BankingTab'
import { ST_COLORS } from '@/components/lead-drawer/constants'
import { useOfferEditor } from '@/components/lead-drawer/useOfferEditor'
import InfoTab from '@/components/lead-drawer/InfoTab'
import NoteTab from '@/components/lead-drawer/NoteTab'
import HistoryTab from '@/components/lead-drawer/HistoryTab'
import QualificationTab from '@/components/lead-drawer/QualificationTab'
import FiscalTab from '@/components/lead-drawer/FiscalTab'
import OffersTab from '@/components/lead-drawer/OffersTab'

type TabId = 'info'|'note'|'history'|'banking'|'fiscal'|'offers'|'qualification'

interface Props {
  leadId: string | null
  onClose: () => void
  team?: any[]
  isAdmin?: boolean
  initialTab?: TabId
  initialOfferId?: string | null
}

export default function LeadDrawer({ leadId, onClose, team = [], isAdmin = false, initialTab, initialOfferId }: Props) {
  const router = useRouter()
  const [lead, setLead] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState('')
  const [tab, setTab] = useState<TabId>('info')
  const [form, setForm] = useState<any>({})
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string|null>(null)
  const [editingNoteText, setEditingNoteText] = useState('')
  const [reportTypes, setReportTypes] = useState<any[]>([])
  const [clientObligations, setClientObligations] = useState<string[]>([])
  const [savingObligations, setSavingObligations] = useState(false)

  const offers = useOfferEditor(leadId, lead)

  // Calificare client
  const [qualAnswers, setQualAnswers] = useState<QualificationAnswers>({})
  const [savingQual, setSavingQual] = useState(false)
  const [qualUpdatedAt, setQualUpdatedAt] = useState<string | null>(null)
  const qualResult = computeQualification(qualAnswers)

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
    offers.reset()
    offers.loadOffersData().then(loadedOffers => {
      if (initialOfferId) {
        const target = loadedOffers.find((o: any) => o.id === initialOfferId)
        if (target) {
          offers.editOffer(target)
          setTab('offers')
          return
        }
      }
      if (initialTab) setTab(initialTab)
    })

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
    const template = offers.offerTemplates.find((t: any) => t.package_type === pkgType)
    if (template) {
      offers.startNewOffer(template)
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

  if (!leadId) return null

  const sc = ST_COLORS[lead?.status] || '#94a3b8'
  const ini = lead?.name?.split(' ').map((w: string) => w[0]).join('').substring(0,2).toUpperCase() || '??'

  const TABS = [
    { id: 'info', label: 'Informații' },
    { id: 'note', label: 'Adaugă notă' },
    { id: 'history', label: `Istoric (${history.length})` },
    { id: 'qualification', label: '✅ Calificare' },
    { id: 'fiscal', label: '📋 Fiscal' },
    { id: 'offers', label: `📄 Oferte${offers.clientOffers.length ? ` (${offers.clientOffers.length})` : ''}` },
    { id: 'banking', label: '🏦 Bancă' },
  ]

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-[480px] bg-white shadow-2xl z-50 flex flex-col">

        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
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

        <div className="px-4 sm:px-6 border-b border-gray-200 flex gap-1 flex-shrink-0 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id as TabId)}
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
                <InfoTab
                  form={form} setForm={setForm} isAdmin={isAdmin} team={team}
                  saving={saving} confirmDelete={confirmDelete} setConfirmDelete={setConfirmDelete}
                  onSave={handleSave} onDelete={handleDelete}
                />
              )}

              {tab === 'note' && (
                <NoteTab note={note} setNote={setNote} onAdd={handleAddNote} />
              )}

              {tab === 'history' && (
                <HistoryTab
                  history={history} isAdmin={isAdmin}
                  editingNoteId={editingNoteId} editingNoteText={editingNoteText}
                  setEditingNoteId={setEditingNoteId} setEditingNoteText={setEditingNoteText}
                  onEditNote={handleEditNote} onDeleteNote={handleDeleteNote}
                />
              )}

              {tab === 'qualification' && (
                <QualificationTab
                  qualAnswers={qualAnswers} qualResult={qualResult} qualUpdatedAt={qualUpdatedAt}
                  saving={savingQual}
                  onFieldChange={(key, value) => setQualAnswers(a => ({ ...a, [key]: value }))}
                  onSave={handleSaveQualification} onGenerateOffer={goToOfferWithRecommendation}
                />
              )}

              {tab === 'fiscal' && (
                <FiscalTab
                  reportTypes={reportTypes} clientObligations={clientObligations}
                  saving={savingObligations} onSaveObligations={saveObligations}
                />
              )}

              {tab === 'offers' && (
                <OffersTab offers={offers} leadEmail={lead?.email} />
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
