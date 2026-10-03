export function isPastCutoff(cutoffAt: string | Date, now: Date = new Date()): boolean {
  return now.getTime() >= new Date(cutoffAt).getTime();
}

export function formatCutoff(cutoffAt: string | Date): string {
  return new Date(cutoffAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

// Cutoff must not be after the pickup start. Both are absolute instants; the DB trigger
// check_offering_schedule enforces the same rule using the pickup point's timezone.
export function cutoffBeforePickup(cutoffAt: Date, pickupStart: Date): boolean {
  return cutoffAt.getTime() <= pickupStart.getTime();
}
