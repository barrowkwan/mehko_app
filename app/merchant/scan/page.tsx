import { requireMerchant } from "@/lib/auth";
import { Scanner } from "./scanner";

export default async function ScanPage() {
  await requireMerchant();
  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-xl font-bold">Confirm pickup</h1>
      <p className="text-sm text-neutral-500">Scan the QR code on the customer&apos;s order.</p>
      <Scanner />
    </main>
  );
}
