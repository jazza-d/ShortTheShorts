import { describe, expect, it } from 'vitest';
import { DIFFICULTIES } from '../shared/settings';
import { WORDS, generateAnagram } from './anagram';

const sorted = (s: string) => s.split('').sort().join('');
const LENGTH = { easy: 4, medium: 6, hard: 8 } as const;

describe('generateAnagram', () => {
  it.each(DIFFICULTIES)('%s: scrambles a word of the right length and accepts only that word', (difficulty) => {
    for (let i = 0; i < 100; i++) {
      const c = generateAnagram(difficulty);
      const scrambled = c.prompt.replace('Unscramble: ', '').toLowerCase();
      const word = WORDS[difficulty].find((w) => sorted(w) === sorted(scrambled));

      expect(word).toBeDefined();
      expect(word).toHaveLength(LENGTH[difficulty]);
      expect(scrambled).not.toBe(word);
      expect(c.check(word!)).toBe(true);
      expect(c.check(` ${word!.toUpperCase()} `)).toBe(true);
      expect(c.check(scrambled)).toBe(false);
      expect(c.check('')).toBe(false);
    }
  });

  it('has no two words in a level that are anagrams of each other', () => {
    for (const level of DIFFICULTIES) {
      const keys = WORDS[level].map(sorted);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});
