// Constante partajate de taburile din LeadDrawer

export const STATUSES = ['Nou','Contactat','Întâlnire programată','Ofertă trimisă','Client activ','Pierdut','Nu se califică']
export const SOURCES = ['Meta Ads','WhatsApp','Organic','Referință','Site web','Import']
export const FISCAL_REGIMES = ['non-TVA','TVA']
export const SERVICE_TYPES = ['Contabilitate lunară','Înregistrare SRL','Consultanță fiscală','Salarizare','Audit','Altele']

export const ST_COLORS: Record<string,string> = {
  'Nou':'#94a3b8','Contactat':'#3a7bd5','Întâlnire programată':'#c9a84c',
  'Ofertă trimisă':'#8b5cf6','Client activ':'#00c48c','Pierdut':'#e05050','Nu se califică':'#f97316'
}

export const OFFER_STATUS_CFG: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-gray-100 text-gray-600' },
  sent: { label: 'Trimis', cls: 'bg-blue-50 text-blue-600' },
  accepted: { label: 'Acceptat', cls: 'bg-green-50 text-green-700' },
  rejected: { label: 'Refuzat', cls: 'bg-red-50 text-red-600' },
}
