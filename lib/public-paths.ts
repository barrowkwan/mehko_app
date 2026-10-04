// Pages that anonymous visitors may open. Everything else redirects to /login (see lib/supabase/proxy.ts).
// /privacy and /terms must stay public: login providers (Google, Facebook, Apple) and the app stores
// require reachable policy URLs.
const PUBLIC_PATHS = ["/login", "/auth", "/privacy", "/terms"];

export function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}
