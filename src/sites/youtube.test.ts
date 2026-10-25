import { describe, expect, it } from 'vitest';
import { parseVideo, toWatchUrl } from './youtube';

describe('parseVideo', () => {
  it('recognises Shorts URLs', () => {
    expect(parseVideo('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toEqual({ id: 'dQw4w9WgXcQ', kind: 'short' });
    expect(parseVideo('https://www.youtube.com/shorts/dQw4w9WgXcQ?feature=share')?.id).toBe('dQw4w9WgXcQ');
    expect(parseVideo('https://www.youtube.com/shorts/dQw4w9WgXcQ/')?.id).toBe('dQw4w9WgXcQ');
  });

  it('recognises standard watch URLs', () => {
    expect(parseVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42')).toEqual({ id: 'dQw4w9WgXcQ', kind: 'watch' });
  });

  it('returns null for non-video pages and malformed ids', () => {
    expect(parseVideo('https://www.youtube.com/')).toBeNull();
    expect(parseVideo('https://www.youtube.com/shorts')).toBeNull();
    expect(parseVideo('https://www.youtube.com/watch')).toBeNull();
    expect(parseVideo('https://www.youtube.com/watch?v=short')).toBeNull();
    expect(parseVideo('https://www.youtube.com/results?search_query=cats')).toBeNull();
  });
});

describe('toWatchUrl', () => {
  it('builds a standard watch URL', () => {
    expect(toWatchUrl('dQw4w9WgXcQ')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });
});
