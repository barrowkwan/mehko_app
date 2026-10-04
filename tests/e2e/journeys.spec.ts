import { expect, test } from "@playwright/test";
import { admin, createUser, removeUsers, run, signIn } from "./helpers";

const ymd = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
const must = <T>(r: { data: T; error: { message: string } | null }): NonNullable<T> => {
  if (r.error) throw new Error(r.error.message);
  return r.data as NonNullable<T>;
};

test.afterAll(removeUsers);

test("customer orders, edits, switches language and cancels", async ({ page, context, baseURL }) => {
  const mer = await createUser("e2emerchant");
  const cust = await createUser("e2ecustomer");
  const kitchen = `E2E Kitchen ${run}`;
  const merchantId = must(await admin.from("merchants").insert({ owner_id: mer.id, name: kitchen }).select("id").single()).id;
  const pointId = must(await admin.from("pickup_points").insert({ merchant_id: merchantId, name: "E2E Park", lat: 40.8, lng: -73.97, timezone: "UTC" }).select("id").single()).id;
  const foodId = must(await admin.from("food_items").insert({ merchant_id: merchantId, name: "E2E Dumplings" }).select("id").single()).id;
  const offeringId = must(
    await admin
      .from("offerings")
      .insert({ merchant_id: merchantId, pickup_point_id: pointId, pickup_date: ymd(3), pickup_start: "17:00", pickup_end: "19:00", cutoff_at: new Date(Date.now() + 2 * 86_400_000).toISOString(), status: "published" })
      .select("id")
      .single(),
  ).id;
  const itemId = must(await admin.from("offering_items").insert({ offering_id: offeringId, food_item_id: foodId, quantity_limit: 10 }).select("id").single()).id;

  await signIn(context, baseURL!, cust.email);
  await page.goto("/");
  await page.getByRole("link", { name: new RegExp(kitchen) }).click();

  // Place an order with a note.
  await page.locator(`input[name="qty_${itemId}"]`).fill("2");
  await page.locator('textarea[name="note"]').fill("no peanuts");
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}/);
  await expect(page.getByAltText("Order QR code")).toBeVisible();
  await expect(page.getByText("no peanuts")).toBeVisible();

  // Edit the quantity.
  await page.locator(`input[name="qty_${itemId}"]`).fill("3");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.locator(`input[name="qty_${itemId}"]`)).toHaveValue("3");

  // Switch to Spanish: the page re-renders in Spanish.
  await page.getByLabel("Language").selectOption("es");
  await expect(page.getByRole("button", { name: "Cancelar pedido" })).toBeVisible();

  // Cancel.
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Cancelar pedido" }).click();
  await expect(page.getByText("Cancelado")).toBeVisible();
});

test("merchant adds a pickup point by clicking the map", async ({ page, context, baseURL }) => {
  const mer = await createUser("e2emerchant2");
  must(await admin.from("merchants").insert({ owner_id: mer.id, name: `E2E Map Kitchen ${run}` }).select("id").single());
  await signIn(context, baseURL!, mer.email);

  await page.goto("/merchant/pickup-points");
  await page.getByLabel("Name", { exact: true }).fill("Map spot");
  await page.locator(".leaflet-container").click({ position: { x: 150, y: 100 } });
  await expect(page.locator('input[name="lat"]')).not.toHaveValue("");
  await expect(page.locator('input[name="lng"]')).not.toHaveValue("");
  await page.getByRole("button", { name: "Add pickup point" }).click();
  await expect(page.getByText("Map spot")).toBeVisible();
});
