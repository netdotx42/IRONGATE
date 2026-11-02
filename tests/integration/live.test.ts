import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
const live = process.env.IRONGATE_RUN_LIVE_TESTS === "true";
describe.skipIf(!live)(
  "LIVE Supabase authentication, RLS, persistence and atomic jobs (creates temporary users)",
  () => {
    it("isolates two users, denies browser writes, verifies monitor guard and rate limit", async () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!,
        key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      expect(url).toBeTruthy();
      expect(service).toBeTruthy();
      const a = createClient(url, service, { auth: { persistSession: false } });
      const ids: string[] = [];
      const password = `Test-${crypto.randomUUID()}!`;
      try {
        const clients = [];
        for (let i = 0; i < 2; i++) {
          const email = `irongate-test-${crypto.randomUUID()}@example.com`;
          const created = await a.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
          });
          if (created.error) throw created.error;
          ids.push(created.data.user.id);
          const c = createClient(url, key, { auth: { persistSession: false } });
          const sign = await c.auth.signInWithPassword({ email, password });
          expect(sign.error).toBeNull();
          clients.push(c);
        }
        const { data: d, error } = await a
          .from("domains")
          .insert({
            user_id: ids[0],
            hostname: `${crypto.randomUUID()}.example.com`,
          })
          .select()
          .single();
        expect(error).toBeNull();
        expect(
          (await clients[0].from("domains").select().eq("id", d.id)).data,
        ).toHaveLength(1);
        expect(
          (await clients[1].from("domains").select().eq("id", d.id)).data,
        ).toHaveLength(0);
        expect(
          (
            await clients[0]
              .from("domains")
              .update({ verified: true })
              .eq("id", d.id)
          ).error,
        ).not.toBeNull();
        expect(
          (
            await a
              .from("monitors")
              .insert({ user_id: ids[0], domain_id: d.id, frequency: "daily" })
          ).error,
        ).not.toBeNull();
        await a
          .from("domains")
          .update({ verified: true, verified_at: new Date().toISOString() })
          .eq("id", d.id);
        expect(
          (
            await a.rpc("enroll_monitor", {
              owner_id: ids[0],
              owned_domain: d.id,
              schedule: "daily",
            })
          ).error,
        ).toBeNull();
        const result = { hostname: d.hostname, findings: [] };
        const saved = await a
          .from("scans")
          .insert({
            user_id: ids[0],
            domain_id: d.id,
            tool: "webshield",
            status: "completed",
            score: 100,
            grade: "A",
            findings: [],
            result,
            scoring_version: "1.0.0",
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          })
          .select()
          .single();
        expect(saved.error).toBeNull();
        expect(
          (await clients[1].from("scans").select().eq("id", saved.data.id))
            .data,
        ).toHaveLength(0);
        const bucket = `test:${crypto.randomUUID()}`;
        expect(
          (await a.rpc("consume_rate", { bucket_key: bucket, bucket_limit: 1 }))
            .data,
        ).toBe(true);
        expect(
          (await a.rpc("consume_rate", { bucket_key: bucket, bucket_limit: 1 }))
            .data,
        ).toBe(false);
        await a.from("rate_buckets").delete().eq("key", bucket);
        for (const c of clients) await c.auth.signOut();
      } finally {
        for (const id of ids) await a.auth.admin.deleteUser(id);
      }
    }, 30000);
  },
);
