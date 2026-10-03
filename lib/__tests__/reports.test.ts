import { describe, expect, it } from "vitest";
import { topFoodsBy, type OrderLine } from "../reports";

const line = (over: Partial<OrderLine>): OrderLine => ({
  food_name: "Dumplings",
  qty: 1,
  pickup_date: "2026-10-10",
  pickup_point_name: "Park",
  is_holiday: false,
  holiday_name: null,
  weather_bucket: "clear",
  ...over,
});

describe("topFoodsBy", () => {
  const lines = [
    line({ qty: 3 }),
    line({ food_name: "Noodles", qty: 5 }),
    line({ food_name: "Noodles", qty: 1, pickup_date: "2026-10-11", pickup_point_name: "Station", weather_bucket: "rain" }),
    line({ food_name: "Dumplings", qty: 2, pickup_date: "2026-10-12", is_holiday: true, holiday_name: "Thanksgiving", weather_bucket: "rain" }),
  ];

  it("ranks foods within each date, newest date first", () => {
    const g = topFoodsBy(lines, "date");
    expect(g.map((x) => x.key)).toEqual(["2026-10-12", "2026-10-11", "2026-10-10"]);
    expect(g[2].foods).toEqual([
      { name: "Noodles", qty: 5 },
      { name: "Dumplings", qty: 3 },
    ]);
  });

  it("groups by location, busiest first", () => {
    const g = topFoodsBy(lines, "location");
    expect(g.map((x) => [x.key, x.total])).toEqual([
      ["Park", 10],
      ["Station", 1],
    ]);
  });

  it("separates holidays from regular days", () => {
    const keys = topFoodsBy(lines, "holiday").map((x) => x.key);
    expect(keys).toContain("Holiday: Thanksgiving");
    expect(keys).toContain("Regular day");
  });

  it("groups by weather bucket and labels missing weather as unknown", () => {
    const g = topFoodsBy([...lines, line({ weather_bucket: null })], "weather");
    expect(g.map((x) => x.key).sort()).toEqual(["clear", "rain", "unknown"]);
  });

  it("limits foods per group to topN", () => {
    const many = ["A", "B", "C"].map((n, i) => line({ food_name: n, qty: i + 1 }));
    expect(topFoodsBy(many, "location", 2)[0].foods).toHaveLength(2);
  });
});
