import { describe, expect, it } from 'vitest';
import { gatingStatus, isAutoOff, isInWindow } from './schedule';
import { DEFAULT_SETTINGS, SUGGESTED_OFF_WINDOWS, type AutoOff, type OffWindow } from './settings';

// 2026-10-26 is a Monday.
const at = (day: number, time: string) => {
  const [h, m] = time.split(':').map(Number);
  return new Date(2026, 9, 26 + day, h, m);
};
const MON = 0, FRI = 4, SAT = 5, SUN = 6;

describe('isInWindow', () => {
  const lunch: OffWindow = { days: [1, 2, 3, 4, 5], start: '12:00', end: '13:00' };
  const evenings: OffWindow = { days: [1, 2, 3, 4, 5], start: '17:00', end: '09:00' };

  it('matches a daytime block on selected days only', () => {
    expect(isInWindow(lunch, at(MON, '12:00'))).toBe(true);
    expect(isInWindow(lunch, at(MON, '12:59'))).toBe(true);
    expect(isInWindow(lunch, at(MON, '13:00'))).toBe(false);
    expect(isInWindow(lunch, at(SAT, '12:30'))).toBe(false);
  });

  it('treats start > end as "before end or after start" on the same day', () => {
    expect(isInWindow(evenings, at(MON, '08:59'))).toBe(true);
    expect(isInWindow(evenings, at(MON, '09:00'))).toBe(false);
    expect(isInWindow(evenings, at(FRI, '16:59'))).toBe(false);
    expect(isInWindow(evenings, at(FRI, '17:00'))).toBe(true);
    expect(isInWindow(evenings, at(SAT, '08:00'))).toBe(false);
  });

  it('treats start === end as all day', () => {
    const weekend: OffWindow = { days: [0, 6], start: '00:00', end: '00:00' };
    expect(isInWindow(weekend, at(SAT, '00:00'))).toBe(true);
    expect(isInWindow(weekend, at(SUN, '23:59'))).toBe(true);
    expect(isInWindow(weekend, at(MON, '12:00'))).toBe(false);
  });
});

describe('isAutoOff', () => {
  const suggested: AutoOff = { enabled: true, windows: SUGGESTED_OFF_WINDOWS };

  it('never switches off when disabled', () => {
    expect(isAutoOff({ ...suggested, enabled: false }, at(SAT, '12:00'))).toBe(false);
  });

  it('is off if any window matches (suggested: weekday evenings + weekends)', () => {
    expect(isAutoOff(suggested, at(MON, '10:00'))).toBe(false);
    expect(isAutoOff(suggested, at(MON, '07:00'))).toBe(true);
    expect(isAutoOff(suggested, at(FRI, '18:00'))).toBe(true);
    expect(isAutoOff(suggested, at(SAT, '12:00'))).toBe(true);
    expect(isAutoOff(suggested, at(SUN, '12:00'))).toBe(true);
  });

  it('is never off with no windows', () => {
    expect(isAutoOff({ enabled: true, windows: [] }, at(SAT, '12:00'))).toBe(false);
  });
});

describe('gatingStatus', () => {
  const autoOff: AutoOff = { enabled: true, windows: SUGGESTED_OFF_WINDOWS };

  it('defaults to active', () => {
    expect(gatingStatus(DEFAULT_SETTINGS, at(SAT, '12:00'))).toBe('active');
  });

  it('reports paused, auto-off, or active', () => {
    expect(gatingStatus({ ...DEFAULT_SETTINGS, enabled: false })).toBe('paused');
    expect(gatingStatus({ ...DEFAULT_SETTINGS, autoOff }, at(SAT, '12:00'))).toBe('auto-off');
    expect(gatingStatus({ ...DEFAULT_SETTINGS, autoOff }, at(MON, '10:00'))).toBe('active');
  });
});
