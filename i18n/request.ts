import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, negotiateLocale, type Locale } from "@/lib/locale";

// Locale = saved cookie, else the browser's Accept-Language, else English. No URL prefix.
// (After login, /auth/callback copies the user's saved profile locale into the cookie.)
export default getRequestConfig(async () => {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(saved) ? saved : negotiateLocale((await headers()).get("accept-language")) ?? DEFAULT_LOCALE;
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    // Dates are formatted in the viewer's choice of locale; times are shown in the pickup point's
    // timezone explicitly where it matters (see lib/format.ts), so no global timeZone here.
  };
});
