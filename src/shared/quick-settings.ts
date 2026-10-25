import './quick-settings.css';
import { CHALLENGE_LABELS, DIFFICULTY_HINTS } from '../challenges';
import { gatingStatus } from './schedule';
import {
  CHALLENGE_TYPES,
  DIFFICULTIES,
  FRICTION_INTERVALS,
  type ChallengeType,
  type FrictionInterval,
  type GateScope,
  type Settings,
} from './settings';

/** The settings shown in both the toolbar popup and the full settings page. */
export type QuickSettingsValues = Pick<Settings, 'enabled' | 'interval' | 'challengeType' | 'difficulty'>;

export interface QuickSettings {
  status: HTMLElement;
  frequency: HTMLElement;
  challenge: HTMLElement;
  read(): QuickSettingsValues;
  /** Re-renders the status line from `base` overlaid with the current (unsaved) control values. */
  refreshStatus(base: Settings): void;
  /** Relabels the frequency options ("Every 3 Shorts/Reels" vs "Every 3 videos"). */
  setScope(scope: GateScope): void;
}

const TEMPLATE = `
  <section data-part="status">
    <label class="toggle">
      <span>Status: <strong data-ref="status-label"></strong></span>
      <input type="checkbox" name="enabled" role="switch" aria-label="Gate enabled" />
    </label>
    <p class="hint" data-ref="status-hint"></p>
  </section>

  <section data-part="frequency">
    <h2>Friction frequency</h2>
    <fieldset data-ref="intervals"></fieldset>
  </section>

  <section data-part="challenge">
    <h2>Challenge type</h2>
    <select name="challengeType" aria-label="Challenge type"></select>

    <h2 class="difficulty-heading">Level: <span data-ref="difficulty-label"></span></h2>
    <input type="range" name="difficulty" min="0" max="2" step="1" aria-label="Difficulty" />
    <div class="ticks" aria-hidden="true"><span>Easy</span><span>Medium</span><span>Hard</span></div>
    <p class="hint" data-ref="difficulty-hint"></p>
  </section>
`;

const STATUS_LABELS = { active: 'ACTIVE', paused: 'PAUSED', 'auto-off': 'AUTO-OFF' } as const;

export function createQuickSettings(settings: Settings, { autoOffHint = '' } = {}): QuickSettings {
  const root = document.createElement('div');
  root.innerHTML = TEMPLATE;
  // Resolve every element now: callers move the sections out of `root`, so later lookups would miss.
  const $ = <T extends Element>(selector: string) => root.querySelector<T>(selector)!;
  const status = $<HTMLElement>('[data-part="status"]');
  const frequency = $<HTMLElement>('[data-part="frequency"]');
  const challenge = $<HTMLElement>('[data-part="challenge"]');
  const statusLabel = $<HTMLElement>('[data-ref="status-label"]');
  const statusHint = $<HTMLElement>('[data-ref="status-hint"]');
  const difficultyLabel = $<HTMLElement>('[data-ref="difficulty-label"]');
  const difficultyHint = $<HTMLElement>('[data-ref="difficulty-hint"]');
  const intervals = $<HTMLFieldSetElement>('[data-ref="intervals"]');
  const enabled = $<HTMLInputElement>('input[name="enabled"]');
  const challengeType = $<HTMLSelectElement>('select[name="challengeType"]');
  const difficulty = $<HTMLInputElement>('input[name="difficulty"]');

  const currentDifficulty = () => DIFFICULTIES[Number(difficulty.value)] ?? 'easy';
  const currentInterval = () =>
    Number(intervals.querySelector<HTMLInputElement>('input:checked')?.value ?? settings.interval) as FrictionInterval;

  const setScope = (scope: GateScope) => {
    const selected = currentInterval();
    const [one, many] = scope === 'all' ? ['video', 'videos'] : ['Short/Reel', 'Shorts/Reels'];
    intervals.replaceChildren(
      ...FRICTION_INTERVALS.map((n) => {
        const label = document.createElement('label');
        const radio = Object.assign(document.createElement('input'), {
          type: 'radio',
          name: 'interval',
          value: String(n),
          checked: n === selected,
        });
        label.append(radio, ` ${n === 1 ? `Every ${one}` : `Every ${n} ${many}`}`);
        return label;
      }),
    );
  };

  const renderDifficulty = () => {
    const level = currentDifficulty();
    difficultyLabel.textContent = level[0]!.toUpperCase() + level.slice(1);
    difficultyHint.textContent = DIFFICULTY_HINTS[challengeType.value as ChallengeType][level];
  };

  const read = (): QuickSettingsValues => ({
    enabled: enabled.checked,
    interval: currentInterval(),
    challengeType: challengeType.value as ChallengeType,
    difficulty: currentDifficulty(),
  });

  let lastBase = settings;
  const refreshStatus = (base: Settings) => {
    lastBase = base;
    const current = gatingStatus({ ...base, ...read() });
    statusLabel.textContent = STATUS_LABELS[current];
    statusLabel.className = `status-${current}`;
    statusHint.textContent = current === 'auto-off' ? autoOffHint : '';
  };

  for (const type of CHALLENGE_TYPES) challengeType.append(new Option(CHALLENGE_LABELS[type], type));
  enabled.checked = settings.enabled;
  challengeType.value = settings.challengeType;
  difficulty.value = String(DIFFICULTIES.indexOf(settings.difficulty));
  setScope(settings.scope);
  renderDifficulty();
  refreshStatus(settings);

  enabled.addEventListener('change', () => refreshStatus(lastBase));
  difficulty.addEventListener('input', renderDifficulty);
  challengeType.addEventListener('change', renderDifficulty);

  return {
    status,
    frequency,
    challenge,
    read,
    refreshStatus,
    setScope,
  };
}
