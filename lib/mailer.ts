import { env } from "cloudflare:workers";

// Transactional mail for the portal (password recovery, future notices).
// Providers are plugged in through environment variables; Brevo's HTTPS API
// is the primary one (Workers cannot use SMTP port 587 reliably), Resend is
// an optional alternative. Until a provider key and sender are configured,
// sends are skipped and reported unsent so the caller can fall back to
// manual delivery.
export type MailResult = { sent: boolean; reason?: string };

type Provider = { key: string; from: string; url: string; headers: Record<string, string>; body: (msg: { to: string; subject: string; text: string }) => unknown };

function configuredProvider(): Provider | null {
  const e = env as Record<string, string | undefined>;
  if (e.BREVO_API_KEY && e.MAIL_FROM) {
    return {
      key: e.BREVO_API_KEY, from: e.MAIL_FROM, url: (e.ALLOW_MAIL_ENDPOINT_OVERRIDE === "true" && e.BREVO_API_URL) || "https://api.brevo.com/v3/smtp/email",
      headers: { "api-key": e.BREVO_API_KEY, "Content-Type": "application/json" },
      body: (msg) => ({ sender: { email: e.MAIL_FROM }, to: [{ email: msg.to }], subject: msg.subject, textContent: msg.text }),
    };
  }
  if (e.RESEND_API_KEY && e.MAIL_FROM) {
    return {
      key: e.RESEND_API_KEY, from: e.MAIL_FROM, url: (e.ALLOW_MAIL_ENDPOINT_OVERRIDE === "true" && e.RESEND_API_URL) || "https://api.resend.com/emails",
      headers: { Authorization: `Bearer ${e.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: (msg) => ({ from: e.MAIL_FROM, to: [msg.to], subject: msg.subject, text: msg.text }),
    };
  }
  return null;
}

export async function sendMail(msg: { to: string; subject: string; text: string }): Promise<MailResult> {
  const provider = configuredProvider();
  if (!provider) {
    console.warn("mailer: no provider configured (BREVO_API_KEY or RESEND_API_KEY, plus MAIL_FROM, missing); email not sent to", msg.to);
    return { sent: false, reason: "no_provider" };
  }
  try {
    const res = await fetch(provider.url, {
      method: "POST",
      headers: provider.headers,
      body: JSON.stringify(provider.body(msg)),
    });
    if (!res.ok) {
      console.warn("mailer: provider rejected", res.status);
      return { sent: false, reason: `provider_${res.status}` };
    }
    return { sent: true };
  } catch {
    return { sent: false, reason: "provider_error" };
  }
}

export function mailConfigured(): boolean {
  return configuredProvider() !== null;
}
