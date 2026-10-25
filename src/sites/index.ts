import { instagram } from './instagram';
import type { SiteAdapter, SiteId } from './types';
import { youtube } from './youtube';

export * from './types';

export const SITES: Record<SiteId, SiteAdapter> = { youtube, instagram };

export function siteForHostname(hostname: string): SiteAdapter | null {
  return Object.values(SITES).find((site) => site.hostnames.includes(hostname)) ?? null;
}
