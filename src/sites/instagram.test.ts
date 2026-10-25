import { describe, expect, it } from 'vitest';
import { parseVideo } from './instagram';

describe('parseVideo', () => {
  it('recognises Reels feed and single-Reel URLs', () => {
    expect(parseVideo('https://www.instagram.com/reels/C9xYz_Ab-12/')).toEqual({ id: 'C9xYz_Ab-12', kind: 'short' });
    expect(parseVideo('https://www.instagram.com/reel/C9xYz_Ab-12/')?.id).toBe('C9xYz_Ab-12');
    expect(parseVideo('https://www.instagram.com/reel/C9xYz_Ab-12')?.id).toBe('C9xYz_Ab-12');
    expect(parseVideo('https://www.instagram.com/reel/C9xYz_Ab-12/?igsh=abc')?.id).toBe('C9xYz_Ab-12');
  });

  it('recognises username-prefixed Reel URLs', () => {
    expect(parseVideo('https://www.instagram.com/some.user_1/reel/C9xYz_Ab-12/')?.id).toBe('C9xYz_Ab-12');
  });

  it('returns null for non-Reel pages', () => {
    expect(parseVideo('https://www.instagram.com/')).toBeNull();
    expect(parseVideo('https://www.instagram.com/reels/')).toBeNull();
    expect(parseVideo('https://www.instagram.com/reels/audio/')).toBeNull();
    expect(parseVideo('https://www.instagram.com/reels/audio/123456789/')).toBeNull();
    expect(parseVideo('https://www.instagram.com/some.user/reels/')).toBeNull();
    expect(parseVideo('https://www.instagram.com/p/C9xYz_Ab-12/')).toBeNull();
    expect(parseVideo('https://www.instagram.com/stories/some.user/3456789012/')).toBeNull();
  });
});
