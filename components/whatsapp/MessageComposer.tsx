'use client'
// Zona de compunere: atașare fișier + textarea auto-resize + trimitere.
import { useEffect, useRef } from 'react'
import { Send, Paperclip } from 'lucide-react'

interface Props {
  draft: string
  setDraft: (v: string) => void
  sending: boolean
  uploadingFile: boolean
  // Fereastra 24h închisă și conversația are deja mesaje → input blocat
  locked: boolean
  onSend: () => void
  onSendFile: (file: File) => void
}

export default function MessageComposer({ draft, setDraft, sending, uploadingFile, locked, onSend, onSendFile }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 128) + 'px'
  }, [draft])

  return (
    <div className="bg-white border-t border-gray-200 px-4 py-3 flex items-end gap-2">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) onSendFile(file)
          if (fileInputRef.current) fileInputRef.current.value = ''
        }}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={locked || uploadingFile}
        className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 text-gray-400 hover:text-[#004437] hover:border-[#004437] transition-colors disabled:opacity-30 flex-shrink-0"
        title="Atașează fișier">
        {uploadingFile
          ? <div className="w-4 h-4 border-2 border-gray-300 border-t-[#004437] rounded-full animate-spin" />
          : <Paperclip size={15} />}
      </button>

      <textarea
        ref={textareaRef}
        className={`flex-1 resize-none border rounded-xl px-4 py-2.5 text-sm outline-none transition-colors min-h-[44px] max-h-32 ${
          locked
            ? 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed'
            : 'border-gray-200 focus:border-[#004437]'
        }`}
        placeholder={locked ? 'Fereastra închisă — folosește un template...' : 'Scrie un mesaj...'}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        disabled={locked}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend() }
        }}
        rows={1}
        style={{ overflow: 'hidden' }}
      />
      <button
        onClick={onSend}
        disabled={!draft.trim() || sending || locked}
        className="w-11 h-11 bg-[#004437] text-white rounded-xl flex items-center justify-center hover:bg-[#005a47] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
      >
        {sending ? (
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <Send size={16} />
        )}
      </button>
    </div>
  )
}
