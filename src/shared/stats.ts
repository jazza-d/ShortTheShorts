export interface DailyStats {
  date: string;
  videosViewed: number;
  gatesShown: number;
  gatesSolved: number;
  gatesFailed: number;
  conversions: number;
  tabsClosed: number;
}

export type StatField = Exclude<keyof DailyStats, 'date'>;

// Placeholder heuristic until we have real data; see "Open questions" in docs/tech_spec.md.
const MINUTES_SAVED_PER_TAB_CLOSE = 5;

export function localDateKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function emptyStats(date: string): DailyStats {
  return { date, videosViewed: 0, gatesShown: 0, gatesSolved: 0, gatesFailed: 0, conversions: 0, tabsClosed: 0 };
}

const storageKey = (date: string) => `stats:${date}`;

export async function getStats(date = localDateKey()): Promise<DailyStats> {
  const key = storageKey(date);
  const stored = await chrome.storage.local.get(key);
  return { ...emptyStats(date), ...(stored[key] as Partial<DailyStats> | undefined) };
}

/** Callers must serialise increments (the background worker does this) to avoid lost writes. */
export async function incrementStat(field: StatField, date = localDateKey()): Promise<void> {
  const stats = await getStats(date);
  stats[field] += 1;
  await chrome.storage.local.set({ [storageKey(date)]: stats });
}

export function estimateMinutesSaved(stats: DailyStats): number {
  return stats.tabsClosed * MINUTES_SAVED_PER_TAB_CLOSE;
}
