'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Plus, LayoutGrid, List } from 'lucide-react'
import LeadDrawer from '@/components/LeadDrawer'

const STATUSES = ['Nou','Contactat','Întâlnire programată','Ofertă trimisă','Client activ','Pierdut','Nu se califică']
const ST_COLORS: Record<string,string> = {
  'Nou':'#94a3b8','Contactat':'#3a7bd5','Întâlnire programată':'#c9a84c',
  'Ofertă trimisă':'#8b5cf6','Client activ':'#00c48c','Pierdut':'#e05050','Nu se califică':'#f97316'
}
const SRC_CLS: Record<string,string> = {
  'Meta Ads':'bg-blue-100 text-blue-700','WhatsApp':'bg-green-100 text-green-700',
  'Organic':'bg-emerald-100 text-emerald-700','Referință':'bg-purple-100 text-purple-700',
  'Site web':'bg-sky-100 text-sky-700','Import':'bg-gray-100 text-gray-600'
}
const SERVICE_TYPES = ['Contabilitate lunară','Înregistrare SRL','Consultanță fiscală','Salarizare','Audit','Altele']

interface Props { leads:any[]; team:any[]; isAdmin:boolean; currentUserId:string }

export default function PipelineClient({ leads, team, isAdmin, currentUserId }:Props) {
  const router = useRouter()
  const [filter, setFilter] = useState('all')
  const [view, setView] = useState<'kanban'|'list'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('pipeline_view') as 'kanban'|'list') || 'kanban'
    }
    return 'kanban'
  })
  const [showModal, setShowModal] = useState(false)
  const [dragId, setDragId] = useState<string|null>(null)
  const [selectedLeadId, setSelectedLeadId] = useState<string|null>(null)
  const [sortField, setSortField] = useState<'name'|'status'|'created_at'|'assigned_to'>('created_at')
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc')
  const [form, setForm] = useState({name:'',company:'',phone:'',email:'',source:'Meta Ads',status:'Nou',assigned_to:'',note:'',reminder_at:'',service_type:''})

  const filtered = leads.filter(l => filter==='all' || l.assignee?.id===filter)

  function toggleView(v: 'kanban'|'list') {
    setView(v)
    localStorage.setItem('pipeline_view', v)
  }

  function toggleSort(field: typeof sortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const sorted = [...filtered].sort((a, b) => {
    let av: any = a[sortField] || ''
    let bv: any = b[sortField] || ''
    if (sortField === 'status') { av = STATUSES.indexOf(a.status); bv = STATUSES.indexOf(b.status) }
    else if (sortField === 'assigned_to') { av = a.assignee?.full_name || ''; bv = b.assignee?.full_name || '' }
    if (av < bv) return sortDir === 'asc' ? -1 : 1
    if (av > bv) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  // Prin API route — înregistrează și în istoric
  async function handleDrop(status: string, leadId: string) {
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error()
      toast.success('→ ' + status)
      router.refresh()
    } catch {
      toast.error('Eroare la actualizare status')
    }
  }

  async function openWhatsApp(e: React.MouseEvent, leadId: string, phone: string, name: string) {
    e.stopPropagation()
    try {
      const res = await fetch('/api/whatsapp/conversation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, phone, name }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      router.push(`/whatsapp?conv=${json.conversationId}`)
    } catch (err: any) { toast.error(err.message) }
  }

  async function handleAddLead(e:React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()
    const {data:{user}} = await supabase.auth.getUser()
    const payload: any = {
      name: form.name, company: form.company||null, phone: form.phone||null,
      email: form.email||null, source: form.source, status: form.status,
      note: form.note||null, reminder_at: form.reminder_at||null,
      service_type: form.service_type||null,
      assigned_to: form.assigned_to||user?.id, created_by: user?.id,
    }
    const {error} = await (supabase as any).from('leads').insert(payload as any)
    if(error){toast.error(error.message);return}
    toast.success('Lead adăugat: '+form.name)
    setShowModal(false)
    setForm({name:'',company:'',phone:'',email:'',source:'Meta Ads',status:'Nou',assigned_to:'',note:'',reminder_at:'',service_type:''})
    router.refresh()
  }

  const inp=(field:string)=>({value:(form as any)[field],onChange:(e:any)=>setForm(f=>({...f,[field]:e.target.value})),className:'input'})

  function SortIcon({ field }: { field: string }) {
    if (sortField !== field) return <span className="text-gray-300 ml-1">↕</span>
    return <span className="text-[#004437] ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="bg-white border-b border-gray-200 px-6 h-14 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-base font-semibold">Pipeline</h1>
          <p className="text-xs text-gray-400">{leads.length} lead-uri</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <button onClick={() => toggleView('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${view === 'kanban' ? 'bg-[#004437] text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
              <LayoutGrid size={13} /> Kanban
            </button>
            <button onClick={() => toggleView('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${view === 'list' ? 'bg-[#004437] text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
              <List size={13} /> Listă
            </button>
          </div>
          <button onClick={()=>setShowModal(true)} className="btn-primary"><Plus size={15}/>Lead nou</button>
        </div>
      </div>

      {isAdmin && (
        <div className="bg-white border-b border-gray-100 px-6 py-2 flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-gray-500 font-medium">Responsabil:</span>
          {[{id:'all',full_name:'Toți',avatar_color:'#004437'}, ...team].map((m:any)=>(
            <button key={m.id} onClick={()=>setFilter(m.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${filter===m.id?'bg-[#004437] text-white border-[#004437]':'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
              {m.full_name}
            </button>
          ))}
        </div>
      )}

      {view === 'kanban' && (
        <div className="flex-1 overflow-x-auto p-6">
          <div className="flex gap-4 h-full min-w-max items-start">
            {STATUSES.map(st=>{
              const cols = filtered.filter(l=>l.status===st)
              const sc = ST_COLORS[st]
              return (
                <div key={st} className="w-60 flex flex-col bg-gray-50 border border-gray-200 rounded-xl max-h-[calc(100vh-220px)]"
                  onDragOver={e=>e.preventDefault()}
                  onDrop={e=>{e.preventDefault();if(dragId)handleDrop(st,dragId)}}>
                  <div className="px-3 py-2.5 border-b border-gray-200 flex items-center gap-2 flex-shrink-0">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{background:sc}}/>
                    <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex-1">{st}</span>
                    <span className="text-xs font-semibold bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{cols.length}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {cols.map((l:any)=>(
                      <div key={l.id} draggable
                        onDragStart={()=>setDragId(l.id)}
                        onDragEnd={()=>setDragId(null)}
                        className="bg-white border border-gray-200 rounded-lg p-3 cursor-grab shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
                        onClick={()=>{if(!dragId)setSelectedLeadId(l.id)}}>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${SRC_CLS[l.source]||'bg-gray-100 text-gray-600'}`}>{l.source}</span>
                        <div className="text-sm font-semibold text-gray-900 mt-1.5 mb-0.5">{l.name}</div>
                        <div className="text-xs text-gray-500 mb-1">{l.company||'—'}</div>
                        {l.service_type && (
                          <div className="text-[10px] bg-[#004437]/8 text-[#004437] px-2 py-0.5 rounded-full inline-block mb-1.5 font-medium">
                            {l.service_type}
                          </div>
                        )}
                        {l.latest_note && (
                          <div className="text-[10px] text-gray-400 italic mb-1.5 line-clamp-1 leading-relaxed">
                            "{(l.latest_note.content || l.latest_note.action || '').substring(0, 40)}{(l.latest_note.content || l.latest_note.action || '').length > 40 ? '...' : ''}"
                          </div>
                        )}
                        {l.reminder_at&&<div className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full inline-block mb-2">🔔 {new Date(l.reminder_at).toLocaleDateString('ro-RO',{day:'2-digit',month:'short'})}</div>}
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-gray-400">{new Date(l.created_at).toLocaleDateString('ro-RO',{day:'2-digit',month:'short'})}</span>
                          {l.assignee&&<div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white" style={{background:l.assignee.avatar_color}}>{l.assignee.full_name.split(' ').map((w:string)=>w[0]).join('').substring(0,2)}</div>}
                        </div>
                        {l.phone&&<div className="mt-2 pt-2 border-t border-gray-100 flex gap-1">
                          <button onClick={(e)=>openWhatsApp(e,l.id,l.phone,l.name)}
                            className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded hover:bg-green-100">💬 WA</button>
                          <a href={`tel:${l.phone}`} onClick={e=>e.stopPropagation()} className="text-[10px] bg-gray-50 text-gray-600 px-2 py-0.5 rounded hover:bg-gray-100">📞</a>
                        </div>}
                      </div>
                    ))}
                    {cols.length===0&&<div className="text-center py-6 text-xs text-gray-400">Niciun lead</div>}
                  </div>
                  <button onClick={()=>{setForm(f=>({...f,status:st}));setShowModal(true)}}
                    className="mx-2 mb-2 py-1.5 border border-dashed border-gray-300 rounded-lg text-xs text-gray-400 hover:border-[#004437] hover:text-[#004437] transition-colors">
                    + Adaugă
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {view === 'list' && (
        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                {[
                  { label: 'Contact', field: 'name' },
                  { label: 'Status', field: 'status' },
                  { label: 'Sursă', field: null },
                  { label: 'Telefon', field: null },
                  { label: 'Reminder', field: null },
                  { label: 'Responsabil', field: 'assigned_to' },
                  { label: 'Adăugat', field: 'created_at' },
                  { label: '', field: null },
                ].map((col, i) => (
                  <th key={i} onClick={() => col.field && toggleSort(col.field as any)}
                    className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200 whitespace-nowrap ${col.field ? 'cursor-pointer hover:text-gray-700 select-none' : ''}`}>
                    {col.label}{col.field && <SortIcon field={col.field} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map((l:any) => {
                const ini = l.name.split(' ').map((w:string)=>w[0]).join('').substring(0,2).toUpperCase()
                const sc = ST_COLORS[l.status] || '#94a3b8'
                const reminderExpired = l.reminder_at && new Date(l.reminder_at) < new Date()
                return (
                  <tr key={l.id} className="hover:bg-gray-50 cursor-pointer group" onClick={()=>setSelectedLeadId(l.id)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                          style={{background: l.assignee?.avatar_color || '#3a7bd5'}}>{ini}</div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{l.name}</div>
                          <div className="text-xs text-gray-400">{l.company||'—'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                        style={{background: sc+'22', color: sc}}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{background: sc}}/>{l.status}
                      </span>
                    </td>
                    <td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${SRC_CLS[l.source]||'bg-gray-100 text-gray-600'}`}>{l.source}</span></td>
                    <td className="px-4 py-3"><a href={`tel:${l.phone}`} onClick={e=>e.stopPropagation()} className="text-sm text-[#004437] hover:underline">{l.phone||'—'}</a></td>
                    <td className="px-4 py-3">
                      {l.reminder_at ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${reminderExpired ? 'bg-red-50 text-red-600 font-medium' : 'bg-amber-50 text-amber-700'}`}>
                          🔔 {new Date(l.reminder_at).toLocaleDateString('ro-RO',{day:'2-digit',month:'short'})}
                        </span>
                      ) : <span className="text-xs text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {l.assignee && (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                            style={{background: l.assignee.avatar_color}}>
                            {l.assignee.full_name.split(' ').map((w:string)=>w[0]).join('').substring(0,2)}
                          </div>
                          <span className="text-xs text-gray-600 hidden xl:block">{l.assignee.full_name}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                      {new Date(l.created_at).toLocaleDateString('ro-RO',{day:'2-digit',month:'short',year:'2-digit'})}
                    </td>
                    <td className="px-4 py-3">
                      {l.phone && (
                        <button onClick={(e)=>openWhatsApp(e,l.id,l.phone,l.name)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg border border-gray-200 text-green-600 hover:bg-green-50 transition-all">💬</button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {sorted.length === 0 && (
                <tr><td colSpan={8} className="text-center py-16 text-gray-400 text-sm">Niciun lead</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <LeadDrawer leadId={selectedLeadId} onClose={()=>{setSelectedLeadId(null);router.refresh()}} team={team} isAdmin={isAdmin} />

      {showModal&&(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold">Lead nou</h2>
              <button onClick={()=>setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <form onSubmit={handleAddLead} className="px-6 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Nume *</label><input {...inp('name')} placeholder="Ion Popescu" required/></div>
                <div><label className="label">Companie</label><input {...inp('company')} placeholder="SRL..."/></div>
                <div><label className="label">Telefon</label><input {...inp('phone')} placeholder="+373..."/></div>
                <div><label className="label">Email</label><input {...inp('email')} type="email"/></div>
                <div><label className="label">Sursă</label>
                  <select {...inp('source')} className="input">{['Meta Ads','WhatsApp','Organic','Referință','Site web'].map(s=><option key={s}>{s}</option>)}</select>
                </div>
                <div><label className="label">Serviciu solicitat</label>
                  <select {...inp('service_type')} className="input">
                    <option value="">— selectează —</option>
                    {SERVICE_TYPES.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                <div><label className="label">Status</label>
                  <select {...inp('status')} className="input">{STATUSES.map(s=><option key={s}>{s}</option>)}</select>
                </div>
                {isAdmin&&team.length>0&&<div><label className="label">Responsabil</label>
                  <select {...inp('assigned_to')} className="input"><option value="">— eu —</option>
                    {team.map((m:any)=><option key={m.id} value={m.id}>{m.full_name}</option>)}
                  </select>
                </div>}
                <div><label className="label">🔔 Reminder</label><input {...inp('reminder_at')} type="datetime-local" className="input"/></div>
              </div>
              <div><label className="label">Notă</label><textarea {...inp('note')} className="input resize-none" rows={2}/></div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={()=>setShowModal(false)} className="btn-ghost">Anulează</button>
                <button type="submit" className="btn-primary">Adaugă lead</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
