import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json' with { type: 'json' };

export default defineManifest({
  manifest_version: 3,
  name: 'Short the Shorts',
  description: pkg.description,
  version: pkg.version,
  icons: {
    16: 'icons/icon-16.png',
    32: 'icons/icon-32.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png',
  },
  permissions: ['storage'],
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  action: {
    default_popup: 'src/popup/index.html',
    default_icon: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
    },
  },
  options_ui: {
    page: 'src/options/index.html',
    open_in_tab: true,
  },
  content_scripts: [
    {
      // Must match whole sites, not just /shorts/* or /reels/*: both are SPAs, so a user who
      // navigates Home -> Shorts never triggers a fresh content-script injection.
      // Adding a site here also needs an adapter in src/sites/.
      matches: ['https://www.youtube.com/*', 'https://www.instagram.com/*'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
    },
  ],
});
