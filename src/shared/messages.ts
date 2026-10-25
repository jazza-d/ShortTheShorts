import type { StatField } from './stats';

export type Message = { type: 'stat'; field: StatField } | { type: 'closeTab' } | { type: 'openSettings' };

export function sendMessage(message: Message): void {
  // The service worker may be restarting (async rejection), or the extension was reloaded and
  // this content script is orphaned (sendMessage throws synchronously: "Extension context
  // invalidated"). Messages are best-effort, and callers rely on this never throwing.
  try {
    chrome.runtime.sendMessage(message).catch(() => {});
  } catch {
    // Orphaned content script.
  }
}
