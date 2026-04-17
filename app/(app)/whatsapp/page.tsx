'use client'
import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Send, Search, MessageCircle, ExternalLink, RefreshCw, Archive, Trash2, MoreVertical, Zap, UserCircle, Plus, ChevronDown, X, Paperclip } from 'lucide-react'

type Conversation = {
  id: string
  wa_phone: string
  wa_name: string
  last_message: string
  last_message_at: string
  unread_count: number
  lead_id: string | null
  is_archived?: boolean
  lead?: { name: string; status: string }
}

type Message = {
  id: string
  conversation_id: string
  direction: 'inbound' | 'outbound'
  message_type: string
  body: string
  status: string
  created_at: string
  sent_by?: string
  media_url?: string | null
  media_mime_type?: string | null
}

const STATUS_COLORS: Record<string, string> = {
  'Nou': '#94a3b8', 'Contactat': '#3a7bd5', 'Întâlnire programată': '#c9a84c',
  'Ofertă trimisă': '#8b5cf6', 'Client activ': '#00c48c', 'Pierdut': '#e05050'
}

// Template-urile aprobate în Meta — actualizează cu numele exacte din Meta Business Suite
const TEMPLATES = [
  { name: 'chiaramsrl', label: 'Am SRL', language: 'ro' },
  // Adaugă aici template-urile tale aprobate:
  { name: 'contact', label: 'Bună ziua', language: 'ro' },
  { name: 'am_srl', label: 'Vreau SRL', language: 'ro' },
]

function fmtTime(ts: string) {
  const d = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return 'acum'
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm'
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' })
}

// Verifică dacă fereastra de 24h e deschisă (ultimul mesaj inbound < 24h)
function isWindowOpen(messages: Message[]): boolean {
  const lastInbound = [...messages].reverse().find(m => m.direction === 'inbound')
  if (!lastInbound) return false
  const diff = Date.now() - new Date(lastInbound.created_at).getTime()
  return diff < 24 * 60 * 60 * 1000
}

export default function WhatsAppPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [filtered, setFiltered] = useState<Conversation[]>([])
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [q, setQ] = useState('')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [sendingTemplate, setSendingTemplate] = useState(false)
  const [showContactPanel, setShowContactPanel] = useState(false)
  const [contactData, setContactData] = useState<any>(null)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [taskForm, setTaskForm] = useState({ title: '', due_at: '', priority: 'medium' })
  const [savingTask, setSavingTask] = useState(false)
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [changingStatus, setChangingStatus] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const templateRef = useRef<HTMLDivElement>(null)
  const statusMenuRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  const searchParams = useSearchParams()
  const supabase = createClient()

  async function loadConversations() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: prof } = await (supabase as any)
      .from('profiles').select('role').eq('id', user.id).single()
    const isAdmin = (prof as any)?.role === 'admin'

    let query = (supabase as any)
      .from('whatsapp_conversations')
      .select('*, lead:lead_id(name, status)')
      .order('last_message_at', { ascending: false })

    if (!isAdmin) {
      const { data: myLeads } = await (supabase as any)
        .from('leads').select('id').eq('assigned_to', user.id)
      const myLeadIds = (myLeads || []).map((l: any) => l.id)

      // Vede conversațiile proprii + conversațiile fără lead asignat (noi din WA)
      if (myLeadIds.length === 0) {
        query = query.is('lead_id', null)
      } else {
        query = query.or(`lead_id.in.(${myLeadIds.join(',')}),lead_id.is.null`)
      }
    }

    const { data } = await query
    setConversations(data || [])
    setLoading(false)
  }

  async function loadMessages(convId: string) {
    setLoadingMsgs(true)
    const { data } = await (supabase as any)
      .from('whatsapp_messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
    setMessages(data || [])
    setLoadingMsgs(false)

    await (supabase as any)
      .from('whatsapp_conversations')
      .update({ unread_count: 0 })
      .eq('id', convId)

    setConversations(cs => cs.map(c => c.id === convId ? { ...c, unread_count: 0 } : c))
  }

  useEffect(() => { loadConversations() }, [])

  useEffect(() => {
    const convId = searchParams.get('conv')
    if (convId && conversations.length > 0) {
      const conv = conversations.find(c => c.id === convId)
      if (conv && (!selected || selected.id !== convId)) selectConv(conv)
    }
  }, [conversations, searchParams])

  useEffect(() => {
    const channel = supabase
      .channel('whatsapp_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' }, (payload) => {
        const msg = payload.new as Message
        if (selected && msg.conversation_id === selected.id) setMessages(ms => [...ms, msg])
        loadConversations()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_conversations' }, () => { loadConversations() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [selected])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 128) + 'px'
  }, [draft])
  
  // Auto-refresh silențios mesaje la fiecare 15 secunde
  useEffect(() => {
    if (!selected) return
    const interval = setInterval(async () => {
      const { data } = await (supabase as any)
        .from('whatsapp_messages')
        .select('*')
        .eq('conversation_id', selected.id)
        .order('created_at', { ascending: true })
      if (data) {
        // Actualizează doar dacă s-au adăugat mesaje noi
        setMessages(prev => {
          if (data.length !== prev.length) return data
          const lastPrev = prev[prev.length - 1]?.id
          const lastNew = data[data.length - 1]?.id
          if (lastPrev !== lastNew) return data
          return prev // Fără re-render dacă nu s-a schimbat nimic
        })
      }
    }, 15000)
    return () => clearInterval(interval)
  }, [selected?.id])

  // Auto-refresh conversații la fiecare 60 secunde
  useEffect(() => {
    const interval = setInterval(() => loadConversations(), 60000)
    return () => clearInterval(interval)
  }, [])
    
  useEffect(() => {
    const active = conversations.filter(c => showArchived ? c.is_archived : !c.is_archived)
    if (!q) { setFiltered(active); return }
    setFiltered(active.filter(c =>
      c.wa_name?.toLowerCase().includes(q.toLowerCase()) ||
      c.wa_phone?.includes(q) ||
      c.lead?.name?.toLowerCase().includes(q.toLowerCase())
    ))
  }, [q, conversations, showArchived])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
        setConfirmDelete(false)
      }
      if (templateRef.current && !templateRef.current.contains(e.target as Node)) {
        setShowTemplates(false)
      }
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setShowStatusMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function selectConv(conv: Conversation) {
    setSelected(conv)
    setMessages([])
    setDraft('')
    setMenuOpen(false)
    setConfirmDelete(false)
    setShowTemplates(false)
    setShowContactPanel(false)
    setContactData(null)
    setShowStatusMenu(false)
    await loadMessages(conv.id)
  }

  async function loadContactPanel(leadId: string) {
    const { data } = await (supabase as any)
      .from('leads')
      .select('*, assignee:assigned_to(full_name, avatar_color)')
      .eq('id', leadId)
      .single()
    setContactData(data)
    setShowContactPanel(true)
  }

  async function handleAddTask() {
    if (!taskForm.title.trim() || !selected) return
    setSavingTask(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await (supabase as any).from('tasks').insert({
        title: taskForm.title.trim(),
        due_at: taskForm.due_at || null,
        priority: taskForm.priority,
        lead_id: selected.lead_id || null,
        assigned_to: user?.id,
        created_by: user?.id,
        is_done: false,
      })
      if (error) throw error
      toast.success('Sarcină adăugată')
      setShowTaskModal(false)
      setTaskForm({ title: '', due_at: '', priority: 'medium' })
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSavingTask(false)
    }
  }

  async function handleChangeStatus(newStatus: string) {
    if (!selected?.lead_id) return
    setChangingStatus(true)
    try {
      const res = await fetch(`/api/leads/${selected.lead_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error()
      toast.success(`Status → ${newStatus}`)
      setShowStatusMenu(false)
      // Actualizează local
      setConversations(cs => cs.map(c =>
        c.id === selected.id ? { ...c, lead: { ...c.lead!, status: newStatus } } : c
      ))
      setSelected(s => s ? { ...s, lead: { ...s.lead!, status: newStatus } } : s)
    } catch {
      toast.error('Eroare la schimbarea statusului')
    } finally {
      setChangingStatus(false)
    }
  }

  async function archiveConversation() {
    if (!selected) return
    const newVal = !selected.is_archived
    await (supabase as any)
      .from('whatsapp_conversations')
      .update({ is_archived: newVal })
      .eq('id', selected.id)
    toast.success(newVal ? 'Conversație arhivată' : 'Conversație dezarhivată')
    setMenuOpen(false)
    setSelected(null)
    loadConversations()
  }

  async function deleteConversation() {
    if (!selected) return
    await (supabase as any).from('whatsapp_messages').delete().eq('conversation_id', selected.id)
    await (supabase as any).from('whatsapp_conversations').delete().eq('id', selected.id)
    toast.success('Conversație ștearsă')
    setMenuOpen(false)
    setConfirmDelete(false)
    setSelected(null)
    loadConversations()
  }

  async function sendTemplate(templateName: string, languageCode: string) {
    if (!selected || sendingTemplate) return
    setSendingTemplate(true)
    setShowTemplates(false)
    try {
      const res = await fetch('/api/whatsapp/template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: selected.id, templateName, languageCode }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success('Template trimis')
      loadMessages(selected.id)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSendingTemplate(false)
    }
  }

  async function sendMessage() {
    if (!draft.trim() || !selected || sending) return
    setSending(true)
    const msgText = draft.trim()
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: selected.id, message: msgText }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setDraft('')

      if (selected.lead_id) {
        const { data: { user } } = await supabase.auth.getUser()
        const convUrl = `${window.location.origin}/whatsapp?conv=${selected.id}`
        await (supabase as any).from('lead_history').insert({
          lead_id: selected.lead_id,
          type: 'whatsapp',
          action: `💬 Mesaj WhatsApp trimis`,
          content: `Mesaj trimis pe WhatsApp: "${msgText.length > 80 ? msgText.substring(0, 80) + '...' : msgText}" — [Vezi discuția](${convUrl})`,
          created_by: user?.id,
          user_id: user?.id,
        })
      }
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSending(false)
    }
  }

  const windowOpen = isWindowOpen(messages)

  async function sendFile(file: File) {
    if (!selected || !windowOpen) return
    setUploadingFile(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('conversationId', selected.id)
      const res = await fetch('/api/whatsapp/upload', {
        method: 'POST',
        body: formData,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Eroare upload')
      toast.success('Fișier trimis')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setUploadingFile(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }
  const totalUnread = conversations.filter(c => !c.is_archived).reduce((s, c) => s + (c.unread_count || 0), 0)
  const archivedCount = conversations.filter(c => c.is_archived).length

  return (
    <div className="flex-1 flex overflow-hidden">

      {/* ── Sidebar conversații ── */}
      <div className="w-80 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold">WhatsApp</h1>
              {totalUnread > 0 && (
                <span className="bg-[#00c48c] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {totalUnread}
                </span>
              )}
            </div>
            <button onClick={loadConversations} className="text-gray-400 hover:text-[#004437] transition-colors">
              <RefreshCw size={14} />
            </button>
          </div>
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
            <Search size={13} className="text-gray-400" />
            <input
              className="bg-transparent text-sm outline-none flex-1 placeholder:text-gray-400"
              placeholder="Caută conversație..."
              value={q}
              onChange={e => setQ(e.target.value)}
            />
          </div>
          {archivedCount > 0 && (
            <button
              onClick={() => setShowArchived(v => !v)}
              className="mt-2 w-full flex items-center gap-2 text-xs text-gray-500 hover:text-[#004437] transition-colors px-1">
              <Archive size={12} />
              {showArchived ? 'Înapoi la active' : `Arhivate (${archivedCount})`}
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Se încarcă...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 px-4">
              <MessageCircle size={32} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-400 font-medium">Nicio conversație</p>
              <p className="text-xs text-gray-400 mt-1">Mesajele de pe WhatsApp Business vor apărea automat aici</p>
            </div>
          ) : (
            filtered.map(conv => {
              const ini = (conv.wa_name || conv.wa_phone).substring(0, 2).toUpperCase()
              const isSelected = selected?.id === conv.id
              const sc = conv.lead?.status ? STATUS_COLORS[conv.lead.status] : '#94a3b8'
              return (
                <div
                  key={conv.id}
                  onClick={() => selectConv(conv)}
                  className={`px-4 py-3 cursor-pointer border-b border-gray-100 transition-colors ${isSelected ? 'bg-[#e8f0ee]' : 'hover:bg-gray-50'} ${conv.is_archived ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="relative flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-[#25d366] flex items-center justify-center text-white text-xs font-bold">
                        {ini}
                      </div>
                      {conv.unread_count > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#00c48c] rounded-full flex items-center justify-center text-[9px] font-bold text-white">
                          {conv.unread_count > 9 ? '9+' : conv.unread_count}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-sm font-semibold text-gray-900 truncate">{conv.wa_name || conv.wa_phone}</span>
                        <span className="text-[10px] text-gray-400 flex-shrink-0">{conv.last_message_at ? fmtTime(conv.last_message_at) : ''}</span>
                      </div>
                      {conv.lead && (
                        <div className="flex items-center gap-1 mb-0.5">
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: sc }} />
                          <span className="text-[10px] text-gray-500 truncate">{conv.lead.name}</span>
                        </div>
                      )}
                      <p className="text-xs text-gray-400 truncate">{conv.last_message || '—'}</p>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ── Zona de chat ── */}
      {selected ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header chat */}
          <div className="bg-white border-b border-gray-200 px-4 h-14 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              {/* Avatar + nume clickabil → panel contact */}
              <button
                onClick={() => selected.lead_id && (showContactPanel ? setShowContactPanel(false) : loadContactPanel(selected.lead_id!))}
                className={`w-8 h-8 rounded-full bg-[#25d366] flex items-center justify-center text-white text-xs font-bold ${selected.lead_id ? 'hover:ring-2 hover:ring-[#004437]/30 transition-all cursor-pointer' : ''}`}>
                {(selected.wa_name || selected.wa_phone).substring(0, 2).toUpperCase()}
              </button>
              <div>
                <button
                  onClick={() => selected.lead_id && (showContactPanel ? setShowContactPanel(false) : loadContactPanel(selected.lead_id!))}
                  className={`text-sm font-semibold text-gray-900 ${selected.lead_id ? 'hover:text-[#004437] transition-colors cursor-pointer' : ''}`}>
                  {selected.wa_name || selected.wa_phone}
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">+{selected.wa_phone}</span>
                  {messages.length > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${windowOpen ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                      {windowOpen ? '● Fereastră deschisă' : '● Fereastră închisă'}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">

              {/* Buton Adaugă sarcină */}
              {selected.lead_id && (
                <button
                  onClick={() => setShowTaskModal(true)}
                  className="flex items-center gap-1.5 text-xs border border-gray-200 px-2.5 py-1.5 rounded-lg text-gray-600 hover:border-[#004437] hover:text-[#004437] transition-colors"
                  title="Adaugă sarcină">
                  <Plus size={13} /> Sarcină
                </button>
              )}

              {/* Dropdown Schimbă status */}
              {selected.lead_id && (
                <div className="relative" ref={statusMenuRef}>
                  <button
                    onClick={() => setShowStatusMenu(v => !v)}
                    disabled={changingStatus}
                    className="flex items-center gap-1.5 text-xs border border-gray-200 px-2.5 py-1.5 rounded-lg text-gray-600 hover:border-[#004437] hover:text-[#004437] transition-colors disabled:opacity-50">
                    {selected.lead?.status
                      ? <span className="w-1.5 h-1.5 rounded-full" style={{background: STATUS_COLORS[selected.lead.status] || '#94a3b8'}} />
                      : null}
                    {selected.lead?.status || 'Status'}
                    <ChevronDown size={11} />
                  </button>
                  {showStatusMenu && (
                    <div className="absolute right-0 top-9 bg-white border border-gray-200 rounded-xl shadow-lg z-50 w-52 overflow-hidden">
                      {Object.entries(STATUS_COLORS).map(([st, color]) => (
                        <button
                          key={st}
                          onClick={() => handleChangeStatus(st)}
                          className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors ${selected.lead?.status === st ? 'font-semibold text-[#004437] bg-[#f0fdf4]' : 'text-gray-700'}`}>
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{background: color}} />
                          {st}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Buton panel contact */}
              {selected.lead_id && (
                <button
                  onClick={() => showContactPanel ? setShowContactPanel(false) : loadContactPanel(selected.lead_id!)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-colors ${showContactPanel ? 'border-[#004437] text-[#004437] bg-[#e8f0ee]' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                  title="Fișa contact">
                  <UserCircle size={15} />
                </button>
              )}

              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => { setMenuOpen(v => !v); setConfirmDelete(false) }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
                  <MoreVertical size={14} />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-10 bg-white border border-gray-200 rounded-xl shadow-lg z-50 w-52 overflow-hidden">
                    <button
                      onClick={archiveConversation}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <Archive size={14} className="text-gray-400" />
                      {selected.is_archived ? 'Dezarhivează' : 'Arhivează conversația'}
                    </button>
                    <div className="border-t border-gray-100" />
                    {!confirmDelete ? (
                      <button
                        onClick={() => setConfirmDelete(true)}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                        <Trash2 size={14} />
                        Șterge conversația
                      </button>
                    ) : (
                      <div className="px-4 py-3">
                        <p className="text-xs text-gray-600 mb-2">Ești sigur? Toate mesajele vor fi șterse permanent.</p>
                        <div className="flex gap-2">
                          <button onClick={deleteConversation} className="flex-1 text-xs bg-red-500 text-white py-1.5 rounded-lg hover:bg-red-600">Șterge</button>
                          <button onClick={() => setConfirmDelete(false)} className="flex-1 text-xs border border-gray-200 py-1.5 rounded-lg hover:bg-gray-50">Anulează</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Banner fereastră închisă */}
          {messages.length > 0 && !windowOpen && (
            <div className="bg-amber-50 border-b border-amber-100 px-6 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-amber-700 font-medium">
                  Fereastra de 24h e închisă — nu poți trimite mesaje libere.
                </span>
                <span className="text-xs text-amber-600">Folosește un template aprobat pentru a reiniția conversația.</span>
              </div>
              <div className="relative" ref={templateRef}>
                <button
                  onClick={() => setShowTemplates(v => !v)}
                  disabled={sendingTemplate}
                  className="flex items-center gap-1.5 text-xs bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50">
                  <Zap size={12} />
                  {sendingTemplate ? 'Se trimite...' : 'Trimite template'}
                </button>
                {showTemplates && (
                  <div className="absolute right-0 top-9 bg-white border border-gray-200 rounded-xl shadow-lg z-50 w-64 overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-gray-100">
                      <p className="text-xs font-semibold text-gray-700">Template-uri aprobate</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">Selectează pentru a trimite</p>
                    </div>
                    {TEMPLATES.map(t => (
                      <button
                        key={t.name}
                        onClick={() => sendTemplate(t.name, t.language)}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                        <div className="font-medium text-xs">{t.label}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{t.name} · {t.language}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Banner conversație nouă — niciun mesaj */}
          {messages.length === 0 && !loadingMsgs && (
            <div className="bg-blue-50 border-b border-blue-100 px-6 py-2 flex items-center justify-between">
              <span className="text-xs text-blue-700">Conversație nouă — inițiaz-o cu un template aprobat.</span>
              <div className="relative" ref={templateRef}>
                <button
                  onClick={() => setShowTemplates(v => !v)}
                  disabled={sendingTemplate}
                  className="flex items-center gap-1.5 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
                  <Zap size={12} />
                  {sendingTemplate ? 'Se trimite...' : 'Trimite template'}
                </button>
                {showTemplates && (
                  <div className="absolute right-0 top-9 bg-white border border-gray-200 rounded-xl shadow-lg z-50 w-64 overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-gray-100">
                      <p className="text-xs font-semibold text-gray-700">Template-uri aprobate</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">Selectează pentru a trimite</p>
                    </div>
                    {TEMPLATES.map(t => (
                      <button
                        key={t.name}
                        onClick={() => sendTemplate(t.name, t.language)}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                        <div className="font-medium text-xs">{t.label}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{t.name} · {t.language}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Mesaje */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#f0f2f5]">
            {loadingMsgs ? (
              <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Se încarcă mesajele...</div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Niciun mesaj încă</div>
            ) : (
              messages.map(msg => {
                const isOut = msg.direction === 'outbound'
                const isTemplate = msg.message_type === 'template'
                const isImage = msg.message_type === 'image'
                const isDocument = msg.message_type === 'document'
                const isMedia = isImage || isDocument
                return (
                  <div key={msg.id} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs lg:max-w-md xl:max-w-lg rounded-2xl shadow-sm overflow-hidden ${
                      isOut ? 'bg-[#004437] text-white rounded-br-sm' : 'bg-white text-gray-900 rounded-bl-sm'
                    }`}>
                      {isTemplate && (
                        <div className={`text-[10px] px-4 pt-2.5 flex items-center gap-1 ${isOut ? 'text-white/50' : 'text-gray-400'}`}>
                          <Zap size={9} /> Template
                        </div>
                      )}
                      {isImage && msg.media_url && (
                        <a href={`/api/whatsapp/media?id=${msg.media_url}`} target="_blank" rel="noopener">
                          <img src={`/api/whatsapp/media?id=${msg.media_url}`} alt={msg.body || 'Imagine'}
                            className="max-w-full block" style={{ maxHeight: 240 }} />
                        </a>
                      )}
                      {isDocument && msg.media_url && (
                        <a href={`/api/whatsapp/media?id=${msg.media_url}`} target="_blank" rel="noopener"
                          className={`flex items-center gap-3 px-4 py-3 ${isOut ? 'text-white/90 hover:text-white' : 'text-[#004437]'} transition-colors`}>
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-lg ${isOut ? 'bg-white/20' : 'bg-[#004437]/10'}`}>📄</div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{msg.body?.replace('📄 ', '') || 'Document'}</div>
                            <div className={`text-[10px] ${isOut ? 'text-white/50' : 'text-gray-400'}`}>Apasă pentru a deschide</div>
                          </div>
                        </a>
                      )}
                      {!isMedia && (
                        <div className="px-4 py-2.5">
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                        </div>
                      )}
                      {isImage && msg.body && msg.body !== '📷 Imagine' && (
                        <div className="px-4 pb-1 pt-1">
                          <p className="text-xs opacity-80">{msg.body}</p>
                        </div>
                      )}
                      <div className={`flex items-center gap-1 px-4 pb-2 ${isOut ? 'justify-end' : 'justify-start'}`}>
                        <span className={`text-[10px] ${isOut ? 'text-white/60' : 'text-gray-400'}`}>
                          {new Date(msg.created_at).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isOut && (
                          <span className="text-[10px] text-white/60">
                            {msg.status === 'read' ? '✓✓' : msg.status === 'delivered' ? '✓✓' : '✓'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input trimitere */}
          <div className="bg-white border-t border-gray-200 px-4 py-3 flex items-end gap-2">
            {/* Buton atașare fișier */}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) sendFile(file)
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={!windowOpen && messages.length > 0 || uploadingFile}
              className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 text-gray-400 hover:text-[#004437] hover:border-[#004437] transition-colors disabled:opacity-30 flex-shrink-0"
              title="Atașează fișier">
              {uploadingFile
                ? <div className="w-4 h-4 border-2 border-gray-300 border-t-[#004437] rounded-full animate-spin" />
                : <Paperclip size={15} />}
            </button>

            <textarea
              ref={textareaRef}
              className={`flex-1 resize-none border rounded-xl px-4 py-2.5 text-sm outline-none transition-colors min-h-[44px] max-h-32 ${
                !windowOpen && messages.length > 0
                  ? 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed'
                  : 'border-gray-200 focus:border-[#004437]'
              }`}
              placeholder={!windowOpen && messages.length > 0 ? 'Fereastra închisă — folosește un template...' : 'Scrie un mesaj...'}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              disabled={!windowOpen && messages.length > 0}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
              }}
              rows={1}
              style={{ overflow: 'hidden' }}
            />
            <button
              onClick={sendMessage}
              disabled={!draft.trim() || sending || (!windowOpen && messages.length > 0)}
              className="w-11 h-11 bg-[#004437] text-white rounded-xl flex items-center justify-center hover:bg-[#005a47] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            >
              {sending ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Send size={16} />
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-[#f0f2f5]">
          <div className="text-center">
            <div className="w-16 h-16 bg-[#e8f0ee] rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageCircle size={28} className="text-[#004437]" />
            </div>
            <h3 className="text-base font-semibold text-gray-700 mb-1">TaxFlow WhatsApp</h3>
            <p className="text-sm text-gray-400">Selectează o conversație pentru a citi mesajele</p>
          </div>
        </div>
      )}

      {/* ── Panel lateral fișă contact ── */}
      {showContactPanel && contactData && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setShowContactPanel(false)} />
          <div className="fixed right-0 top-0 h-full w-80 bg-white shadow-2xl z-40 flex flex-col border-l border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
              <h3 className="text-sm font-semibold text-gray-900">Fișa contact</h3>
              <button onClick={() => setShowContactPanel(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
                <X size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Header contact */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                  style={{ background: contactData.assignee?.avatar_color || '#3a7bd5' }}>
                  {contactData.name?.split(' ').map((w: string) => w[0]).join('').substring(0,2).toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold text-gray-900 text-sm">{contactData.name}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_COLORS[contactData.status] || '#94a3b8' }} />
                    <span className="text-xs" style={{ color: STATUS_COLORS[contactData.status] || '#94a3b8' }}>{contactData.status}</span>
                  </div>
                </div>
              </div>

              {/* Date contact */}
              <div className="space-y-2">
                {contactData.company && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-xs text-gray-400 w-20 flex-shrink-0">Companie</span>
                    <span className="text-gray-700 font-medium">{contactData.company}</span>
                  </div>
                )}
                {contactData.idno && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-xs text-gray-400 w-20 flex-shrink-0">IDNO</span>
                    <span className="text-gray-700 font-mono">{contactData.idno}</span>
                  </div>
                )}
                {contactData.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-xs text-gray-400 w-20 flex-shrink-0">Telefon</span>
                    <a href={`tel:${contactData.phone}`} className="text-[#004437] hover:underline">{contactData.phone}</a>
                  </div>
                )}
                {contactData.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-xs text-gray-400 w-20 flex-shrink-0">Email</span>
                    <span className="text-gray-700 truncate">{contactData.email}</span>
                  </div>
                )}
                {contactData.source && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-xs text-gray-400 w-20 flex-shrink-0">Sursă</span>
                    <span className="text-gray-700">{contactData.source}</span>
                  </div>
                )}
                {contactData.service_type && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-xs text-gray-400 w-20 flex-shrink-0">Serviciu</span>
                    <span className="text-xs bg-[#004437]/10 text-[#004437] px-2 py-0.5 rounded-full font-medium">{contactData.service_type}</span>
                  </div>
                )}
                {contactData.fiscal_regime && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-xs text-gray-400 w-20 flex-shrink-0">Regim fiscal</span>
                    <span className="text-gray-700">{contactData.fiscal_regime}</span>
                  </div>
                )}
                {contactData.contract_value && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-xs text-gray-400 w-20 flex-shrink-0">Contract</span>
                    <span className="text-emerald-700 font-semibold">{Number(contactData.contract_value).toLocaleString('ro-RO')} MDL</span>
                  </div>
                )}
                {contactData.assignee && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-xs text-gray-400 w-20 flex-shrink-0">Responsabil</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                        style={{ background: contactData.assignee.avatar_color }}>
                        {contactData.assignee.full_name.split(' ').map((w: string) => w[0]).join('').substring(0,2)}
                      </div>
                      <span className="text-gray-700 text-xs">{contactData.assignee.full_name}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Notă generală */}
              {contactData.note && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[11px] text-gray-400 font-medium mb-1">Notă</p>
                  <p className="text-xs text-gray-600 leading-relaxed">{contactData.note}</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Modal adaugă sarcină ── */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Sarcină nouă</h3>
              <button onClick={() => setShowTaskModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Titlu *</label>
                <input
                  className="input w-full"
                  placeholder="Ce trebuie făcut..."
                  value={taskForm.title}
                  onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleAddTask()}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Deadline</label>
                  <input
                    type="datetime-local"
                    className="input w-full"
                    value={taskForm.due_at}
                    onChange={e => setTaskForm(f => ({ ...f, due_at: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Prioritate</label>
                  <select
                    className="input w-full"
                    value={taskForm.priority}
                    onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))}>
                    <option value="low">Scăzută</option>
                    <option value="medium">Medie</option>
                    <option value="high">Înaltă</option>
                  </select>
                </div>
              </div>
              {selected?.lead && (
                <div className="bg-[#e8f0ee] rounded-lg px-3 py-2 text-xs text-[#004437]">
                  Legată de: <strong>{selected.lead.name}</strong>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowTaskModal(false)} className="btn-ghost text-sm">Anulează</button>
              <button onClick={handleAddTask} disabled={!taskForm.title.trim() || savingTask}
                className="btn-primary text-sm flex items-center gap-1.5">
                <Plus size={13} /> {savingTask ? 'Se salvează...' : 'Adaugă'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
