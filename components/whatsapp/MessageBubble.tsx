'use client'
import { Zap } from 'lucide-react'
import { Message } from './types'

export default function MessageBubble({ msg }: { msg: Message }) {
  const isOut = msg.direction === 'outbound'
  const isTemplate = msg.message_type === 'template'
  const isImage = msg.message_type === 'image'
  const isDocument = msg.message_type === 'document'
  const isMedia = isImage || isDocument

  return (
    <div className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-xs lg:max-w-md xl:max-w-lg rounded-2xl shadow-sm overflow-hidden ${
        isOut ? 'bg-[#004437] text-white rounded-br-sm' : 'bg-white text-gray-900 rounded-bl-sm'
      }`}>
        {isTemplate && (
          <div className={`text-[10px] px-4 pt-2.5 flex items-center gap-1 ${isOut ? 'text-white/50' : 'text-gray-400'}`}>
            <Zap size={9} /> Template
          </div>
        )}
        {isImage && msg.media_url && (
          <a href={`/api/whatsapp/media?id=${msg.media_url}`} target="_blank" rel="noopener">
            <img src={`/api/whatsapp/media?id=${msg.media_url}`} alt={msg.body || 'Imagine'}
              className="max-w-full block" style={{ maxHeight: 240 }} />
          </a>
        )}
        {isDocument && msg.media_url && (
          <a href={`/api/whatsapp/media?id=${msg.media_url}`} target="_blank" rel="noopener"
            className={`flex items-center gap-3 px-4 py-3 ${isOut ? 'text-white/90 hover:text-white' : 'text-[#004437]'} transition-colors`}>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-lg ${isOut ? 'bg-white/20' : 'bg-[#004437]/10'}`}>📄</div>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{msg.body?.replace('📄 ', '') || 'Document'}</div>
              <div className={`text-[10px] ${isOut ? 'text-white/50' : 'text-gray-400'}`}>Apasă pentru a deschide</div>
            </div>
          </a>
        )}
        {!isMedia && (
          <div className="px-4 py-2.5">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.body}</p>
          </div>
        )}
        {isImage && msg.body && msg.body !== '📷 Imagine' && (
          <div className="px-4 pb-1 pt-1">
            <p className="text-xs opacity-80">{msg.body}</p>
          </div>
        )}
        <div className={`flex items-center gap-1 px-4 pb-2 ${isOut ? 'justify-end' : 'justify-start'}`}>
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
}
