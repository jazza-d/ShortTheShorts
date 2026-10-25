import type { SiteAdapter, VideoRef } from './types';

/**
 * `/reels/CODE/` is the scrolling Reels feed (the URL updates per Reel), `/reel/CODE/` is a
 * single Reel, optionally prefixed with the author's username. Shortcodes are 10+ characters;
 * requiring at least 6 rules out short sub-pages like `/reels/audio/`.
 */
const REEL_PATH = /^\/(?:[\w.]+\/)?reels?\/([\w-]{6,})\/?$/;

export function parseVideo(url: string | URL): VideoRef | null {
  const u = typeof url === 'string' ? new URL(url) : url;
  const id = REEL_PATH.exec(u.pathname)?.[1];
  return id ? { id, kind: 'short' } : null;
}

// Reels in the home feed, Stories and DMs don't change the URL, so only the Reels feed and
// single-Reel pages are gated. Instagram's class names are obfuscated and change often, so
// there are no video selectors: the most visible <video> is the active Reel.
export const instagram: SiteAdapter = {
  id: 'instagram',
  name: 'Instagram',
  shortNoun: 'Reels',
  hostnames: ['www.instagram.com'],
  parseVideo,
  hasWatchPages: false,
  navigationEvents: [],
  videoSelectors: {},
};
