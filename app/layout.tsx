import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Geist } from "next/font/google";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Neighborhood Eats",
  description: "Pre-order food from local merchants and pick it up nearby.",
  appleWebApp: { capable: true, title: "Neighborhood Eats" },
};

export const viewport: Viewport = { themeColor: "#ea580c" };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="border-b border-neutral-200 dark:border-neutral-800">
          <nav className="mx-auto flex max-w-4xl items-center gap-4 p-4 text-sm">
            <Link href="/" className="mr-auto font-bold text-orange-600">
              Neighborhood Eats
            </Link>
            {user && (
              <>
                <Link href="/">Browse</Link>
                <Link href="/orders">My orders</Link>
                <Link href="/merchant">Merchant</Link>
                <form action="/auth/signout" method="post">
                  <button className="text-neutral-500 hover:underline">Sign out</button>
                </form>
              </>
            )}
          </nav>
        </header>
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
