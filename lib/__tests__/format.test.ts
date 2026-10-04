import { describe, expect, it } from "vitest";
import { formatDate, formatInstant, formatTime, isoToLocalInput, todayIn } from "../format";

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

describe("isoToLocalInput", () => {
  it("renders an ISO instant as the browser-local value a datetime-local input expects", () => {
    const local = new Date(2026, 9, 5, 14, 30); // local wall-clock time, whatever the machine's timezone
    expect(isoToLocalInput(local.toISOString())).toBe("2026-10-05T14:30");
  });
  it("pads single-digit parts and survives a round trip to the same minute", () => {
    const local = new Date(2027, 0, 2, 3, 4);
    const text = isoToLocalInput(local.toISOString());
    expect(text).toBe("2027-01-02T03:04");
    expect(new Date(text).getTime()).toBe(local.getTime());
  });
  it("returns an empty string for invalid input", () => {
    expect(isoToLocalInput("")).toBe("");
    expect(isoToLocalInput("not a date")).toBe("");
  });
});
