'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Plus, Search, MessageCircle } from 'lucide-react'
import LeadDrawer from '@/components/LeadDrawer'

const ST_COLORS: Record<string,string> = {
  'Nou':'#94a3b8','Contactat':'#3a7bd5','Întâlnire programată':'#c9a84c',
  'Ofertă trimisă':'#8b5cf6','Client activ':'#00c48c','Pierdut':'#e05050'
}
const SRC_CLS: Record<string,string> = {
  'Meta Ads':'bg-blue-100 text-blue-700','WhatsApp':'bg-green-100 text-green-700',
  'Organic':'bg-emerald-100 text-emerald-700','Referință':'bg-purple-100 text-purple-700',
  'Site web':'bg-sky-100 text-sky-700','Import':'bg-gray-100 text-gray-600'
}

export default function ContactsPage() {
  const [leads, setLeads] = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
  const [q, setQ] = useState('')
  const [stFilter, setStFilter] = useState('')
  const [srcFilter, setSrcFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [team, setTeam] = useState<any[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [form, setForm] = useState({name:'',company:'',phone:'',email:'',source:'Meta Ads',assigned_to:'',note:''})
  const [selectedLeadId, setSelectedLeadId] = useState<string|null>(null)

  async function loadData() {
    const supabase = createClient()
    const {data:{user}} = await supabase.auth.getUser()
    const {data:prof} = await (supabase as any).from('profiles').select('role').eq('id',user!.id).single()
    const admin = (prof as any)?.role==='admin'
    setIsAdmin(admin)
    const {data:l} = await (supabase as any).from('leads').select('*, assignee:assigned_to(id,full_name,avatar_color)').order('created_at',{ascending:false})
    const {data:t} = admin ? await (supabase as any).from('profiles').select('id,full_name,avatar_color').eq('is_active',true) : {data:[]}
    setLeads(l as any[] || [])
    setFiltered(l as any[] || [])
    setTeam(t as any[] || [])
    setLoading(false)
  }

  useEffect(()=>{ loadData() },[])

  useEffect(()=>{
    let r = leads
    if(q) r=r.filter(l=>l.name?.toLowerCase().includes(q.toLowerCase())||(l.phone||'').includes(q)||(l.company||'').toLowerCase().includes(q.toLowerCase())||(l.email||'').toLowerCase().includes(q.toLowerCase()))
    if(stFilter) r=r.filter(l=>l.status===stFilter)
    if(srcFilter) r=r.filter(l=>l.source===srcFilter)
    setFiltered(r)
  },[q,stFilter,srcFilter,leads])

  async function handleAdd(e:React.FormEvent){
    e.preventDefault()
    const supabase=createClient()
    const {data:{user}}=await supabase.auth.getUser()
    const payload: any = {
      name: form.name,
      company: form.company||null,
      phone: form.phone||null,
      email: form.email||null,
      source: form.source,
      note: form.note||null,
      status: 'Nou',
      assigned_to: form.assigned_to||user?.id,
      created_by: user?.id,
    }
    const {error}=await (supabase as any).from('leads').insert(payload as any)
    if(error){toast.error(error.message);return}
    toast.success('Contact adăugat')
    setShowModal(false)
    setForm({name:'',company:'',phone:'',email:'',source:'Meta Ads',assigned_to:'',note:''})
    loadData()
  }

  const inp=(field:string,rest?:any)=>({value:(form as any)[field],onChange:(e:any)=>setForm(f=>({...f,[field]:e.target.value})),className:'input',...rest})

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="bg-white border-b border-gray-200 px-6 h-14 flex items-center justify-between flex-shrink-0">
        <div><h1 className="text-base font-semibold">Contacte</h1><p className="text-xs text-gray-400">{filtered.length} din {leads.length}</p></div>
        <button onClick={()=>setShowModal(true)} className="btn-primary"><Plus size={15}/>Contact nou</button>
      </div>
      <div className="bg-white border-b border-gray-100 px-6 py-2 flex items-center gap-3 flex-shrink-0">
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 w-64">
          <Search size={14} className="text-gray-400"/>
          <input className="bg-transparent text-sm outline-none flex-1 placeholder:text-gray-400" placeholder="Caută..." value={q} onChange={e=>setQ(e.target.value)}/>
        </div>
        <select className="input w-44 py-1.5" value={stFilter} onChange={e=>setStFilter(e.target.value)}>
          <option value="">Toate statusurile</option>
          {['Nou','Contactat','Întâlnire programată','Ofertă trimisă','Client activ','Pierdut'].map(s=><option key={s}>{s}</option>)}
        </select>
        <select className="input w-36 py-1.5" value={srcFilter} onChange={e=>setSrcFilter(e.target.value)}>
          <option value="">Toate sursele</option>
          {['Meta Ads','WhatsApp','Organic','Referință','Site web','Import'].map(s=><option key={s}>{s}</option>)}
        </select>
      </div>
      <div className="flex-1 overflow-auto">
        {loading ? <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Se încarcă...</div> : (
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>{['Contact','Telefon','Email','Sursă','Status','Responsabil','Acțiuni'].map(h=>(
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((l:any)=>{
                const ini=l.name.split(' ').map((w:string)=>w[0]).join('').substring(0,2).toUpperCase()
                const uc=l.assignee?.avatar_color||'#3a7bd5'
                const sc=ST_COLORS[l.status]||'#94a3b8'
                return (
                  <tr key={l.id} className="hover:bg-gray-50 cursor-pointer" onClick={()=>setSelectedLeadId(l.id)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{background:uc}}>{ini}</div>
                        <div><div className="text-sm font-medium text-gray-900">{l.name}</div><div className="text-xs text-gray-400">{l.company||'—'}</div></div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><a href={`tel:${l.phone}`} className="text-sm text-[#004437] hover:underline">{l.phone||'—'}</a></td>
                    <td className="px-4 py-3 text-sm text-gray-500">{l.email||'—'}</td>
                    <td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${SRC_CLS[l.source]||'bg-gray-100 text-gray-600'}`}>{l.source}</span></td>
                    <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{background:sc+'22',color:sc}}><span className="w-1.5 h-1.5 rounded-full" style={{background:sc}}/>{l.status}</span></td>
                    <td className="px-4 py-3">{l.assignee&&<div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{background:l.assignee.avatar_color}} title={l.assignee.full_name}>{l.assignee.full_name.split(' ').map((w:string)=>w[0]).join('').substring(0,2)}</div>}</td>
                    <td className="px-4 py-3">{l.phone&&<a href={`https://wa.me/${l.phone.replace(/\D/g,'')}`} target="_blank" className="p-1.5 rounded-lg border border-gray-200 text-green-600 hover:bg-green-50 transition-colors inline-flex"><MessageCircle size={13}/></a>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {!loading&&filtered.length===0&&<div className="text-center py-16 text-gray-400"><div className="text-3xl mb-2">🔍</div><p className="text-sm">Niciun contact găsit</p></div>}
      </div>
      <LeadDrawer leadId={selectedLeadId} onClose={()=>{setSelectedLeadId(null);loadData()}} team={team} isAdmin={isAdmin} />

      {showModal&&(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold">Contact nou</h2>
              <button onClick={()=>setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <form onSubmit={handleAdd} className="px-6 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Nume *</label><input {...inp('name')} required placeholder="Ion Popescu"/></div>
                <div><label className="label">Companie</label><input {...inp('company')} placeholder="SRL..."/></div>
                <div><label className="label">Telefon</label><input {...inp('phone')} placeholder="+373..."/></div>
                <div><label className="label">Email</label><input {...inp('email')} type="email"/></div>
                <div><label className="label">Sursă</label>
                  <select {...inp('source')} className="input">{['Meta Ads','WhatsApp','Organic','Referință','Site web'].map(s=><option key={s}>{s}</option>)}</select>
                </div>
                {isAdmin&&team.length>0&&<div><label className="label">Responsabil</label>
                  <select {...inp('assigned_to')} className="input"><option value="">— eu —</option>{team.map((m:any)=><option key={m.id} value={m.id}>{m.full_name}</option>)}</select>
                </div>}
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
