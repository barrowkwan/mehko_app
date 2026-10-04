import { getTranslations } from "next-intl/server";
import { verifyUnsubscribeToken } from "@/lib/notifications/unsubscribe";
import { unsubscribe } from "./actions";

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string; done?: string }> }) {
  const { token = "", done } = await searchParams;
  const t = await getTranslations("unsubscribe");
  const valid = !!verifyUnsubscribeToken(token, process.env.UNSUBSCRIBE_SECRET ?? "");

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <h1 className="text-xl font-bold">{t("title")}</h1>
      {done ? (
        <p>{t("done")}</p>
      ) : !valid ? (
        <p>{t("invalid")}</p>
      ) : (
        <form action={unsubscribe.bind(null, token)} className="flex flex-col gap-3">
          <p>{t("intro")}</p>
          <button className="rounded-lg bg-orange-600 px-4 py-2 font-medium text-white hover:bg-orange-700">{t("button")}</button>
        </form>
      )}
    </main>
  );
}
