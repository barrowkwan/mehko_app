import { describe, expect, it } from "vitest";
import { groupSlotsByPoint } from "../slots";

const slot = (id: string, point: string, start: string, date = "2026-10-10") => ({ id, pickup_point_id: point, pickup_date: date, pickup_start: start, pickup_end: "23:00" });

describe("groupSlotsByPoint", () => {
  it("puts the same point's times together, ordered by time, points ordered by their earliest slot", () => {
    const groups = groupSlotsByPoint([slot("a", "P1", "18:00"), slot("b", "P2", "12:00"), slot("c", "P1", "09:00")]);
    expect(groups.map((g) => g.pointId)).toEqual(["P1", "P2"]);
    expect(groups[0].slots.map((s) => s.id)).toEqual(["c", "a"]);
  });

  it("keeps single-time points as one-slot groups and handles an empty list", () => {
    expect(groupSlotsByPoint([slot("a", "P1", "09:00")])).toHaveLength(1);
    expect(groupSlotsByPoint([])).toEqual([]);
  });
});

import { groupOfferings } from "../slots";

describe("groupOfferings", () => {
  it("joins rows with the same group_id, keeps ungrouped rows alone and keeps first-seen order", () => {
    const rows = [
      { id: "a", group_id: "G1" },
      { id: "b", group_id: null },
      { id: "c", group_id: "G1" },
      { id: "d", group_id: "G2" },
    ];
    expect(groupOfferings(rows).map((g) => g.map((r) => r.id))).toEqual([["a", "c"], ["b"], ["d"]]);
  });
});
