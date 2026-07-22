'use client'
// Banner cu dropdown de template-uri aprobate Meta — apare când
// fereastra de 24h e închisă (amber) sau conversația e nouă (blue).
import { useState, useEffect, useRef } from 'react'
import { Zap } from 'lucide-react'
import { TEMPLATES } from './types'

interface Props {
  variant: 'closed-window' | 'new-conversation'
  sending: boolean
  onSendTemplate: (name: string, language: string) => void
}

export default function TemplateBanner({ variant, sending, onSendTemplate }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const isAmber = variant === 'closed-window'

  return (
    <div className={`border-b px-4 sm:px-6 py-2 flex items-center justify-between gap-2 ${isAmber ? 'bg-amber-50 border-amber-100' : 'bg-blue-50 border-blue-100'}`}>
      {isAmber ? (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-amber-700 font-medium">
            Fereastra de 24h e închisă — nu poți trimite mesaje libere.
          </span>
          <span className="text-xs text-amber-600">Folosește un template aprobat pentru a reiniția conversația.</span>
        </div>
      ) : (
        <span className="text-xs text-blue-700">Conversație nouă — inițiaz-o cu un template aprobat.</span>
      )}
      <div className="relative flex-shrink-0" ref={ref}>
        <button
          onClick={() => setOpen(v => !v)}
          disabled={sending}
          className={`flex items-center gap-1.5 text-xs text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${isAmber ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
          <Zap size={12} />
          {sending ? 'Se trimite...' : 'Trimite template'}
        </button>
        {open && (
          <div className="absolute right-0 top-9 bg-white border border-gray-200 rounded-xl shadow-lg z-50 w-64 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-700">Template-uri aprobate</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Selectează pentru a trimite</p>
            </div>
            {TEMPLATES.map(t => (
              <button
                key={t.name}
                onClick={() => { setOpen(false); onSendTemplate(t.name, t.language) }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                <div className="font-medium text-xs">{t.label}</div>
                <div className="text-[10px] text-gray-400 font-mono">{t.name} · {t.language}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
