'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Upload, Download, CheckCircle, XCircle, AlertCircle } from 'lucide-react'

type Row = { name:string; company?:string; phone?:string; email?:string; source?:string; note?:string }
type RowResult = Row & { ok:boolean; error?:string }

const SOURCES = ['Meta Ads','WhatsApp','Organic','Referință','Site web','Import']

const CSV_TEMPLATE = `name,company,phone,email,source,note
Ion Popescu,TaxFlow SRL,+37360000001,ion@taxflow.md,Meta Ads,Client nou
Maria Ionescu,ABC SRL,+37360000002,maria@abc.md,Referință,Referit de Ion`

export default function ImportPage() {
  const [step, setStep] = useState<'upload'|'preview'|'done'>('upload')
  const [rows, setRows] = useState<Row[]>([])
  const [results, setResults] = useState<RowResult[]>([])
  const [source, setSource] = useState('Import')
  const [importing, setImporting] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  function parseCSV(text:string): Row[] {
    const lines = text.trim().split('\n').filter(Boolean)
    if(lines.length<2) return []
    const headers = lines[0].split(',').map(h=>h.trim().toLowerCase().replace(/"/g,''))
    return lines.slice(1).map(line=>{
      const vals = line.split(',').map(v=>v.trim().replace(/"/g,''))
      const obj: any = {}
      headers.forEach((h,i)=>{ obj[h]=vals[i]||'' })
      return {
        name: obj.name||obj.nume||'',
        company: obj.company||obj.companie||'',
        phone: obj.phone||obj.telefon||'',
        email: obj.email||'',
        source: obj.source||obj.sursa||source,
        note: obj.note||obj.nota||obj.notă||'',
      } as Row
    }).filter(r=>r.name)
  }

  function handleFile(file:File) {
    if(!file.name.endsWith('.csv')){ toast.error('Doar fișiere CSV'); return }
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const parsed = parseCSV(text)
      if(parsed.length===0){ toast.error('CSV invalid sau gol'); return }
      setRows(parsed)
      setStep('preview')
    }
    reader.readAsText(file)
  }

  function handleDrop(e:React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if(file) handleFile(file)
  }

  async function handleImport() {
    setImporting(true)
    const supabase = createClient()
    const {data:{user}} = await supabase.auth.getUser()
    const res: RowResult[] = []

    for(const row of rows) {
      const {error} = await (supabase as any).from('leads').insert({
        name: row.name,
        company: row.company||null,
        phone: row.phone||null,
        email: row.email||null,
        source: SOURCES.includes(row.source||'')?row.source:'Import',
        note: row.note||null,
        status: 'Nou',
        assigned_to: user?.id,
        created_by: user?.id,
      })
      res.push({...row, ok:!error, error:error?.message})
    }

    setResults(res)
    setStep('done')
    setImporting(false)
    const ok = res.filter(r=>r.ok).length
    const fail = res.filter(r=>!r.ok).length
    if(fail===0) toast.success(`${ok} lead-uri importate cu succes!`)
    else toast.error(`${ok} importate, ${fail} erori`)
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], {type:'text/csv'})
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'taxflow-import-template.csv'
    a.click()
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="bg-white border-b border-gray-200 px-6 h-14 flex items-center justify-between flex-shrink-0">
        <div><h1 className="text-base font-semibold">Import lead-uri</h1><p className="text-xs text-gray-400">Importă din CSV</p></div>
        <button onClick={downloadTemplate} className="btn-outline text-xs"><Download size={14}/>Template CSV</button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto">

          {/* PASUL 1: Upload */}
          {step==='upload' && (
            <div className="space-y-4">
              <div className="bg-[#e8f0ee] border border-[#c2d9d3] rounded-xl p-4 text-sm text-[#004437]">
                <p className="font-semibold mb-2">📋 Format CSV acceptat:</p>
                <code className="text-xs bg-white/60 rounded px-2 py-1 block">name, company, phone, email, source, note</code>
                <p className="mt-2 text-xs text-[#004437]/70">Coloana <strong>name</strong> este obligatorie. Descarcă template-ul pentru exemplu.</p>
              </div>

              <div className="mb-3">
                <label className="label">Sursă implicită (dacă lipsește din CSV)</label>
                <select className="input w-48" value={source} onChange={e=>setSource(e.target.value)}>
                  {SOURCES.map(s=><option key={s}>{s}</option>)}
                </select>
              </div>

              <div
                onDragOver={e=>{e.preventDefault();setDragOver(true)}}
                onDragLeave={()=>setDragOver(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${dragOver?'border-[#004437] bg-[#e8f0ee]':'border-gray-300 hover:border-[#004437] hover:bg-gray-50'}`}
                onClick={()=>document.getElementById('csvInput')?.click()}
              >
                <Upload size={32} className="mx-auto text-gray-400 mb-3"/>
                <p className="text-sm font-medium text-gray-700">Trage fișierul CSV aici</p>
                <p className="text-xs text-gray-400 mt-1">sau click pentru a selecta</p>
                <input id="csvInput" type="file" accept=".csv" className="hidden" onChange={e=>{ const f=e.target.files?.[0]; if(f) handleFile(f) }}/>
              </div>
            </div>
          )}

          {/* PASUL 2: Preview */}
          {step==='preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-900">{rows.length} lead-uri găsite</div>
                <div className="flex gap-2">
                  <button onClick={()=>setStep('upload')} className="btn-ghost text-xs">← Înapoi</button>
                  <button onClick={handleImport} disabled={importing} className="btn-primary text-xs">
                    {importing?'Se importă...':'Importă '+rows.length+' lead-uri →'}
                  </button>
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>{['Nume','Companie','Telefon','Email','Sursă'].map(h=><th key={h} className="px-3 py-2 text-left font-semibold text-gray-500">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.slice(0,50).map((r,i)=>(
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-900">{r.name}</td>
                        <td className="px-3 py-2 text-gray-500">{r.company||'—'}</td>
                        <td className="px-3 py-2 text-gray-500">{r.phone||'—'}</td>
                        <td className="px-3 py-2 text-gray-500">{r.email||'—'}</td>
                        <td className="px-3 py-2"><span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{r.source||source}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length>50 && <div className="px-4 py-2 bg-amber-50 text-xs text-amber-700 border-t border-amber-100">Afișate 50 din {rows.length} rânduri. Toate vor fi importate.</div>}
              </div>
            </div>
          )}

          {/* PASUL 3: Rezultate */}
          {step==='done' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-[#e8f0ee] rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-[#004437]">{results.length}</div>
                  <div className="text-xs text-[#004437]/70 mt-0.5">Total procesate</div>
                </div>
                <div className="bg-green-50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">{results.filter(r=>r.ok).length}</div>
                  <div className="text-xs text-green-600/70 mt-0.5">Importate cu succes</div>
                </div>
                <div className="bg-red-50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-red-500">{results.filter(r=>!r.ok).length}</div>
                  <div className="text-xs text-red-500/70 mt-0.5">Erori</div>
                </div>
              </div>

              {results.filter(r=>!r.ok).length>0 && (
                <div className="bg-white border border-red-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-xs font-semibold text-red-600">Rânduri cu erori</div>
                  {results.filter(r=>!r.ok).map((r,i)=>(
                    <div key={i} className="px-4 py-2 border-b border-gray-100 last:border-0 flex items-center gap-2 text-xs">
                      <XCircle size={13} className="text-red-500 flex-shrink-0"/>
                      <span className="font-medium text-gray-800">{r.name}</span>
                      <span className="text-red-500">{r.error}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={()=>{setStep('upload');setRows([]);setResults([])}} className="btn-outline">Import nou</button>
                <a href="/contacts" className="btn-primary">Mergi la Contacte →</a>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
