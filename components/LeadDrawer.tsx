'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { X, Save, Trash2, MessageCircle, Phone, Mail, Building2, User, Tag, Calendar, FileText, Clock, Landmark, Hash, Briefcase, Pencil, DollarSign } from 'lucide-react'
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
}

export default function LeadDrawer({ leadId, onClose, team = [], isAdmin = false }: Props) {
  const router = useRouter()
  const [lead, setLead] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState('')
  const [tab, setTab] = useState<'info'|'note'|'history'|'banking'>('info')
  const [form, setForm] = useState<any>({})
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string|null>(null)
  const [editingNoteText, setEditingNoteText] = useState('')

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
      value_estimated: data?.value_estimated ?? '',
    })
    setLoading(false)
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
          value_estimated: form.value_estimated !== '' ? Number(form.value_estimated) : null,
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
                  {lead?.value_estimated && (
                    <span className="text-[10px] text-emerald-600 font-medium">
                      · {Number(lead.value_estimated).toLocaleString('ro-RO')} MDL
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
                    <div>
                      <label className="label flex items-center gap-1.5"><DollarSign size={12} />Valoare estimată (MDL)</label>
                      <input {...f('value_estimated')} type="number" min="0" placeholder="0" className="input" />
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
