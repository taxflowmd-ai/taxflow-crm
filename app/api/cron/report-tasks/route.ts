// app/api/cron/report-tasks/route.ts
// Rulează zilnic — creează sarcini automate cu 5 zile înainte de termen
// Configurează în vercel.json: { "crons": [{ "path": "/api/cron/report-tasks", "schedule": "0 7 * * *" }] }

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

const admin = () => createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Calculează data termenului pentru un tip de raport în contextul datei curente
function getDeadlineDate(t: any, today: Date): Date | null {
  if (!t.deadline_day) return null
  const day = t.deadline_day
  const freq = t.frequency || 'monthly'
  const month = today.getMonth() + 1 // 1-12
  const year = today.getFullYear()

  if (freq === 'monthly') {
    // Termen: ziua X a lunii următoare
    return new Date(year, month, day) // month în JS e deja luna următoare (0-indexed)
  }

  if (freq === 'quarterly') {
    const quarterEndMonth = Math.ceil(month / 3) * 3
    if (quarterEndMonth === 12) return new Date(year + 1, 0, day)
    return new Date(year, quarterEndMonth, day)
  }

  if (freq === 'semi') {
    if (month <= 6) return new Date(year, 6, day)
    return new Date(year + 1, 0, day)
  }

  if (freq === 'annual') {
    const targetMonth = t.deadline_month ? t.deadline_month - 1 : 0
    const targetYear = t.deadline_month && t.deadline_month <= month ? year + 1 : year
    return new Date(targetYear, targetMonth, day)
  }

  return null
}

export async function GET(req: NextRequest) {
  // Verificare token securitate cron
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = admin()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const targetDate = new Date(today)
  targetDate.setDate(today.getDate() + 5) // cu 5 zile înainte

  let created = 0
  let skipped = 0

  try {
    // Obține toate tipurile de rapoarte cu deadline configurat
    const { data: reportTypes } = await db
      .from('report_types')
      .select('*')
      .not('deadline_day', 'is', null)

    if (!reportTypes?.length) {
      return NextResponse.json({ message: 'Niciun tip cu deadline configurat', created: 0 })
    }

    for (const rt of reportTypes) {
      const deadline = getDeadlineDate(rt, today)
      if (!deadline) continue

      // Verifică dacă termenul e în exact 5 zile
      const diffDays = Math.ceil((deadline.getTime() - today.getTime()) / 86400000)
      if (diffDays !== 5) continue

      // Obține toți clienții cu această obligație activă și raport nedepus
      const { data: obligations } = await db
        .from('client_obligations')
        .select('lead_id, lead:lead_id(name, assigned_to)')
        .eq('report_type_id', rt.id)
        .eq('is_active', true)

      if (!obligations?.length) continue

      // Verifică luna/trimestrul/semestrul curent pentru compliance_reports
      const reportMonth = today.getMonth() + 1
      const reportYear = today.getFullYear()

      for (const obl of obligations) {
        const leadId = obl.lead_id
        const lead = obl.lead as any

        // Verifică dacă raportul e deja marcat done pentru perioada curentă
        const { data: existingReport } = await db
          .from('compliance_reports')
          .select('status')
          .eq('lead_id', leadId)
          .eq('report_type_id', rt.id)
          .eq('year', reportYear)
          .eq('month', reportMonth)
          .single()

        if (existingReport?.status === 'done') {
          skipped++
          continue
        }

        // Verifică dacă sarcina există deja (evită duplicate)
        const taskTitle = `${rt.code} — ${lead?.name || 'Client'} — termen ${deadline.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' })}`
        const { data: existingTask } = await db
          .from('tasks')
          .select('id')
          .eq('title', taskTitle)
          .eq('lead_id', leadId)
          .single()

        if (existingTask) {
          skipped++
          continue
        }

        // Creează sarcina
        await db.from('tasks').insert({
          title: taskTitle,
          lead_id: leadId,
          assigned_to: lead?.assigned_to || null,
          due_at: deadline.toISOString(),
          priority: diffDays <= 3 ? 'high' : 'medium',
          is_done: false,
          created_by: null,
        } as any)

        created++
      }
    }

    return NextResponse.json({
      success: true,
      created,
      skipped,
      message: `${created} sarcini create, ${skipped} omise (done sau existente)`
    })
  } catch (err: any) {
    console.error('Cron error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
