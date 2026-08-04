import { expect, test } from "@playwright/test";

test("a user can register, land on the dashboard, and log out", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;
  const password = "correct-horse-battery";

  await page.goto("/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByText("No vendors yet.")).toBeVisible();

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);

  // Cookies are cleared, so the dashboard should no longer be reachable directly.
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});

test("login rejects the wrong password with a visible error", async ({ page }) => {
  const email = `e2e-${Date.now()}-wrongpw@example.com`;
  const password = "correct-horse-battery";

  await page.goto("/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("the-wrong-password");
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page.getByText("Incorrect email or password.")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});
