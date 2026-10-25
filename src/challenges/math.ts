import type { Difficulty } from '../shared/settings';
import type { ChallengeGenerator } from './types';

type Random = () => number;
type Range = readonly [min: number, max: number];

/** Answers are kept as fractions so every problem type shares one checker. */
interface Problem {
  expression: string;
  answer: { n: number; d: number };
}

const randInt = (random: Random, [min, max]: Range) => Math.floor(random() * (max - min + 1)) + min;
const pick = <T>(random: Random, items: readonly T[]) => items[Math.floor(random() * items.length)]!;
const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
const whole = (n: number) => ({ n, d: 1 });

function addSub(random: Random, range: Range): Problem {
  let a = randInt(random, range);
  let b = randInt(random, range);
  const add = random() < 0.5;
  if (!add && b > a) [a, b] = [b, a];
  return { expression: `${a} ${add ? '+' : '−'} ${b}`, answer: whole(add ? a + b : a - b) };
}

function multiply(random: Random, aRange: Range, bRange: Range): Problem {
  const a = randInt(random, aRange);
  const b = randInt(random, bRange);
  return { expression: `${a} × ${b}`, answer: whole(a * b) };
}

/** Always divides exactly: the dividend is built from divisor × quotient. */
function divide(random: Random, divisorRange: Range, quotientRange: Range): Problem {
  const divisor = randInt(random, divisorRange);
  const quotient = randInt(random, quotientRange);
  return { expression: `${divisor * quotient} ÷ ${divisor}`, answer: whole(quotient) };
}

function fractions(random: Random): Problem {
  const fraction = () => {
    const d = randInt(random, [2, 6]);
    return { n: randInt(random, [1, d - 1]), d };
  };
  let a = fraction();
  let b = fraction();
  const add = random() < 0.5;
  if (!add && a.n * b.d < b.n * a.d) [a, b] = [b, a];

  const n = add ? a.n * b.d + b.n * a.d : a.n * b.d - b.n * a.d;
  const d = a.d * b.d;
  const g = gcd(n, d) || 1;
  return { expression: `${a.n}/${a.d} ${add ? '+' : '−'} ${b.n}/${b.d}`, answer: { n: n / g, d: d / g } };
}

const PROBLEMS: Record<Difficulty, ((random: Random) => Problem)[]> = {
  easy: [(r) => addSub(r, [10, 99])],
  medium: [(r) => addSub(r, [10, 99]), (r) => multiply(r, [2, 12], [2, 12]), (r) => divide(r, [2, 12], [2, 12])],
  hard: [
    (r) => addSub(r, [100, 999]),
    (r) => multiply(r, [12, 25], [3, 9]),
    (r) => divide(r, [3, 12], [12, 25]),
    fractions,
  ],
};

const ANSWER = /^\s*(\d+)\s*(?:\/\s*(\d+))?\s*$/;

/** Accepts whole numbers and any equivalent fraction (e.g. 7/12, 14/24; 1 or 2/2 for one). */
function parseAnswer(input: string): { n: number; d: number } | null {
  const match = ANSWER.exec(input);
  if (!match) return null;
  const d = match[2] === undefined ? 1 : Number(match[2]);
  return d === 0 ? null : { n: Number(match[1]), d };
}

export const generateMath: ChallengeGenerator = (difficulty, random = Math.random) => {
  const { expression, answer } = pick(random, PROBLEMS[difficulty])(random);
  const isFraction = expression.includes('/');
  return {
    prompt: `${expression} = ?`,
    inputHint: isFraction ? 'Answer as a fraction, e.g. 5/6' : 'Enter answer...',
    inputMode: isFraction ? 'text' : 'numeric',
    check: (input) => {
      const given = parseAnswer(input);
      return given !== null && given.n * answer.d === answer.n * given.d;
    },
  };
};
