import { expect, test } from "@playwright/test";

const ROUTES = ["/", "/projects", "/projects/validrun", "/launch", "/docs"];

test.describe("routes", () => {
  for (const route of ROUTES) {
    test(`${route} boots`, async ({ page }) => {
      const crash: string[] = [];
      page.on("pageerror", (error) => crash.push(error.message));

      const response = await page.goto(route);
      expect(response?.status()).toBe(200);

      await expect(page.locator(".brand")).toBeVisible();
      await expect(page.locator("footer.footer")).toBeVisible();
      expect(crash).toEqual([]);
    });
  }
});

test("landing page shows the hero and the minting bar", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("Tokens that exist");
  await expect(page.locator("h1 .accent")).toHaveText("work");
  await expect(page.locator(".mint__track")).toBeVisible();
  await expect(page.getByRole("link", { name: "Launch a token" })).toBeVisible();
});

test("registry renders cards or an empty state", async ({ page }) => {
  await page.goto("/projects");
  await expect(page.getByRole("heading", { name: "Projects, oldest first." })).toBeVisible();
  await expect(page.locator(".projcard, .empty").first()).toBeVisible();
});

test("console explains which token build a project runs", async ({ page }) => {
  await page.goto("/projects/validrun");
  await expect(page.locator(".console")).toBeVisible();
  await expect(page.locator(".chip--ver").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /registry/ })).toBeVisible();
});

test("launch page parses pasted markdown", async ({ page }) => {
  await page.goto("/launch");
  const editor = page.locator("textarea");
  await expect(editor).toBeVisible();
  await expect(page.locator(".launch__fields")).toContainText("token account");

  // A file without frontmatter must surface the error, not fail silently.
  await editor.fill("name: no frontmatter");
  await expect(page.locator(".errors")).toContainText("frontmatter");

  // The sample button puts a valid file back.
  await page.getByRole("button", { name: /reset to sample/i }).click();
  await expect(editor).toHaveValue(/name: Swarm Token/);
});

test("docs cover mining and token versions", async ({ page }) => {
  await page.goto("/docs");
  await expect(page.locator("#mining")).toContainText("Mining");
  await expect(page.locator("#versions")).toContainText("230,615");
});

test("wallet picker lists the four testnet wallets with icons", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /connect wallet/i }).click();

  const dialog = page.getByRole("dialog", { name: "Choose a wallet" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".wallet__option")).toHaveCount(4);
  await expect(dialog.locator(".wallet__option img")).toHaveCount(4);
  await expect(dialog).toContainText("Meteor");
  await expect(dialog).toContainText("HERE");
});
