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

export const DIMENSIONS: { id: Dimension; label: string }[] = [
  { id: "date", label: "By date" },
  { id: "location", label: "By location" },
  { id: "holiday", label: "By holiday" },
  { id: "weather", label: "By weather" },
];

export type Group = {
  key: string;
  total: number;
  foods: { name: string; qty: number }[];
};

export function groupKey(line: OrderLine, dim: Dimension): string {
  switch (dim) {
    case "date":
      return line.pickup_date;
    case "location":
      return line.pickup_point_name;
    case "holiday":
      return line.is_holiday ? `Holiday: ${line.holiday_name ?? "public holiday"}` : "Regular day";
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
