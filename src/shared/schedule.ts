import type { AutoOff, OffWindow, Settings } from './settings';

/** Monday-first, for display. Values are `Date.getDay()` numbers. */
export const WEEK = [
  { day: 1, label: 'Mon' },
  { day: 2, label: 'Tue' },
  { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' },
  { day: 5, label: 'Fri' },
  { day: 6, label: 'Sat' },
  { day: 0, label: 'Sun' },
] as const;

function toMinutes(hhmm: string): number {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function isInWindow(window: OffWindow, now = new Date()): boolean {
  if (!window.days.includes(now.getDay())) return false;

  const minutes = now.getHours() * 60 + now.getMinutes();
  const start = toMinutes(window.start);
  const end = toMinutes(window.end);

  if (start === end) return true;
  if (start < end) return minutes >= start && minutes < end;
  return minutes >= start || minutes < end;
}

export function isAutoOff(autoOff: AutoOff, now = new Date()): boolean {
  return autoOff.enabled && autoOff.windows.some((w) => isInWindow(w, now));
}

export type GatingStatus = 'active' | 'paused' | 'auto-off';

export function gatingStatus(settings: Settings, now = new Date()): GatingStatus {
  if (!settings.enabled) return 'paused';
  return isAutoOff(settings.autoOff, now) ? 'auto-off' : 'active';
}
