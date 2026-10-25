import type { Difficulty } from '../shared/settings';
import type { ChallengeGenerator } from './types';

// Every word must have no other valid anagram, or users will type a correct word and be rejected.
export const WORDS: Record<Difficulty, readonly string[]> = {
  easy: ['fish', 'duck', 'frog', 'jump', 'milk', 'gift', 'quiz', 'bulb', 'hymn', 'jazz'],
  medium: ['pencil', 'rocket', 'window', 'yellow', 'bridge', 'jacket', 'guitar', 'pocket', 'monkey', 'turtle'],
  hard: ['elephant', 'mountain', 'keyboard', 'umbrella', 'dinosaur', 'sandwich', 'hospital', 'football', 'notebook', 'chipmunk'],
};

function shuffle(word: string, random: () => number): string {
  const letters = word.split('');
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [letters[i], letters[j]] = [letters[j]!, letters[i]!];
  }
  return letters.join('');
}

export const generateAnagram: ChallengeGenerator = (difficulty, random = Math.random) => {
  const words = WORDS[difficulty];
  const word = words[Math.floor(random() * words.length)]!;
  let scrambled = shuffle(word, random);
  for (let tries = 0; scrambled === word && tries < 10; tries++) scrambled = shuffle(word, random);

  return {
    prompt: `Unscramble: ${scrambled.toUpperCase()}`,
    inputHint: 'Type the word...',
    inputMode: 'text',
    check: (input) => input.trim().toLowerCase() === word,
  };
};
