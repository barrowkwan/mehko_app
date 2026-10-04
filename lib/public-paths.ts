// Pages that anonymous visitors may open. Everything else redirects to /login (see lib/supabase/proxy.ts).
// /privacy and /terms must stay public: login providers (Google, Facebook, Apple) and the app stores
// require reachable policy URLs. /api/health is for uptime monitors. /unsubscribe (+ its one-click API) must work
// without signing in: it is linked from emails and protected by a signed token.
const PUBLIC_PATHS = ["/login", "/auth", "/privacy", "/terms", "/api/health", "/unsubscribe", "/api/unsubscribe"];

export function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}
