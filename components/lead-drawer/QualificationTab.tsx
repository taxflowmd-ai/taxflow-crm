'use client'
import { Save, ClipboardCheck, AlertTriangle, ArrowRight } from 'lucide-react'
import { QUALIFICATION_FIELDS, QualificationAnswers, QualificationResult } from '@/lib/qualification/scoring'

interface Props {
  qualAnswers: QualificationAnswers
  qualResult: QualificationResult
  qualUpdatedAt: string | null
  saving: boolean
  onFieldChange: (key: string, value: string) => void
  onSave: () => void
  onGenerateOffer: () => void
}

export default function QualificationTab({
  qualAnswers, qualResult, qualUpdatedAt, saving, onFieldChange, onSave, onGenerateOffer,
}: Props) {
  return (
    <div className="p-4 space-y-4">
      <div className="space-y-3">
        {QUALIFICATION_FIELDS.map(field => (
          <div key={field.key}>
            <label className="label">{field.label}</label>
            <select
              value={(qualAnswers as any)[field.key] || ''}
              onChange={e => onFieldChange(field.key, e.target.value)}
              className="input">
              <option value="">— selectează —</option>
              {field.options.map(o => (
                <option key={o.value} value={o.value}>{o.value}{o.note ? ` — ${o.note}` : ''}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* Scoruri agregate */}
      <div className="border-t border-gray-100 pt-3">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Scoruri agregate</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-gray-50 rounded-lg p-2.5">
            <div className="text-[10px] text-gray-400">Dimensiune</div>
            <div className="text-lg font-bold text-gray-700">{qualResult.scoreDimension ?? '—'}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-2.5">
            <div className="text-[10px] text-gray-400">Complexitate</div>
            <div className="text-lg font-bold text-gray-700">{qualResult.scoreComplexity ?? '—'}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-2.5">
            <div className="text-[10px] text-gray-400">Maturitate</div>
            <div className="text-lg font-bold text-gray-700">{qualResult.scoreMaturity ?? '—'}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-2.5">
            <div className="text-[10px] text-gray-400">Fit TaxFlow</div>
            <div className="text-lg font-bold text-gray-700">{qualResult.scoreFit ?? '—'}</div>
          </div>
        </div>
      </div>

      {/* Recomandare */}
      {qualResult.recommendedPackage && (
        <div className="bg-[#e8f5f0] border border-[#004437]/20 rounded-xl p-3.5">
          <div className="flex items-center gap-2 mb-1">
            <ClipboardCheck size={14} className="text-[#004437]" />
            <span className="text-[11px] font-semibold text-[#004437] uppercase tracking-wide">Recomandare automată</span>
          </div>
          <div className="text-base font-bold text-[#004437]">{qualResult.recommendedPackage}</div>
          <div className="text-xs text-gray-500 mt-0.5">OverallScore: {qualResult.overallScore}</div>

          {qualResult.riskFlags.length > 0 && (
            <div className="mt-2.5 space-y-1">
              {qualResult.riskFlags.map((flag, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5">
                  <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                  <span>{flag}</span>
                </div>
              ))}
              <p className="text-[10px] text-gray-400 italic mt-1">
                Recomandarea automată e un punct de plecare. Cu flaguri risc, se face call de aliniere înainte de ofertare.
              </p>
            </div>
          )}

          <button onClick={onGenerateOffer}
            className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs bg-[#004437] text-white px-3 py-2 rounded-lg hover:bg-[#005a47] transition-colors">
            Generează ofertă cu {qualResult.recommendedPackage} <ArrowRight size={12} />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        {qualUpdatedAt && (
          <span className="text-[10px] text-gray-400">
            Salvat {new Date(qualUpdatedAt).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <button onClick={onSave} disabled={saving}
          className="btn-primary flex items-center gap-1.5 text-sm ml-auto">
          <Save size={14} />{saving ? 'Se salvează...' : 'Salvează calificarea'}
        </button>
      </div>
    </div>
  )
}
