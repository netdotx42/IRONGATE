import { test, expect } from "@playwright/test";
test("home navigation and exactly three tools", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Your digital fortress/i }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Run Security Check" }).click();
  await expect(page.getByRole("tab")).toHaveCount(3);
});
test("KeyGuard evaluates and generates without transmitting passwords", async ({
  page,
}) => {
  await page.goto("/tools?tool=keyguard");
  await expect(
    page.getByRole("heading", { name: "How strong is your password?" }),
  ).toBeVisible();
  let requests = 0;
  page.on("request", (r) => {
    if (r.method() === "POST") requests++;
  });
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await expect(
    page.getByRole("heading", { name: /Very Weak|Weak/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Generate password", exact: true })
    .click();
  await expect(page.getByLabel("Password", { exact: true })).not.toHaveValue(
    "password123",
  );
  expect(requests).toBe(0);
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
});
test("shows safe empty account states and responsive layout", async ({
  page,
}) => {
  for (const path of ["/dashboard", "/automation", "/settings"]) {
    await page.goto(path);
    await expect(page.locator("main h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});
test("HeaderGuard tab and reset work", async ({ page }) => {
  await page.goto("/tools");
  await page.getByRole("tab", { name: "HeaderGuard" }).click();
  await expect(
    page.getByRole("button", { name: "Analyze headers" }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Website URL" }).fill("example.com");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Website URL" })).toHaveValue(
    "",
  );
});
// These live acceptance flows require operator-provisioned accounts and a DNS-controlled domain.
test("real WebShield scan and JSON export", async ({ page }) => {
  test.skip(
    !process.env.E2E_LIVE_DOMAIN,
    "Live scan requires configured services.",
  );
  await page.goto("/tools");
  await page
    .getByRole("textbox", { name: "Website URL" })
    .fill(process.env.E2E_LIVE_DOMAIN!);
  await page
    .getByRole("button", { name: "Run WebShield", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: process.env.E2E_LIVE_DOMAIN! }),
  ).toBeVisible({ timeout: 30000 });
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON" }).click();
  expect((await event).suggestedFilename()).toContain(".json");
});
