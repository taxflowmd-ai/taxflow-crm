'use client'

interface Props {
  reportTypes: any[]
  clientObligations: string[]
  saving: boolean
  onSaveObligations: (selectedIds: string[]) => void
}

export default function FiscalTab({ reportTypes, clientObligations, saving, onSaveObligations }: Props) {
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Obligații fiscale</p>
        <span className="text-[10px] text-gray-400">{clientObligations.length} active</span>
      </div>
      {reportTypes.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          Niciun tip de raport configurat
        </div>
      ) : (
        <div className="space-y-1">
          {reportTypes.map((t: any) => {
            const isChecked = clientObligations.includes(t.id)
            const freqLabel: Record<string,string> = {
              monthly: 'lunar', quarterly: 'trimestrial',
              semi: 'semestrial', annual: 'anual'
            }
            return (
              <label key={t.id}
                className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors ${isChecked ? 'bg-[#e8f5f0] border border-[#004437]/20' : 'bg-gray-50 border border-transparent hover:border-gray-200'}`}>
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={e => {
                    const newIds = e.target.checked
                      ? [...clientObligations, t.id]
                      : clientObligations.filter((id: string) => id !== t.id)
                    onSaveObligations(newIds)
                  }}
                  className="w-4 h-4 accent-[#004437] flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-700 font-mono">{t.code}</span>
                    <span className="text-xs text-gray-500 truncate">{t.label}</span>
                  </div>
                  {(t.frequency || t.deadline_day) && (
                    <div className="flex items-center gap-2 mt-0.5">
                      {t.frequency && (
                        <span className="text-[10px] text-gray-400 capitalize">
                          {freqLabel[t.frequency] || t.frequency}
                        </span>
                      )}
                      {t.deadline_day && (
                        <span className="text-[10px] text-gray-400">
                          · termen: {t.deadline_day}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {isChecked && (
                  <span className="text-[10px] text-[#004437] font-medium flex-shrink-0">Activ</span>
                )}
              </label>
            )
          })}
        </div>
      )}
      {saving && (
        <p className="text-xs text-gray-400 text-center">Se salvează...</p>
      )}
    </div>
  )
}
