// A tiny stand-in for Geoapify's geocoding API, so e2e tests never call the real service (or spend its quota).
import { createServer } from "node:http";

const KEY = "e2e-key";
const ranch = {
  name: "99 Ranch Market",
  address_line1: "99 Ranch Market",
  address_line2: "10983 North Wolfe Road, Cupertino, CA 95014, United States of America",
  formatted: "99 Ranch Market, 10983 North Wolfe Road, Cupertino, CA 95014, United States of America",
  lat: 37.3347,
  lon: -122.0141,
  category: "commercial.supermarket",
  timezone: { name: "America/Los_Angeles" },
};

createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const send = (status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (url.pathname !== "/v1/geocode/search") return send(404, {});
  if (url.searchParams.get("apiKey") !== KEY) return send(401, { message: "bad key" });
  const text = (url.searchParams.get("text") ?? "").toLowerCase();
  if (text.includes("boom")) return send(500, { message: "provider down" });
  if (text.includes("ranch")) return send(200, { results: [ranch] });
  return send(200, { results: [] });
}).listen(3199, "127.0.0.1");
