import type { Message } from '../shared/messages';
import { incrementStat } from '../shared/stats';

// All stat writes funnel through this queue so concurrent tabs can't clobber each
// other's read-modify-write on chrome.storage.local.
let statQueue: Promise<void> = Promise.resolve();

chrome.runtime.onMessage.addListener((message: Message, sender) => {
  switch (message.type) {
    case 'stat':
      statQueue = statQueue.then(() => incrementStat(message.field)).catch(console.error);
      break;
    case 'closeTab':
      // Content scripts can't window.close() a tab they didn't open; tabs.remove needs no permission.
      if (sender.tab?.id !== undefined) void chrome.tabs.remove(sender.tab.id);
      break;
    case 'openSettings':
      // runtime.openOptionsPage isn't available to content scripts.
      void chrome.runtime.openOptionsPage();
      break;
  }
});
