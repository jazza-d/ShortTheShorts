import type { SiteAdapter, VideoRef } from './types';

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const SHORTS_PATH = /^\/shorts\/([A-Za-z0-9_-]{11})(?:[/?#]|$)/;

export function parseVideo(url: string | URL): VideoRef | null {
  const u = typeof url === 'string' ? new URL(url) : url;

  const shortId = SHORTS_PATH.exec(u.pathname)?.[1];
  if (shortId) return { id: shortId, kind: 'short' };

  const watchId = u.pathname === '/watch' ? u.searchParams.get('v') : null;
  if (watchId && VIDEO_ID.test(watchId)) return { id: watchId, kind: 'watch' };

  return null;
}

export function toWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}

export const youtube: SiteAdapter = {
  id: 'youtube',
  name: 'YouTube',
  shortNoun: 'Shorts',
  hostnames: ['www.youtube.com'],
  parseVideo,
  hasWatchPages: true,
  convertUrl: (video) => toWatchUrl(video.id),
  navigationEvents: ['yt-navigate-finish'],
  navigationRoot: '#content',
  // YouTube changes its DOM often; keep these in one place.
  videoSelectors: {
    short: ['ytd-reel-video-renderer[is-active] video', '#shorts-player video', 'ytd-shorts video'],
    watch: ['#movie_player video.html5-main-video', '#movie_player video'],
  },
};
