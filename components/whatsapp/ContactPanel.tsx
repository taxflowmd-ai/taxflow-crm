'use client'
import { X } from 'lucide-react'
import { STATUS_COLORS } from './types'

interface Props {
  contactData: any
  onClose: () => void
}

export default function ContactPanel({ contactData, onClose }: Props) {
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-[320px] bg-white shadow-2xl z-40 flex flex-col border-l border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <h3 className="text-sm font-semibold text-gray-900">Fișa contact</h3>
          <button onClick={onClose}
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
  )
}
