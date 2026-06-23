// lib/offers/sync-lead-status.ts
// La trimiterea unei oferte (status='sent'), avansează automat statusul lead-ului
// la 'Ofertă trimisă' — dar doar dacă era într-un status anterior în pipeline.

const STATUSES = ['Nou', 'Contactat', 'Întâlnire programată', 'Ofertă trimisă', 'Client activ', 'Pierdut', 'Nu se califică']
const OFFER_SENT_INDEX = STATUSES.indexOf('Ofertă trimisă')

export async function syncLeadStatusOnOfferSent(admin: any, leadId: string, userId?: string | null) {
  if (!leadId) return

  const { data: lead } = await admin
    .from('leads')
    .select('id, status')
    .eq('id', leadId)
    .single()

  if (!lead) return

  const currentIndex = STATUSES.indexOf(lead.status)
  // Avansează doar dacă lead-ul e într-un status ANTERIOR lui 'Ofertă trimisă'
  // (Nou, Contactat, Întâlnire programată) — nu retrogradează din Client activ/Pierdut/etc.
  if (currentIndex === -1 || currentIndex >= OFFER_SENT_INDEX) return

  await admin
    .from('leads')
    .update({ status: 'Ofertă trimisă' })
    .eq('id', leadId)

  // Înregistrare în istoric, în același format folosit de restul aplicației
  await admin.from('lead_history').insert({
    lead_id: leadId,
    type: 'status_change',
    action: `Status schimbat: ${lead.status} → Ofertă trimisă`,
    content: `Status schimbat: ${lead.status} → Ofertă trimisă (ofertă expediată)`,
    created_by: userId || null,
    user_id: userId || null,
  })
}
