import { expect, test } from "@playwright/test";

test("a user can manage vendors and proposals, and run a comparison", async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());

  const email = `e2e-vendors-${Date.now()}@example.com`;

  await page.goto("/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("No vendors yet.")).toBeVisible();

  // Create vendor A with a proposal.
  await page.getByRole("link", { name: "Add vendor" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Acme Cloud Services");
  await page.getByLabel("Contact email").fill("sales@acme.example");
  await page.getByRole("button", { name: "Add vendor" }).click();
  await expect(page.getByRole("heading", { name: "Acme Cloud Services" })).toBeVisible();

  await page.getByRole("link", { name: "Add proposal" }).click();
  await page.getByLabel("Title").fill("Standard hosting package");
  await page.getByLabel("Price").fill("1200");
  await page.getByLabel("Summary").fill("12-month hosting contract, 99.9% SLA.");
  await page.getByRole("button", { name: "Add proposal" }).click();
  await expect(page.getByText("Standard hosting package")).toBeVisible();
  await expect(page.getByText("$1,200.00")).toBeVisible();

  // Create vendor B with a proposal.
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Add vendor" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Globex Hosting");
  await page.getByRole("button", { name: "Add vendor" }).click();
  await page.getByRole("link", { name: "Add proposal" }).click();
  await page.getByLabel("Title").fill("Premium hosting package");
  await page.getByLabel("Price").fill("950");
  await page.getByLabel("Summary").fill("12-month hosting contract, 99.95% SLA.");
  await page.getByRole("button", { name: "Add proposal" }).click();
  await expect(page.getByText("Premium hosting package")).toBeVisible();

  // Compare across both vendors. No AI_PROVIDER_API_KEY is configured in this test
  // environment, so this exercises the graceful "not configured" path, not a live AI call.
  await page.goto("/dashboard/compare");
  await expect(page.getByText("Acme Cloud Services — Standard hosting package")).toBeVisible();
  await expect(page.getByText("Globex Hosting — Premium hosting package")).toBeVisible();

  const compareButton = page.getByRole("button", { name: /^Compare \d/ });
  await expect(compareButton).toBeDisabled();

  await page.getByLabel(/Acme Cloud Services/).check();
  await page.getByLabel(/Globex Hosting/).check();
  await expect(compareButton).toBeEnabled();
  await compareButton.click();

  await expect(page.getByText("AI comparison is not configured on this server.")).toBeVisible();

  // Edit vendor A.
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Acme Cloud Services" }).click();
  await page.getByRole("link", { name: "Edit" }).first().click();
  await page.getByLabel("Name", { exact: true }).fill("Acme Cloud Services (renamed)");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("heading", { name: "Acme Cloud Services (renamed)" }),
  ).toBeVisible();

  // Delete the proposal, then the vendor itself.
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText("No proposals from this vendor yet.")).toBeVisible();

  await page.getByRole("button", { name: "Delete vendor" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Acme Cloud Services (renamed)")).not.toBeVisible();
});
