import type { Difficulty } from '../shared/settings';

export interface Challenge {
  /** Text shown in the challenge box, e.g. "47 + 38 = ?". */
  prompt: string;
  /** Placeholder for the answer input. */
  inputHint: string;
  inputMode: 'numeric' | 'text';
  check(answer: string): boolean;
}

/** `random` returns a float in [0, 1); injectable so generators are deterministic in tests. */
export type ChallengeGenerator = (difficulty: Difficulty, random?: () => number) => Challenge;
