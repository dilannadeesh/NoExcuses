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
  // trim: a stray space/newline pasted into the env var makes Resend say "API key is invalid"
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) throw new Error("RESEND_API_KEY env var is not set.");
  const from = (process.env.RESEND_FROM || "").trim() || DEFAULT_FROM;

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

// ---- Group invite --------------------------------------------------------
// Sent when an owner/admin adds someone to a group. `joined` = they already
// have an account (just open the app) vs. a placeholder they claim by signing
// up with this same email.

function inviteEmailHtml({ name, inviterName, groupName, url, joined }) {
  const lead = joined
    ? `${esc(inviterName)} added you to <b>${esc(groupName)}</b> on NoExcuses Badminton.`
    : `${esc(inviterName)} added you to <b>${esc(groupName)}</b> on NoExcuses Badminton, the app your group uses to keep score.`;
  const how = joined
    ? "Open the app to see the group, your ranking and anything you owe."
    : "Create your free account with <b>this email address</b> and the group, your games and your ranking are already there.";
  const button = joined ? "Open the app" : "Join the group";
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
        <p style="margin:0 0 12px;">${lead}</p>
        <p style="margin:0 0 20px;color:#c9d4cc;">${how}</p>
      </td></tr>
      <tr><td style="padding:0 28px 8px;">
        <a href="${esc(url)}" style="display:inline-block;background:#ccf53c;color:#0a1206;font-weight:700;font-size:15px;text-decoration:none;padding:14px 24px;border-radius:12px;">${button}</a>
      </td></tr>
      <tr><td style="padding:16px 28px 28px;color:#9fb0a5;font-size:13px;line-height:1.6;">
        <p style="margin:0 0 8px;">Log games, see who's top of the group, get fair matches for the night and split the court fee.</p>
        <p style="margin:0;">Not expecting this? You can ignore it — nothing happens unless you sign up.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

export function inviteEmail({ name, inviterName, groupName, url, joined }) {
  const subject = `${inviterName} added you to ${groupName}`;
  const text = joined
    ? `${inviterName} added you to ${groupName} on NoExcuses Badminton. Open the app to see it: ${url}`
    : `${inviterName} added you to ${groupName} on NoExcuses Badminton. Sign up with this email address and the group is already there: ${url}\n\nNot expecting this? Ignore it — nothing happens unless you sign up.`;
  return { subject, text, html: inviteEmailHtml({ name, inviterName, groupName, url, joined }) };
}

export async function sendGroupInviteEmail({ to, ...rest }) {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) throw new Error("RESEND_API_KEY env var is not set.");
  const from = (process.env.RESEND_FROM || "").trim() || DEFAULT_FROM;
  const { subject, text, html } = inviteEmail(rest);
  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html, text }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend API error (${res.status}): ${body}`);
  }
  return res.json();
}

// ---- Content report -> the team ------------------------------------------
export async function sendReportEmail({ to, reporter, groupName, groupId, reportedName, reason, details, reportId }) {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) throw new Error("RESEND_API_KEY env var is not set.");
  const from = (process.env.RESEND_FROM || "").trim() || DEFAULT_FROM;
  const lines = [
    `Report #${reportId}: ${reason}`,
    `From: ${reporter.name} <${reporter.email}> (user ${reporter.id})`,
    groupId ? `Group: ${groupName || "?"} (id ${groupId})` : null,
    reportedName ? `About: ${reportedName}` : null,
    "",
    details || "(no details)",
    "",
    "Apple expects reports to be acted on within 24 hours: remove the content or the person, or reply to the reporter.",
  ].filter((l) => l !== null);
  const text = lines.join("\n");
  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: reporter.email,
      subject: `[NoExcuses report #${reportId}] ${reason}${groupName ? ` — ${groupName}` : ""}`,
      text,
      html: `<pre style="font:14px/1.5 ui-monospace,Menlo,monospace;white-space:pre-wrap">${esc(text)}</pre>`,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend API error (${res.status}): ${body}`);
  }
  return res.json();
}
