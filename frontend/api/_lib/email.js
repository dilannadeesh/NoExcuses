// Uses Resend's HTTP API directly (no SDK) so there's one fewer dependency.
// Until a custom domain is verified in Resend, RESEND_FROM must stay on the
// resend.dev sandbox sender, which can only deliver to the Resend account's
// own email — see https://resend.com/docs/knowledge-base/403-error-resend-dev-domain
const RESEND_API_URL = "https://api.resend.com/emails";
const DEFAULT_FROM = "NoExcuses <onboarding@resend.dev>";

export async function sendPasswordResetEmail({ to, resetUrl }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY env var is not set.");
  const from = process.env.RESEND_FROM || DEFAULT_FROM;

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Reset your NoExcuses password",
      html: `
        <p>Someone requested a password reset for this email address on NoExcuses.</p>
        <p><a href="${resetUrl}">Click here to set a new password</a>. This link expires in 1 hour.</p>
        <p>If you didn't request this, you can safely ignore this email.</p>
      `,
      text: `Reset your NoExcuses password: ${resetUrl} (expires in 1 hour, ignore if you didn't request this)`,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend API error (${res.status}): ${body}`);
  }
  return res.json();
}
