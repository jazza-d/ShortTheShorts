import { describe, expect, it } from 'vitest';
import { GateTracker } from './gate';

const view = (t: GateTracker, id: string) => t.onVideoViewed(id).shouldGate;

describe('GateTracker', () => {
  it('gates every Short when interval is 1', () => {
    const t = new GateTracker(1);
    expect([view(t, 'a'), view(t, 'b'), view(t, 'c')]).toEqual([true, true, true]);
  });

  it('gates on every Nth new Short', () => {
    const t = new GateTracker(3);
    const results = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => view(t, id));
    expect(results).toEqual([false, false, true, false, false, true]);
  });

  it('does not count revisits', () => {
    const t = new GateTracker(2);
    expect(view(t, 'a')).toBe(false);
    expect(t.onVideoViewed('a')).toEqual({ isNewView: false, shouldGate: false });
    expect(view(t, 'b')).toBe(true);
    expect(t.viewedThisSession).toBe(2);
  });

  it('never gates a video marked as already seen', () => {
    const t = new GateTracker(1);
    t.markSeen('a');
    expect(view(t, 'a')).toBe(false);
    expect(view(t, 'b')).toBe(true);
  });

  it('gates on the next view when the interval is lowered below the current count', () => {
    const t = new GateTracker(10);
    ['a', 'b', 'c', 'd'].forEach((id) => view(t, id));
    t.setInterval(3);
    expect(view(t, 'e')).toBe(true);
  });
});
