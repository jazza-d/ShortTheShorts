import type { SiteAdapter } from '../sites';

/**
 * YouTube and Instagram are SPAs, and content scripts run in an isolated world, so we cannot
 * patch the page's history.pushState. Instead we listen to several independent signals and
 * dedupe on the URL.
 */
export function watchNavigation(site: SiteAdapter, onChange: (url: string) => void): () => void {
  let last = location.href;
  const check = () => {
    if (location.href === last) return;
    last = location.href;
    onChange(last);
  };

  // The site's own SPA navigation events (e.g. yt-navigate-finish) are the fast path.
  site.navigationEvents.forEach((type) => document.addEventListener(type, check));
  window.addEventListener('popstate', check);

  // Fallback for transitions without an event (e.g. some Shorts swipes, every Instagram Reel).
  const observer = new MutationObserver(check);
  const root = (site.navigationRoot && document.querySelector(site.navigationRoot)) || document.body;
  observer.observe(root, { childList: true, subtree: true });

  return () => {
    site.navigationEvents.forEach((type) => document.removeEventListener(type, check));
    window.removeEventListener('popstate', check);
    observer.disconnect();
  };
}
