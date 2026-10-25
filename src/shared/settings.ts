import { SITE_IDS, type SiteId } from '../sites/types';

export const FRICTION_INTERVALS = [1, 3, 5, 10] as const;
export type FrictionInterval = (typeof FRICTION_INTERVALS)[number];

export const CHALLENGE_TYPES = ['math', 'anagram'] as const;
export type ChallengeType = (typeof CHALLENGE_TYPES)[number];

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/** Which pages get gated: only short-form video, or every video including YouTube `/watch`. */
export const GATE_SCOPES = ['shorts', 'all'] as const;
export type GateScope = (typeof GATE_SCOPES)[number];

/**
 * A period when gating switches off. Times are evaluated within each selected day:
 * start < end is a daytime block, start > end means "before end and after start"
 * (e.g. 17:00–09:00 = evenings and early mornings), start === end means all day.
 */
export interface OffWindow {
  /** `Date.getDay()` values (0 = Sunday). */
  days: number[];
  /** Local time, "HH:MM". */
  start: string;
  end: string;
}

export interface AutoOff {
  /** When false, the gate is always on (the default). */
  enabled: boolean;
  windows: OffWindow[];
}

export interface Settings {
  enabled: boolean;
  /** Per-site on/off, on top of `enabled`. */
  sites: Record<SiteId, boolean>;
  scope: GateScope;
  interval: FrictionInterval;
  challengeType: ChallengeType;
  difficulty: Difficulty;
  cooldownSeconds: number;
  autoOff: AutoOff;
}

/** Pre-filled suggestion: off on weekday evenings/nights and all weekend. */
export const SUGGESTED_OFF_WINDOWS: OffWindow[] = [
  { days: [1, 2, 3, 4, 5], start: '17:00', end: '09:00' },
  { days: [0, 6], start: '00:00', end: '00:00' },
];

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  sites: Object.fromEntries(SITE_IDS.map((id) => [id, true])) as Record<SiteId, boolean>,
  scope: 'shorts',
  interval: 1,
  challengeType: 'math',
  difficulty: 'easy',
  cooldownSeconds: 3,
  autoOff: {
    enabled: false,
    windows: SUGGESTED_OFF_WINDOWS,
  },
};

const KEY = 'settings';

const oneOf = <T>(allowed: readonly T[], value: unknown, fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

/**
 * Sync storage can hold values this build doesn't know (e.g. a challenge type from a newer
 * version on another device), and an unknown enum would crash the gate, so fall back to defaults.
 */
function withDefaults(partial: Partial<Settings> | undefined): Settings {
  const merged: Settings = {
    ...DEFAULT_SETTINGS,
    ...partial,
    sites: { ...DEFAULT_SETTINGS.sites, ...partial?.sites },
    autoOff: { ...DEFAULT_SETTINGS.autoOff, ...partial?.autoOff },
  };
  return {
    ...merged,
    scope: oneOf(GATE_SCOPES, merged.scope, DEFAULT_SETTINGS.scope),
    interval: oneOf(FRICTION_INTERVALS, merged.interval, DEFAULT_SETTINGS.interval),
    challengeType: oneOf(CHALLENGE_TYPES, merged.challengeType, DEFAULT_SETTINGS.challengeType),
    difficulty: oneOf(DIFFICULTIES, merged.difficulty, DEFAULT_SETTINGS.difficulty),
  };
}

/**
 * The fields of `values` that differ from `base` (what the form was rendered from). Saving only
 * these stops a long-open page from writing stale copies of fields changed elsewhere since.
 */
export function changedFields(base: Settings, values: Partial<Settings>): Partial<Settings> {
  return Object.fromEntries(
    Object.entries(values).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(base[key as keyof Settings])),
  ) as Partial<Settings>;
}

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.sync.get(KEY);
  return withDefaults(stored[KEY] as Partial<Settings> | undefined);
}

/** Merges onto the latest stored value so the popup and options page can't overwrite each other's fields. */
export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = withDefaults({ ...(await loadSettings()), ...patch });
  await chrome.storage.sync.set({ [KEY]: next });
  return next;
}

export function onSettingsChanged(callback: (settings: Settings) => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    const change = changes[KEY];
    if (area === 'sync' && change) callback(withDefaults(change.newValue as Partial<Settings>));
  });
}
