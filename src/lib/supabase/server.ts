import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { boundedFetch } from "./fetch";
import { cookies } from "next/headers";
import { publicEnv, required } from "../env";
export async function db() {
  const env = publicEnv(),
    jar = await cookies();
  return createServerClient(env.url, env.key, {
    global: { fetch: boundedFetch },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (values) => {
        try {
          values.forEach(({ name, value, options }) =>
            jar.set(name, value, {
              ...options,
              secure: process.env.NODE_ENV === "production",
              sameSite: "lax",
            }),
          );
        } catch {
          /* Server component: refresh is handled by proxy. */
        }
      },
    },
  });
}
export function admin() {
  return createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: boundedFetch },
    },
  );
}
export async function authenticated() {
  const client = await db();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) throw new Error("UNAUTHORIZED");
  return { client, user };
}
