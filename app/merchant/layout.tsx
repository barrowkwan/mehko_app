import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getMyMerchant } from "@/lib/auth";

export default async function MerchantLayout({ children }: LayoutProps<"/merchant">) {
  const { merchant } = await getMyMerchant();
  const t = await getTranslations("merchantNav");
  const links = [
    ["/merchant", t("dashboard")],
    ["/merchant/offerings", t("offerings")],
    ["/merchant/foods", t("foods")],
    ["/merchant/pickup-points", t("pickupPoints")],
    ["/merchant/scan", t("scan")],
    ["/merchant/customers", t("customers")],
    ["/merchant/reports", t("reports")],
    ["/merchant/profile", t("profile")],
  ] as const;
  return (
    <div className="flex flex-1 flex-col">
      {merchant && (
        <nav className="flex gap-4 overflow-x-auto border-b border-neutral-200 px-4 py-2 text-sm dark:border-neutral-800">
          {links.map(([href, label]) => (
            <Link key={href} href={href} className="whitespace-nowrap hover:text-orange-600">
              {label}
            </Link>
          ))}
        </nav>
      )}
      {children}
    </div>
  );
}
