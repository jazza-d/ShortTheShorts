import { CHALLENGES } from '../challenges';
import { sendMessage } from '../shared/messages';
import { isAutoOff } from '../shared/schedule';
import { loadSettings, onSettingsChanged, type Settings } from '../shared/settings';
import type { StatField } from '../shared/stats';
import { siteForHostname, type SiteAdapter, type VideoRef } from '../sites';
import { GateTracker } from './gate';
import { watchNavigation } from './navigation';
import { showOverlay } from './overlay/overlay';
import { blockScrollNavigation, holdPlayback } from './player';

interface ActiveGate {
  video: VideoRef;
  teardown(resume: boolean): void;
}

// Survives the full page load that "Convert" triggers, so the user isn't gated twice for one video.
const PASSED_KEY = 'short-the-shorts:passed';

const stat = (field: StatField) => sendMessage({ type: 'stat', field });

async function main(site: SiteAdapter) {
  let settings: Settings = await loadSettings();
  const tracker = new GateTracker(settings.interval);
  let gate: ActiveGate | null = null;
  // Set when the user navigates away from an unsolved gate, so Back/Forward to the same (now
  // "seen") video, or on to the next one, can't skip the challenge.
  let gateOwed = false;

  const passed = sessionStorage.getItem(PASSED_KEY);
  if (passed) {
    tracker.markSeen(passed);
    sessionStorage.removeItem(PASSED_KEY);
  }

  const closeGate = (resume: boolean) => {
    gate?.teardown(resume);
    gate = null;
  };

  const openGate = (video: VideoRef) => {
    gateOwed = false;
    stat('gatesShown');
    const releasePlayback = holdPlayback(site, video.kind);
    const noun = settings.scope === 'all' && site.hasWatchPages ? 'Videos' : site.shortNoun;
    const convertUrl = site.convertUrl;
    const overlay = showOverlay({
      generate: () => CHALLENGES[settings.challengeType](settings.difficulty),
      contextLine: `${noun} watched this session: ${tracker.viewedThisSession}`,
      siteName: site.name,
      showConvert: video.kind === 'short' && convertUrl !== undefined,
      cooldownSeconds: settings.cooldownSeconds,
      onSolved: () => {
        stat('gatesSolved');
        closeGate(true);
      },
      onFailed: () => stat('gatesFailed'),
      onConvert: () => {
        if (!convertUrl) return;
        const current = gate?.video ?? video;
        stat('conversions');
        sessionStorage.setItem(PASSED_KEY, current.id);
        location.assign(convertUrl(current));
      },
      onCloseTab: () => {
        stat('tabsClosed');
        sendMessage({ type: 'closeTab' });
      },
      onOpenSettings: () => sendMessage({ type: 'openSettings' }),
    });
    const releaseScroll = blockScrollNavigation(overlay.host);

    gate = {
      video,
      teardown(resume) {
        releaseScroll();
        overlay.destroy();
        releasePlayback(resume);
      },
    };
  };

  const isGated = (video: VideoRef | null): video is VideoRef =>
    video !== null && (video.kind === 'short' || settings.scope === 'all');

  const handleUrl = (url: string) => {
    const video = site.parseVideo(new URL(url));

    if (!isGated(video)) {
      if (gate) gateOwed = true;
      closeGate(false);
      return;
    }
    if (!settings.enabled || !settings.sites[site.id] || isAutoOff(settings.autoOff)) return;

    // Already gated (e.g. user hit browser Back to another video): keep the gate up,
    // but make "Convert" target the video that's now in the URL.
    if (gate) {
      gate.video = video;
      return;
    }

    const { isNewView, shouldGate } = tracker.onVideoViewed(video.id);
    if (isNewView) stat('videosViewed');
    if (shouldGate || gateOwed) openGate(video);
  };

  onSettingsChanged((next) => {
    settings = next;
    tracker.setInterval(next.interval);
    if (!next.enabled || !next.sites[site.id]) closeGate(true);
  });

  watchNavigation(site, handleUrl);
  handleUrl(location.href);
}

const site = siteForHostname(location.hostname);
if (site) void main(site);
