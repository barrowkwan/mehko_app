// Legal pages are structured data (not Markdown) so every language is checked for the same shape by
// lib/__tests__/legal-content.test.ts. Text may use the tokens {operator}, {contact}, {site}, {updated}.
export type Block = { p: string } | { ul: string[] };
export type Section = { id: string; title: string; blocks: Block[] };
export type LegalDoc = { title: string; intro: string; sections: Section[] };
