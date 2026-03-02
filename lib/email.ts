// lib/email.ts
// Serviciu email prin Resend

import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM_EMAIL || 'noreply@taxflow.md'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

// ── TRIMITERE INVITAȚIE ──────────────────────────────────────
export async function sendInvitationEmail({
  to,
  token,
  invitedByName,
  role,
}: {
  to: string
  token: string
  invitedByName: string
  role: 'admin' | 'user'
}) {
  const inviteUrl = `${APP_URL}/auth/invite/${token}`
  const roleLabel = role === 'admin' ? 'Administrator' : 'Utilizator'

  const { data, error } = await resend.emails.send({
    from: `TaxFlow CRM <${FROM}>`,
    to,
    subject: `${invitedByName} te-a invitat în TaxFlow CRM`,
    html: `
<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitație TaxFlow CRM</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f5;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,68,55,.12);">
        
        <!-- Header -->
        <tr>
          <td style="background:#004437;padding:32px 40px;text-align:center;">
            <div style="font-family:Georgia,serif;font-size:28px;color:#ffffff;letter-spacing:-0.5px;margin-bottom:4px;">TaxFlow</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.5);letter-spacing:2px;text-transform:uppercase;">CRM · Partner financiar</div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 8px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;">Invitație nouă</p>
            <h1 style="margin:0 0 24px;font-size:22px;font-weight:700;color:#1a1a1a;line-height:1.3;">
              ${invitedByName} te-a invitat să te alături TaxFlow CRM
            </h1>
            
            <div style="background:#e8f0ee;border-radius:8px;padding:16px 20px;margin-bottom:28px;">
              <p style="margin:0;font-size:13px;color:#004437;font-weight:500;">
                📋 Rol acordat: <strong>${roleLabel}</strong>
              </p>
            </div>

            <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.6;">
              Apasă butonul de mai jos pentru a-ți crea contul. 
              Link-ul este valabil <strong>7 zile</strong>.
            </p>

            <div style="text-align:center;margin-bottom:32px;">
              <a href="${inviteUrl}" 
                 style="display:inline-block;background:#004437;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.3px;">
                Creează contul meu →
              </a>
            </div>

            <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;text-align:center;">
              Sau copiază acest link în browser:
            </p>
            <p style="margin:0;font-size:12px;color:#004437;text-align:center;word-break:break-all;">
              ${inviteUrl}
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f4f6f5;padding:20px 40px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;line-height:1.6;">
              Dacă nu te-ai așteptat la această invitație, poți ignora acest email în siguranță.<br>
              © ${new Date().getFullYear()} TaxFlow · Partner în structurare financiară
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
    `,
  })

  if (error) throw new Error(`Email error: ${error.message}`)
  return data
}

// ── NOTIFICARE CONT DEZACTIVAT ───────────────────────────────
export async function sendAccountDeactivatedEmail(to: string, fullName: string) {
  await resend.emails.send({
    from: `TaxFlow CRM <${FROM}>`,
    to,
    subject: 'Contul tău TaxFlow CRM a fost dezactivat',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:40px 20px;">
        <h2 style="color:#004437;">TaxFlow CRM</h2>
        <p>Bună ${fullName},</p>
        <p>Contul tău a fost <strong>dezactivat</strong> de un administrator.</p>
        <p>Dacă crezi că este o eroare, contactează administratorul TaxFlow.</p>
        <p style="color:#9ca3af;font-size:12px;">© ${new Date().getFullYear()} TaxFlow</p>
      </div>
    `,
  })
}

// ── NOTIFICARE CONT REACTIVAT ────────────────────────────────
export async function sendAccountReactivatedEmail(to: string, fullName: string) {
  const loginUrl = `${APP_URL}/auth/login`
  await resend.emails.send({
    from: `TaxFlow CRM <${FROM}>`,
    to,
    subject: 'Contul tău TaxFlow CRM a fost reactivat',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:40px 20px;">
        <h2 style="color:#004437;">TaxFlow CRM</h2>
        <p>Bună ${fullName},</p>
        <p>Contul tău a fost <strong>reactivat</strong>. Te poți loga acum.</p>
        <a href="${loginUrl}" style="display:inline-block;background:#004437;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:12px;">
          Intră în CRM →
        </a>
        <p style="color:#9ca3af;font-size:12px;margin-top:32px;">© ${new Date().getFullYear()} TaxFlow</p>
      </div>
    `,
  })
}
