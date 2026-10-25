import { describe, expect, it } from 'vitest';
import { siteForHostname } from '.';

describe('siteForHostname', () => {
  it('finds the adapter for each supported site', () => {
    expect(siteForHostname('www.youtube.com')?.id).toBe('youtube');
    expect(siteForHostname('www.instagram.com')?.id).toBe('instagram');
  });

  it('returns null for other hosts', () => {
    expect(siteForHostname('m.youtube.com')).toBeNull();
    expect(siteForHostname('example.com')).toBeNull();
  });
});
