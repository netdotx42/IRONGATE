import { createServerClient } from "@supabase/ssr";
import { boundedFetch } from "./lib/supabase/fetch";
import { NextRequest, NextResponse } from "next/server";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;
  const client = createServerClient(url, key, {
    global: { fetch: boundedFetch },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values) => {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, {
            ...options,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
          }),
        );
      },
    },
  });
  try {
    await client.auth.getUser();
  } catch {
    /* API authorization rechecks identity and fails closed. */
  }
  return response;
}
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/automation/:path*",
    "/settings/:path*",
    "/api/:path*",
  ],
};
