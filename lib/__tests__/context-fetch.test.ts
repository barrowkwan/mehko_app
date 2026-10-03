import { describe, expect, it, vi } from "vitest";
import { createHolidayLookup, fetchWeather, weatherBucket } from "../context-fetch";

describe("weatherBucket", () => {
  it("prefers precipitation over temperature", () => {
    expect(weatherBucket(61, 35)).toBe("rain");
    expect(weatherBucket(73, -5)).toBe("snow");
    expect(weatherBucket(95, 20)).toBe("rain");
  });
  it("flags temperature extremes on dry days", () => {
    expect(weatherBucket(0, 33)).toBe("hot");
    expect(weatherBucket(3, 0)).toBe("cold");
  });
  it("distinguishes clear and cloudy", () => {
    expect(weatherBucket(1, 20)).toBe("clear");
    expect(weatherBucket(3, 20)).toBe("cloudy");
    expect(weatherBucket(45, 20)).toBe("cloudy");
  });
  it("returns null with no data", () => {
    expect(weatherBucket(null, null)).toBeNull();
  });
});

describe("fetchWeather", () => {
  it("parses the daily response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ daily: { weather_code: [63], temperature_2m_max: [14.2], precipitation_sum: [6.5] } }),
    });
    const w = await fetchWeather(40.7, -74, new Date().toISOString().slice(0, 10), fetchImpl as unknown as typeof fetch);
    expect(w).toMatchObject({ bucket: "rain", tempMaxC: 14.2, precipMm: 6.5 });
  });
  it("returns null when the API fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false });
    expect(await fetchWeather(0, 0, "2026-01-01", fetchImpl as unknown as typeof fetch)).toBeNull();
  });
});

describe("createHolidayLookup", () => {
  it("finds a holiday and caches the year lookup", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ date: "2026-11-26", name: "Thanksgiving Day", global: true }],
    });
    const holidayOn = createHolidayLookup(fetchImpl as unknown as typeof fetch);
    expect(await holidayOn("2026-11-26", "US")).toBe("Thanksgiving Day");
    expect(await holidayOn("2026-11-27", "US")).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
