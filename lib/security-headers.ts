// Response headers for every page. Deliberately NOT a full script-src Content-Security-Policy: Next.js inline
// scripts need per-request nonces, which would make every page dynamic. This set blocks clickjacking, MIME
// sniffing, plugin/base-tag injection and cross-site form posts, and limits powerful browser features.
// A nonce-based CSP is a follow-up (docs/roadmap.md SEC-3).
export function securityHeaders(isProd: boolean): { key: string; value: string }[] {
  const csp = ["frame-ancestors 'none'", "base-uri 'self'", "object-src 'none'", "form-action 'self'"].join("; ");
  const headers = [
    { key: "Content-Security-Policy", value: csp },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // The app itself uses the camera (QR scan) and location (pickup point, live sharing); nothing else.
    { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=(), payment=(), usb=()" },
  ];
  // HTTPS only in production (local dev runs on http).
  if (isProd) headers.push({ key: "Strict-Transport-Security", value: "max-age=31536000" });
  return headers;
}
