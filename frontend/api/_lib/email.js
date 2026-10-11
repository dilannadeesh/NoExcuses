// Uses Resend's HTTP API directly (no SDK) so there's one fewer dependency.
// Until a custom domain is verified in Resend, RESEND_FROM must stay on the
// resend.dev sandbox sender, which can only deliver to the Resend account's
// own email — see https://resend.com/docs/knowledge-base/403-error-resend-dev-domain
const RESEND_API_URL = "https://api.resend.com/emails";
const DEFAULT_FROM = "NoExcuses Badminton <onboarding@resend.dev>";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function resetEmailHtml({ name, resetUrl, hours, byAdmin }) {
  const intro = byAdmin
    ? "An administrator has asked for you to set a new password for your NoExcuses Badminton account."
    : "Someone (hopefully you) asked to reset the password for your NoExcuses Badminton account.";
  const expiry = hours >= 24 ? `${Math.round(hours / 24)} day${hours >= 48 ? "s" : ""}` : `${hours} hour${hours === 1 ? "" : "s"}`;
  return `<!doctype html>
<html><body style="margin:0;background:#060a08;padding:24px 12px;font-family:Inter,Segoe UI,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
    <table role="presentation" width="100%" style="max-width:480px;background:#0e1612;border:1px solid #1f2d25;border-radius:16px;">
      <tr><td style="padding:28px 28px 8px;">
        <div style="font-size:11px;letter-spacing:.42em;color:#9fb0a5;text-transform:uppercase;">No Excuses</div>
        <div style="font-size:28px;font-weight:800;font-style:italic;text-transform:uppercase;color:#f3f7f1;line-height:1.1;">Badminton</div>
      </td></tr>
      <tr><td style="padding:12px 28px 4px;color:#f3f7f1;font-size:15px;line-height:1.6;">
        <p style="margin:0 0 12px;">Hi ${esc(name) || "there"},</p>
        <p style="margin:0 0 20px;">${intro}</p>
      </td></tr>
      <tr><td style="padding:0 28px 8px;">
        <a href="${esc(resetUrl)}" style="display:inline-block;background:#ccf53c;color:#0a1206;font-weight:700;font-size:15px;text-decoration:none;padding:14px 24px;border-radius:12px;">Set a new password</a>
      </td></tr>
      <tr><td style="padding:16px 28px 28px;color:#9fb0a5;font-size:13px;line-height:1.6;">
        <p style="margin:0 0 8px;">This link works once and expires in ${expiry}.</p>
        <p style="margin:0 0 8px;">Button not working? Paste this into your browser:<br><span style="word-break:break-all;color:#ccf53c;">${esc(resetUrl)}</span></p>
        <p style="margin:0;">If you didn't expect this email you can ignore it — your password stays the same.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

export async function sendPasswordResetEmail({ to, name, resetUrl, hours = 1, byAdmin = false }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY env var is not set.");
  const from = process.env.RESEND_FROM || DEFAULT_FROM;

  const expiryText = hours >= 24 ? `${Math.round(hours / 24)} day(s)` : `${hours} hour(s)`;
  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Set a new password for NoExcuses Badminton",
      html: resetEmailHtml({ name, resetUrl, hours, byAdmin }),
      text: `Set a new password for NoExcuses Badminton: ${resetUrl}\n\nThis link works once and expires in ${expiryText}. If you didn't expect this email, ignore it — your password stays the same.`,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend API error (${res.status}): ${body}`);
  }
  return res.json();
}
