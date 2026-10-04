export type OrderLine = {
  food_name: string;
  qty: number;
  pickup_date: string;
  pickup_point_name: string;
  is_holiday: boolean;
  holiday_name: string | null;
  weather_bucket: string | null;
};

export type Dimension = "date" | "location" | "holiday" | "weather";

// Labels live in messages/*.json (reports.byDate …); ids are what the URL carries.
export const DIMENSIONS: { id: Dimension; labelKey: "byDate" | "byLocation" | "byHoliday" | "byWeather" }[] = [
  { id: "date", labelKey: "byDate" },
  { id: "location", labelKey: "byLocation" },
  { id: "holiday", labelKey: "byHoliday" },
  { id: "weather", labelKey: "byWeather" },
];

export type Group = {
  key: string;
  total: number;
  foods: { name: string; qty: number }[];
};

// Group keys are language-neutral: the page turns them into labels with the active locale.
//   holiday dimension: "regular" or "holiday:<name>"; weather dimension: a bucket or "unknown".
export function groupKey(line: OrderLine, dim: Dimension): string {
  switch (dim) {
    case "date":
      return line.pickup_date;
    case "location":
      return line.pickup_point_name;
    case "holiday":
      return line.is_holiday ? `holiday:${line.holiday_name ?? ""}` : "regular";
    case "weather":
      return line.weather_bucket ?? "unknown";
  }
}

// Groups order lines by a dimension and ranks foods inside each group by quantity ordered.
export function topFoodsBy(lines: OrderLine[], dim: Dimension, topN = 5): Group[] {
  const groups = new Map<string, Map<string, number>>();
  for (const line of lines) {
    const key = groupKey(line, dim);
    const foods = groups.get(key) ?? new Map<string, number>();
    foods.set(line.food_name, (foods.get(line.food_name) ?? 0) + line.qty);
    groups.set(key, foods);
  }

  const result: Group[] = [...groups].map(([key, foods]) => {
    const ranked = [...foods].map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name));
    return { key, total: ranked.reduce((s, f) => s + f.qty, 0), foods: ranked.slice(0, topN) };
  });

  return dim === "date"
    ? result.sort((a, b) => b.key.localeCompare(a.key))
    : result.sort((a, b) => b.total - a.total || a.key.localeCompare(b.key));
}
