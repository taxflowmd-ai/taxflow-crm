'use client'
import { X, Plus } from 'lucide-react'

interface Props {
  taskForm: { title: string; due_at: string; priority: string }
  setTaskForm: (fn: (f: any) => any) => void
  saving: boolean
  leadName?: string | null
  onSave: () => void
  onClose: () => void
}

export default function TaskModal({ taskForm, setTaskForm, saving, leadName, onSave, onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Sarcină nouă</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label">Titlu *</label>
            <input
              className="input w-full"
              placeholder="Ce trebuie făcut..."
              value={taskForm.title}
              onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && onSave()}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Deadline</label>
              <input
                type="datetime-local"
                className="input w-full"
                value={taskForm.due_at}
                onChange={e => setTaskForm(f => ({ ...f, due_at: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Prioritate</label>
              <select
                className="input w-full"
                value={taskForm.priority}
                onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))}>
                <option value="low">Scăzută</option>
                <option value="medium">Medie</option>
                <option value="high">Înaltă</option>
              </select>
            </div>
          </div>
          {leadName && (
            <div className="bg-[#e8f0ee] rounded-lg px-3 py-2 text-xs text-[#004437]">
              Legată de: <strong>{leadName}</strong>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="btn-ghost text-sm">Anulează</button>
          <button onClick={onSave} disabled={!taskForm.title.trim() || saving}
            className="btn-primary text-sm flex items-center gap-1.5">
            <Plus size={13} /> {saving ? 'Se salvează...' : 'Adaugă'}
          </button>
        </div>
      </div>
    </div>
  )
}
