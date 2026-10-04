// Pure helpers for the legal pages (no React, so they are unit-testable).

export type LegalVars = { operator: string; contact: string | null; site: string; updated: string };
export type Part = { kind: "text"; text: string } | { kind: "contact"; email: string };

// Splits a legal text into plain text and {contact} links, replacing {operator}, {site} and {updated}.
// {contact} becomes a mailto link when a contact email is configured, otherwise the fallback sentence.
export function splitLegalText(text: string, vars: LegalVars, contactFallback: string): Part[] {
  const replaced = text
    .replaceAll("{operator}", vars.operator)
    .replaceAll("{site}", vars.site)
    .replaceAll("{updated}", vars.updated);
  const parts: Part[] = [];
  replaced.split("{contact}").forEach((chunk, i, all) => {
    if (chunk) parts.push({ kind: "text", text: chunk });
    if (i < all.length - 1) {
      parts.push(vars.contact ? { kind: "contact", email: vars.contact } : { kind: "text", text: contactFallback });
    }
  });
  return parts;
}

export function isPlausibleEmail(value: string | undefined | null): value is string {
  return !!value && /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(value.trim());
}
