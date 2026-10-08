// Magic-link mail via Gmail SMTP (free, app password). Env: SMTP_USER, SMTP_PASS. Without them the link is logged
// server-side only (dev) and nothing is sent. Uses nodemailer if installed, otherwise reports unavailable.
export async function sendMagicMail(email, token, base) {
  const link = `${base}/magic?t=${encodeURIComponent(token)}`;
  const { SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_USER || !SMTP_PASS) { console.warn('magic link mail not configured (SMTP_USER/SMTP_PASS)'); return false; }
  const nodemailer = (await import('nodemailer')).default;
  const t = nodemailer.createTransport({ service: 'gmail', auth: { user: SMTP_USER, pass: SMTP_PASS } });
  await t.sendMail({ from: `Vow <${SMTP_USER}>`, to: email, subject: 'Your Vow sign-in link', text: `Sign in to Vow: ${link}\n\nThe link works once and expires in 10 minutes. If you did not request it, ignore this email.` });
  return true;
}
