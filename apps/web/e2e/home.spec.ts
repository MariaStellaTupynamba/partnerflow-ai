import { expect, test } from "@playwright/test";

test("home page renders the PartnerFlow AI headline", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Compare vendor proposals",
  );
  await expect(page.getByText("PartnerFlow AI", { exact: true })).toBeVisible();
});
