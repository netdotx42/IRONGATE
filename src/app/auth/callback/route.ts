import { NextResponse } from "next/server";
import { db } from "@/lib/supabase/server";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    const client = await db();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(
        new URL(
          url.searchParams.get("recovery") === "1"
            ? "/settings?recovery=1"
            : "/dashboard",
          request.url,
        ),
      );
  }
  return NextResponse.redirect(new URL("/?auth_error=1", request.url));
}
