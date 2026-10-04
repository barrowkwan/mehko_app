// Runs against the app server started WITHOUT a place-search key (see playwright.config.ts): the search box is hidden
// and merchants can still add a pickup point by clicking the map.
import { expect, test } from "@playwright/test";
import { admin, createUser, removeUsers, run, signIn } from "./helpers";

test.afterAll(removeUsers);

test("without a search key the search box is hidden and the map still works", async ({ page, context, baseURL }) => {
  const mer = await createUser("e2enokey");
  const { data: merchant } = await admin.from("merchants").insert({ owner_id: mer.id, name: `E2E NoKey Kitchen ${run}` }).select("id").single();
  await signIn(context, baseURL!, mer.email);

  await page.goto("/merchant/pickup-points");
  await expect(page.getByText("Find the place")).toHaveCount(0);
  await expect(page.getByPlaceholder("Business, place or address")).toHaveCount(0);

  await page.getByLabel("Name", { exact: true }).fill("Manual spot");
  await page.locator(".leaflet-container").click({ position: { x: 150, y: 100 } });
  await page.getByRole("button", { name: "Add pickup point" }).click();
  await expect(page.getByText("Manual spot")).toBeVisible();
  const { count } = await admin.from("pickup_points").select("id", { count: "exact", head: true }).eq("merchant_id", merchant!.id);
  expect(count).toBe(1);
});
