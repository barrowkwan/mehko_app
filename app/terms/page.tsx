import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { terms } from "@/content/legal/terms";
import { LegalDocument } from "@/components/legal-document";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: terms[locale].title };
}

export default async function TermsPage() {
  const locale = await getLocale();
  return <LegalDocument doc={terms[locale]} />;
}
