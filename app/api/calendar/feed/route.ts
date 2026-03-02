{\rtf1\mac\ansicpg10000\cocoartf2868
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 import \{ NextRequest, NextResponse \} from 'next/server'\
import \{ createClient \} from '@supabase/supabase-js'\
\
const admin = () => createClient(\
  process.env.NEXT_PUBLIC_SUPABASE_URL!,\
  process.env.SUPABASE_SERVICE_ROLE_KEY!,\
  \{ auth: \{ autoRefreshToken: false, persistSession: false \} \}\
)\
\
function esc(str: string) \{\
  return (str || '').replace(/\\\\/g, '\\\\\\\\').replace(/;/g, '\\\\;').replace(/,/g, '\\\\,').replace(/\\n/g, '\\\\n')\
\}\
\
function icsDate(d: string) \{\
  return new Date(d).toISOString().replace(/[-:]/g, '').replace(/\\.\\d\{3\}/, '')\
\}\
\
export async function GET(req: NextRequest) \{\
  try \{\
    const \{ searchParams \} = new URL(req.url)\
    const token = searchParams.get('token')\
    const userId = searchParams.get('uid')\
    if (!token || !userId) return new NextResponse('Token lips\uc0\u259 ', \{ status: 401 \})\
\
    const db = admin()\
    const \{ data: profile \} = await db\
      .from('profiles').select('id, full_name, calendar_token')\
      .eq('id', userId).eq('calendar_token', token).single()\
    if (!profile) return new NextResponse('Token invalid', \{ status: 401 \})\
\
    const \{ data: events \} = await db\
      .from('events').select('*, lead:lead_id(name, company)')\
      .eq('created_by', userId).order('start_at', \{ ascending: true \})\
\
    const \{ data: reminders \} = await db\
      .from('leads').select('id, name, company, reminder_at, status')\
      .eq('assigned_to', userId).not('reminder_at', 'is', null)\
      .gte('reminder_at', new Date().toISOString())\
\
    const lines: string[] = [\
      'BEGIN:VCALENDAR',\
      'VERSION:2.0',\
      'PRODID:-//TaxFlow CRM//RO',\
      'CALSCALE:GREGORIAN',\
      'METHOD:PUBLISH',\
      `X-WR-CALNAME:TaxFlow - $\{esc((profile as any).full_name)\}`,\
      'X-WR-CALDESC:Evenimente TaxFlow CRM',\
      'X-WR-TIMEZONE:Europe/Chisinau',\
      'X-APPLE-CALENDAR-COLOR:#004437',\
    ]\
\
    const EMOJI: Record<string, string> = \{ meeting: '\uc0\u55358 \u56605 ', call: '\u55357 \u56542 ', deadline: '\u9200 ', task: '\u9989 ' \}\
\
    for (const ev of (events || [])) \{\
      const e = ev as any\
      if (!e.start_at) continue\
      const leadInfo = e.lead ? ` \'95 $\{e.lead.name\}$\{e.lead.company ? ` ($\{e.lead.company\})` : ''\}` : ''\
      lines.push('BEGIN:VEVENT')\
      lines.push(`UID:taxflow-ev-$\{e.id\}@taxflow.md`)\
      lines.push(`DTSTART:$\{icsDate(e.start_at)\}`)\
      lines.push(`DTEND:$\{icsDate(e.end_at || e.start_at)\}`)\
      lines.push(`DTSTAMP:$\{icsDate(new Date().toISOString())\}`)\
      lines.push(`SUMMARY:$\{esc(`$\{EMOJI[e.type] || '\uc0\u55357 \u56517 '\} $\{e.title\}$\{leadInfo\}`)\}`)\
      if (e.description) lines.push(`DESCRIPTION:$\{esc(e.description)\}`)\
      if (e.location) lines.push(`LOCATION:$\{esc(e.location)\}`)\
      lines.push('BEGIN:VALARM')\
      lines.push('TRIGGER:-PT15M')\
      lines.push('ACTION:DISPLAY')\
      lines.push(`DESCRIPTION:$\{esc(e.title)\}`)\
      lines.push('END:VALARM')\
      lines.push('END:VEVENT')\
    \}\
\
    for (const rem of (reminders || [])) \{\
      const r = rem as any\
      lines.push('BEGIN:VEVENT')\
      lines.push(`UID:taxflow-rem-$\{r.id\}@taxflow.md`)\
      lines.push(`DTSTART:$\{icsDate(r.reminder_at)\}`)\
      lines.push(`DTEND:$\{icsDate(r.reminder_at)\}`)\
      lines.push(`DTSTAMP:$\{icsDate(new Date().toISOString())\}`)\
      lines.push(`SUMMARY:$\{esc(`\uc0\u55357 \u56596  $\{r.name\}$\{r.company ? ` ($\{r.company\})` : ''\}`)\}`)\
      lines.push(`DESCRIPTION:$\{esc(`Status CRM: $\{r.status\}`)\}`)\
      lines.push('BEGIN:VALARM')\
      lines.push('TRIGGER:-PT30M')\
      lines.push('ACTION:DISPLAY')\
      lines.push(`DESCRIPTION:$\{esc(`Reminder: $\{r.name\}`)\}`)\
      lines.push('END:VALARM')\
      lines.push('END:VEVENT')\
    \}\
\
    lines.push('END:VCALENDAR')\
\
    return new NextResponse(lines.join('\\r\\n'), \{\
      headers: \{\
        'Content-Type': 'text/calendar; charset=utf-8',\
        'Content-Disposition': 'inline; filename="taxflow.ics"',\
        'Cache-Control': 'no-cache',\
      \},\
    \})\
  \} catch (err: any) \{\
    return new NextResponse('Eroare server', \{ status: 500 \})\
  \}\
\}}