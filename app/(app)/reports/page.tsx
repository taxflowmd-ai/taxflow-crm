'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Settings2, X, Plus, Pencil, Trash2, GripVertical, Users } from 'lucide-react'

const MONTHS_FULL = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie']

const STATUS_CFG = {
  pending:     { label: '✗', bg: 'bg-red-100',    text: 'text-red-500',    title: 'Neefectuat' },
  in_progress: { label: '●', bg: 'bg-amber-100',  text: 'text-amber-600',  title: 'În lucru' },
  done:        { label: '✓', bg: 'bg-green-100',  text: 'text-green-700',  title: 'Prezentat' },
  na:          { label: '—', bg: 'bg-gray-100',   text: 'text-gray-400',   title: 'Nu se aplică' },
}
type Status = 'pending' | 'in_progress' | 'done' | 'na'
const CYCLE: Status[] = ['pending', 'in_progress', 'done', 'na']

function ObligationsModal({ client, reportTypes, current, onSave, onClose }: any) {
  const [selected, setSelected] = useState<string[]>(current)
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-gray-900">Obligații fiscale</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
        </div>
        <p className="text-xs text-gray-500 mb-4">{client?.company || client?.name}{client?.company ? ` · ${client.name}` : ''}</p>
        <div className="space-y-1 mb-5 max-h-72 overflow-y-auto">
          {reportTypes.map((t: any) => (
            <label key={t.id} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
              <input type="checkbox" checked={selected.includes(t.id)}
                onChange={e => setSelected(s => e.target.checked ? [...s, t.id] : s.filter((id: string) => id !== t.id))}
                className="w-4 h-4 accent-[#004437]"/>
              <div>
                <span className="text-sm font-semibold text-gray-700">{t.code}</span>
                <span className="text-xs text-gray-400 ml-2">{t.label}</span>
              </div>
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-ghost flex-1">Anulează</button>
          <button onClick={() => onSave(selected)} className="btn-primary flex-1">Salvează</button>
        </div>
      </div>
    </div>
  )
}

function ConfigModal({ reportTypes, onClose, onRefresh }: any) {
  const [types, setTypes] = useState<any[]>(reportTypes)
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ code: '', label: '' })
  const [newForm, setNewForm] = useState({ code: '', label: '' })
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleAdd() {
    if (!newForm.code || !newForm.label) { toast.error('Completează codul și denumirea'); return }
    setSaving(true)
    const res = await fetch('/api/report-types', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newForm, sort_order: types.length + 1 }),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error); setSaving(false); return }
    setTypes(t => [...t, json.data])
    setNewForm({ code: '', label: '' })
    setAdding(false)
    setSaving(false)
    toast.success('Tip adăugat')
    onRefresh()
  }

  async function handleEdit(id: string) {
    setSaving(true)
    const res = await fetch('/api/report-types', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...editForm }),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error); setSaving(false); return }
    setTypes(t => t.map(x => x.id === id ? json.data : x))
    setEditId(null)
    setSaving(false)
    toast.success('Salvat')
    onRefresh()
  }

  async function handleDelete(id: string, code: string) {
    if (!confirm(`Ștergi tipul "${code}"? Toate rapoartele asociate vor fi pierdute.`)) return
    const res = await fetch('/api/report-types', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) { setTypes(t => t.filter(x => x.id !== id)); toast.success('Tip șters'); onRefresh() }
    else toast.error('Eroare la ștergere')
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Configurare tipuri rapoarte</h2>
            <p className="text-xs text-gray-400 mt-0.5">Adaugă, editează sau șterge tipurile de rapoarte</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18}/></button>
        </div>
        <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
          {types.map(t => (
            <div key={t.id} className="flex items-center gap-2 p-2.5 border border-gray-200 rounded-xl hover:border-gray-300 transition-colors">
              <GripVertical size={14} className="text-gray-300 flex-shrink-0"/>
              {editId === t.id ? (
                <>
                  <input value={editForm.code} onChange={e => setEditForm(f => ({...f, code: e.target.value}))}
                    className="input w-20 text-xs py-1 font-mono uppercase" placeholder="COD" maxLength={10}/>
                  <input value={editForm.label} onChange={e => setEditForm(f => ({...f, label: e.target.value}))}
                    className="input flex-1 text-xs py-1" placeholder="Denumire completă"/>
                  <button onClick={() => handleEdit(t.id)} disabled={saving}
                    className="text-xs bg-[#004437] text-white px-2.5 py-1 rounded-lg hover:bg-[#005a47] flex-shrink-0">
                    {saving ? '...' : 'Salvează'}
                  </button>
                  <button onClick={() => setEditId(null)} className="text-gray-400 hover:text-gray-600 flex-shrink-0"><X size={14}/></button>
                </>
              ) : (
                <>
                  <span className="text-sm font-bold text-gray-700 w-16 flex-shrink-0 font-mono">{t.code}</span>
                  <span className="text-sm text-gray-500 flex-1">{t.label}</span>
                  <button onClick={() => { setEditId(t.id); setEditForm({ code: t.code, label: t.label }) }}
                    className="text-gray-300 hover:text-[#004437] transition-colors flex-shrink-0"><Pencil size={13}/></button>
                  <button onClick={() => handleDelete(t.id, t.code)}
                    className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"><Trash2 size={13}/></button>
                </>
              )}
            </div>
          ))}
          {adding ? (
            <div className="flex items-center gap-2 p-2.5 border-2 border-dashed border-[#004437] rounded-xl">
              <Plus size={14} className="text-[#004437] flex-shrink-0"/>
              <input value={newForm.code} onChange={e => setNewForm(f => ({...f, code: e.target.value}))}
                className="input w-20 text-xs py-1 font-mono uppercase" placeholder="COD" maxLength={10} autoFocus/>
              <input value={newForm.label} onChange={e => setNewForm(f => ({...f, label: e.target.value}))}
                className="input flex-1 text-xs py-1" placeholder="Denumire completă"
                onKeyDown={e => e.key === 'Enter' && handleAdd()}/>
              <button onClick={handleAdd} disabled={saving}
                className="text-xs bg-[#004437] text-white px-2.5 py-1 rounded-lg flex-shrink-0">
                {saving ? '...' : 'Adaugă'}
              </button>
              <button onClick={() => setAdding(false)} className="text-gray-400 hover:text-gray-600 flex-shrink-0"><X size={14}/></button>
            </div>
          ) : (
            <button onClick={() => setAdding(true)}
              className="w-full flex items-center gap-2 p-2.5 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-[#004437] hover:text-[#004437] transition-colors text-sm">
              <Plus size={14}/> Adaugă tip nou
            </button>
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-primary w-full">Închide</button>
        </div>
      </div>
    </div>
  )
}

export default function ReportsPage() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [clients, setClients] = useState<any[]>([])
  const [reportTypes, setReportTypes] = useState<any[]>([])
  const [obligations, setObligations] = useState<Record<string, string[]>>({})
  const [reports, setReports] = useState<Record<string, Status>>({})
  const [loading, setLoading] = useState(true)
  const [showSettings, setShowSettings] = useState<string | null>(null)
  const [showConfig, setShowConfig] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [team, setTeam] = useState<any[]>([])
  const [filterUserId, setFilterUserId] = useState<string>('all')
  const [isAdmin, setIsAdmin] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string>('')

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setCurrentUserId(user.id)

    const { data: prof } = await (supabase as any).from('profiles').select('role').eq('id', user.id).single()
    const admin = (prof as any)?.role === 'admin'
    setIsAdmin(admin)

    if (admin) {
      const { data: tm } = await (supabase as any).from('profiles').select('id,full_name,avatar_color').eq('is_active', true).order('full_name')
      setTeam(tm || [])
    }

    const activeFilter = filterUserId === 'all' ? null : filterUserId === 'mine' ? user.id : filterUserId
    
    // Leads prin API route (ocolește RLS)
    const leadsRes = await fetch('/api/reports/clients')
    const leadsJson = await leadsRes.json()
    const allLeads = leadsJson.data || []
    const filteredLeads = activeFilter
      ? allLeads.filter((l: any) => l.assigned_to === activeFilter)
      : allLeads
    
    const [{ data: types }, { data: obls }, { data: reps }] = await Promise.all([
      (supabase as any).from('report_types').select('*').order('sort_order'),
      (supabase as any).from('client_obligations').select('lead_id,report_type_id').eq('is_active', true),
      (supabase as any).from('compliance_reports').select('lead_id,report_type_id,status').eq('year', year).eq('month', month),
    ])
    setClients(filteredLeads)
    setReportTypes(types || [])
    
    const oblMap: Record<string, string[]> = {}
    for (const o of (obls || [])) {
      if (!oblMap[o.lead_id]) oblMap[o.lead_id] = []
      oblMap[o.lead_id].push(o.report_type_id)
    }
    setObligations(oblMap)
    const repMap: Record<string, Status> = {}
    for (const r of (reps || [])) repMap[`${r.lead_id}_${r.report_type_id}`] = r.status
    setReports(repMap)
    setLoading(false)
  }, [year, month, filterUserId])

  useEffect(() => { load() }, [load])

  async function cycleStatus(leadId: string, typeId: string) {
    const key = `${leadId}_${typeId}`
    const current: Status = reports[key] || 'pending'
    const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length]
    setSaving(key)
    setReports(r => ({ ...r, [key]: next }))
    try {
      const res = await fetch('/api/compliance', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, reportTypeId: typeId, year, month, status: next }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setReports(r => ({ ...r, [key]: current }))
      toast.error('Eroare la salvare')
    } finally { setSaving(null) }
  }

  async function saveObligations(leadId: string, selectedIds: string[]) {
    const res = await fetch('/api/compliance', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId, reportTypeIds: selectedIds }),
    })
    if (res.ok) {
      setObligations(o => ({ ...o, [leadId]: selectedIds }))
      toast.success('Obligații salvate')
      setShowSettings(null)
    } else toast.error('Eroare la salvare')
  }

  function prevMonth() { if (month === 1) { setMonth(12); setYear(y => y-1) } else setMonth(m => m-1) }
  function nextMonth() { if (month === 12) { setMonth(1); setYear(y => y+1) } else setMonth(m => m+1) }

  const totalDone = Object.values(reports).filter(s => s === 'done').length
  const totalPending = clients.reduce((acc, c) => {
    const obls = obligations[c.id] || []
    return acc + obls.filter(tid => { const s = reports[`${c.id}_${tid}`]; return !s || s === 'pending' }).length
  }, 0)

  const settingsClient = clients.find(c => c.id === showSettings)
  const filterLabel = filterUserId === 'all' ? 'Toți responsabilii'
    : filterUserId === 'mine' ? 'Clienții mei'
    : team.find(t => t.id === filterUserId)?.full_name || 'Filtru'

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="bg-white border-b border-gray-200 px-6 h-14 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-base font-semibold">Rapoarte & Declarații</h1>
          <p className="text-xs text-gray-400">
            <span className="text-green-600 font-medium">{totalDone} prezentate</span>
            {' · '}
            <span className="text-red-400 font-medium">{totalPending} în așteptare</span>
            {' · '}
            <span className="text-gray-400">{clients.length} clienți</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={filterUserId}
              onChange={e => setFilterUserId(e.target.value)}
              className="appearance-none pl-7 pr-8 py-1.5 text-xs border border-gray-200 rounded-lg bg-white hover:border-gray-300 transition-colors text-gray-600 cursor-pointer focus:outline-none focus:border-[#004437]"
            >
              <option value="all">👥 Toți responsabilii</option>
              <option value="mine">👤 Clienții mei</option>
              {isAdmin && team.map(m => (
                <option key={m.id} value={m.id}>{m.full_name}</option>
              ))}
            </select>
            <Users size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
          </div>
          <button onClick={() => setShowConfig(true)}
            className="flex items-center gap-1.5 text-xs border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors text-gray-600">
            <Settings2 size={13}/> Configurare
          </button>
          <button onClick={prevMonth} className="w-8 h-8 border border-gray-200 rounded-lg flex items-center justify-center hover:bg-gray-50 transition-colors">
            <ChevronLeft size={15}/>
          </button>
          <span className="text-sm font-semibold min-w-[140px] text-center bg-gray-50 px-3 py-1.5 rounded-lg">
            {MONTHS_FULL[month-1]} {year}
          </span>
          <button onClick={nextMonth} className="w-8 h-8 border border-gray-200 rounded-lg flex items-center justify-center hover:bg-gray-50 transition-colors">
            <ChevronRight size={15}/>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Se încarcă...</div>
        ) : (
          <>
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-auto max-h-[calc(100vh-140px)]">
              <table className="w-full border-collapse text-sm">

                {/* ── HEADER STICKY ── */}
                <thead className="sticky top-0 z-20">
                  <tr className="bg-[#004437] text-white">

                    {/* Coloana # */}
                    <th className="sticky left-0 z-30 bg-[#004437] text-center px-3 py-3 font-semibold text-xs w-10 rounded-tl-xl">
                      #
                    </th>

                    {/* Coloana Client */}
                    <th className="sticky left-10 z-30 bg-[#004437] text-left px-4 py-3 font-semibold min-w-[148px]">
                      Client
                      {filterUserId !== 'all' && (
                        <span className="ml-2 text-[10px] text-white/50 font-normal">· {filterLabel}</span>
                      )}
                    </th>

                    {/* Coloane rapoarte */}
                    {reportTypes.map((t, i) => (
                      <th key={t.id} className={`px-2 py-3 font-semibold text-center min-w-[42px] text-xs ${i === reportTypes.length-1 ? 'rounded-tr-xl' : ''}`}>
                        {t.code}
                      </th>
                    ))}
                    <th className="px-2 py-3 min-w-[30px]"></th>
                  </tr>
                </thead>

                {/* ── BODY ── */}
                <tbody>
                  {clients.map((client: any, ci: number) => {
                    const clientObls = obligations[client.id] || []
                    const doneCount = clientObls.filter(tid => reports[`${client.id}_${tid}`] === 'done').length
                    const progress = clientObls.length > 0 ? Math.round((doneCount / clientObls.length) * 100) : 0
                    return (
                      <tr key={client.id} className={`border-b border-gray-100 hover:bg-gray-50/50 group ${ci % 2 === 0 ? '' : 'bg-gray-50/30'}`}>

                        {/* Celula # */}
                        <td className="sticky left-0 z-10 bg-white group-hover:bg-gray-50/50 text-center px-3 py-2.5 text-xs font-semibold text-gray-400 border-r border-gray-100">
                          {ci + 1}
                        </td>

                        {/* Celula Client */}
                        <td className="sticky left-10 z-10 bg-white group-hover:bg-gray-50/50 px-4 py-2.5 border-r border-gray-100">
                          {client.company && <div className="font-medium text-gray-900 text-sm">{client.company}</div>}
                          <div className="text-[11px] text-gray-400">{client.name}</div>
                          {clientObls.length > 0 && (
                            <div className="flex items-center gap-1.5 mt-1">
                              <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden" style={{maxWidth:'80px'}}>
                                <div className="h-full bg-[#00c48c] rounded-full transition-all" style={{width:`${progress}%`}}/>
                              </div>
                              <span className="text-[10px] text-gray-400">{doneCount}/{clientObls.length}</span>
                            </div>
                          )}
                        </td>

                        {/* Celule rapoarte */}
                        {reportTypes.map(t => {
                          const hasObl = clientObls.includes(t.id)
                          const key = `${client.id}_${t.id}`
                          const status: Status = reports[key] || 'pending'
                          const cfg = STATUS_CFG[status]
                          const isSaving = saving === key
                          if (!hasObl) return (
                            <td key={t.id} className="px-1 py-1.5 text-center">
                              <div className="w-full h-8 rounded flex items-center justify-center">
                                <span className="text-gray-100 text-xs select-none">·</span>
                              </div>
                            </td>
                          )
                          return (
                            <td key={t.id} className="px-1 py-1.5 text-center">
                              <button onClick={() => cycleStatus(client.id, t.id)} disabled={!!isSaving}
                                title={cfg.title}
                                className={`w-full h-8 rounded-lg text-sm font-bold transition-all hover:scale-105 active:scale-95 ${cfg.bg} ${cfg.text} ${isSaving ? 'opacity-40' : ''}`}>
                                {isSaving ? '·' : cfg.label}
                              </button>
                            </td>
                          )
                        })}

                        {/* Buton setări */}
                        <td className="px-2 py-1.5 text-center">
                          <button onClick={() => setShowSettings(client.id)}
                            className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center mx-auto text-gray-300 hover:text-[#004437] hover:border-[#004437] transition-colors opacity-0 group-hover:opacity-100">
                            <Settings2 size={12}/>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {clients.length === 0 && (
                    <tr>
                      <td colSpan={reportTypes.length + 3} className="text-center py-16 text-gray-400 text-sm">
                        {filterUserId !== 'all'
                          ? `Niciun client activ pentru ${filterLabel}.`
                          : 'Niciun client activ. Schimbă statusul în Client activ în Pipeline.'
                        }
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Legendă + total clienți */}
            <div className="flex items-center gap-5 mt-3">
              <span className="text-xs text-gray-400 font-medium">Legendă:</span>
              {(Object.entries(STATUS_CFG) as [Status, typeof STATUS_CFG[Status]][]).map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <div className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center ${cfg.bg} ${cfg.text}`}>
                    {cfg.label}
                  </div>
                  <span className="text-xs text-gray-500">{cfg.title}</span>
                </div>
              ))}
              <span className="text-xs text-gray-300 ml-2">· Click pe celulă pentru a schimba statusul</span>
            </div>
          </>
        )}
      </div>

      {showSettings && settingsClient && (
        <ObligationsModal
          client={settingsClient}
          reportTypes={reportTypes}
          current={obligations[showSettings] || []}
          onSave={(ids: string[]) => saveObligations(showSettings, ids)}
          onClose={() => setShowSettings(null)}
        />
      )}

      {showConfig && (
        <ConfigModal
          reportTypes={reportTypes}
          onClose={() => setShowConfig(false)}
          onRefresh={load}
        />
      )}
    </div>
  )
}
