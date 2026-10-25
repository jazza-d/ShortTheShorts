export const SITE_IDS = ['youtube', 'instagram'] as const;
export type SiteId = (typeof SITE_IDS)[number];

export type VideoKind = 'short' | 'watch';

export interface VideoRef {
  id: string;
  kind: VideoKind;
}

/**
 * Everything the content script needs to know about one site. Adapters are plain data plus
 * pure functions (no DOM access) so they stay unit-testable; `src/content/` does the DOM work.
 */
export interface SiteAdapter {
  id: SiteId;
  /** Shown to users, e.g. "Close YouTube Tab". */
  name: string;
  /** What the site calls its short videos, e.g. "Shorts" or "Reels". */
  shortNoun: string;
  hostnames: string[];
  parseVideo(url: URL): VideoRef | null;
  /** Whether the "All videos" scope adds regular video pages on this site. */
  hasWatchPages: boolean;
  /** Where "Convert to Standard Video" goes. Omit to hide the button on this site. */
  convertUrl?(video: VideoRef): string;
  /** Site-specific DOM events that fire after an in-app (SPA) navigation. */
  navigationEvents: string[];
  /** Element to watch for re-renders as a navigation fallback. Defaults to `document.body`. */
  navigationRoot?: string;
  /**
   * Selectors for the video currently on screen, most specific first. When none match,
   * the most visible `<video>` on the page is used instead.
   */
  videoSelectors: Partial<Record<VideoKind, string[]>>;
}
