import { it, expect, vi, afterEach } from "vitest";
vi.mock("../../src/lib/supabase/server", () => ({
  authenticated: vi.fn(async () => {
    throw new Error("UNAUTHORIZED");
  }),
  db: vi.fn(),
  admin: vi.fn(),
}));
vi.mock("../../src/lib/automation/dispatch", () => ({
  dispatch: vi.fn(async () => ({ completed: 1, failed: 0, sent: 0 })),
}));
import { api } from "../../src/lib/api";
import { sameOrigin, body } from "../../src/lib/security/http";
import { email, escapeHTML } from "../../src/lib/email";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
it("rejects unauthenticated resources", async () => {
  const result = await api(new Request("http://localhost/api/dashboard"), [
    "dashboard",
  ]);
  expect(result.status).toBe(401);
  expect((await result.json()).error.code).toBe("UNAUTHORIZED");
});
it("rejects cron without a constant-time secret match", async () => {
  vi.stubEnv("CRON_SECRET", "a".repeat(32));
  const result = await api(new Request("http://localhost/api/cron/dispatch"), [
    "cron",
    "dispatch",
  ]);
  expect(result.status).toBe(401);
});
it("rejects cross-origin and missing-origin mutations", () => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://irongate.example");
  expect(() =>
    sameOrigin(
      new Request("https://irongate.example/api/settings", {
        headers: { origin: "https://evil.example" },
      }),
    ),
  ).toThrow("INVALID_ORIGIN");
  expect(() =>
    sameOrigin(new Request("https://irongate.example/api/settings")),
  ).toThrow();
});
it("caps request body size", async () =>
  await expect(
    body(
      new Request("http://localhost", {
        method: "POST",
        body: "x".repeat(8193),
      }),
    ),
  ).rejects.toThrow("BODY_TOO_LARGE"));
it("escapes email HTML and sends HTML plus text with idempotency", async () => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://irongate.example");
  vi.stubEnv("RESEND_FROM_EMAIL", "alerts@irongate.example");
  vi.stubEnv("RESEND_API_KEY", "test-not-a-real-key");
  const spy = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response("{}", { status: 200 }));
  await email(
    "user@example.com",
    "example.com",
    "<script>bad</script>",
    "warning",
    "alert-1",
  );
  const options = spy.mock.calls[0][1]!;
  const payload = JSON.parse(options.body as string);
  expect(payload.html).not.toContain("<script>");
  expect(payload.text).toContain("<script>bad</script>");
  expect(options.headers).toHaveProperty("Idempotency-Key", "alert-1");
  expect(escapeHTML('"&<>')).toBe("&quot;&amp;&lt;&gt;");
});
it("records delivery failure as an exception for durable retry", async () => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://irongate.example");
  vi.stubEnv("RESEND_FROM_EMAIL", "a@example.com");
  vi.stubEnv("RESEND_API_KEY", "test");
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("{}", { status: 500 }),
  );
  await expect(
    email("u@example.com", "example.com", "message", "critical", "id"),
  ).rejects.toThrow("EMAIL_DELIVERY_FAILED");
});

it("accepts the exact cron secret and returns dispatch contract", async () => {
  vi.stubEnv("CRON_SECRET", "a".repeat(32));
  const result = await api(
    new Request("http://localhost/api/cron/dispatch", {
      headers: { authorization: "Bearer " + "a".repeat(32) },
    }),
    ["cron", "dispatch"],
  );
  expect(result.status).toBe(200);
  expect((await result.json()).data.completed).toBe(1);
});
