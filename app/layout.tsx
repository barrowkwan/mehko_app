import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Geist } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("title"),
    description: t("description"),
    appleWebApp: { capable: true, title: t("title") },
  };
}

export const viewport: Viewport = { themeColor: "#ea580c" };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const t = await getTranslations("nav");
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  return (
    <html lang={locale} className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          <header className="border-b border-neutral-200 dark:border-neutral-800">
            <nav className="mx-auto flex max-w-4xl flex-wrap items-center gap-4 p-4 text-sm">
              <Link href="/" className="mr-auto font-bold text-orange-600">
                {t("brand")}
              </Link>
              {user && (
                <>
                  <Link href="/">{t("browse")}</Link>
                  <Link href="/orders">{t("myOrders")}</Link>
                  <Link href="/merchant">{t("merchant")}</Link>
                </>
              )}
              <LocaleSwitcher />
              {user && (
                <form action="/auth/signout" method="post">
                  <button className="text-neutral-500 hover:underline">{t("signOut")}</button>
                </form>
              )}
            </nav>
          </header>
          <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col">{children}</div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
