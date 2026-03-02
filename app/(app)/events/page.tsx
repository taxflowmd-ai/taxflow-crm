'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'

const TYPE_CFG: Record<string,{label:string,icon:string,cls:string}> = {
  meeting:{label:'Întâlnire',icon:'🤝',cls:'bg-blue-50 text-blue-700'},
  call:{label:'Apel',icon:'📞',cls:'bg-green-50 text-green-700'},
  deadline:{label:'Deadline',icon:'⏰',cls:'bg-red-50 text-red-600'}
}
const MONTHS = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie']
const DAYS = ['L','M','M','J','V','S','D']

export default function EventsPage() {
  const [events, setEvents] = useState<any[]>([])
  const [leads, setLeads] = useState<any[]>([])
  const [showModal, setShowModal] = useState(false)
  const [cal, setCal] = useState({y:new Date().getFullYear(),m:new Date().getMonth()})
  const [form, setForm] = useState({title:'',type:'meeting',lead_id:'',starts_at:'',location:'',note:''})

  async function load() {
    const supabase = createClient()
    const {data:e} = await (supabase as any).from('events').select('*, lead:lead_id(name)').order('starts_at')
    const {data:l} = await (supabase as any).from('leads').select('id,name').order('name')
    setEvents(e as any[]||[])
    setLeads(l as any[]||[])
  }

  useEffect(()=>{ load() },[])

  async function handleAdd(e:React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()
    const {data:{user}} = await supabase.auth.getUser()
    const payload: any = {
      title: form.title,
      type: form.type,
      lead_id: form.lead_id||null,
      starts_at: form.starts_at,
      location: form.location||null,
      note: form.note||null,
      assigned_to: user?.id,
      created_by: user?.id,
    }
    const {error} = await (supabase as any).from('events').insert(payload as any)
    if(error){toast.error(error.message);return}
    toast.success('Eveniment adăugat')
    setShowModal(false)
    setForm({title:'',type:'meeting',lead_id:'',starts_at:'',location:'',note:''})
    load()
  }

  const evDates = new Set(events.map((e:any)=>new Date(e.starts_at).toDateString()))
  const today = new Date()
  const fd = new Date(cal.y,cal.m,1).getDay()
  const dim = new Date(cal.y,cal.m+1,0).getDate()
  const off = fd===0?6:fd-1
  const calDays = Array.from({length:off},(_,i)=>({d:0,i})).concat(Array.from({length:dim},(_,i)=>({d:i+1,i:i+off})))
  const upcoming = events.filter((e:any)=>new Date(e.starts_at)>=today).slice(0,20)
  const inp=(field:string)=>({value:(form as any)[field],onChange:(e:any)=>setForm(f=>({...f,[field]:e.target.value})),className:'input'})

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="bg-white border-b border-gray-200 px-6 h-14 flex items-center justify-between flex-shrink-0">
        <div><h1 className="text-base font-semibold">Evenimente</h1><p className="text-xs text-gray-400">{upcoming.length} viitoare</p></div>
        <button onClick={()=>setShowModal(true)} className="btn-primary"><Plus size={15}/>Eveniment nou</button>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-[1fr_280px] gap-6 items-start">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-900">Upcoming</div>
            {upcoming.map((e:any)=>{
              const cfg=TYPE_CFG[e.type]||TYPE_CFG.meeting
              const d=new Date(e.starts_at)
              return (
                <div key={e.id} className="px-4 py-3 border-b border-gray-100 last:border-0 flex items-center gap-4 hover:bg-gray-50">
                  <div className="text-center w-12 flex-shrink-0">
                    <div className="text-xs font-bold text-[#004437]">{d.toLocaleTimeString('ro-RO',{hour:'2-digit',minute:'2-digit'})}</div>
                    <div className="text-[10px] text-gray-400">{d.toLocaleDateString('ro-RO',{day:'2-digit',month:'short'})}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">{e.title}</div>
                    <div className="text-xs text-gray-400">{e.lead?.name&&'👤 '+e.lead.name}{e.location&&' · 📍'+e.location}</div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.cls}`}>{cfg.icon} {cfg.label}</span>
                </div>
              )
            })}
            {upcoming.length===0&&<div className="text-center py-12 text-gray-400 text-sm">Niciun eveniment viitor</div>}
          </div>
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <button onClick={()=>setCal(c=>{let m=c.m-1,y=c.y;if(m<0){m=11;y--}return{y,m}})} className="w-7 h-7 border border-gray-200 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-50">‹</button>
              <span className="text-sm font-semibold">{MONTHS[cal.m]} {cal.y}</span>
              <button onClick={()=>setCal(c=>{let m=c.m+1,y=c.y;if(m>11){m=0;y++}return{y,m}})} className="w-7 h-7 border border-gray-200 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-50">›</button>
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {DAYS.map((d,i)=><div key={i} className="text-center text-[10px] font-semibold text-gray-400 py-1">{d}</div>)}
              {calDays.map(({d,i})=>{
                if(!d) return <div key={i}/>
                const dt=new Date(cal.y,cal.m,d)
                const isToday=dt.toDateString()===today.toDateString()
                const hasEv=evDates.has(dt.toDateString())
                return (
                  <div key={i} className={`relative text-center text-xs py-1.5 rounded-lg ${isToday?'bg-[#004437] text-white font-bold':'text-gray-700 hover:bg-gray-50'}`}>
                    {d}
                    {hasEv&&<span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${isToday?'bg-white/70':'bg-[#00c48c]'}`}/>}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
      {showModal&&(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold">Eveniment nou</h2>
              <button onClick={()=>setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <form onSubmit={handleAdd} className="px-6 py-4 space-y-3">
              <div><label className="label">Titlu *</label><input {...inp('title')} required placeholder="Întâlnire..."/></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Tip</label>
                  <select {...inp('type')} className="input">
                    <option value="meeting">🤝 Întâlnire</option>
                    <option value="call">📞 Apel</option>
                    <option value="deadline">⏰ Deadline</option>
                  </select>
                </div>
                <div><label className="label">Contact</label>
                  <select {...inp('lead_id')} className="input"><option value="">— niciun contact —</option>
                    {leads.map((l:any)=><option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div><label className="label">Data și ora *</label><input {...inp('starts_at')} type="datetime-local" required/></div>
                <div><label className="label">Locație</label><input {...inp('location')} placeholder="Adresă sau link"/></div>
              </div>
              <div><label className="label">Notă</label><textarea {...inp('note')} className="input resize-none" rows={2}/></div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={()=>setShowModal(false)} className="btn-ghost">Anulează</button>
                <button type="submit" className="btn-primary">Adaugă</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
