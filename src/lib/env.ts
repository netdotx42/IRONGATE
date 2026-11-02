import { z } from "zod";
export function publicEnv() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
    throw new Error("SERVICE_UNAVAILABLE");
  return z.object({ url: z.url(), key: z.string().min(1) }).parse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}
export function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error("SERVICE_UNAVAILABLE");
  return value;
}
export function validateProduction() {
  if (process.env.NODE_ENV === "production") {
    publicEnv();
    for (const key of [
      "SUPABASE_SERVICE_ROLE_KEY",
      "RESEND_API_KEY",
      "RESEND_FROM_EMAIL",
      "CRON_SECRET",
      "NEXT_PUBLIC_APP_URL",
    ])
      required(key);
    if (!required("NEXT_PUBLIC_APP_URL").startsWith("https://"))
      throw new Error("HTTPS app URL required");
    if (required("CRON_SECRET").length < 32)
      throw new Error("CRON_SECRET must be at least 32 characters");
  }
}
