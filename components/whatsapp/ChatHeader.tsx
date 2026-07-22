'use client'
// Header-ul zonei de chat: înapoi (mobil), avatar/nume, badge fereastră
// 24h, sarcină nouă, schimbare status lead, fișă contact, arhivare/ștergere.
import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronDown, Plus, UserCircle, MoreVertical, Archive, Trash2 } from 'lucide-react'
import { Conversation, STATUS_COLORS } from './types'

interface Props {
  selected: Conversation
  windowOpen: boolean
  hasMessages: boolean
  showContactPanel: boolean
  changingStatus: boolean
  onBack: () => void
  onToggleContactPanel: () => void
  onOpenTaskModal: () => void
  onChangeStatus: (status: string) => void
  onArchive: () => void
  onDelete: () => void
}

export default function ChatHeader({
  selected, windowOpen, hasMessages, showContactPanel, changingStatus,
  onBack, onToggleContactPanel, onOpenTaskModal, onChangeStatus, onArchive, onDelete,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const statusMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
        setConfirmDelete(false)
      }
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setShowStatusMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Reset la schimbarea conversației
  useEffect(() => {
    setMenuOpen(false)
    setConfirmDelete(false)
    setShowStatusMenu(false)
  }, [selected.id])

  return (
    <div className="bg-white border-b border-gray-200 px-2 sm:px-4 h-14 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Înapoi la lista de conversații — doar pe mobil */}
        <button
          onClick={onBack}
          className="lg:hidden p-1.5 -ml-1 text-gray-500 hover:text-[#004437] flex-shrink-0"
          aria-label="Înapoi la conversații">
          <ChevronLeft size={20} />
        </button>
        {/* Avatar + nume clickabil → panel contact */}
        <button
          onClick={() => selected.lead_id && onToggleContactPanel()}
          className={`w-8 h-8 rounded-full bg-[#25d366] flex items-center justify-center text-white text-xs font-bold ${selected.lead_id ? 'hover:ring-2 hover:ring-[#004437]/30 transition-all cursor-pointer' : ''}`}>
          {(selected.wa_name || selected.wa_phone).substring(0, 2).toUpperCase()}
        </button>
        <div>
          <button
            onClick={() => selected.lead_id && onToggleContactPanel()}
            className={`text-sm font-semibold text-gray-900 ${selected.lead_id ? 'hover:text-[#004437] transition-colors cursor-pointer' : ''}`}>
            {selected.wa_name || selected.wa_phone}
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">+{selected.wa_phone}</span>
            {hasMessages && (
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
            onClick={onOpenTaskModal}
            className="flex items-center gap-1.5 text-xs border border-gray-200 px-2.5 py-1.5 rounded-lg text-gray-600 hover:border-[#004437] hover:text-[#004437] transition-colors"
            title="Adaugă sarcină">
            <Plus size={13} /> <span className="hidden sm:inline">Sarcină</span>
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
              <span className="hidden sm:inline">{selected.lead?.status || 'Status'}</span>
              <ChevronDown size={11} />
            </button>
            {showStatusMenu && (
              <div className="absolute right-0 top-9 bg-white border border-gray-200 rounded-xl shadow-lg z-50 w-52 overflow-hidden">
                {Object.entries(STATUS_COLORS).map(([st, color]) => (
                  <button
                    key={st}
                    onClick={() => { setShowStatusMenu(false); onChangeStatus(st) }}
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
            onClick={onToggleContactPanel}
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
                onClick={() => { setMenuOpen(false); onArchive() }}
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
                    <button onClick={() => { setMenuOpen(false); setConfirmDelete(false); onDelete() }} className="flex-1 text-xs bg-red-500 text-white py-1.5 rounded-lg hover:bg-red-600">Șterge</button>
                    <button onClick={() => setConfirmDelete(false)} className="flex-1 text-xs border border-gray-200 py-1.5 rounded-lg hover:bg-gray-50">Anulează</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
