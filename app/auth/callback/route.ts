import { cookies, headers } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth";
import { publicOrigin } from "@/lib/origin";
import { LOCALE_COOKIE, isLocale, negotiateLocale } from "@/lib/locale";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const origin = publicOrigin(request);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await syncLocale(supabase);
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}

// A returning user gets their saved language on this device; a first-time user's current
// language (cookie or browser) is saved to their profile.
async function syncLocale(supabase: Awaited<ReturnType<typeof createClient>>) {
  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const { data: profile } = await supabase.from("profiles").select("locale").eq("id", data.user.id).maybeSingle();
    const store = await cookies();
    if (isLocale(profile?.locale)) {
      store.set(LOCALE_COOKIE, profile.locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
      return;
    }
    const current = store.get(LOCALE_COOKIE)?.value;
    const locale = isLocale(current) ? current : negotiateLocale((await headers()).get("accept-language"));
    await supabase.from("profiles").update({ locale }).eq("id", data.user.id);
  } catch {
    // Language sync is best-effort; never block login.
  }
}
