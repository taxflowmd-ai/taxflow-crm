'use client'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { FileSignature, Download, Trash2 } from 'lucide-react'
import LeadDrawer from '@/components/LeadDrawer'

const STATUS_FILTERS = [
  { id: 'all', label: 'Toate' },
  { id: 'draft', label: 'Draft' },
  { id: 'sent', label: 'Trimis' },
  { id: 'accepted', label: 'Acceptat' },
  { id: 'rejected', label: 'Refuzat' },
]

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-gray-100 text-gray-600' },
  sent: { label: 'Trimis', cls: 'bg-blue-50 text-blue-600' },
  accepted: { label: 'Acceptat', cls: 'bg-green-50 text-green-700' },
  rejected: { label: 'Refuzat', cls: 'bg-red-50 text-red-600' },
}

interface Props { isAdmin: boolean; team: any[] }

export default function OffersClient({ isAdmin, team }: Props) {
  const [offers, setOffers] = useState<any[]>([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  // Pentru deschiderea fișei clientului + ofertei la click
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const res = await fetch(`/api/offers?status=${filter}`, { cache: 'no-store' })
    const json = await res.json()
    setOffers(json.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [filter])

  function openOffer(offer: any) {
    if (!offer.lead_id) {
      toast.error('Oferta nu are un contact asociat')
      return
    }
    setSelectedOfferId(offer.id)
    setSelectedLeadId(offer.lead_id)
  }

  function closeDrawer() {
    setSelectedLeadId(null)
    setSelectedOfferId(null)
    load() // reîncarcă lista — starea s-ar putea fi schimbat din drawer
  }

  async function updateStatus(id: string, status: string, e?: React.MouseEvent) {
    e?.stopPropagation()
    await fetch('/api/offers', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    toast.success('Status actualizat')
    load()
  }

  async function deleteOffer(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Ștergi această ofertă?')) return
    await fetch('/api/offers', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    toast.success('Ofertă ștearsă')
    load()
  }

  async function downloadPdf(offer: any, e: React.MouseEvent) {
    e.stopPropagation()
    setDownloadingId(offer.id)
    try {
      const pdfData = {
        sector: offer.sector,
        date: new Date(offer.created_at).toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' }),
        problems: offer.problems_json || [],
        packageName: offer.content_json?.packageName || offer.template?.name || '',
        categories: offer.content_json?.categories || [],
        price: offer.price,
        priceUnit: offer.price_unit,
        contractMonths: offer.contract_months,
        excluded: offer.excluded_json || [],
        steps: offer.content_json?.steps || [],
        validUntil: offer.valid_until ? new Date(offer.valid_until).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '',
      }
      const res = await fetch('/api/offers/generate-pdf', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pdfData),
      })
      if (!res.ok) throw new Error('Eroare generare PDF')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Oferta_TaxFlow_${(offer.lead?.name || 'client').replace(/\s+/g, '_')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Eroare la generarea PDF-ului')
    } finally {
      setDownloadingId(null)
    }
  }

  const totalValue = offers.filter(o => o.status === 'sent' || o.status === 'accepted')
    .reduce((sum, o) => sum + (Number(o.price) || 0), 0)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 h-14 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-base font-semibold flex items-center gap-2">
            <FileSignature size={17} className="text-[#004437]" />
            Oferte
          </h1>
          <p className="text-xs text-gray-400">
            {offers.length} oferte
            {totalValue > 0 && <span className="ml-2 text-emerald-600 font-medium">· {totalValue.toLocaleString('ro-RO')} MDL valoare potențială</span>}
          </p>
        </div>
      </div>

      <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-2 flex gap-2 flex-shrink-0 overflow-x-auto">
        {STATUS_FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all whitespace-nowrap ${filter === f.id ? 'bg-[#004437] text-white border-[#004437]' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Se încarcă...</div>
        ) : (
          <div className="space-y-2 max-w-4xl">
            {offers.map((o: any) => {
              const cfg = STATUS_CFG[o.status] || STATUS_CFG.draft
              return (
                <div key={o.id} onClick={() => openOffer(o)}
                  className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md hover:border-[#004437]/30 transition-all cursor-pointer">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{o.content_json?.packageName || o.template?.name || '—'}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cfg.cls}`}>{cfg.label}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs text-gray-500">
                      {o.lead && <span>👤 {o.lead.name}</span>}
                      {o.sector && <span>· {o.sector}</span>}
                      <span className="text-emerald-600 font-medium">· {Number(o.price).toLocaleString('ro-RO')} {o.price_unit}</span>
                      <span>· {new Date(o.created_at).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>

                  {/* Schimbare rapidă status — nu deschide drawer-ul */}
                  <select value={o.status} onClick={e => e.stopPropagation()} onChange={e => updateStatus(o.id, e.target.value, e as any)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 flex-shrink-0">
                    <option value="draft">Draft</option>
                    <option value="sent">Trimis</option>
                    <option value="accepted">Acceptat</option>
                    <option value="rejected">Refuzat</option>
                  </select>

                  <button onClick={e => downloadPdf(o, e)} disabled={downloadingId === o.id}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-[#004437] transition-colors flex-shrink-0"
                    title="Download PDF">
                    {downloadingId === o.id
                      ? <div className="w-3.5 h-3.5 border-2 border-gray-300 border-t-[#004437] rounded-full animate-spin" />
                      : <Download size={14} />}
                  </button>

                  <button onClick={e => deleteOffer(o.id, e)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors flex-shrink-0"
                    title="Șterge">
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })}
            {offers.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <FileSignature size={28} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">Nicio ofertă {filter !== 'all' ? `cu statusul "${STATUS_CFG[filter]?.label}"` : ''}</p>
                <p className="text-xs text-gray-300 mt-1">Generează oferte din fișa unui contact (tab 📄 Oferte)</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Click pe ofertă → deschide fișa clientului direct pe oferta respectivă, pentru editare */}
      <LeadDrawer
        leadId={selectedLeadId}
        onClose={closeDrawer}
        team={team}
        isAdmin={isAdmin}
        initialTab="offers"
        initialOfferId={selectedOfferId}
      />
    </div>
  )
}
