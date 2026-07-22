'use client'
import { Save, Trash2, Phone, Mail, Building2, User, Tag, Calendar, FileText, Landmark, Hash, Briefcase } from 'lucide-react'
import { STATUSES, SOURCES, FISCAL_REGIMES, SERVICE_TYPES } from './constants'

interface Props {
  form: any
  setForm: (updater: (p: any) => any) => void
  isAdmin: boolean
  team: any[]
  saving: boolean
  confirmDelete: boolean
  setConfirmDelete: (v: boolean) => void
  onSave: () => void
  onDelete: () => void
}

export default function InfoTab({ form, setForm, isAdmin, team, saving, confirmDelete, setConfirmDelete, onSave, onDelete }: Props) {
  const f = (field: string) => ({
    value: form[field] ?? '',
    onChange: (e: any) => setForm((p: any) => ({ ...p, [field]: e.target.value })),
    className: 'input',
  })

  return (
    <div className="p-6 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label flex items-center gap-1.5"><User size={12} />Nume complet *</label>
          <input {...f('name')} placeholder="Ion Popescu" />
        </div>
        <div>
          <label className="label flex items-center gap-1.5"><Building2 size={12} />Companie</label>
          <input {...f('company')} placeholder="SRL..." />
        </div>
        <div>
          <label className="label flex items-center gap-1.5"><Hash size={12} />IDNO</label>
          <input {...f('idno')} placeholder="1234567890123" maxLength={13} className="input font-mono tracking-wider" />
        </div>
        <div>
          <label className="label flex items-center gap-1.5"><Phone size={12} />Telefon</label>
          <input {...f('phone')} placeholder="+373..." />
        </div>
        <div>
          <label className="label flex items-center gap-1.5"><Mail size={12} />Email</label>
          <input {...f('email')} type="email" placeholder="ion@firma.md" />
        </div>
        <div>
          <label className="label flex items-center gap-1.5"><Tag size={12} />Sursă</label>
          <select {...f('source')} className="input">{SOURCES.map(s => <option key={s}>{s}</option>)}</select>
        </div>
        <div>
          <label className="label">Serviciu solicitat</label>
          <select {...f('service_type')} className="input">
            <option value="">— selectează —</option>
            {SERVICE_TYPES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select {...f('status')} className="input">{STATUSES.map(s => <option key={s}>{s}</option>)}</select>
        </div>
        {isAdmin && team.length > 0 && (
          <div>
            <label className="label flex items-center gap-1.5"><User size={12} />Responsabil</label>
            <select {...f('assigned_to')} className="input">
              <option value="">— nealocate —</option>
              {team.map((m: any) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="label flex items-center gap-1.5"><Calendar size={12} />🔔 Reminder</label>
          <input {...f('reminder_at')} type="datetime-local" className="input" />
        </div>
      </div>

      {form.status === 'Client activ' && (
        <div className="border-t border-gray-100 pt-4">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Briefcase size={11} /> Date fiscale
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Regim fiscal</label>
              <select {...f('fiscal_regime')} className="input">
                {FISCAL_REGIMES.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="label flex items-center gap-1.5"><User size={12} />Nr. angajați</label>
              <input {...f('employees_count')} type="number" min="0" placeholder="0" className="input" />
            </div>
            <div className="col-span-2">
              <label className="label flex items-center gap-1.5"><Landmark size={12} />Valoare contract lunar (MDL)</label>
              <input {...f('contract_value')} type="number" min="0" placeholder="0" className="input" />
            </div>
          </div>
        </div>
      )}

      <div>
        <label className="label flex items-center gap-1.5"><FileText size={12} />Notă generală</label>
        <textarea {...f('note')} className="input resize-none" rows={3} placeholder="Context, servicii dorite..." />
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition-colors">
            <Trash2 size={13} />Șterge contact
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-600 font-medium">Ești sigur?</span>
            <button onClick={onDelete} className="text-xs bg-red-500 text-white px-3 py-1 rounded-lg hover:bg-red-600">Da, șterge</button>
            <button onClick={() => setConfirmDelete(false)} className="text-xs border border-gray-200 px-3 py-1 rounded-lg hover:bg-gray-50">Anulează</button>
          </div>
        )}
        <button onClick={onSave} disabled={saving} className="btn-primary flex items-center gap-1.5 text-sm">
          <Save size={14} />{saving ? 'Se salvează...' : 'Salvează'}
        </button>
      </div>
    </div>
  )
}
