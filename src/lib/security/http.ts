import { NextResponse } from "next/server";
import { ZodError } from "zod";
export class ApiError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
  }
}
export function ok(data: unknown, status = 200) {
  return NextResponse.json(
    { data },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
export function fail(error: unknown) {
  const code =
    error instanceof ApiError
      ? error.code
      : error instanceof ZodError
        ? "INVALID_INPUT"
        : error instanceof Error
          ? error.message
          : "INTERNAL_ERROR";
  const allowed = [
    "UNAUTHORIZED",
    "NOT_FOUND",
    "SERVICE_UNAVAILABLE",
    "INVALID_URL",
    "BLOCKED_DESTINATION",
    "RATE_LIMITED",
    "DOMAIN_NOT_VERIFIED",
    "LIMIT_REACHED",
    "DNS_TIMEOUT",
  ];
  const safe =
    error instanceof ApiError ||
    allowed.includes(code) ||
    code === "INVALID_INPUT"
      ? code
      : "REQUEST_FAILED";
  return NextResponse.json(
    { error: { code: safe, message: safe.replaceAll("_", " ").toLowerCase() } },
    {
      status:
        error instanceof ApiError
          ? error.status
          : code === "UNAUTHORIZED"
            ? 401
            : code === "SERVICE_UNAVAILABLE"
              ? 503
              : code === "RATE_LIMITED"
                ? 429
                : 400,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
export async function body(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError("INVALID_INPUT");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) {
        await reader.cancel();
        throw new ApiError("BODY_TOO_LARGE", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ApiError("INVALID_INPUT");
  }
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = process.env.NEXT_PUBLIC_APP_URL;
  if (
    !origin ||
    !expected ||
    new URL(origin).origin !== new URL(expected).origin
  )
    throw new ApiError("INVALID_ORIGIN", 403);
}
