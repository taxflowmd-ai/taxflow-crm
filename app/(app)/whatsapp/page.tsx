'use client'
// Pagina WhatsApp: stare + încărcare date + realtime + acțiuni.
// UI-ul e compus din componentele din components/whatsapp/.
import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { MessageCircle } from 'lucide-react'
import { Conversation, Message, isWindowOpen } from '@/components/whatsapp/types'
import ConversationList from '@/components/whatsapp/ConversationList'
import ChatHeader from '@/components/whatsapp/ChatHeader'
import TemplateBanner from '@/components/whatsapp/TemplateBanner'
import MessageBubble from '@/components/whatsapp/MessageBubble'
import MessageComposer from '@/components/whatsapp/MessageComposer'
import ContactPanel from '@/components/whatsapp/ContactPanel'
import TaskModal from '@/components/whatsapp/TaskModal'

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
  const [sendingTemplate, setSendingTemplate] = useState(false)
  const [showContactPanel, setShowContactPanel] = useState(false)
  const [contactData, setContactData] = useState<any>(null)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [taskForm, setTaskForm] = useState({ title: '', due_at: '', priority: 'medium' })
  const [savingTask, setSavingTask] = useState(false)
  const [changingStatus, setChangingStatus] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
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

  async function selectConv(conv: Conversation) {
    setSelected(conv)
    setMessages([])
    setDraft('')
    setShowContactPanel(false)
    setContactData(null)
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

  function toggleContactPanel() {
    if (!selected?.lead_id) return
    if (showContactPanel) setShowContactPanel(false)
    else loadContactPanel(selected.lead_id)
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
    setSelected(null)
    loadConversations()
  }

  async function deleteConversation() {
    if (!selected) return
    await (supabase as any).from('whatsapp_messages').delete().eq('conversation_id', selected.id)
    await (supabase as any).from('whatsapp_conversations').delete().eq('id', selected.id)
    toast.success('Conversație ștearsă')
    setSelected(null)
    loadConversations()
  }

  async function sendTemplate(templateName: string, languageCode: string) {
    if (!selected || sendingTemplate) return
    setSendingTemplate(true)
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
    }
  }

  const totalUnread = conversations.filter(c => !c.is_archived).reduce((s, c) => s + (c.unread_count || 0), 0)
  const archivedCount = conversations.filter(c => c.is_archived).length

  return (
    <div className="flex-1 flex overflow-hidden">

      <ConversationList
        filtered={filtered} loading={loading} q={q} setQ={setQ}
        totalUnread={totalUnread} archivedCount={archivedCount}
        showArchived={showArchived} setShowArchived={setShowArchived}
        selectedId={selected?.id || null} hidden={!!selected}
        onSelect={selectConv} onRefresh={loadConversations}
      />

      {/* ── Zona de chat ── */}
      {selected ? (
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <ChatHeader
            selected={selected} windowOpen={windowOpen} hasMessages={messages.length > 0}
            showContactPanel={showContactPanel} changingStatus={changingStatus}
            onBack={() => setSelected(null)}
            onToggleContactPanel={toggleContactPanel}
            onOpenTaskModal={() => setShowTaskModal(true)}
            onChangeStatus={handleChangeStatus}
            onArchive={archiveConversation}
            onDelete={deleteConversation}
          />

          {/* Banner fereastră închisă */}
          {messages.length > 0 && !windowOpen && (
            <TemplateBanner key={`closed-${selected.id}`} variant="closed-window"
              sending={sendingTemplate} onSendTemplate={sendTemplate} />
          )}

          {/* Banner conversație nouă — niciun mesaj */}
          {messages.length === 0 && !loadingMsgs && (
            <TemplateBanner key={`new-${selected.id}`} variant="new-conversation"
              sending={sendingTemplate} onSendTemplate={sendTemplate} />
          )}

          {/* Mesaje */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#f0f2f5]">
            {loadingMsgs ? (
              <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Se încarcă mesajele...</div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Niciun mesaj încă</div>
            ) : (
              messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)
            )}
            <div ref={messagesEndRef} />
          </div>

          <MessageComposer
            draft={draft} setDraft={setDraft} sending={sending}
            uploadingFile={uploadingFile}
            locked={!windowOpen && messages.length > 0}
            onSend={sendMessage} onSendFile={sendFile}
          />
        </div>
      ) : (
        <div className="flex-1 hidden lg:flex items-center justify-center bg-[#f0f2f5]">
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
        <ContactPanel contactData={contactData} onClose={() => setShowContactPanel(false)} />
      )}

      {/* ── Modal adaugă sarcină ── */}
      {showTaskModal && (
        <TaskModal
          taskForm={taskForm} setTaskForm={setTaskForm} saving={savingTask}
          leadName={selected?.lead?.name}
          onSave={handleAddTask} onClose={() => setShowTaskModal(false)}
        />
      )}
    </div>
  )
}
