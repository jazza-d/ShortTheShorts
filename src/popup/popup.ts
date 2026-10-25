import '../shared/theme.css';
import '../shared/page.css';
import './popup.css';
import { renderSupportLinks } from '../shared/links';
import { createQuickSettings } from '../shared/quick-settings';
import { changedFields, loadSettings, updateSettings } from '../shared/settings';
import { estimateMinutesSaved, getStats } from '../shared/stats';

const form = document.querySelector<HTMLFormElement>('#settings')!;

async function init() {
  renderSupportLinks(document.querySelector('footer')!);
  document.querySelectorAll('[data-action="open-settings"]').forEach((el) =>
    el.addEventListener('click', () => chrome.runtime.openOptionsPage()),
  );

  const [settings, stats] = await Promise.all([loadSettings(), getStats()]);

  const quick = createQuickSettings(settings, {
    autoOffHint: 'Switched off by one of your auto-off times. Change this in ⚙️ Settings.',
  });
  const statsSection = document.getElementById('stats')!;
  statsSection.before(quick.status);
  statsSection.after(quick.frequency, quick.challenge);

  document.getElementById('viewed-label')!.textContent = settings.scope === 'all' ? 'Videos viewed' : 'Shorts viewed';
  const setStat = (key: string, value: string) => {
    document.querySelector(`[data-stat="${key}"]`)!.textContent = value;
  };
  setStat('videosViewed', String(stats.videosViewed));
  setStat('gatesSolved', String(stats.gatesSolved));
  setStat('minutesSaved', `~${estimateMinutesSaved(stats)} mins`);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const values = quick.read();
    await updateSettings(changedFields(settings, values));
    Object.assign(settings, values);
    const saved = document.querySelector<HTMLElement>('.saved')!;
    saved.textContent = 'Saved ✓';
    setTimeout(() => (saved.textContent = ''), 1500);
  });
}

void init();
