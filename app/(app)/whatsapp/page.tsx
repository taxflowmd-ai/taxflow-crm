'use client'
import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Send, Search, MessageCircle, ExternalLink, RefreshCw, Archive, Trash2, MoreVertical, Zap } from 'lucide-react'

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
}

const STATUS_COLORS: Record<string, string> = {
  'Nou': '#94a3b8', 'Contactat': '#3a7bd5', 'Întâlnire programată': '#c9a84c',
  'Ofertă trimisă': '#8b5cf6', 'Client activ': '#00c48c', 'Pierdut': '#e05050'
}

// Template-urile aprobate în Meta — actualizează cu numele exacte din Meta Business Suite
const TEMPLATES = [
  { name: 'hello_world', label: 'Salut (hello_world)', language: 'en_US' },
  // Adaugă aici template-urile tale aprobate:
  { name: 'contact', label: 'Bună ziua', language: 'ro' },
  // { name: 'taxflow_oferta', label: 'Ofertă servicii', language: 'ro' },
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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const templateRef = useRef<HTMLDivElement>(null)
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
      if (myLeadIds.length === 0) {
        setConversations([])
        setFiltered([])
        setLoading(false)
        return
      }
      query = query.in('lead_id', myLeadIds)
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
  
  useEffect(() => {
    if (!selected) return
    const interval = setInterval(() => {
      loadMessages(selected.id)
    }, 10000)
    return () => clearInterval(interval)
  }, [selected?.id])

  // Auto-refresh conversații la fiecare 30 secunde
  useEffect(() => {
    const interval = setInterval(() => {
      loadConversations()
    }, 60000)
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
    await loadMessages(conv.id)
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
          <div className="bg-white border-b border-gray-200 px-6 h-14 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#25d366] flex items-center justify-center text-white text-xs font-bold">
                {(selected.wa_name || selected.wa_phone).substring(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900">{selected.wa_name || selected.wa_phone}</div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">+{selected.wa_phone}</span>
                  {/* Indicator fereastră 24h */}
                  {messages.length > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${windowOpen ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                      {windowOpen ? '● Fereastră deschisă' : '● Fereastră închisă'}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selected.lead_id && (
                <a href="/contacts" className="flex items-center gap-1.5 text-xs text-[#004437] border border-[#c2d9d3] px-3 py-1.5 rounded-lg hover:bg-[#e8f0ee] transition-colors">
                  <ExternalLink size={12} />
                  Fișa contact
                </a>
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
                return (
                  <div key={msg.id} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs lg:max-w-md xl:max-w-lg rounded-2xl px-4 py-2.5 shadow-sm ${
                      isOut ? 'bg-[#004437] text-white rounded-br-sm' : 'bg-white text-gray-900 rounded-bl-sm'
                    }`}>
                      {isTemplate && (
                        <div className={`text-[10px] mb-1 flex items-center gap-1 ${isOut ? 'text-white/50' : 'text-gray-400'}`}>
                          <Zap size={9} /> Template
                        </div>
                      )}
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                      <div className={`flex items-center gap-1 mt-1 ${isOut ? 'justify-end' : 'justify-start'}`}>
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
          <div className="bg-white border-t border-gray-200 px-4 py-3 flex items-end gap-3">
            <textarea
              className={`flex-1 resize-none border rounded-xl px-4 py-2.5 text-sm outline-none transition-colors max-h-32 min-h-[44px] ${
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
    </div>
  )
}
