import { getTranslations } from "next-intl/server";
import { safeNext } from "@/lib/auth";
import { LoginButtons } from "./login-buttons";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const t = await getTranslations("login");
  const next = safeNext(typeof sp.next === "string" ? sp.next : null);
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-neutral-600 dark:text-neutral-400">{t("subtitle")}</p>
      </div>
      {sp.deleted && <p className="text-sm text-green-700">{t("deleted")}</p>}
      {sp.error && <p className="text-sm text-red-600">{t("failed")}</p>}
      <LoginButtons next={next} />
    </main>
  );
}
