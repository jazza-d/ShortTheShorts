import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, type Difficulty } from '../shared/settings';
import { generateMath } from './math';

type Fraction = { n: number; d: number };

const parseOperand = (s: string): Fraction => {
  const [n, d = '1'] = s.split('/');
  return { n: Number(n), d: Number(d) };
};

/** Independent evaluator for prompts like "47 + 38 = ?" or "1/3 − 1/4 = ?". */
function solve(prompt: string): Fraction {
  const [left, op, right] = prompt.replace(' = ?', '').split(' ') as [string, string, string];
  const a = parseOperand(left);
  const b = parseOperand(right);
  switch (op) {
    case '+': return { n: a.n * b.d + b.n * a.d, d: a.d * b.d };
    case '−': return { n: a.n * b.d - b.n * a.d, d: a.d * b.d };
    case '×': return { n: a.n * b.n, d: a.d * b.d };
    case '÷': return { n: a.n * b.d, d: a.d * b.n };
    default: throw new Error(`unknown operator in "${prompt}"`);
  }
}

const operatorsSeen = (difficulty: Difficulty) => {
  const ops = new Set<string>();
  for (let i = 0; i < 500; i++) ops.add(generateMath(difficulty).prompt.split(' ')[1]!);
  return ops;
};

describe('generateMath', () => {
  it.each(DIFFICULTIES)('%s: accepts the correct answer (and equivalents) and rejects others', (difficulty) => {
    for (let i = 0; i < 300; i++) {
      const c = generateMath(difficulty);
      const { n, d } = solve(c.prompt);

      expect(n).toBeGreaterThanOrEqual(0);
      expect(c.check(`${n}/${d}`)).toBe(true);
      expect(c.check(` ${n * 2} / ${d * 2} `)).toBe(true);
      expect(c.check(`${n + d}/${d}`)).toBe(false);
      expect(c.check('')).toBe(false);
      expect(c.check('abc')).toBe(false);
      if (n % d === 0) expect(c.check(String(n / d))).toBe(true);
    }
  });

  it('easy only uses addition and subtraction', () => {
    expect([...operatorsSeen('easy')].sort()).toEqual(['+', '−']);
  });

  it('medium adds multiplication and division', () => {
    expect(operatorsSeen('medium')).toEqual(new Set(['+', '−', '×', '÷']));
  });

  it('hard includes fractions', () => {
    const prompts = Array.from({ length: 300 }, () => generateMath('hard'));
    const fraction = prompts.find((c) => c.prompt.includes('/'));
    expect(fraction).toBeDefined();
    expect(fraction!.inputMode).toBe('text');
  });

  it('rejects a zero denominator', () => {
    expect(generateMath('easy').check('1/0')).toBe(false);
  });
});
