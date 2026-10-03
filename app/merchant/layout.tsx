import Link from "next/link";
import { getMyMerchant } from "@/lib/auth";

const LINKS = [
  ["/merchant", "Dashboard"],
  ["/merchant/offerings", "Offerings"],
  ["/merchant/foods", "Foods"],
  ["/merchant/pickup-points", "Pickup points"],
  ["/merchant/scan", "Scan QR"],
  ["/merchant/customers", "Customers"],
  ["/merchant/reports", "Reports"],
] as const;

export default async function MerchantLayout({ children }: LayoutProps<"/merchant">) {
  const { merchant } = await getMyMerchant();
  return (
    <div className="flex flex-1 flex-col">
      {merchant && (
        <nav className="flex gap-4 overflow-x-auto border-b border-neutral-200 px-4 py-2 text-sm dark:border-neutral-800">
          {LINKS.map(([href, label]) => (
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
