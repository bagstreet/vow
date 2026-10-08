// Magic-link mail via Brevo transactional API (free tier: 300 mails/day, HTTPS, no SMTP, no extra deps).
// Env: BREVO_API_KEY, MAIL_FROM (a sender verified in Brevo). Without them the link is not sent (dev).
export function magicMailHtml(link) {
  return `<!doctype html><html><body style="margin:0;background:#020303;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#020303"><tr><td align="center" style="padding:40px 16px">
<table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#101214;border:1px solid #23272a;border-radius:16px">
<tr><td style="padding:32px 32px 8px;font-size:34px;font-weight:700;letter-spacing:-1px;color:#f3f5f6">vow<span style="color:#0E9C86">.</span></td></tr>
<tr><td style="padding:8px 32px 0;color:#f3f5f6;font-size:20px;font-weight:600">Your sign-in link</td></tr>
<tr><td style="padding:12px 32px 0;color:#b7bdc1;font-size:15px;line-height:1.5">Tap the button to open your dashboard. The link works once and expires in 10 minutes.</td></tr>
<tr><td style="padding:24px 32px"><a href="${link}" style="display:inline-block;background:#0E9C86;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:10px">Sign in to Vow</a></td></tr>
<tr><td style="padding:0 32px 8px;color:#a1a9ae;font-size:12px;line-height:1.5">Button not working? Paste this into your browser:<br><span style="word-break:break-all;color:#b7bdc1">${link}</span></td></tr>
<tr><td style="padding:16px 32px 32px;color:#a1a9ae;font-size:12px">If you did not request this, just ignore this email.</td></tr>
</table></td></tr></table></body></html>`;
}

export async function sendMagicMail(email, token, base, fetchFn = globalThis.fetch) {
  const link = `${base}/magic?t=${encodeURIComponent(token)}`;
  const { BREVO_API_KEY, MAIL_FROM } = process.env;
  if (!BREVO_API_KEY || !MAIL_FROM) { console.warn('magic link mail not configured (BREVO_API_KEY/MAIL_FROM)'); return false; }
  const r = await fetchFn('https://api.brevo.com/v3/smtp/email', {
    method: 'POST', headers: { 'api-key': BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ sender: { name: 'Vow', email: MAIL_FROM }, to: [{ email }], subject: 'Your Vow sign-in link',
      htmlContent: magicMailHtml(link), textContent: `Sign in to Vow: ${link}\n\nThe link works once and expires in 10 minutes. If you did not request it, ignore this email.` }),
  });
  if (!r.ok) { console.warn('brevo send failed', r.status, (await r.text()).slice(0, 200)); return false; }
  return true;
}
