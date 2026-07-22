'use client'
import { Search, MessageCircle, RefreshCw, Archive } from 'lucide-react'
import { Conversation, STATUS_COLORS, fmtTime } from './types'

interface Props {
  filtered: Conversation[]
  loading: boolean
  q: string
  setQ: (v: string) => void
  totalUnread: number
  archivedCount: number
  showArchived: boolean
  setShowArchived: (fn: (v: boolean) => boolean) => void
  selectedId: string | null
  hidden: boolean
  onSelect: (conv: Conversation) => void
  onRefresh: () => void
}

export default function ConversationList({
  filtered, loading, q, setQ, totalUnread, archivedCount,
  showArchived, setShowArchived, selectedId, hidden, onSelect, onRefresh,
}: Props) {
  return (
    <div className={`w-full lg:w-80 flex-shrink-0 bg-white border-r border-gray-200 flex-col ${hidden ? 'hidden lg:flex' : 'flex'}`}>
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
          <button onClick={onRefresh} className="text-gray-400 hover:text-[#004437] transition-colors">
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
            const isSelected = selectedId === conv.id
            const sc = conv.lead?.status ? STATUS_COLORS[conv.lead.status] : '#94a3b8'
            return (
              <div
                key={conv.id}
                onClick={() => onSelect(conv)}
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
  )
}
