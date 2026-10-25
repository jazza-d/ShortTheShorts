import type { SiteAdapter, VideoKind } from '../sites';

function visibleArea(el: Element): number {
  const r = el.getBoundingClientRect();
  const width = Math.min(r.right, window.innerWidth) - Math.max(r.left, 0);
  const height = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
  return Math.max(0, width) * Math.max(0, height);
}

export function findActiveVideo(site: SiteAdapter, kind: VideoKind): HTMLVideoElement | null {
  for (const selector of site.videoSelectors[kind] ?? []) {
    const video = document.querySelector<HTMLVideoElement>(selector);
    if (video) return video;
  }
  let best: HTMLVideoElement | null = null;
  let bestArea = 0;
  for (const video of document.querySelectorAll('video')) {
    const area = visibleArea(video);
    if (area > bestArea) [best, bestArea] = [video, area];
  }
  return best;
}

/**
 * Pauses all video and keeps it paused until released. YouTube and Instagram aggressively call
 * play() (autoplay, swipe preloading), so we re-pause on every `play` event. `play` doesn't
 * bubble, but it does go through the capture phase.
 */
export function holdPlayback(site: SiteAdapter, kind: VideoKind): (resume: boolean) => void {
  const pause = (e: Event) => {
    if (e.target instanceof HTMLVideoElement) e.target.pause();
  };
  document.addEventListener('play', pause, true);
  document.querySelectorAll('video').forEach((v) => v.pause());

  return (resume) => {
    document.removeEventListener('play', pause, true);
    if (resume) findActiveVideo(site, kind)?.play().catch(() => {});
  };
}

const NAV_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', ' ', 'k', 'j']);

/** Blocks wheel/touch/keyboard swiping to the next Short, except for events inside `allowWithin`. */
export function blockScrollNavigation(allowWithin: HTMLElement): () => void {
  const block = (e: Event) => {
    if (e.composedPath().includes(allowWithin)) return;
    if (e instanceof KeyboardEvent && !NAV_KEYS.has(e.key)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  const opts = { capture: true, passive: false } as const;
  const events = ['wheel', 'touchmove', 'keydown'] as const;
  events.forEach((type) => window.addEventListener(type, block, opts));
  return () => events.forEach((type) => window.removeEventListener(type, block, opts));
}
