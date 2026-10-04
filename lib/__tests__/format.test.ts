import { describe, expect, it } from "vitest";
import { formatDate, formatInstant, formatTime, todayIn } from "../format";

describe("formatDate / formatTime", () => {
  it("formats the calendar day without a timezone shift", () => {
    expect(formatDate("2026-10-10", "en")).toContain("Oct");
    expect(formatDate("2026-10-10", "en")).toContain("10");
    expect(formatDate("2026-10-10", "es").toLowerCase()).toContain("oct");
    expect(formatDate("2026-10-10", "zh-CN")).toContain("10");
  });
  it("formats a wall-clock time", () => {
    expect(formatTime("17:30", "en")).toMatch(/5:30\s?PM/i);
    expect(formatTime("17:30", "zh-TW")).toContain("5:30");
  });
});

describe("formatInstant", () => {
  it("renders in the requested timezone with its name", () => {
    const s = formatInstant("2026-10-10T00:00:00Z", "en", "America/New_York");
    expect(s).toMatch(/Oct 9/);
    expect(s).toMatch(/8:00\s?PM/);
    expect(s).toMatch(/EDT/);
  });
  it("differs by timezone for the same instant", () => {
    const ny = formatInstant("2026-10-10T00:00:00Z", "en", "America/New_York");
    const tokyo = formatInstant("2026-10-10T00:00:00Z", "en", "Asia/Tokyo");
    expect(ny).not.toBe(tokyo);
    expect(tokyo).toMatch(/Oct 10/);
  });
});

describe("todayIn", () => {
  it("returns a YYYY-MM-DD string", () => {
    expect(todayIn("UTC")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
