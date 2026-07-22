// Tipuri și constante partajate de componentele WhatsApp

export type Conversation = {
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

export type Message = {
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

export const STATUS_COLORS: Record<string, string> = {
  'Nou': '#94a3b8', 'Contactat': '#3a7bd5', 'Întâlnire programată': '#c9a84c',
  'Ofertă trimisă': '#8b5cf6', 'Client activ': '#00c48c', 'Pierdut': '#e05050'
}

// Template-urile aprobate în Meta — actualizează cu numele exacte din Meta Business Suite
export const TEMPLATES = [
  { name: 'chiaramsrl', label: 'Am SRL', language: 'ro' },
  // Adaugă aici template-urile tale aprobate:
  { name: 'contact', label: 'Bună ziua', language: 'ro' },
  { name: 'am_srl', label: 'Vreau SRL', language: 'ro' },
]

export function fmtTime(ts: string) {
  const d = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return 'acum'
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm'
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' })
}

// Verifică dacă fereastra de 24h e deschisă (ultimul mesaj inbound < 24h)
export function isWindowOpen(messages: Message[]): boolean {
  const lastInbound = [...messages].reverse().find(m => m.direction === 'inbound')
  if (!lastInbound) return false
  const diff = Date.now() - new Date(lastInbound.created_at).getTime()
  return diff < 24 * 60 * 60 * 1000
}
