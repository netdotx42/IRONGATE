import { z } from "zod";
import { resolveTxt } from "node:dns/promises";
import { timingSafeEqual } from "node:crypto";
import { authenticated, db, admin } from "./supabase/server";
import { ok, fail, body, sameOrigin, ApiError } from "./security/http";
import { rate } from "./security/rate";
import { scan, scanStatus } from "./scanning";
import { withScanSlot } from "./security/concurrency";
import { parseURL } from "./security/network";
import { nextRun } from "./automation/pure";
import { dispatch } from "./automation/dispatch";
import { required } from "./env";
const uuid = z.uuid();
const schedule = z.enum(["daily", "weekly", "monthly"]);
function check<T>(result: { data: T; error: unknown }) {
  if (result.error) {
    const error = result.error as { message?: string; code?: string };
    if (error.message === "LIMIT_REACHED")
      throw new ApiError("LIMIT_REACHED", 409);
    if (error.message === "DOMAIN_NOT_VERIFIED")
      throw new ApiError("DOMAIN_NOT_VERIFIED", 422);
    if (error.code === "23505")
      throw new ApiError("RESOURCE_ALREADY_EXISTS", 409);
    throw new ApiError("DATABASE_ERROR", 503);
  }
  return result.data;
}
export async function api(request: Request, segments: string[]) {
  try {
    const method = request.method,
      path = segments.join("/");
    if (path === "cron/dispatch") {
      if (method !== "GET") throw new ApiError("METHOD_NOT_ALLOWED", 405);
      const expected = `Bearer ${required("CRON_SECRET")}`,
        actual = request.headers.get("authorization") ?? "";
      if (
        actual.length !== expected.length ||
        !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
      )
        throw new ApiError("UNAUTHORIZED", 401);
      return ok(await dispatch());
    }
    if (method !== "GET") sameOrigin(request);
    if (
      segments[0] === "tools" &&
      ["webshield", "headerguard"].includes(segments[1]) &&
      segments.length === 2 &&
      method === "POST"
    ) {
      const input = z
        .object({
          url: z.string().min(1).max(2048),
          save: z.boolean().default(false),
        })
        .parse(await body(request));
      const client = await db();
      const {
        data: { user },
      } = await client.auth.getUser();
      await rate(request, user?.id);
      if (input.save && !user) throw new ApiError("UNAUTHORIZED", 401);
      const result = await withScanSlot(() =>
        scan(input.url, segments[1] as "webshield" | "headerguard"),
      );
      if (input.save && user) {
        const a = admin();
        const { data: domain } = await client
          .from("domains")
          .select("id")
          .eq("hostname", result.hostname)
          .maybeSingle();
        const saved = check(
          await a
            .from("scans")
            .insert({
              user_id: user.id,
              domain_id: domain?.id ?? null,
              tool: result.tool,
              status: scanStatus(result),
              score: result.score,
              grade: result.grade,
              findings: result.findings,
              result,
              scoring_version: result.scoring_version,
              started_at: result.started_at,
              completed_at: result.completed_at,
            })
            .select("id")
            .single(),
        );
        if (!saved) throw new ApiError("DATABASE_ERROR", 503);
        result.id = saved.id;
      }
      return ok(result);
    }
    const { client, user } = await authenticated();
    await rate(request, user.id);
    const a = admin();
    const owner = (table: string) =>
      a.from(table).select("*").eq("user_id", user.id);
    if (path === "dashboard" && method === "GET") {
      const [domains, scans, monitors, alerts] = await Promise.all([
        client
          .from("domains")
          .select("*")
          .order("created_at", { ascending: false }),
        client
          .from("scans")
          .select("*")
          .order("completed_at", { ascending: false })
          .limit(100),
        client.from("monitors").select("*"),
        client
          .from("alerts")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      return ok({
        domains: check(domains),
        scans: check(scans),
        monitors: check(monitors),
        alerts: check(alerts),
      });
    }
    if (segments[0] === "domains") {
      if (segments.length === 1) {
        if (method === "GET")
          return ok(
            check(
              await client
                .from("domains")
                .select("*")
                .order("created_at", { ascending: false }),
            ),
          );
        if (method === "POST") {
          const input = z
            .object({ hostname: z.string().max(253) })
            .parse(await body(request));
          const u = parseURL(input.hostname);
          return ok(
            check(
              await a.rpc("add_domain", {
                owner_id: user.id,
                host: u.hostname,
              }),
            ),
            201,
          );
        }
      }
      const id = uuid.parse(segments[1]);
      const domain = check(await owner("domains").eq("id", id).maybeSingle());
      if (!domain) throw new ApiError("NOT_FOUND", 404);
      if (segments.length === 2 && method === "DELETE") {
        check(
          await a.from("domains").delete().eq("id", id).eq("user_id", user.id),
        );
        return ok({ deleted: true });
      }
      if (
        segments[2] === "verify" &&
        segments.length === 3 &&
        method === "POST"
      ) {
        let records: string[][] = [];
        try {
          records = await Promise.race([
            resolveTxt(`_irongate.${domain.hostname}`),
            new Promise<never>((_, reject) => {
              const t = setTimeout(
                () => reject(new Error("DNS_TIMEOUT")),
                4000,
              );
              t.unref();
            }),
          ]);
        } catch {
          throw new ApiError("TXT_NOT_FOUND", 422);
        }
        if (
          !records.some(
            (r) =>
              r.join("") ===
              `irongate-verification=${domain.verification_token}`,
          )
        )
          throw new ApiError("TXT_NOT_FOUND", 422);
        return ok(
          check(
            await a
              .from("domains")
              .update({ verified: true, verified_at: new Date().toISOString() })
              .eq("id", id)
              .eq("user_id", user.id)
              .select()
              .single(),
          ),
        );
      }
    }
    if (segments[0] === "scans") {
      if (segments.length === 1 && method === "GET") {
        const page = z.coerce
          .number()
          .int()
          .min(0)
          .max(10000)
          .parse(new URL(request.url).searchParams.get("page") ?? 0);
        const params = new URL(request.url).searchParams;
        const host = params.get("hostname");
        const tool = params.get("tool");
        let query = client.from("scans").select("*");
        if (host)
          query = query.eq("result->>hostname", parseURL(host).hostname);
        if (tool)
          query = query.eq(
            "tool",
            z.enum(["webshield", "headerguard"]).parse(tool),
          );
        return ok(
          check(
            await query
              .order("completed_at", { ascending: false })
              .range(page * 20, page * 20 + 19),
          ),
        );
      }
      const id = uuid.parse(segments[1]);
      const record = check(
        await client.from("scans").select("*").eq("id", id).maybeSingle(),
      );
      if (!record) throw new ApiError("NOT_FOUND", 404);
      if (segments.length === 2 && method === "GET") return ok(record);
      if (segments[2] === "export" && method === "POST")
        return new Response(JSON.stringify(record.result, null, 2), {
          headers: {
            "Content-Type": "application/json",
            "Content-Disposition": `attachment; filename="irongate-${id}.json"`,
            "Cache-Control": "no-store",
          },
        });
    }
    if (segments[0] === "monitors") {
      if (segments.length === 1) {
        if (method === "GET")
          return ok(check(await client.from("monitors").select("*")));
        if (method === "POST") {
          const input = z
            .object({ domain_id: uuid, frequency: schedule })
            .parse(await body(request));
          const domain = check(
            await owner("domains").eq("id", input.domain_id).maybeSingle(),
          );
          if (
            !domain?.verified ||
            Date.parse(domain.verified_at) < Date.now() - 90 * 86400000
          )
            throw new ApiError("DOMAIN_NOT_VERIFIED", 422);
          return ok(
            check(
              await a.rpc("enroll_monitor", {
                owner_id: user.id,
                owned_domain: input.domain_id,
                schedule: input.frequency,
              }),
            ),
            201,
          );
        }
      }
      const id = uuid.parse(segments[1]);
      const record = check(await owner("monitors").eq("id", id).maybeSingle());
      if (!record) throw new ApiError("NOT_FOUND", 404);
      if (method === "DELETE") {
        check(
          await a.from("monitors").delete().eq("id", id).eq("user_id", user.id),
        );
        return ok({ deleted: true });
      }
      if (method === "PATCH") {
        const input = z
          .object({
            enabled: z.boolean().optional(),
            frequency: schedule.optional(),
          })
          .strict()
          .parse(await body(request));
        return ok(
          check(
            await a
              .from("monitors")
              .update({
                ...input,
                ...(input.frequency
                  ? { next_run_at: nextRun(input.frequency) }
                  : {}),
              })
              .eq("id", id)
              .eq("user_id", user.id)
              .select()
              .single(),
          ),
        );
      }
    }
    if (segments[0] === "alerts") {
      if (segments.length === 1 && method === "GET")
        return ok(
          check(
            await client
              .from("alerts")
              .select("*")
              .order("created_at", { ascending: false })
              .limit(100),
          ),
        );
      if (segments.length === 2 && method === "PATCH") {
        const id = uuid.parse(segments[1]);
        const result = check(
          await a
            .from("alerts")
            .update({ acknowledged_at: new Date().toISOString() })
            .eq("id", id)
            .eq("user_id", user.id)
            .select()
            .maybeSingle(),
        );
        if (!result) throw new ApiError("NOT_FOUND", 404);
        return ok(result);
      }
    }
    if (path === "settings") {
      if (method === "GET") {
        const prefs = check(
          await client
            .from("notification_preferences")
            .select("*")
            .eq("user_id", user.id)
            .single(),
        );
        return ok({
          email: user.email,
          created_at: user.created_at,
          preferences: prefs,
          retention:
            "Scan history retained until deletion. Account deletion cascades through all records.",
        });
      }
      if (method === "PATCH") {
        const input = z
          .object({
            email_enabled: z.boolean(),
            ssl_alerts: z.boolean(),
            header_alerts: z.boolean(),
            summary_enabled: z.literal(false).default(false),
          })
          .strict()
          .parse(await body(request));
        return ok(
          check(
            await a
              .from("notification_preferences")
              .update(input)
              .eq("user_id", user.id)
              .select()
              .single(),
          ),
        );
      }
      if (method === "DELETE") {
        const input = z
          .object({ confirmation: z.literal("DELETE") })
          .parse(await body(request));
        void input;
        await client.auth.signOut({ scope: "global" });
        const result = await a.auth.admin.deleteUser(user.id);
        if (result.error) throw new ApiError("DELETE_FAILED", 503);
        return ok({ deleted: true });
      }
    }
    throw new ApiError("NOT_FOUND", 404);
  } catch (error) {
    return fail(error);
  }
}
