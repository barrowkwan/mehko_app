import { describe, expect, it } from "vitest";
import { publicOrigin } from "../origin";

const req = (headers: Record<string, string>, origin = "https://localhost:10000", protocol = "https:") => ({
  headers: new Headers(headers),
  nextUrl: { origin, protocol },
});

describe("publicOrigin", () => {
  it("uses the Host header and forwarded proto behind a proxy", () => {
    expect(publicOrigin(req({ host: "mehko-app.onrender.com", "x-forwarded-proto": "https" }))).toBe("https://mehko-app.onrender.com");
  });
  it("prefers x-forwarded-host and takes the first value of a list", () => {
    expect(publicOrigin(req({ "x-forwarded-host": "app.example.com, internal", host: "localhost:10000", "x-forwarded-proto": "https,http" }))).toBe("https://app.example.com");
  });
  it("falls back to the request protocol, then to nextUrl.origin", () => {
    expect(publicOrigin(req({ host: "localhost:3000" }, "http://localhost:3000", "http:"))).toBe("http://localhost:3000");
    expect(publicOrigin(req({}, "http://localhost:3000", "http:"))).toBe("http://localhost:3000");
  });
});
