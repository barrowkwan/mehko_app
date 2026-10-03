import { describe, expect, it } from "vitest";
import { cutoffBeforePickup, isPastCutoff } from "../cutoff";

describe("isPastCutoff", () => {
  const cutoff = "2026-10-10T12:00:00Z";
  it("is false before the cutoff", () => {
    expect(isPastCutoff(cutoff, new Date("2026-10-10T11:59:59Z"))).toBe(false);
  });
  it("is true at and after the cutoff", () => {
    expect(isPastCutoff(cutoff, new Date("2026-10-10T12:00:00Z"))).toBe(true);
    expect(isPastCutoff(cutoff, new Date("2026-10-11T00:00:00Z"))).toBe(true);
  });
});

describe("cutoffBeforePickup", () => {
  it("accepts a cutoff before or equal to pickup start", () => {
    expect(cutoffBeforePickup(new Date("2026-10-09T00:00:00Z"), new Date("2026-10-10T00:00:00Z"))).toBe(true);
    expect(cutoffBeforePickup(new Date("2026-10-10T00:00:00Z"), new Date("2026-10-10T00:00:00Z"))).toBe(true);
  });
  it("rejects a cutoff after pickup start", () => {
    expect(cutoffBeforePickup(new Date("2026-10-10T01:00:00Z"), new Date("2026-10-10T00:00:00Z"))).toBe(false);
  });
});
