import { expect, test } from "@playwright/test";
import { admin, createUser, removeUsers, run, signIn } from "./helpers";

const ymd = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
const must = <T>(r: { data: T; error: { message: string } | null }): NonNullable<T> => {
  if (r.error) throw new Error(r.error.message);
  return r.data as NonNullable<T>;
};

test.afterAll(removeUsers);

// The pickup point in these tests is set to UTC; a customer in California must still see their own time.
test.use({ timezoneId: "America/Los_Angeles" });

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
  // Browse shows one short card per merchant; the offering is picked on the merchant's page.
  await page.getByRole("link", { name: new RegExp(kitchen) }).click();
  await page.getByRole("link", { name: /E2E Park/ }).click();

  // Place an order with a note.
  await page.locator(`input[name="qty_${itemId}"]`).fill("2");
  await page.locator('textarea[name="note"]').fill("no peanuts");
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}/);
  await expect(page.getByAltText("Order QR code")).toBeVisible();
  await expect(page.getByText("no peanuts")).toBeVisible();
  // The cutoff is shown in the customer's own timezone, and "left" counts what others (and I) have taken: 10 - 2.
  await expect(page.getByText(/You can change this order until .*P[DS]T/)).toBeVisible();
  await expect(page.getByText("8 left")).toBeVisible();

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

test("merchant publishes an offering through the form; stock limit stops a second customer", async ({ browser, baseURL }) => {
  const mer = await createUser("e2emerchant3");
  const c1 = await createUser("e2ecust1");
  const kitchen = `E2E Form Kitchen ${run}`;
  const merchantId = must(await admin.from("merchants").insert({ owner_id: mer.id, name: kitchen }).select("id").single()).id;
  must(await admin.from("pickup_points").insert({ merchant_id: merchantId, name: "Form Park", lat: 40.8, lng: -73.97, timezone: "UTC" }).select("id").single());
  must(await admin.from("food_items").insert({ merchant_id: merchantId, name: "Form Buns" }).select("id").single());

  // Merchant fills in the real form.
  const merCtx = await browser.newContext();
  await signIn(merCtx, baseURL!, mer.email);
  const mp = await merCtx.newPage();
  await mp.goto("/merchant/offerings/new");
  await mp.getByLabel("Pickup date").fill(ymd(3));
  await mp.getByLabel("Pickup from").fill("17:00");
  await mp.getByLabel("Pickup until").fill("19:00");
  const cutoff = new Date(Date.now() + 2 * 86_400_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  await mp.getByLabel("Order cutoff").fill(`${cutoff.getFullYear()}-${pad(cutoff.getMonth() + 1)}-${pad(cutoff.getDate())}T${pad(cutoff.getHours())}:${pad(cutoff.getMinutes())}`);
  await mp.getByRole("checkbox", { name: /Form Buns/ }).check();
  await mp.locator('input[name^="limit_"]').fill("2");
  await mp.getByRole("button", { name: "Review & publish" }).click();
  await mp.getByRole("button", { name: "Publish offering" }).click();
  await mp.waitForURL(/\/merchant\/offerings(\/|$)/);
  await merCtx.close();

  // A customer takes both buns; the next customer cannot order any.
  const first = await browser.newContext();
  await signIn(first, baseURL!, c1.email);
  const p1 = await first.newPage();
  await p1.goto("/");
  await p1.getByRole("link", { name: new RegExp(kitchen) }).click();
  await p1.getByRole("link", { name: /Form Park/ }).click();
  await p1.locator('input[name^="qty_"]').fill("2");
  await p1.getByRole("button", { name: "Place order" }).click();
  await expect(p1).toHaveURL(/\/orders\/[0-9a-f-]{36}/);
  await first.close();

  const c2 = await createUser("e2ecust2");
  const second = await browser.newContext();
  await signIn(second, baseURL!, c2.email);
  const p2 = await second.newPage();
  await p2.goto("/");
  await p2.getByRole("link", { name: new RegExp(kitchen) }).click();
  await p2.getByRole("link", { name: /Form Park/ }).click();
  await expect(p2.getByText("0 left")).toBeVisible();
  await p2.locator('input[name^="qty_"]').fill("1");
  await p2.getByRole("button", { name: "Place order" }).click();
  await expect(p2).not.toHaveURL(/\/orders\/[0-9a-f-]{36}/); // the form refuses more than what is left
  await second.close();
});

test("merchant offers two pickup slots; customer picks one and later moves the order to the other", async ({ browser, baseURL }) => {
  const mer = await createUser("e2emerchant4");
  const cust = await createUser("e2ecust3");
  const kitchen = `E2E Slots Kitchen ${run}`;
  const merchantId = must(await admin.from("merchants").insert({ owner_id: mer.id, name: kitchen }).select("id").single()).id;
  must(await admin.from("pickup_points").insert({ merchant_id: merchantId, name: "North Gate", lat: 40.8, lng: -73.97, timezone: "UTC" }).select("id").single());
  must(await admin.from("pickup_points").insert({ merchant_id: merchantId, name: "South Gate", lat: 40.7, lng: -73.97, timezone: "UTC" }).select("id").single());
  must(await admin.from("food_items").insert({ merchant_id: merchantId, name: "Slot Buns" }).select("id").single());

  const merCtx = await browser.newContext({ timezoneId: "UTC" });
  await signIn(merCtx, baseURL!, mer.email);
  const mp = await merCtx.newPage();
  await mp.goto("/merchant/offerings/new");
  await mp.getByLabel("Pickup point").first().selectOption({ label: "North Gate" });
  await mp.getByLabel("Pickup date").first().fill(ymd(3));
  await mp.getByLabel("Pickup from").first().fill("17:00");
  await mp.getByLabel("Pickup until").first().fill("19:00");
  const cutoff = new Date(Date.now() + 2 * 86_400_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  await mp.getByLabel("Order cutoff").fill(`${cutoff.getFullYear()}-${pad(cutoff.getMonth() + 1)}-${pad(cutoff.getDate())}T${pad(cutoff.getHours())}:${pad(cutoff.getMinutes())}`);
  await mp.getByRole("button", { name: "Add a pickup slot" }).click();
  await mp.locator('select[name="slot_0_point"]').selectOption({ label: "South Gate" });
  await mp.locator('input[name="slot_0_start"]').fill("12:00");
  await mp.locator('input[name="slot_0_end"]').fill("13:00");
  await mp.getByRole("checkbox", { name: /Slot Buns/ }).check();
  await mp.locator('input[name^="limit_"]').fill("2");
  await mp.getByRole("button", { name: "Review & publish" }).click();
  // The review shows what customers will see before anything is saved.
  const review = mp.getByRole("dialog");
  await expect(review.getByText("Slot Buns — limit 2")).toBeVisible();
  await expect(review.getByText("North Gate")).toBeVisible();
  await expect(review.getByText("Invalid Date")).toHaveCount(0); // every slot uses the offering's date
  await expect(review.getByText(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),/)).toHaveCount(1); // the date is shown once
  await expect(review.getByText("South Gate")).toBeVisible();
  await expect(review.getByText("Order cutoff (your time)")).toBeVisible();
  await review.getByRole("button", { name: "Back to edit" }).click();
  await expect(review).toBeHidden();
  expect(mp.url()).toMatch(/\/offerings\/new/);
  await mp.getByRole("button", { name: "Review & publish" }).click();
  await mp.getByRole("button", { name: "Publish offering" }).click();
  await mp.waitForURL(/\/merchant\/offerings\/[0-9a-f-]{36}$/);
  await expect(mp.getByRole("heading", { name: "Pickup slots" })).toBeVisible();
  // The offerings list shows the two slots as ONE row with a short summary.
  await mp.goto("/merchant/offerings");
  const rows = mp.locator("li", { hasText: "Slot Buns" });
  await expect(rows).toHaveCount(1);
  await expect(rows.getByText("2 pickup slots")).toBeVisible();
  await merCtx.close();

  const ctx = await browser.newContext({ timezoneId: "UTC" });
  await signIn(ctx, baseURL!, cust.email);
  const p = await ctx.newPage();
  await p.goto("/");
  // Browse: just one short card for the merchant, no slot details.
  const merchantCard = p.locator("li", { hasText: kitchen });
  await expect(merchantCard).toHaveCount(1);
  await expect(merchantCard.getByText("Open offerings: 1")).toBeVisible();
  await expect(merchantCard.getByText("North Gate")).toHaveCount(0);
  await merchantCard.getByRole("link").click();
  const card = p.locator("li", { hasText: "2 pickup options" });
  await expect(card).toBeVisible();
  await card.getByRole("link", { name: /5:00/ }).click() // the North Gate slot (17:00);
  await expect(p.getByText("Other pickup options")).toBeVisible();
  await p.locator('input[name^="qty_"]').fill("2");
  await p.getByRole("button", { name: "Place order" }).click();
  await expect(p).toHaveURL(/\/orders\/[0-9a-f-]{36}/);
  await expect(p.locator("p", { hasText: "North Gate" })).toBeVisible();

  // Move to the other slot: pickup place changes, the shared stock is still used up (0 left).
  await p.locator('select[name="slot"]').selectOption({ index: 0 }) // same date: sorted by time, South Gate (12:00) comes first;
  await p.getByRole("button", { name: "Move my order" }).click();
  await expect(p.locator("p", { hasText: "South Gate" })).toBeVisible();
  await expect(p.getByText("0 left")).toBeVisible();
  await ctx.close();

  // The merchant sees the ordered quantity from whichever slot they open, plus a per-slot breakdown.
  const mctx = await browser.newContext({ timezoneId: "UTC" });
  await signIn(mctx, baseURL!, mer.email);
  const m = await mctx.newPage();
  await m.goto("/merchant/offerings");
  await m.locator("li", { hasText: "Slot Buns" }).getByRole("link").click();
  await expect(m.getByRole("heading", { name: "Prep list" }).locator("..").getByText("2× Slot Buns").first()).toBeVisible();
  await expect(m.getByText("By pickup slot")).toBeVisible();
  await expect(m.getByRole("heading", { name: "Orders (1)" })).toBeVisible();
  // Dashboard: one card for the offering, with orders per slot.
  await m.goto("/merchant");
  const dash = m.locator("main ul > li", { hasText: "Gate" });
  await expect(dash).toHaveCount(1);
  await expect(dash.getByText("1 order · 0 picked up")).toBeVisible();
  await mctx.close();
});

test("same pickup point at two times: merchant gets a warning, customer sees both times clearly", async ({ browser, baseURL }) => {
  const mer = await createUser("e2emerchant5");
  const cust = await createUser("e2ecust4");
  const kitchen = `E2E Dup Kitchen ${run}`;
  const merchantId = must(await admin.from("merchants").insert({ owner_id: mer.id, name: kitchen }).select("id").single()).id;
  must(await admin.from("pickup_points").insert({ merchant_id: merchantId, name: "Only Gate", lat: 40.8, lng: -73.97, timezone: "UTC" }).select("id").single());
  must(await admin.from("food_items").insert({ merchant_id: merchantId, name: "Dup Buns" }).select("id").single());

  const ctx = await browser.newContext({ timezoneId: "UTC" });
  await signIn(ctx, baseURL!, mer.email);
  const mp = await ctx.newPage();
  await mp.goto("/merchant/offerings/new");
  await mp.getByLabel("Pickup date").first().fill(ymd(3));
  await mp.getByLabel("Pickup from").first().fill("17:00");
  await mp.getByLabel("Pickup until").first().fill("19:00");
  const cutoff = new Date(Date.now() + 2 * 86_400_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  await mp.getByLabel("Order cutoff").fill(`${cutoff.getFullYear()}-${pad(cutoff.getMonth() + 1)}-${pad(cutoff.getDate())}T${pad(cutoff.getHours())}:${pad(cutoff.getMinutes())}`);
  await mp.getByRole("button", { name: "Add a pickup slot" }).click();
  await mp.locator('input[name="slot_0_start"]').fill("09:00");
  await mp.locator('input[name="slot_0_end"]').fill("11:00");
  await mp.getByRole("checkbox", { name: /Dup Buns/ }).check();
  await mp.getByRole("button", { name: "Review & publish" }).click();

  // Warned, but allowed: the merchant confirms this is intended.
  const dialog = mp.getByRole("dialog");
  await expect(dialog.getByRole("alert").getByText("Same pickup point used more than once")).toBeVisible();
  await dialog.getByRole("button", { name: "Publish offering" }).click();
  await mp.waitForURL(/\/merchant\/offerings\/[0-9a-f-]{36}$/);
  await ctx.close();

  // The customer sees one place with two clearly separate times.
  const cctx = await browser.newContext({ timezoneId: "UTC" });
  await signIn(cctx, baseURL!, cust.email);
  const p = await cctx.newPage();
  await p.goto("/");
  await p.locator("li", { hasText: kitchen }).getByRole("link").click();
  const card = p.locator("li", { hasText: "2 pickup times here" });
  await expect(card.getByText("2 pickup times here")).toBeVisible();
  await expect(card.getByRole("link")).toHaveCount(2);
  await card.getByRole("link").first().click();
  await expect(p.getByText("2 pickup times here")).toBeVisible();
  await expect(p.locator('a[aria-current="page"]')).toHaveCount(1);
  await cctx.close();
});

test("Browse shows each merchant once, however many offerings they have", async ({ browser, baseURL }) => {
  const mer = await createUser("e2emerchant6");
  const cust = await createUser("e2ecust5");
  const kitchen = `E2E Many Kitchen ${run}`;
  const merchantId = must(await admin.from("merchants").insert({ owner_id: mer.id, name: kitchen }).select("id").single()).id;
  const pointId = must(await admin.from("pickup_points").insert({ merchant_id: merchantId, name: "Many Park", lat: 40.8, lng: -73.97, timezone: "UTC" }).select("id").single()).id;
  const foodId = must(await admin.from("food_items").insert({ merchant_id: merchantId, name: "Many Buns" }).select("id").single()).id;
  for (const day of [3, 4, 5]) {
    const off = must(
      await admin.from("offerings").insert({ merchant_id: merchantId, pickup_point_id: pointId, pickup_date: ymd(day), pickup_start: "17:00", pickup_end: "19:00", cutoff_at: new Date(Date.now() + 2 * 86_400_000).toISOString(), status: "published" }).select("id").single(),
    ).id;
    must(await admin.from("offering_items").insert({ offering_id: off, food_item_id: foodId }).select("id").single());
  }

  const ctx = await browser.newContext({ timezoneId: "UTC" });
  await signIn(ctx, baseURL!, cust.email);
  const p = await ctx.newPage();
  await p.goto("/");
  const card = p.locator("li", { hasText: kitchen });
  await expect(card).toHaveCount(1);
  await expect(card.getByText("Open offerings: 3")).toBeVisible();
  await expect(card.getByText("Many Buns")).toHaveCount(0); // no food or place detail on Browse
  await card.getByRole("link").click();
  await expect(p.getByRole("heading", { name: kitchen })).toBeVisible();
  await expect(p.getByRole("link", { name: /Many Park/ })).toHaveCount(3); // the three offerings are listed here
  await ctx.close();
});

test("Dashboard hides closed offerings; History lists everything with status filters", async ({ browser, baseURL }) => {
  const mer = await createUser("e2emerchant7");
  const merchantId = must(await admin.from("merchants").insert({ owner_id: mer.id, name: `E2E History Kitchen ${run}` }).select("id").single()).id;
  const pointId = must(await admin.from("pickup_points").insert({ merchant_id: merchantId, name: "History Park", lat: 40.8, lng: -73.97, timezone: "UTC" }).select("id").single()).id;
  const foodId = must(await admin.from("food_items").insert({ merchant_id: merchantId, name: "History Buns" }).select("id").single()).id;
  for (const [day, status] of [[3, "draft"], [4, "published"], [5, "closed"]] as const) {
    const off = must(
      await admin.from("offerings").insert({ merchant_id: merchantId, pickup_point_id: pointId, pickup_date: ymd(day), pickup_start: "17:00", pickup_end: "19:00", cutoff_at: new Date(Date.now() + 2 * 86_400_000).toISOString(), status }).select("id").single(),
    ).id;
    must(await admin.from("offering_items").insert({ offering_id: off, food_item_id: foodId }).select("id").single());
  }

  const ctx = await browser.newContext({ timezoneId: "UTC" });
  await signIn(ctx, baseURL!, mer.email);
  const p = await ctx.newPage();

  await p.goto("/merchant");
  await expect(p.locator("main ul > li")).toHaveCount(2); // draft + published, not the closed one
  await expect(p.getByRole("link", { name: "New offering" })).toHaveCount(1); // the one "New offering" button is on the Dashboard

  await p.goto("/merchant/offerings");
  await expect(p.getByRole("heading", { name: "Offering history" })).toBeVisible();
  await expect(p.getByRole("link", { name: "New offering" })).toHaveCount(0); // not on History
  await expect(p.getByRole("link", { name: "All (3)" })).toBeVisible();
  await expect(p.locator("main ul > li")).toHaveCount(3);
  await p.getByRole("link", { name: "Closed (1)" }).click();
  await expect(p.locator("main ul > li")).toHaveCount(1);
  await expect(p.getByText("Closed").nth(1)).toBeVisible();
  await p.getByRole("link", { name: "Published (1)" }).click();
  await expect(p.locator("main ul > li")).toHaveCount(1);
  await ctx.close();
});

test("merchant profile: logo, website, contact details, US-only country; customers see them", async ({ browser, baseURL }) => {
  const mer = await createUser("e2emerchant8");
  const cust = await createUser("e2ecust6");
  const kitchen = `E2E Profile Kitchen ${run}`;
  const merchantId = must(await admin.from("merchants").insert({ owner_id: mer.id, name: kitchen }).select("id").single()).id;
  const pointId = must(await admin.from("pickup_points").insert({ merchant_id: merchantId, name: "Profile Park", lat: 40.8, lng: -73.97, timezone: "UTC" }).select("id").single()).id;
  const foodId = must(await admin.from("food_items").insert({ merchant_id: merchantId, name: "Profile Buns" }).select("id").single()).id;
  const off = must(await admin.from("offerings").insert({ merchant_id: merchantId, pickup_point_id: pointId, pickup_date: ymd(3), pickup_start: "17:00", pickup_end: "19:00", cutoff_at: new Date(Date.now() + 2 * 86_400_000).toISOString(), status: "published" }).select("id").single()).id;
  must(await admin.from("offering_items").insert({ offering_id: off, food_item_id: foodId }).select("id").single());

  const mctx = await browser.newContext({ timezoneId: "UTC" });
  await signIn(mctx, baseURL!, mer.email);
  const m = await mctx.newPage();
  await m.goto("/merchant/profile");

  // Country is a drop-down with only the United States.
  await expect(m.locator('select[name="country_code"] option')).toHaveCount(1);

  // A bad website is refused with a clear message; nothing is saved.
  await m.getByLabel("Website (optional)").fill("not a website");
  await m.getByRole("button", { name: "Save profile" }).click();
  await expect(m.getByText("Enter a valid website address")).toBeVisible();

  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAADUlEQVR4nGP438AARAAMfgL/LyTkkgAAAABJRU5ErkJggg==", "base64");
  await m.locator('input[name="image"]').setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: png });
  await expect(m.locator('img[alt="Logo (optional)"]')).toBeVisible(); // the picture was read and resized
  await m.getByLabel("Website (optional)").fill("example.com/menu");
  await m.getByLabel("Contact email (optional)").fill("hello@example.com");
  await m.getByLabel("Contact phone (optional)").fill("+1 (408) 555-0100");
  await m.getByRole("button", { name: "Save profile" }).click();
  await expect(m.getByText("Saved")).toBeVisible();
  await mctx.close();

  const { data: saved } = await admin.from("merchants").select("website, logo_path").eq("id", merchantId).single();
  expect(saved?.website).toBe("https://example.com/menu"); // a missing scheme is added
  expect(saved?.logo_path).toMatch(new RegExp(`^${merchantId}/logo-[a-z0-9]+\\.jpg$`));

  const cctx = await browser.newContext({ timezoneId: "UTC" });
  await signIn(cctx, baseURL!, cust.email);
  const p = await cctx.newPage();
  await p.goto("/");
  await expect(p.locator("li", { hasText: kitchen }).locator("img")).toHaveCount(1); // logo on the Browse card
  await p.locator("li", { hasText: kitchen }).getByRole("link").click();
  await expect(p.getByRole("link", { name: "example.com/menu" })).toHaveAttribute("href", "https://example.com/menu");
  await expect(p.getByRole("link", { name: "hello@example.com" })).toHaveAttribute("href", "mailto:hello@example.com");
  await expect(p.getByRole("link", { name: "+1 (408) 555-0100" })).toHaveAttribute("href", "tel:+14085550100");
  await cctx.close();
});

test("food description is a multi-line box and keeps its line breaks", async ({ browser, baseURL }) => {
  const mer = await createUser("e2emerchant9");
  must(await admin.from("merchants").insert({ owner_id: mer.id, name: `E2E Food Kitchen ${run}` }).select("id").single());
  const ctx = await browser.newContext({ timezoneId: "UTC" });
  await signIn(ctx, baseURL!, mer.email);
  const p = await ctx.newPage();
  await p.goto("/merchant/foods");
  await expect(p.locator('textarea[name="description"]')).toHaveCount(1);
  await p.getByLabel("Name", { exact: true }).fill("Layered Cake");
  await p.locator('textarea[name="description"]').fill("Line one\nLine two");
  await p.getByRole("button", { name: "Add food" }).click();
  const shown = p.getByText("Line one", { exact: false }).first();
  await expect(shown).toBeVisible();
  await expect(shown).toHaveCSS("white-space", /pre-line/);
  await ctx.close();
});
