'use client'
import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Send, Search, MessageCircle, ExternalLink, RefreshCw } from 'lucide-react'

type Conversation = {
  id: string
  wa_phone: string
  wa_name: string
  last_message: string
  last_message_at: string
  unread_count: number
  lead_id: string | null
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

function fmtTime(ts: string) {
  const d = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return 'acum'
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm'
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' })
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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const searchParams = useSearchParams()
  const supabase = createClient()

  async function loadConversations() {
    const { data } = await (supabase as any)
      .from('whatsapp_conversations')
      .select('*, lead:lead_id(name, status)')
      .order('last_message_at', { ascending: false })
    setConversations(data || [])
    setFiltered(data || [])
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

    // Resetează unread
    await (supabase as any)
      .from('whatsapp_conversations')
      .update({ unread_count: 0 })
      .eq('id', convId)

    setConversations(cs => cs.map(c => c.id === convId ? { ...c, unread_count: 0 } : c))
  }

  useEffect(() => {
    loadConversations().then(() => {
      const convId = searchParams.get('conv')
      if (convId) {
        // selectăm după ce se încarcă lista
      }
    })
  }, [])

  // Auto-selectează conversația din URL
  useEffect(() => {
    const convId = searchParams.get('conv')
    if (convId && conversations.length > 0) {
      const conv = conversations.find(c => c.id === convId)
      if (conv && (!selected || selected.id !== convId)) {
        selectConv(conv)
      }
    }
  }, [conversations, searchParams])

  // Realtime — mesaje noi
  useEffect(() => {
    const channel = supabase
      .channel('whatsapp_realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'whatsapp_messages',
      }, (payload) => {
        const msg = payload.new as Message
        if (selected && msg.conversation_id === selected.id) {
          setMessages(ms => [...ms, msg])
        }
        loadConversations()
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'whatsapp_conversations',
      }, () => { loadConversations() })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [selected])

  // Auto-scroll la ultimul mesaj
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!q) { setFiltered(conversations); return }
    setFiltered(conversations.filter(c =>
      c.wa_name?.toLowerCase().includes(q.toLowerCase()) ||
      c.wa_phone?.includes(q) ||
      c.lead?.name?.toLowerCase().includes(q.toLowerCase())
    ))
  }, [q, conversations])

  async function selectConv(conv: Conversation) {
    setSelected(conv)
    setMessages([])
    setDraft('')
    await loadMessages(conv.id)
  }

  async function sendMessage() {
    if (!draft.trim() || !selected || sending) return
    setSending(true)
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: selected.id, message: draft.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setDraft('')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSending(false)
    }
  }

  const totalUnread = conversations.reduce((s, c) => s + (c.unread_count || 0), 0)

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
                  className={`px-4 py-3 cursor-pointer border-b border-gray-100 transition-colors ${isSelected ? 'bg-[#e8f0ee]' : 'hover:bg-gray-50'}`}
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
                <div className="text-xs text-gray-400">+{selected.wa_phone}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selected.lead_id && (
                <a href="/contacts" className="flex items-center gap-1.5 text-xs text-[#004437] border border-[#c2d9d3] px-3 py-1.5 rounded-lg hover:bg-[#e8f0ee] transition-colors">
                  <ExternalLink size={12} />
                  Vezi fișa contact
                </a>
              )}
              <a
                href={`https://wa.me/${selected.wa_phone}`}
                target="_blank"
                className="flex items-center gap-1.5 text-xs text-green-700 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-50 transition-colors"
              >
                <MessageCircle size={12} />
                Deschide WA
              </a>
            </div>
          </div>

          {/* Mesaje */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#f0f2f5]">
            {loadingMsgs ? (
              <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Se încarcă mesajele...</div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Niciun mesaj încă</div>
            ) : (
              messages.map(msg => {
                const isOut = msg.direction === 'outbound'
                return (
                  <div key={msg.id} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs lg:max-w-md xl:max-w-lg rounded-2xl px-4 py-2.5 shadow-sm ${
                      isOut
                        ? 'bg-[#004437] text-white rounded-br-sm'
                        : 'bg-white text-gray-900 rounded-bl-sm'
                    }`}>
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
              className="flex-1 resize-none border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#004437] transition-colors max-h-32 min-h-[44px]"
              placeholder="Scrie un mesaj..."
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              rows={1}
            />
            <button
              onClick={sendMessage}
              disabled={!draft.trim() || sending}
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
