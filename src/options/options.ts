import '../shared/theme.css';
import '../shared/page.css';
import './options.css';
import { renderSupportLinks } from '../shared/links';
import { createQuickSettings } from '../shared/quick-settings';
import { WEEK } from '../shared/schedule';
import { changedFields, loadSettings, updateSettings, type AutoOff, type GateScope, type OffWindow, type Settings } from '../shared/settings';
import { SITE_IDS, SITES } from '../sites';

const form = document.querySelector<HTMLFormElement>('#settings')!;
const autoOffEnabled = form.elements.namedItem('autoOffEnabled') as HTMLInputElement;
const autoOffFields = document.getElementById('auto-off-fields')!;
const windowsList = document.getElementById('windows')!;

const NEW_WINDOW: OffWindow = { days: [1, 2, 3, 4, 5], start: '12:00', end: '13:00' };

function renderWindow(window: OffWindow) {
  const row = document.createElement('div');
  row.className = 'window';

  const days = Object.assign(document.createElement('fieldset'), { className: 'days' });
  days.setAttribute('aria-label', 'Days');
  for (const { day, label } of WEEK) {
    const wrapper = document.createElement('label');
    const box = Object.assign(document.createElement('input'), {
      type: 'checkbox',
      value: String(day),
      checked: window.days.includes(day),
    });
    wrapper.append(box, Object.assign(document.createElement('span'), { textContent: label }));
    days.append(wrapper);
  }

  const time = (field: 'start' | 'end', value: string) => {
    const input = Object.assign(document.createElement('input'), { type: 'time', value, required: true });
    input.dataset.field = field;
    return input;
  };
  const from = document.createElement('label');
  from.append('Off from ', time('start', window.start));
  const to = document.createElement('label');
  to.append('to ', time('end', window.end));

  const remove = Object.assign(document.createElement('button'), {
    type: 'button',
    className: 'icon remove',
    textContent: '✕',
    title: 'Remove this time',
  });
  remove.setAttribute('aria-label', 'Remove this time');
  remove.addEventListener('click', () => {
    row.remove();
    form.dispatchEvent(new Event('input'));
  });

  const times = Object.assign(document.createElement('div'), { className: 'row times' });
  times.append(from, to, remove);
  row.append(days, times);
  windowsList.append(row);
}

function readAutoOff(): AutoOff {
  const windows = [...windowsList.querySelectorAll<HTMLElement>('.window')].map((row) => ({
    days: [...row.querySelectorAll<HTMLInputElement>('.days input:checked')].map((b) => Number(b.value)),
    start: row.querySelector<HTMLInputElement>('[data-field="start"]')!.value,
    end: row.querySelector<HTMLInputElement>('[data-field="end"]')!.value,
  }));
  return { enabled: autoOffEnabled.checked, windows };
}

function validate(autoOff: AutoOff): string | null {
  if (!autoOff.enabled) return null;
  if (autoOff.windows.length === 0) return 'Add at least one time, or untick auto-off.';
  if (autoOff.windows.some((w) => w.days.length === 0)) return 'Each time needs at least one day.';
  return null;
}

const readScope = () => new FormData(form).get('scope') as GateScope;

const siteList = document.getElementById('site-list')!;

function renderSites(sites: Settings['sites']) {
  for (const id of SITE_IDS) {
    const { name, shortNoun } = SITES[id];
    const label = document.createElement('label');
    const box = Object.assign(document.createElement('input'), { type: 'checkbox', name: 'site', value: id, checked: sites[id] });
    label.append(box, ` ${name} ${shortNoun}`);
    siteList.append(label);
  }
}

const readSites = () =>
  Object.fromEntries(
    SITE_IDS.map((id) => [id, siteList.querySelector<HTMLInputElement>(`input[value="${id}"]`)!.checked]),
  ) as Settings['sites'];

async function init() {
  renderSupportLinks(document.querySelector('.support')!, { showQr: true });

  let settings = await loadSettings();
  const quick = createQuickSettings(settings, { autoOffHint: "You're inside one of your auto-off times below." });
  document.getElementById('sites')!.before(quick.status);
  document.getElementById('scope')!.after(quick.frequency, quick.challenge);

  renderSites(settings.sites);
  form.querySelector<HTMLInputElement>(`input[name="scope"][value="${settings.scope}"]`)!.checked = true;
  autoOffEnabled.checked = settings.autoOff.enabled;
  settings.autoOff.windows.forEach(renderWindow);

  const refresh = () => {
    autoOffFields.setAttribute('aria-disabled', String(!autoOffEnabled.checked));
    quick.refreshStatus({ ...settings, autoOff: readAutoOff() });
  };
  refresh();

  document.getElementById('add-window')!.addEventListener('click', () => {
    renderWindow(NEW_WINDOW);
    refresh();
  });
  form.addEventListener('input', refresh);
  form.querySelectorAll('input[name="scope"]').forEach((radio) =>
    radio.addEventListener('change', () => quick.setScope(readScope())),
  );

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const autoOff = readAutoOff();
    const saved = document.querySelector<HTMLElement>('.saved')!;
    const error = validate(autoOff);
    if (error) {
      saved.textContent = error;
      return;
    }
    const values = { ...quick.read(), sites: readSites(), scope: readScope(), autoOff };
    await updateSettings(changedFields(settings, values));
    settings = { ...settings, ...values };
    saved.textContent = 'Saved ✓';
    setTimeout(() => (saved.textContent = ''), 1500);
  });
}

void init();
