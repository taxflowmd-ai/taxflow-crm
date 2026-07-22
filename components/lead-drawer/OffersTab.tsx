'use client'
import { Trash2, Download, Send, Plus as PlusIcon } from 'lucide-react'
import { OFFER_STATUS_CFG } from './constants'
import type { OfferEditor } from './useOfferEditor'

interface Props {
  offers: OfferEditor
  leadEmail?: string | null
}

export default function OffersTab({ offers, leadEmail }: Props) {
  const {
    offerTemplates, clientOffers, offerStep, setOfferStep, offerForm,
    generatingPdf, sendingEmail, savingOffer,
    startNewOffer, editOffer, handleSaveOfferDraft, handleDownloadPdf,
    handleSendEmail, handleDeleteOffer, updateOfferField, handlePackageChange,
    handleReloadServicesFromPackage, updateProblem, addProblem, removeProblem,
    updateCategoryItem, removeCategoryItem, addCategoryItem,
    updateExcluded, addExcluded, removeExcluded,
  } = offers

  return (
    <div className="p-4">
      {offerStep === 'list' && (
        <div className="space-y-4">
          {/* Lista oferte existente */}
          {clientOffers.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Oferte trimise</p>
              {clientOffers.map((o: any) => {
                const cfg = OFFER_STATUS_CFG[o.status] || OFFER_STATUS_CFG.draft
                return (
                  <div key={o.id} className="border border-gray-200 rounded-xl p-3 hover:border-gray-300 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => editOffer(o)}>
                        <div className="text-sm font-medium text-gray-800">{o.content_json?.packageName || o.template?.name}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cfg.cls}`}>{cfg.label}</span>
                          <span className="text-[10px] text-gray-400">{Number(o.price).toLocaleString('ro-RO')} {o.price_unit}</span>
                          <span className="text-[10px] text-gray-400">· {new Date(o.created_at).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' })}</span>
                        </div>
                      </div>
                      <button onClick={() => handleDeleteOffer(o.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Selectare șablon nou */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Generează ofertă nouă</p>
            <div className="space-y-2">
              {offerTemplates.map((t: any) => (
                <button key={t.id} onClick={() => startNewOffer(t)}
                  className="w-full text-left border border-gray-200 rounded-xl p-3 hover:border-[#004437] hover:bg-[#f8fffd] transition-colors group">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-gray-800 group-hover:text-[#004437]">{t.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{t.tagline}</div>
                    </div>
                    <div className="text-xs text-emerald-600 font-medium whitespace-nowrap ml-2">
                      {Number(t.price_min).toLocaleString('ro-RO')}–{Number(t.price_max).toLocaleString('ro-RO')} {t.price_unit}
                    </div>
                  </div>
                </button>
              ))}
              {offerTemplates.length === 0 && (
                <div className="text-center py-6 text-gray-400 text-sm">Niciun șablon disponibil</div>
              )}
            </div>
          </div>
        </div>
      )}

      {offerStep === 'edit' && offerForm && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button onClick={() => setOfferStep('list')} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
              ← Înapoi la listă
            </button>
            {offerForm.status && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${(OFFER_STATUS_CFG[offerForm.status] || OFFER_STATUS_CFG.draft).cls}`}>
                {(OFFER_STATUS_CFG[offerForm.status] || OFFER_STATUS_CFG.draft).label}
              </span>
            )}
          </div>

          <div>
            <label className="label">Destinat (sector / companie)</label>
            <input value={offerForm.sector} onChange={e => updateOfferField('sector', e.target.value)} className="input" placeholder="ex: Tutungerie / Retail" />
          </div>

          {/* Probleme identificate */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="label !mb-0">Probleme identificate</label>
              <button onClick={addProblem} className="text-[10px] text-[#004437] font-medium flex items-center gap-1 hover:underline">
                <PlusIcon size={10} /> Adaugă
              </button>
            </div>
            <div className="space-y-2">
              {offerForm.problems.map((p: any, i: number) => (
                <div key={i} className="bg-gray-50 rounded-xl p-2.5 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <input value={p.title} onChange={e => updateProblem(i, 'title', e.target.value)}
                      placeholder="Titlu problemă" className="input text-xs flex-1" />
                    <button onClick={() => removeProblem(i)} className="text-gray-300 hover:text-red-500 flex-shrink-0">
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <textarea value={p.text} onChange={e => updateProblem(i, 'text', e.target.value)}
                    placeholder="Descriere și consecințe..." className="input text-xs resize-none" rows={2} />
                </div>
              ))}
            </div>
          </div>

          {/* Pachet + preț */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Pachet</label>
              <select
                value={offerForm.template_id || ''}
                onChange={e => handlePackageChange(e.target.value)}
                className="input">
                {(!offerForm.template_id || !offerTemplates.some((t: any) => t.id === offerForm.template_id)) && (
                  <option value="">{offerForm.packageName || '— selectează —'}</option>
                )}
                {offerTemplates.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Preț (MDL/lună)</label>
              <input value={offerForm.price} onChange={e => updateOfferField('price', e.target.value)} type="number" min="0" className="input" />
            </div>
            <div>
              <label className="label">Contract minim (luni)</label>
              <input value={offerForm.contractMonths} onChange={e => updateOfferField('contractMonths', e.target.value)} type="number" min="1" className="input" />
            </div>
            <div>
              <label className="label">Valabilă până la</label>
              <input value={offerForm.validUntil} onChange={e => updateOfferField('validUntil', e.target.value)} placeholder="DD.MM.YYYY" className="input" />
            </div>
          </div>

          {/* Categorii de servicii */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="label !mb-0">Servicii incluse</label>
              <button onClick={handleReloadServicesFromPackage}
                className="text-[10px] text-gray-400 hover:text-[#004437] underline flex-shrink-0">
                ↻ Reîncarcă din pachet
              </button>
            </div>
            <p className="text-[10px] text-gray-400 -mt-2">Descrierea apare în glosarul PDF (pagină separată, font mic)</p>
            {offerForm.categories.map((cat: any, ci: number) => (
              <div key={ci} className="bg-gray-50 rounded-xl p-3">
                <div className="text-xs font-semibold text-gray-700 mb-2">{cat.title}</div>
                <div className="space-y-2">
                  {cat.items.map((item: any, ii: number) => (
                    <div key={ii} className="bg-white rounded-lg p-2 border border-gray-100 space-y-1">
                      <div className="flex items-center gap-2">
                        <input value={item.title} onChange={e => updateCategoryItem(ci, ii, 'title', e.target.value)}
                          placeholder="Titlu serviciu" className="input text-xs flex-1 font-medium" />
                        <button onClick={() => removeCategoryItem(ci, ii)} className="text-gray-300 hover:text-red-500 flex-shrink-0">
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <input value={item.description || ''} onChange={e => updateCategoryItem(ci, ii, 'description', e.target.value)}
                        placeholder="Descriere pentru glosar (opțional, dar recomandat)" className="input text-[11px] text-gray-500 w-full" />
                    </div>
                  ))}
                  <button onClick={() => addCategoryItem(ci)} className="text-[10px] text-[#004437] font-medium hover:underline flex items-center gap-1">
                    <PlusIcon size={10} /> Adaugă serviciu
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Ce nu este inclus */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="label !mb-0">Ce nu este inclus</label>
              <button onClick={addExcluded} className="text-[10px] text-[#004437] font-medium flex items-center gap-1 hover:underline">
                <PlusIcon size={10} /> Adaugă
              </button>
            </div>
            <div className="space-y-1.5">
              {offerForm.excluded.map((e: string, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={e} onChange={ev => updateExcluded(i, ev.target.value)} className="input text-xs flex-1" />
                  <button onClick={() => removeExcluded(i)} className="text-gray-300 hover:text-red-500 flex-shrink-0">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Acțiuni */}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
            <button onClick={() => handleSaveOfferDraft('draft')} disabled={savingOffer}
              className="text-xs border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors flex-1">
              {savingOffer ? 'Se salvează...' : 'Salvează draft'}
            </button>
            <button onClick={handleDownloadPdf} disabled={generatingPdf}
              className="text-xs bg-gray-700 text-white px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-1.5 flex-1">
              <Download size={13} /> {generatingPdf ? 'Se generează...' : 'Download PDF'}
            </button>
            <button onClick={handleSendEmail} disabled={sendingEmail}
              className="text-xs bg-[#004437] text-white px-3 py-2 rounded-lg hover:bg-[#005a47] transition-colors flex items-center justify-center gap-1.5 flex-1">
              <Send size={13} /> {sendingEmail ? 'Se trimite...' : 'Trimite email'}
            </button>
          </div>
          {!leadEmail && (
            <p className="text-[10px] text-amber-600 text-center">Clientul nu are email salvat — completează în tab Informații pentru trimitere directă.</p>
          )}
        </div>
      )}
    </div>
  )
}
