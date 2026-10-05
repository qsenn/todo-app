import { expect, test as setup } from "@playwright/test";
import { AUTH_STATE } from "../../playwright.config";
import { loginWithGithub } from "./helpers";

// Logs in once through the real /auth/github flow (against the fake GitHub) and saves the cookie.
setup("log in as the default E2E user", async ({ page }) => {
  await loginWithGithub(page, "e2e-user");
  await expect(page.getByTestId("current-username")).toHaveText("e2e-user");
  await page.context().storageState({ path: AUTH_STATE });
});
