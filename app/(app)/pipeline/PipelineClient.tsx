'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import LeadDrawer from '@/components/LeadDrawer'

const STATUSES = ['Nou','Contactat','Întâlnire programată','Ofertă trimisă','Client activ','Pierdut']
const ST_COLORS: Record<string,string> = {
  'Nou':'#94a3b8','Contactat':'#3a7bd5','Întâlnire programată':'#c9a84c',
  'Ofertă trimisă':'#8b5cf6','Client activ':'#00c48c','Pierdut':'#e05050'
}
const SRC_CLS: Record<string,string> = {
  'Meta Ads':'bg-blue-100 text-blue-700','WhatsApp':'bg-green-100 text-green-700',
  'Organic':'bg-emerald-100 text-emerald-700','Referință':'bg-purple-100 text-purple-700',
  'Site web':'bg-sky-100 text-sky-700','Import':'bg-gray-100 text-gray-600'
}

interface Props { leads:any[]; team:any[]; isAdmin:boolean; currentUserId:string }

export default function PipelineClient({ leads, team, isAdmin, currentUserId }:Props) {
  const router = useRouter()
  const [filter, setFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [dragId, setDragId] = useState<string|null>(null)
  const [selectedLeadId, setSelectedLeadId] = useState<string|null>(null)
  const [form, setForm] = useState({name:'',company:'',phone:'',email:'',source:'Meta Ads',status:'Nou',assigned_to:'',note:'',reminder_at:''})

  const filtered = leads.filter(l => filter==='all' || l.assignee?.id===filter)

  async function handleDrop(status:string, leadId:string) {
    const supabase = createClient()
    await (supabase as any).from('leads').update({status} as any).eq('id', leadId)
    toast.success('→ '+status)
    router.refresh()
  }

  async function handleAddLead(e:React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()
    const {data:{user}} = await supabase.auth.getUser()
    const payload: any = {
      name: form.name,
      company: form.company||null,
      phone: form.phone||null,
      email: form.email||null,
      source: form.source,
      status: form.status,
      note: form.note||null,
      reminder_at: form.reminder_at||null,
      assigned_to: form.assigned_to||user?.id,
      created_by: user?.id,
    }
    const {error} = await (supabase as any).from('leads').insert(payload as any)
    if(error){toast.error(error.message);return}
    toast.success('Lead adăugat: '+form.name)
    setShowModal(false)
    setForm({name:'',company:'',phone:'',email:'',source:'Meta Ads',status:'Nou',assigned_to:'',note:'',reminder_at:''})
    router.refresh()
  }

  const inp=(field:string)=>({value:(form as any)[field],onChange:(e:any)=>setForm(f=>({...f,[field]:e.target.value})),className:'input'})

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="bg-white border-b border-gray-200 px-6 h-14 flex items-center justify-between flex-shrink-0">
        <div><h1 className="text-base font-semibold">Pipeline Kanban</h1><p className="text-xs text-gray-400">{leads.length} lead-uri</p></div>
        <button onClick={()=>setShowModal(true)} className="btn-primary"><Plus size={15}/>Lead nou</button>
      </div>
      {isAdmin&&(
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
                      className="bg-white border border-gray-200 rounded-lg p-3 cursor-grab shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all" onClick={(e)=>{if(!dragId)setSelectedLeadId(l.id)}}>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${SRC_CLS[l.source]||'bg-gray-100 text-gray-600'}`}>{l.source}</span>
                      <div className="text-sm font-semibold text-gray-900 mt-1.5 mb-0.5">{l.name}</div>
                      <div className="text-xs text-gray-500 mb-2">{l.company||'—'}</div>
                      {l.reminder_at&&<div className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full inline-block mb-2">🔔 {new Date(l.reminder_at).toLocaleDateString('ro-RO',{day:'2-digit',month:'short'})}</div>}
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-400">{new Date(l.created_at).toLocaleDateString('ro-RO',{day:'2-digit',month:'short'})}</span>
                        {l.assignee&&<div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white" style={{background:l.assignee.avatar_color}}>{l.assignee.full_name.split(' ').map((w:string)=>w[0]).join('').substring(0,2)}</div>}
                      </div>
                      {l.phone&&<div className="mt-2 pt-2 border-t border-gray-100 flex gap-1">
                        <a href={`https://wa.me/${l.phone.replace(/\D/g,'')}`} target="_blank" className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded hover:bg-green-100">💬 WA</a>
                        <a href={`tel:${l.phone}`} className="text-[10px] bg-gray-50 text-gray-600 px-2 py-0.5 rounded hover:bg-gray-100">📞</a>
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
