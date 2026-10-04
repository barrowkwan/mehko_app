import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { privacy } from "@/content/legal/privacy";
import { LegalDocument } from "@/components/legal-document";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: privacy[locale].title };
}

export default async function PrivacyPage() {
  const locale = await getLocale();
  return <LegalDocument doc={privacy[locale]} />;
}
