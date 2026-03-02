'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Plus, CheckSquare, Square, Trash2, RefreshCw } from 'lucide-react'

const FILTERS = [
  {id:'all',label:'Toate'},
  {id:'today',label:'Azi'},
  {id:'overdue',label:'Expirate'},
  {id:'pending',label:'Active'},
  {id:'recurring',label:'Recurente'},
  {id:'done',label:'Finalizate'}
]

const PR_CFG: Record<string,{label:string,cls:string}> = {
  high:{label:'Înaltă',cls:'bg-red-50 text-red-600'},
  medium:{label:'Medie',cls:'bg-amber-50 text-amber-600'},
  low:{label:'Scăzută',cls:'bg-green-50 text-green-700'}
}

const RECURRENCE_LABELS: Record<string,string> = {
  daily:'Zilnic',
  weekly:'Săptămânal',
  monthly:'Lunar',
  quarterly:'Trimestrial',
  yearly:'Anual'
}

const RECURRENCE_MS: Record<string,number> = {
  daily: 86400000,
  weekly: 604800000,
  monthly: 30 * 86400000,
  quarterly: 91 * 86400000,
  yearly: 365 * 86400000,
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<any[]>([])
  const [leads, setLeads] = useState<any[]>([])
  const [filter, setFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [team, setTeam] = useState<any[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [form, setForm] = useState({
    title:'', lead_id:'', priority:'medium', due_at:'', reminder_at:'', assigned_to:'',
    is_recurring: false, recurrence:'weekly', recurrence_end_at:''
  })

  async function load() {
    const supabase = createClient()
    const {data:{user}} = await supabase.auth.getUser()
    const {data:prof} = await (supabase as any).from('profiles').select('role').eq('id',user!.id).single()
    const admin = (prof as any)?.role==='admin'
    setIsAdmin(admin)
    const {data:t} = await (supabase as any)
      .from('tasks')
      .select('*, lead:lead_id(name), assignee:assigned_to(full_name,avatar_color)')
      .order('due_at',{ascending:true})
    const {data:l} = await (supabase as any).from('leads').select('id,name').order('name')
    const {data:tm} = admin
      ? await (supabase as any).from('profiles').select('id,full_name,avatar_color').eq('is_active',true)
      : {data:[]}
    setTasks(t as any[]||[])
    setLeads(l as any[]||[])
    setTeam(tm as any[]||[])
    setLoading(false)
  }

  useEffect(()=>{ load() },[])

  const now = new Date()
  const todayStart = new Date(); todayStart.setHours(0,0,0,0)
  const todayEnd = new Date(); todayEnd.setHours(23,59,59,999)

  const filtered = tasks.filter((t:any) => {
    if(filter==='done') return t.is_done
    if(filter==='pending') return !t.is_done
    if(filter==='recurring') return t.is_recurring
    if(filter==='overdue') return !t.is_done && t.due_at && new Date(t.due_at)<now
    if(filter==='today') return !t.is_done && t.due_at && new Date(t.due_at)>=todayStart && new Date(t.due_at)<=todayEnd
    return true
  })

  async function toggleTask(id:string, done:boolean, task:any) {
    const supabase = createClient()
    await (supabase as any).from('tasks').update({
      is_done:!done,
      done_at:!done?new Date().toISOString():null
    }).eq('id',id)

    // Dacă e recurentă și o bifăm ca done → creează următoarea
    if(!done && task.is_recurring && task.recurrence && task.due_at) {
      const nextDue = new Date(new Date(task.due_at).getTime() + RECURRENCE_MS[task.recurrence])
      const endAt = task.recurrence_end_at ? new Date(task.recurrence_end_at) : null

      if(!endAt || nextDue <= endAt) {
        await (supabase as any).from('tasks').insert({
          title: task.title,
          lead_id: task.lead_id,
          priority: task.priority,
          due_at: nextDue.toISOString(),
          reminder_at: task.reminder_at,
          assigned_to: task.assigned_to,
          created_by: task.created_by,
          is_recurring: true,
          recurrence: task.recurrence,
          recurrence_end_at: task.recurrence_end_at,
          parent_task_id: task.parent_task_id || task.id,
        })
        toast.success('Sarcină finalizată → următoarea a fost creată automat 🔄')
      } else {
        toast.success('Sarcină finalizată — ciclu recurent încheiat')
      }
    } else {
      setTasks(ts=>ts.map((t:any)=>t.id===id?{...t,is_done:!done}:t))
    }

    load()
  }

  async function deleteTask(id:string) {
    const supabase = createClient()
    await (supabase as any).from('tasks').delete().eq('id',id)
    setTasks(ts=>ts.filter((t:any)=>t.id!==id))
    toast.success('Sarcină ștearsă')
  }

  async function handleAdd(e:React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()
    const {data:{user}} = await supabase.auth.getUser()
    const payload: any = {
      title: form.title,
      lead_id: form.lead_id||null,
      priority: form.priority,
      due_at: form.due_at||null,
      reminder_at: form.reminder_at||null,
      assigned_to: form.assigned_to||user?.id,
      created_by: user?.id,
      is_recurring: form.is_recurring,
      recurrence: form.is_recurring ? form.recurrence : null,
      recurrence_end_at: form.is_recurring && form.recurrence_end_at ? form.recurrence_end_at : null,
    }
    const {error} = await (supabase as any).from('tasks').insert(payload)
    if(error){toast.error(error.message);return}
    toast.success('Sarcină adăugată')
    setShowModal(false)
    setForm({title:'',lead_id:'',priority:'medium',due_at:'',reminder_at:'',assigned_to:'',is_recurring:false,recurrence:'weekly',recurrence_end_at:''})
    load()
  }

  const inp=(field:string)=>({
    value:(form as any)[field],
    onChange:(e:any)=>setForm(f=>({...f,[field]:e.target.value})),
    className:'input'
  })

  const recurringCount = tasks.filter((t:any)=>t.is_recurring && !t.is_done).length

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="bg-white border-b border-gray-200 px-6 h-14 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-base font-semibold">Sarcini</h1>
          <p className="text-xs text-gray-400">
            {tasks.filter((t:any)=>!t.is_done).length} active
            {recurringCount > 0 && <span className="ml-2 text-[#004437]">· {recurringCount} recurente</span>}
          </p>
        </div>
        <button onClick={()=>setShowModal(true)} className="btn-primary"><Plus size={15}/>Sarcină nouă</button>
      </div>

      {/* Filtre */}
      <div className="bg-white border-b border-gray-100 px-6 py-2 flex gap-2 flex-shrink-0 overflow-x-auto">
        {FILTERS.map(f=>(
          <button key={f.id} onClick={()=>setFilter(f.id)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all whitespace-nowrap ${filter===f.id?'bg-[#004437] text-white border-[#004437]':'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
            {f.label}
            {f.id==='recurring' && recurringCount > 0 && (
              <span className="ml-1.5 bg-[#00c48c] text-white text-[9px] px-1.5 py-0.5 rounded-full">{recurringCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Lista sarcini */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? <div className="text-center py-16 text-gray-400 text-sm">Se încarcă...</div> : (
          <div className="space-y-2 max-w-3xl">
            {filtered.map((t:any)=>{
              const isOverdue = !t.is_done && t.due_at && new Date(t.due_at)<now
              const isToday = t.due_at && new Date(t.due_at)>=todayStart && new Date(t.due_at)<=todayEnd
              const pr = PR_CFG[t.priority]||PR_CFG.medium
              return (
                <div key={t.id} className={`bg-white border rounded-xl p-4 flex items-start gap-3 shadow-sm hover:shadow-md transition-all ${t.is_done?'opacity-50':'border-gray-200'} ${t.is_recurring&&!t.is_done?'border-l-4 border-l-[#004437]':''}`}>
                  <button onClick={()=>toggleTask(t.id,t.is_done,t)} className="mt-0.5 flex-shrink-0 text-gray-400 hover:text-[#004437] transition-colors">
                    {t.is_done?<CheckSquare size={18} className="text-[#00c48c]"/>:<Square size={18}/>}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium text-gray-900 flex items-center gap-2 ${t.is_done?'line-through text-gray-400':''}`}>
                      {t.title}
                      {t.is_recurring && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-[#e8f0ee] text-[#004437] px-2 py-0.5 rounded-full flex-shrink-0">
                          <RefreshCw size={9}/>{RECURRENCE_LABELS[t.recurrence]||t.recurrence}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {t.lead&&<span className="text-xs text-gray-500">👤 {t.lead.name}</span>}
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${pr.cls}`}>{pr.label}</span>
                      {t.due_at&&<span className={`text-xs font-medium ${isOverdue?'text-red-500':isToday?'text-amber-600':'text-gray-400'}`}>
                        📅 {isOverdue?'⚠ ':''}{new Date(t.due_at).toLocaleDateString('ro-RO',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}
                      </span>}
                      {t.recurrence_end_at&&<span className="text-[10px] text-gray-400">până {new Date(t.recurrence_end_at).toLocaleDateString('ro-RO',{day:'2-digit',month:'short',year:'numeric'})}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {t.assignee&&<div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{background:t.assignee.avatar_color}} title={t.assignee.full_name}>{t.assignee.full_name.split(' ').map((w:string)=>w[0]).join('').substring(0,2)}</div>}
                    <button onClick={()=>deleteTask(t.id)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={14}/></button>
                  </div>
                </div>
              )
            })}
            {filtered.length===0&&<div className="text-center py-16 text-gray-400"><div className="text-3xl mb-2">✅</div><p className="text-sm">Nicio sarcină</p></div>}
          </div>
        )}
      </div>

      {/* Modal adaugă sarcină */}
      {showModal&&(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold">Sarcină nouă</h2>
              <button onClick={()=>setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <form onSubmit={handleAdd} className="px-6 py-4 space-y-3">
              <div>
                <label className="label">Titlu *</label>
                <input {...inp('title')} required placeholder="Sună clientul, trimite oferta..."/>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Contact</label>
                  <select {...inp('lead_id')} className="input">
                    <option value="">— niciun contact —</option>
                    {leads.map((l:any)=><option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Prioritate</label>
                  <select {...inp('priority')} className="input">
                    <option value="high">🔴 Înaltă</option>
                    <option value="medium">🟡 Medie</option>
                    <option value="low">🟢 Scăzută</option>
                  </select>
                </div>
                <div>
                  <label className="label">Deadline</label>
                  <input {...inp('due_at')} type="datetime-local"/>
                </div>
                <div>
                  <label className="label">🔔 Reminder</label>
                  <input {...inp('reminder_at')} type="datetime-local"/>
                </div>
                {isAdmin&&team.length>0&&(
                  <div className="col-span-2">
                    <label className="label">Responsabil</label>
                    <select {...inp('assigned_to')} className="input">
                      <option value="">— eu —</option>
                      {team.map((m:any)=><option key={m.id} value={m.id}>{m.full_name}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* Recurentă */}
              <div className="border border-gray-200 rounded-xl p-3 space-y-3">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <div
                    onClick={()=>setForm(f=>({...f,is_recurring:!f.is_recurring}))}
                    className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${form.is_recurring?'bg-[#004437]':'bg-gray-300'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_recurring?'translate-x-5':'translate-x-0.5'}`}/>
                  </div>
                  <span className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                    <RefreshCw size={14} className="text-[#004437]"/>
                    Sarcină recurentă
                  </span>
                </label>

                {form.is_recurring && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="label">Recurență</label>
                      <select {...inp('recurrence')} className="input">
                        <option value="daily">📅 Zilnic</option>
                        <option value="weekly">📅 Săptămânal</option>
                        <option value="monthly">📅 Lunar</option>
                        <option value="quarterly">📅 Trimestrial</option>
                        <option value="yearly">📅 Anual</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Se termină la</label>
                      <input {...inp('recurrence_end_at')} type="date" placeholder="opțional"/>
                    </div>
                  </div>
                )}
              </div>

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
