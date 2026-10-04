// Behind a reverse proxy (Render, etc.) `request.url` / `request.nextUrl.origin` reflect the
// server's internal address (e.g. https://localhost:10000), not the public one. Route handlers that
// redirect must build absolute URLs from the forwarded headers instead.
export function publicOrigin(request: { headers: Headers; nextUrl: { origin: string; protocol: string } }): string {
  const first = (v: string | null) => v?.split(",")[0].trim() || null;
  const host = first(request.headers.get("x-forwarded-host")) ?? first(request.headers.get("host"));
  if (!host) return request.nextUrl.origin;
  const proto = first(request.headers.get("x-forwarded-proto")) ?? request.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}`;
}
