import { headers } from "next/headers";
import { isPlausibleEmail } from "@/lib/legal";

// Public identity shown on the legal pages. Set in the environment (NEXT_PUBLIC_* are inlined at build time):
//   NEXT_PUBLIC_OPERATOR_NAME   who runs the service (person or business). Default: "Neighborhood Eats"
//   NEXT_PUBLIC_CONTACT_EMAIL   privacy/legal contact address. Strongly recommended: policies need one.
//   NEXT_PUBLIC_SITE_URL        canonical site URL (optional; otherwise taken from the request)
export function getOperatorName(): string {
  return process.env.NEXT_PUBLIC_OPERATOR_NAME?.trim() || "Neighborhood Eats";
}

export function getContactEmail(): string | null {
  const v = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  return isPlausibleEmail(v) ? v.trim() : null;
}

export async function getSiteUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  const h = await headers();
  const host = h.get("x-forwarded-host")?.split(",")[0].trim() ?? h.get("host");
  const proto = h.get("x-forwarded-proto")?.split(",")[0].trim() ?? "https";
  return host ? `${proto}://${host}` : "";
}
