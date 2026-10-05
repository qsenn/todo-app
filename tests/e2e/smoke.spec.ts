import { expect, test } from "@playwright/test";

test("app shell loads with navigation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("navigation")).toBeVisible();
  await expect(page.getByRole("link", { name: "보드" })).toBeVisible();
});
