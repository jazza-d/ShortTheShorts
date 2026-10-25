import type { Challenge } from '../../challenges';
import { renderSupportLinks } from '../../shared/links';
import themeCss from '../../shared/theme.css?inline';
import overlayCss from './overlay.css?inline';

export interface OverlayOptions {
  generate: () => Challenge;
  contextLine: string;
  /** For the "Close <site> Tab" button. */
  siteName: string;
  /** "Convert to Standard Video" only makes sense on YouTube Shorts. */
  showConvert: boolean;
  cooldownSeconds: number;
  onSolved(): void;
  onFailed(): void;
  onConvert(): void;
  onCloseTab(): void;
  onOpenSettings(): void;
}

export interface OverlayHandle {
  host: HTMLElement;
  destroy(): void;
}

const TEMPLATE = `
  <div class="backdrop">
    <div class="card" role="dialog" aria-modal="true" aria-labelledby="bg-title" aria-describedby="bg-challenge">
      <div class="header">
        <h2 id="bg-title">🧠 Mindful Pause</h2>
        <button type="button" class="icon" data-action="settings" aria-label="Open settings" title="Settings">⚙️</button>
      </div>
      <p class="context"></p>
      <p class="label">Solve to continue scrolling:</p>
      <div class="challenge" id="bg-challenge" aria-live="polite"></div>
      <form novalidate>
        <input name="answer" autocomplete="off" aria-label="Your answer" />
        <button type="submit" class="primary">Submit</button>
      </form>
      <p class="cooldown" aria-live="assertive"></p>
      <hr />
      <div class="escapes">
        <button type="button" data-action="convert">🎬 Convert to Standard Video</button>
        <button type="button" data-action="close">🚪 Close <span class="site-name"></span> Tab</button>
      </div>
      <div class="support"></div>
    </div>
  </div>
`;

export function showOverlay(opts: OverlayOptions): OverlayHandle {
  const host = document.createElement('short-the-shorts-gate');
  const root = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = themeCss + overlayCss;
  root.append(style);
  root.append(document.createRange().createContextualFragment(TEMPLATE));

  const $ = <T extends Element>(sel: string) => root.querySelector<T>(sel)!;
  const form = $<HTMLFormElement>('form');
  const input = $<HTMLInputElement>('input');
  const submit = $<HTMLButtonElement>('button[type="submit"]');
  const cooldown = $<HTMLParagraphElement>('.cooldown');
  $<HTMLParagraphElement>('.context').textContent = opts.contextLine;
  $<HTMLSpanElement>('.site-name').textContent = opts.siteName;
  if (!opts.showConvert) $<HTMLButtonElement>('[data-action="convert"]').remove();
  renderSupportLinks($<HTMLDivElement>('.support'));

  let challenge: Challenge;
  let timer: number | undefined;

  const loadChallenge = () => {
    challenge = opts.generate();
    $<HTMLDivElement>('.challenge').textContent = challenge.prompt;
    input.placeholder = challenge.inputHint;
    input.inputMode = challenge.inputMode;
    input.value = '';
  };

  const startCooldown = () => {
    let remaining = opts.cooldownSeconds;
    input.disabled = submit.disabled = true;
    const tick = () => {
      if (remaining <= 0) {
        window.clearInterval(timer);
        timer = undefined;
        cooldown.textContent = '';
        input.disabled = submit.disabled = false;
        input.classList.remove('error');
        loadChallenge();
        input.focus();
        return;
      }
      cooldown.textContent = `Try again in ${remaining}s...`;
      remaining -= 1;
    };
    // Schedule before the first tick so a zero cooldown's immediate expiry clears this timer.
    window.clearInterval(timer);
    timer = window.setInterval(tick, 1000);
    tick();
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (submit.disabled) return;
    if (challenge.check(input.value)) {
      opts.onSolved();
      return;
    }
    opts.onFailed();
    input.classList.remove('error');
    void input.offsetWidth; // restart the shake animation
    input.classList.add('error');
    startCooldown();
  });

  root.addEventListener('click', (e) => {
    const action = (e.target as HTMLElement).closest('[data-action]')?.getAttribute('data-action');
    if (action === 'convert') opts.onConvert();
    if (action === 'close') opts.onCloseTab();
    if (action === 'settings') opts.onOpenSettings();
  });

  // Keep keystrokes away from the site's document-level hotkeys (space, k, j, f, m...).
  host.addEventListener('keydown', (e) => e.stopPropagation());
  host.addEventListener('keyup', (e) => e.stopPropagation());
  host.addEventListener('keypress', (e) => e.stopPropagation());

  root.addEventListener('keydown', (e) => {
    if (!(e instanceof KeyboardEvent) || e.key !== 'Tab') return;
    const focusable = [...root.querySelectorAll<HTMLElement>('input, button, a[href]')].filter(
      (el) => !(el as HTMLInputElement | HTMLButtonElement).disabled,
    );
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    const active = root.activeElement;
    if (e.shiftKey && (active === first || !active)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !active)) {
      e.preventDefault();
      first.focus();
    }
  });

  loadChallenge();
  // A fullscreen player sits in the top layer above any z-index, which would hide the overlay
  // while playback stays paused and input stays blocked.
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  document.documentElement.append(host);
  input.focus();

  return {
    host,
    destroy() {
      window.clearInterval(timer);
      host.remove();
    },
  };
}
