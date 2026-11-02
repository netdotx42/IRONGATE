import { required } from "../env";
export function escapeHTML(v: string) {
  return v.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export async function email(
  to: string,
  hostname: string,
  message: string,
  severity: string,
  id: string,
) {
  const app = required("NEXT_PUBLIC_APP_URL");
  const text = `IRONGATE • ${severity.toUpperCase()}\n${hostname}\n${message}\n${new Date().toISOString()}\nReview: ${app}/dashboard`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(7000),
    headers: {
      Authorization: `Bearer ${required("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
      "Idempotency-Key": id,
    },
    body: JSON.stringify({
      from: required("RESEND_FROM_EMAIL"),
      to: [to],
      subject: `IRONGATE: ${hostname} security alert`,
      text,
      html: `<div style="background:#0B1220;color:#F8FAFC;padding:32px;font-family:Arial"><h1>IRONGATE</h1><p>${escapeHTML(severity.toUpperCase())} · ${escapeHTML(hostname)}</p><p>${escapeHTML(message)}</p><p>${new Date().toISOString()}</p><a style="color:#34D399" href="${escapeHTML(app)}/dashboard">Review findings</a></div>`,
    }),
  });
  if (!response.ok) throw new Error("EMAIL_DELIVERY_FAILED");
}
