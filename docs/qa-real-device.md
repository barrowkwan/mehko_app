# QA-2 · Real-device check (iOS Safari + Android Chrome)

Automated tests cover logic and the web flows in desktop Chromium. They **cannot** cover phone-specific behaviour: camera permission, GPS, home-screen install, mobile keyboards, Safari quirks. Do this once on real phones, and again after big UI changes.

**You need:** the live site (https://mehko-app.onrender.com), two accounts (one merchant, one customer: your own Google login plus a second Google/Facebook account, or a friend), one iPhone and one Android phone (or run the whole list on whichever you have and note it). Use two devices at once for the pickup test: customer shows the QR, merchant scans.

Mark each line **Pass / Fail / N/A** and note the phone + OS version for any failure. Screenshots of failures help.

## 1. Sign-in (both phones)
- [ ] Open the site; login page shows your enabled providers
- [ ] Sign in with Google; you land on the home page, not `localhost` and not an error
- [ ] Close the browser fully, reopen the site: still signed in
- [ ] Sign out, sign in again

## 2. Language (both phones)
- [ ] Language selector opens a usable picker on the phone
- [ ] Switch to Español, 简体中文 and 繁體中文: the whole page changes, no `missing message` text, no clipped text
- [ ] Reload: the choice is remembered

## 3. Customer ordering
- [ ] Home shows open offerings; photos load and aren't stretched
- [ ] Order form: numeric keypad appears for quantity; the note field is usable with the keyboard open
- [ ] Place an order; the order page shows a **QR code** that is large and sharp enough to scan
- [ ] Edit the quantity; cancel (the confirm dialog works)

## 4. Merchant on a phone
- [ ] Add a pickup point: the **map** scrolls the page normally (not trapped), tap places the pin, dragging the pin works
- [ ] "Use my current location": the browser asks permission; the pin and numbers update. Then deny it once: you get the friendly error, not a stuck button
- [ ] Add a food **with a photo from the camera/gallery** (photo is resized; no sideways rotation)
- [ ] Publish an offering (date/time/cutoff pickers work and show the right local time)

## 5. Pickup (two phones)
- [ ] Merchant → Scan QR: camera permission prompt appears; back camera is used; scanning the customer's QR marks the order **Picked up**
- [ ] Scanning the same code again does not double-confirm
- [ ] Customer's order page shows "Picked up"

## 6. Live location (two phones, on the pickup date)
- [ ] Merchant enables location sharing: permission prompt, toggle state is clear
- [ ] Customer opens the order: the map shows the merchant's marker moving (keep the merchant page open; note what happens when the screen locks, this is expected to pause)
- [ ] Merchant turns sharing off: marker disappears
- [ ] Merchant closes the tab (or locks the phone for 3+ minutes) without pressing Stop: the customer's marker disappears within about 2 minutes
- [ ] While sharing, the merchant page shows the red "You are sharing your live location" banner

## 7. Install to home screen
- [ ] Android Chrome: "Install app" / "Add to Home screen" works; icon and name look right; opens full screen
- [ ] iOS Safari: Share → Add to Home Screen; icon and name look right; opens full screen; sign-in still works from the installed app (iOS keeps a separate session for home-screen apps; note the behaviour)

## 8. Emails (any phone mail app)
- [ ] The order confirmation arrives (check spam), renders properly, button opens the order
- [ ] The unsubscribe link opens the confirmation page; after confirming, no more emails; Account → email toggle reflects it

## 9. General
- [ ] Dark mode (phone setting) on home, order, merchant pages: text readable, inputs visible
- [ ] Rotate to landscape: nothing breaks
- [ ] Slow network (turn on low-data mode or airplane mode mid-action): errors are readable, nothing is half-saved
- [ ] The first load after the site was idle takes a while (Render free tier sleeps ~50 s): note whether it's a blank screen or a clear loading state

## Report back
Send me the Fail lines (device, OS, what happened) and I'll turn them into fixes. Everything that passes can be ticked here and the QA-2 item closed.
