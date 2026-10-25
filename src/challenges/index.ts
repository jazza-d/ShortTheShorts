import type { ChallengeType, Difficulty } from '../shared/settings';
import { generateAnagram } from './anagram';
import { generateMath } from './math';
import type { ChallengeGenerator } from './types';

export type { Challenge, ChallengeGenerator } from './types';

export const CHALLENGES: Record<ChallengeType, ChallengeGenerator> = {
  math: generateMath,
  anagram: generateAnagram,
};

export const CHALLENGE_LABELS: Record<ChallengeType, string> = {
  math: 'Micro Math',
  anagram: 'Word Unscramble',
};

/** Shown under the difficulty slider so users know what each level means. */
export const DIFFICULTY_HINTS: Record<ChallengeType, Record<Difficulty, string>> = {
  math: {
    easy: 'Adding & subtracting, e.g. 47 + 38',
    medium: 'Adds times tables & division, e.g. 7 × 8',
    hard: 'Bigger numbers & fractions, e.g. 1/3 + 1/4',
  },
  anagram: {
    easy: '4-letter words',
    medium: '6-letter words',
    hard: '8-letter words',
  },
};
