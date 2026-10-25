/**
 * Fill these in once the accounts exist. Empty values hide the matching button,
 * so the extension can ship before support links are set up.
 */
export const LINKS = {
  /** e.g. "https://buymeacoffee.com/your-handle" or a Ko-fi / PayPal.me / Stripe link. */
  support: 'https://ko-fi.com/jazzad',
  /** Image file in public/, e.g. "support-qr.png" (SnapScan, Zapper, PayPal QR, etc.). */
  supportQrImage: '',
  /** Overrides the default Chrome Web Store listing URL, e.g. a landing page. */
  share: '',
};

export const APP_NAME = 'Short the Shorts';

export const SHARE_TEXT =
  'I use Short the Shorts to stop doom-scrolling Shorts and Reels: a tiny puzzle between videos. Free, private, no account:';

const SHARE_LABEL = '🔗 Share with a friend';

export function shareUrl(): string {
  return LINKS.share || `https://chromewebstore.google.com/detail/${chrome.runtime.id}`;
}

/** Uses the native share sheet where Chrome supports it, otherwise copies to the clipboard. */
export async function shareExtension(): Promise<'shared' | 'copied' | 'cancelled'> {
  const url = shareUrl();
  if (navigator.share) {
    try {
      await navigator.share({ title: APP_NAME, text: SHARE_TEXT, url });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
    }
  }
  await navigator.clipboard.writeText(`${SHARE_TEXT} ${url}`);
  return 'copied';
}

/** Renders the support/share buttons into `container`. */
export function renderSupportLinks(container: HTMLElement, { showQr = false } = {}): void {
  if (LINKS.support) {
    const coffee = Object.assign(document.createElement('a'), {
      href: LINKS.support,
      target: '_blank',
      rel: 'noopener',
      className: 'button secondary',
      textContent: '☕ Give me a tip',
    });
    container.append(coffee);
  }

  const share = Object.assign(document.createElement('button'), {
    type: 'button',
    className: 'secondary',
    textContent: SHARE_LABEL,
  });
  share.addEventListener('click', async () => {
    // Clipboard writes can be refused (e.g. the page lost focus); leave the label unchanged.
    const result = await shareExtension().catch(() => null);
    if (result === 'copied') {
      share.textContent = '✓ Link copied';
      setTimeout(() => (share.textContent = SHARE_LABEL), 1500);
    }
  });
  container.append(share);

  if (showQr && LINKS.supportQrImage) {
    const qr = Object.assign(document.createElement('img'), {
      src: `/${LINKS.supportQrImage}`,
      alt: `QR code to support ${APP_NAME}`,
      className: 'qr',
      width: 160,
      height: 160,
    });
    container.append(qr);
  }
}
