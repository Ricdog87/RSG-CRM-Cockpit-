import "server-only";

/**
 * RSG-gebrandete DSGVO-Einwilligungs-E-Mail (inline-CSS für E-Mail-Clients).
 * Verantwortlicher: RSG Recruiting Solutions Group GmbH.
 */
export const CONSENT_CONTROLLER = "RSG Recruiting Solutions Group GmbH";
export const CONSENT_PRIVACY_EMAIL = "datenschutz@rsg-ai.de";

export function consentEmail(opts: { name: string; link: string }): {
  subject: string;
  html: string;
} {
  const firstName = (opts.name || "").trim().split(" ")[0] || "";
  const hello = firstName ? `Hallo ${firstName},` : "Hallo,";
  const subject = "Ihre Einwilligung zur Datenverarbeitung – RSG Recruiting Solutions Group";
  const html = `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f3f4f6;font-family:'Poppins',Segoe UI,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">
        <tr><td style="background:linear-gradient(135deg,#1d4ed8,#3b82f6);padding:28px 32px;">
          <span style="display:inline-block;background:rgba(255,255,255,.18);color:#fff;font-weight:800;font-size:18px;letter-spacing:1px;padding:8px 12px;border-radius:10px;">RSG</span>
          <span style="color:#eaf1ff;font-size:13px;margin-left:10px;vertical-align:middle;">Recruiting Solutions Group</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 12px;font-size:20px;color:#0f172a;">Einwilligung zur Datenverarbeitung</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">${hello}</p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">
            wir möchten Ihre Bewerbungsunterlagen (inkl. Lebenslauf) für die Vermittlung an passende Positionen speichern und verarbeiten.
            Bitte bestätigen Sie dafür einmalig Ihre Einwilligung gemäß Art. 6 Abs. 1 lit. a DSGVO – das dauert nur einen Klick.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td style="border-radius:12px;background:#1d4ed8;">
            <a href="${opts.link}" target="_blank" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">Einwilligung erteilen</a>
          </td></tr></table>
          <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#64748b;">
            Falls der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:<br>
            <a href="${opts.link}" style="color:#1d4ed8;word-break:break-all;">${opts.link}</a>
          </p>
          <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#64748b;">
            Ihre Einwilligung ist freiwillig und jederzeit mit Wirkung für die Zukunft widerrufbar – formlos per E-Mail an
            <a href="mailto:${CONSENT_PRIVACY_EMAIL}" style="color:#1d4ed8;">${CONSENT_PRIVACY_EMAIL}</a>.
          </p>
        </td></tr>
        <tr><td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
          <p style="margin:0;font-size:11px;line-height:1.6;color:#94a3b8;">
            <strong style="color:#475569;">${CONSENT_CONTROLLER}</strong><br>
            Verantwortlicher im Sinne der DSGVO · Datenschutz: ${CONSENT_PRIVACY_EMAIL}<br>
            Diese E-Mail wurde automatisiert im Rahmen Ihres Bewerbungsprozesses versendet.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  return { subject, html };
}
