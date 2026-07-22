'use client'
import { Clock, Pencil, Trash2 } from 'lucide-react'

interface Props {
  history: any[]
  isAdmin: boolean
  editingNoteId: string | null
  editingNoteText: string
  setEditingNoteId: (v: string | null) => void
  setEditingNoteText: (v: string) => void
  onEditNote: (noteId: string) => void
  onDeleteNote: (noteId: string) => void
}

export default function HistoryTab({
  history, isAdmin, editingNoteId, editingNoteText,
  setEditingNoteId, setEditingNoteText, onEditNote, onDeleteNote,
}: Props) {
  return (
    <div className="p-4 space-y-2">
      {history.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Clock size={28} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">Niciun istoric</p>
        </div>
      ) : history.map((h: any) => {
        const isStatusChange = h.type === 'status_change'
        const isNote = h.type === 'note'
        const isEditingThis = editingNoteId === h.id

        if (isStatusChange) {
          const parts = (h.content || h.action || '').split(': ')
          const transition = parts[1] || ''
          return (
            <div key={h.id} className="flex items-center gap-2 py-1">
              <div className="w-px h-4 bg-gray-200 ml-3 flex-shrink-0" />
              <div className="flex items-center gap-2 flex-1 bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5">
                <span className="text-[10px] text-blue-500 font-mono font-semibold">{transition}</span>
                <span className="flex-1" />
                <span className="text-[10px] text-gray-400">{h.author?.full_name || 'Sistem'}</span>
                <span className="text-[10px] text-gray-300">·</span>
                <span className="text-[10px] text-gray-400">
                  {new Date(h.created_at).toLocaleDateString('ro-RO', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                </span>
              </div>
            </div>
          )
        }

        return (
          <div key={h.id} className="flex gap-3 group/note">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5"
              style={{ background: h.author?.avatar_color || '#94a3b8' }}>
              {h.author?.full_name?.split(' ').map((w: string) => w[0]).join('').substring(0,2) || '?'}
            </div>
            <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-700">{h.author?.full_name || 'Sistem'}</span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-400">
                    {new Date(h.created_at).toLocaleDateString('ro-RO', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                  </span>
                  {isAdmin && isNote && !isEditingThis && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover/note:opacity-100 transition-opacity ml-1">
                      <button onClick={() => { setEditingNoteId(h.id); setEditingNoteText(h.content || h.action || '') }}
                        className="p-1 rounded text-gray-400 hover:text-[#004437] transition-colors" title="Editează">
                        <Pencil size={11} />
                      </button>
                      <button onClick={() => onDeleteNote(h.id)}
                        className="p-1 rounded text-gray-400 hover:text-red-500 transition-colors" title="Șterge">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {isEditingThis ? (
                <div className="space-y-2">
                  <textarea className="input resize-none w-full text-xs" rows={3}
                    value={editingNoteText} onChange={e => setEditingNoteText(e.target.value)} autoFocus />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => { setEditingNoteId(null); setEditingNoteText('') }}
                      className="text-xs border border-gray-200 px-2.5 py-1 rounded-lg hover:bg-gray-50">Anulează</button>
                    <button onClick={() => onEditNote(h.id)} disabled={!editingNoteText.trim()}
                      className="text-xs bg-[#004437] text-white px-2.5 py-1 rounded-lg hover:bg-[#005a47] disabled:opacity-40">Salvează</button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-600 leading-relaxed">{h.content || h.action}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
