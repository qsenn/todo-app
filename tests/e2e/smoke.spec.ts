import { expect, test } from "./fixtures";

test("app shell loads with navigation", { tag: "@smoke" }, async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("navigation")).toBeVisible();
  await expect(page.getByRole("link", { name: "보드" })).toBeVisible();
});
