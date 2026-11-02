import { createHmac } from "node:crypto";
import { admin } from "../supabase/server";
export async function rate(request: Request, userId?: string) {
  const ip =
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ??
    (process.env.NODE_ENV === "production"
      ? "unknown"
      : (request.headers.get("x-forwarded-for") ?? "development"));
  const hash = createHmac(
    "sha256",
    process.env.CRON_SECRET ?? "local-development",
  )
    .update(ip)
    .digest("hex");
  const kind = request.method === "GET" ? "read" : "write";
  const limit = userId ? (kind === "read" ? 60 : 20) : 10;
  for (const key of [
    `${kind}:ip:${hash}`,
    ...(userId ? [`${kind}:user:${userId}`] : []),
  ]) {
    const { data, error } = await admin().rpc("consume_rate", {
      bucket_key: key,
      bucket_limit: limit,
    });
    if (error) throw new Error("SERVICE_UNAVAILABLE");
    if (!data) throw new Error("RATE_LIMITED");
  }
}
