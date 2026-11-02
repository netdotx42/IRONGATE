import { test, expect } from "@playwright/test";

// Opt in only on an isolated deployment/account. Traces are disabled for real credentials.
test.describe("live account acceptance", () => {
  test.use({ trace: "off", screenshot: "off", video: "off" });
  test.skip(
    !process.env.E2E_LOGIN_EMAIL ||
      !process.env.E2E_LOGIN_PASSWORD ||
      !process.env.E2E_VERIFIED_DOMAIN,
    "Requires a confirmed test account and a preverified DNS-controlled test domain.",
  );

  test("login, saved tools, reports, monitor lifecycle and logout", async ({
    page,
  }) => {
    const hostname = process.env.E2E_VERIFIED_DOMAIN!;
    await page.goto("/");
    await page.getByRole("button", { name: /Log in/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Email address").fill(process.env.E2E_LOGIN_EMAIL!);
    await dialog
      .getByLabel("Password", { exact: true })
      .fill(process.env.E2E_LOGIN_PASSWORD!);
    await dialog.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(
      page.getByRole("heading", { name: /Command Center/ }),
    ).toBeVisible();

    for (const tool of ["WebShield", "HeaderGuard"]) {
      await page.goto(`/tools?tool=${tool.toLowerCase()}`);
      await page.getByRole("textbox", { name: "Website URL" }).fill(hostname);
      await page.getByRole("checkbox", { name: /Save result/ }).check();
      await page
        .getByRole("button", {
          name: tool === "WebShield" ? "Run WebShield" : "Analyze headers",
          exact: true,
        })
        .click();
      await expect(page.locator(".report h2")).toHaveText(hostname, {
        timeout: 45000,
      });
      const exported = page.waitForEvent("download");
      await page.getByRole("button", { name: "Download HTML" }).click();
      expect((await exported).suggestedFilename()).toContain(".html");
    }

    await page.goto("/dashboard");
    await expect(page.locator("table tbody")).toContainText(hostname);
    const domains = await page.request.get("/api/domains");
    expect(domains.ok()).toBe(true);
    const owned = (await domains.json()).data as {
      id: string;
      hostname: string;
      verified: boolean;
    }[];
    const domain = owned.find((d) => d.hostname === hostname);
    expect(domain?.verified).toBe(true);
    // The test domain must not already have a monitor; do not modify an existing schedule.
    const response = await page.request.get("/api/monitors");
    const before = (await response.json()).data as {
      id: string;
      domain_id: string;
    }[];
    expect(before.some((m) => m.domain_id === domain!.id)).toBe(false);
    let monitorId: string | undefined;
    try {
      await page.goto("/automation");
      await page.getByLabel("Verified domain").selectOption(domain!.id);
      await page
        .getByLabel("Frequency", { exact: true })
        .selectOption("weekly");
      await page.getByRole("button", { name: "Enable monitoring" }).click();
      const row = page.locator(".monitor-row").filter({ hasText: hostname });
      await expect(row).toBeVisible();
      const created = await page.request.get("/api/monitors");
      monitorId = (await created.json()).data.find(
        (m: { domain_id: string }) => m.domain_id === domain!.id,
      )?.id;
      await row.getByRole("button", { name: "Pause", exact: true }).click();
      await expect(row.getByText("Paused", { exact: true })).toBeVisible();
      await row.getByRole("button", { name: "Resume", exact: true }).click();
      await expect(row.getByText("Scheduled", { exact: true })).toBeVisible();
      page.once("dialog", (d) => d.accept());
      await row.getByRole("button", { name: "Delete", exact: true }).click();
      await expect(row).toHaveCount(0);
      monitorId = undefined;
    } finally {
      if (monitorId)
        await page.request.delete(`/api/monitors/${monitorId}`, {
          headers: { Origin: new URL(page.url()).origin },
        });
    }
    await page.goto("/settings");
    await page.getByRole("button", { name: "Save preferences" }).click();
    await expect(page.getByRole("status")).toContainText(
      "Notification preferences saved.",
    );
    await page
      .getByRole("button", { name: "Sign out of all sessions" })
      .click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("domain challenge rejects missing TXT then removes the test domain", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Log in/ }).click();
    const auth = page.getByRole("dialog");
    await auth.getByLabel("Email address").fill(process.env.E2E_LOGIN_EMAIL!);
    await auth
      .getByLabel("Password", { exact: true })
      .fill(process.env.E2E_LOGIN_PASSWORD!);
    await auth.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    const host = `pending-${crypto.randomUUID().slice(0, 8)}.${process.env.E2E_VERIFIED_DOMAIN}`;
    let domainId: string | undefined;
    try {
      await page
        .getByRole("button", { name: "Add domain", exact: true })
        .click();
      const add = page.getByRole("dialog");
      await add.getByLabel("Domain hostname").fill(host);
      await add
        .getByRole("button", { name: "Add domain", exact: true })
        .click();
      const row = page.locator(".domain-row").filter({ hasText: host });
      await expect(row).toBeVisible();
      const data = (await (await page.request.get("/api/domains")).json()).data;
      domainId = data.find(
        (d: { hostname: string }) => d.hostname === host,
      )?.id;
      await row.getByRole("button", { name: "View / Verify" }).click();
      const verify = page.getByRole("dialog");
      await expect(verify.locator("pre").last()).toContainText(
        "irongate-verification=",
      );
      await verify
        .getByRole("button", { name: "Verify ownership", exact: true })
        .click();
      await expect(verify.getByRole("alert")).toContainText("txt not found");
    } finally {
      if (domainId)
        await page.request.delete(`/api/domains/${domainId}`, {
          headers: { Origin: new URL(page.url()).origin },
        });
    }
  });
});
