'use client'

interface Props {
  note: string
  setNote: (v: string) => void
  onAdd: () => void
}

export default function NoteTab({ note, setNote, onAdd }: Props) {
  return (
    <div className="p-6">
      <label className="label">Notă nouă</label>
      <textarea className="input resize-none w-full" rows={5}
        placeholder="Scrie ce s-a discutat, ce urmează..."
        value={note} onChange={e => setNote(e.target.value)} autoFocus />
      <div className="flex justify-end mt-3">
        <button onClick={onAdd} disabled={!note.trim()} className="btn-primary">Adaugă notă</button>
      </div>
    </div>
  )
}
