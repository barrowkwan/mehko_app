// Groups the pickup slots of one offering by pickup point, so a place offered at two times (e.g. morning and
// evening) is shown once with both times. Order follows the earliest slot of each point.
export type SlotLike = { id: string; pickup_point_id: string; pickup_date: string; pickup_start: string; pickup_end: string };

export function groupSlotsByPoint<T extends SlotLike>(slots: T[]): { pointId: string; slots: T[] }[] {
  const sorted = [...slots].sort((a, b) => (a.pickup_date + a.pickup_start).localeCompare(b.pickup_date + b.pickup_start));
  const groups: { pointId: string; slots: T[] }[] = [];
  for (const s of sorted) {
    const g = groups.find((x) => x.pointId === s.pickup_point_id);
    if (g) g.slots.push(s);
    else groups.push({ pointId: s.pickup_point_id, slots: [s] });
  }
  return groups;
}
