# Technical Specification
## Product: 🧠💡 Short the Shorts (YouTube Shorts & Instagram Reels Chrome Extension)

| | |
| :--- | :--- |
| **Status** | Draft (spike) |
| **Companion doc** | [`user_design_specification.md`](./user_design_specification.md) |
| **Target** | Chrome (desktop) 120+, Manifest V3 |

---

## 1. Summary

A Manifest V3 Chrome extension that watches `www.youtube.com` for Shorts views (and optionally regular `/watch` videos) and, according to a user-configured interval (and outside any user-defined auto-off times), pauses playback and shows a full-viewport gate modal ("Mindful Pause") containing a short puzzle at the chosen difficulty. Solving it resumes the video. Failing it starts a 3-second cooldown, then shows a new puzzle. Escape hatches: convert a Short to a standard `/watch?v=` page, or close the tab.

The same gate runs on `www.instagram.com` for Reels (the Reels tab and `/reel/` links). Everything site-specific lives in a small per-site adapter (6.13), so the rest of the extension doesn't know which site it's on.

Everything runs locally. There is no backend, no network requests, no analytics, and the only permission is `storage`.

### Goals
- Reliable gating across YouTube's SPA navigation (home → Shorts, swipe → next Short, back/forward).
- Gate cannot be trivially bypassed by scrolling, arrow keys, or YouTube's autoplay.
- UI is isolated from YouTube's CSS and survives YouTube DOM re-renders.
- Small, dependency-free runtime bundle (the content script is about 4 KB gzipped).
- Always free. Optional support (Ko-fi tip / QR) and share links, with no paywall.

### Non-goals (for now)
- Mobile web (`m.youtube.com`), the YouTube/Instagram apps, or non-Chromium browsers.
- Instagram Reels in the home feed, Stories, or DMs (the URL doesn't change there). TikTok (next adapter candidate; its feed likely needs play-based detection).
- Tamper-resistance against a determined user (they can always disable the extension). This is a *speed bump*, not a lock.
- Gating previews that autoplay inline on the home feed/search results (only `/shorts/:id` and `/watch?v=` pages).

---

## 2. Architecture

```
┌─────────────── www.youtube.com / www.instagram.com tab ─────────────────────┐
│                                                                              │
│  Content script (isolated world)                                             │
│  ┌──────────────┐  url   ┌─────────────┐ shouldGate ┌──────────────────────┐ │
│  │ navigation.ts├───────►│ index.ts    ├───────────►│ overlay/overlay.ts   │ │
│  │ (SPA watcher)│        │ (controller)│            │ (Shadow DOM modal)   │ │
│  └──────────────┘        │             │◄───────────┤ solved/failed/escape │ │
│                          │  gate.ts    │            └──────────────────────┘ │
│                          │  (counter)  │  pause/    ┌──────────────────────┐ │
│                          │             ├───resume──►│ player.ts            │ │
│                          └──────┬──────┘  block     │ (video + input lock) │ │
│                                 │                   └──────────────────────┘ │
└─────────────────────────────────┼────────────────────────────────────────────┘
                                  │ chrome.runtime.sendMessage
                                  ▼                         { stat } | { closeTab }
                      ┌──────────────────────┐
                      │ Background SW        │── chrome.tabs.remove(sender.tab.id)
                      │ (serialised writes)  │
                      └──────────┬───────────┘
                                 ▼
               chrome.storage.local  (daily stats)
               chrome.storage.sync   (settings) ◄──── Popup + Settings page (read/write)
                                                ────► content script (onChanged)
```

| Context | Responsibility |
| :--- | :--- |
| **Content script** | Detect video views, check scope/auto-off/interval, render overlay, lock playback/scrolling, emit stat events. |
| **Background service worker** | Serialise stat writes; close the tab on request. Stateless otherwise. |
| **Popup** | Quick settings (on/off, frequency, challenge, level), today's stats, ⚙️ / "All settings" link → Settings page. |
| **Settings page** (`options_ui`) | **Every** setting: the quick settings plus gate scope and auto-off times, and support/share with optional QR. Also opened from the gate's ⚙️. |

---

## 3. Tech Stack

| Concern | Choice | Rationale |
| :--- | :--- | :--- |
| Language | TypeScript (strict, `noUncheckedIndexedAccess`) | Type-safe messaging and storage schemas. |
| Bundler | Vite + `@crxjs/vite-plugin` | Manifest-driven multi-entry builds, HMR for popup/content in dev, `?inline` CSS imports for Shadow DOM. |
| UI | Vanilla DOM + CSS | Three small surfaces; a framework would be most of the bundle. Revisit if Phase 3's dashboard gets complex. |
| Tests | Vitest | Same transform pipeline as Vite; zero config. |
| Runtime deps | None | |

---

## 4. Repository Layout

```
ShorterShorts/
├── docs/
│   ├── user_design_specification.md   # UX/UI spec (source of truth for behaviour)
│   └── tech_spec.md                    # this document
├── src/
│   ├── background/
│   │   └── index.ts                    # MV3 service worker: stat queue + closeTab
│   ├── sites/                          # per-site adapters (pure, no DOM), see 6.13
│   │   ├── types.ts                    # SiteAdapter, SiteId, VideoRef
│   │   ├── index.ts (+ .test.ts)       # SITES registry, siteForHostname
│   │   ├── youtube.ts (+ .test.ts)     # parseVideo, toWatchUrl, selectors
│   │   └── instagram.ts (+ .test.ts)   # parseVideo for /reels/ and /reel/
│   ├── content/
│   │   ├── index.ts                    # controller: picks the site, wires navigation → gate → overlay
│   │   ├── gate.ts (+ .test.ts)        # GateTracker: pure "should we gate?" logic
│   │   ├── navigation.ts               # SPA URL-change detection (site events + fallbacks)
│   │   ├── player.ts                   # find/pause/resume <video>, block swipe input
│   │   └── overlay/
│   │       ├── overlay.ts              # Shadow DOM modal, cooldown, focus trap
│   │       └── overlay.css
│   ├── challenges/
│   │   ├── types.ts                    # Challenge / ChallengeGenerator interfaces
│   │   ├── index.ts                    # registry: ChallengeType → generator
│   │   ├── math.ts (+ .test.ts)        # easy/medium/hard arithmetic incl. fractions
│   │   └── anagram.ts (+ .test.ts)     # 4/6/8-letter word unscramble
│   ├── popup/                          # toolbar popup: quick settings + stats
│   │   ├── index.html
│   │   ├── popup.ts
│   │   └── popup.css
│   ├── options/                        # ⚙️ Settings page: scope, auto-off times, support
│   │   ├── index.html
│   │   ├── options.ts
│   │   └── options.css
│   └── shared/
│       ├── settings.ts                 # Settings schema, defaults, storage.sync I/O
│       ├── schedule.ts (+ .test.ts)    # isInWindow, isAutoOff, gatingStatus
│       ├── stats.ts                    # DailyStats schema, storage.local I/O
│       ├── messages.ts                 # typed content ↔ background messages
│       ├── links.ts                    # support/share URLs (fill in), share helper
│       ├── theme.css                   # design tokens (colours, radii, font)
│       ├── quick-settings.ts (+ .css)  # controls shared by popup + settings page
│       └── page.css                    # base styles for popup + settings page
├── manifest.config.ts                  # MV3 manifest (typed, via CRXJS)
├── vite.config.ts
├── tsconfig.json
└── package.json
```

**Conventions:** tests are colocated as `*.test.ts`. Anything touching `chrome.*` or a site's DOM stays out of `gate.ts`, `challenges/`, `shared/schedule.ts`, and `sites/` so those remain unit-testable without mocks.

---

## 5. Manifest & Permissions

```ts
permissions: ['storage']
content_scripts: [{ matches: ['https://www.youtube.com/*', 'https://www.instagram.com/*'], run_at: 'document_idle' }]
options_ui: { page: 'src/options/index.html', open_in_tab: true }
```

- **Why match whole sites, not `/shorts/*` or `/reels/*`?** Content scripts are only injected on full page loads. Navigating Home → Shorts is an SPA transition, so a `/shorts/*`-only match would miss most entries. The same applies to Instagram.
- **Static matches, not optional host permissions.** The install warning lists both sites. The alternative (install with YouTube only, request Instagram from Settings via `chrome.permissions.request` + `chrome.scripting.registerContentScripts`) adds the `scripting` permission and more moving parts. Worth revisiting when a third site is added. Note that adding a site to `matches` in an update makes Chrome disable the extension for existing users until they accept the new warning.
- **No `tabs` permission needed.** `chrome.tabs.remove(sender.tab.id)` works without it; `tabs` is only required to read URLs/titles.
- **No host permissions** beyond the content-script match. This keeps the Chrome Web Store review light and the install warning minimal ("Read and change your data on www.youtube.com and www.instagram.com").
- **No `alarms` permission for auto-off.** Auto-off times are checked on every video view, which is the only moment they matter, so nothing needs to wake up at 17:00.
- **No `clipboardWrite` permission for Share.** `navigator.clipboard.writeText` works from extension pages on a user click.

---

## 6. Component Design

### 6.1 Navigation detection (`content/navigation.ts`)

Content scripts run in an isolated world and cannot monkey-patch the page's `history.pushState`. We listen to three independent signals and dedupe on `location.href`:

1. The adapter's `navigationEvents` on `document`. For YouTube that's `yt-navigate-finish`, its own SPA event and the fast path. Instagram has none.
2. `popstate` for browser back/forward.
3. `MutationObserver` on the adapter's `navigationRoot` (`#content` on YouTube, `document.body` otherwise), subtree. This is the fallback for transitions without an event, and the main signal on Instagram. The callback is a single string compare, so the cost is negligible even under heavy mutation.

Every URL change is passed to the controller, which calls the adapter's `parseVideo()`. It returns `{ id, kind: 'short' | 'watch' }`, or `null` for any other page (see 6.13).

### 6.2 Gate decision (`content/gate.ts`)

`GateTracker` is a pure class holding per-tab, in-memory state:

- `seen: Set<videoId>`: a video counts only on its first view in this tab. Swiping back to an already-seen video is free. Shorts and regular videos share one counter.
- `sinceLastGate`: incremented per new view; gate fires when it reaches `interval` and then resets.
- `setInterval()` clamps the counter so lowering the interval (e.g. 10 → 3) gates on the next new view instead of overshooting.
- `markSeen(id)` records a video without counting it. It's used after "Convert" (see 6.3).

State is intentionally per-tab and resets on reload. See open question Q2.

### 6.3 Controller (`content/index.ts`)

On startup, `siteForHostname(location.hostname)` picks the adapter; the script does nothing on an unknown host.

```
on URL change:
  not a gated page          → tear down any gate (don't resume video)
    (no video, or a /watch video while scope = 'shorts')
  disabled, site turned off, or in an auto-off time → no-op
  gate already open         → keep it; retarget "Convert" to the new id
  else                      → tracker.onVideoViewed(id)
                              new view?  → stat(videosViewed)
                              shouldGate → openGate(video)
```

`openGate` emits `gatesShown`, calls `holdPlayback(kind)`, mounts the overlay with `generate = () => CHALLENGES[type](difficulty)`, and calls `blockScrollNavigation(overlay.host)`. Overlay callbacks map to:

| Event | Effect |
| :--- | :--- |
| Solved | `gatesSolved`++, tear down, resume active video |
| Failed | `gatesFailed`++ (overlay handles cooldown itself) |
| Convert (only when the adapter has `convertUrl`, i.e. YouTube Shorts) | `conversions`++, write the id to `sessionStorage["short-the-shorts:passed"]`, then `location.assign(site.convertUrl(video))`. After the full page load, the new content script reads the key and calls `tracker.markSeen(id)`, so with scope = "All of YouTube" the user isn't gated twice for the same video. |
| Close tab | `tabsClosed`++, message background → `chrome.tabs.remove` |
| ⚙️ Settings | Message background → `chrome.runtime.openOptionsPage()`. Opens in a new tab. The gate stays up. |

Settings changes arrive live via `chrome.storage.onChanged`. Disabling the extension, or turning off the current site, closes any open gate and resumes playback.

### 6.4 Playback & input lock (`content/player.ts`)

**Pausing.** YouTube calls `play()` aggressively (autoplay, preloading the next Short), so a one-off `pause()` is not enough. `holdPlayback()` pauses every `<video>`, then registers a **capture-phase** `play` listener on `document` that re-pauses any video that starts. `play` doesn't bubble but does traverse the capture phase. Release removes the listener and optionally resumes the active Short.

**Active video.** Each adapter has an ordered selector list per video kind (`videoSelectors`), so they're easy to update when a site ships DOM changes. YouTube's:
```
short: ytd-reel-video-renderer[is-active] video, #shorts-player video, ytd-shorts video
watch: #movie_player video.html5-main-video, #movie_player video
```
When no selector matches, `findActiveVideo` falls back to the `<video>` with the largest on-screen area. Instagram has no selectors at all (its class names are obfuscated and change often), so it always uses this fallback.

**Blocking swipes.** `blockScrollNavigation()` adds capture-phase, non-passive `wheel`, `touchmove`, and `keydown` listeners on `window`. Events whose `composedPath()` includes the overlay host pass through untouched. Others are `preventDefault()` + `stopImmediatePropagation()`. For `keydown`, only navigation keys (`↑ ↓ PgUp PgDn Space j k`) are blocked so browser shortcuts still work.

**Hotkey isolation.** The overlay host stops `keydown/keyup/keypress` propagation in the **bubble** phase. This stops YouTube's document-level hotkeys (`k` = play, `f` = fullscreen, etc.) from firing while the user types, without interfering with the overlay's own handlers (which run first, inside the shadow tree).

### 6.5 Overlay (`content/overlay/overlay.ts`)

- **Mount point.** A custom element `<short-the-shorts-gate>` is appended to `document.documentElement`, *outside* YouTube's app tree, so Polymer/Lit re-renders can't remove it.
- **Isolation.** A closed Shadow DOM with styles from `theme.css?inline` + `overlay.css?inline`. `:host { all: initial }` blocks inherited YouTube styles (custom properties still flow, by spec).
- **Positioning.** `position: fixed; inset: 0; z-index: 2147483647`. *Deviation from the UX doc:* the design shows the modal over the Shorts player container. Full-viewport is simpler, immune to player resizing, and also blocks clicks on the sidebar or next-Short arrows. Revisit if it feels too heavy.
- **Accessibility.** `role="dialog"`, `aria-modal`, labelled/described-by, input auto-focused, Tab/Shift+Tab focus trap over enabled controls, `aria-live` for the challenge and the cooldown text, shake animation disabled under `prefers-reduced-motion`.
- **Cooldown.** On a wrong answer: shake, disable input and submit, show `Try again in Ns...` with a 1s tick (`cooldownSeconds`, default **3**). On expiry: re-enable, **load a fresh challenge**, refocus. Regenerating stops users from grinding through guesses on the same prompt.
- **Convert button** is removed when the gate is on a `/watch` page or the site has no `convertUrl` (Instagram).
- **Close button** reads "Close <site name> Tab", from the adapter's `name`.
- **Safe rendering.** The static template is parsed once. All dynamic text (prompt, context line) is set with `textContent`, so there's no injection surface.

### 6.6 Challenge engine (`src/challenges/`)

```ts
interface Challenge {
  prompt: string;
  inputHint: string;
  inputMode: 'numeric' | 'text';   // drives mobile/virtual keyboards
  check(answer: string): boolean;
}
type ChallengeGenerator = (difficulty: 'easy' | 'medium' | 'hard', random?: () => number) => Challenge;
```

Generators are pure and take an injectable RNG for deterministic tests. To add a challenge type: implement a generator for all three levels, register it in `CHALLENGES`, `CHALLENGE_LABELS`, and `DIFFICULTY_HINTS`, and add the key to `CHALLENGE_TYPES` in `settings.ts`.

**Math by level.** Each level picks randomly from a pool of problem types. All results are non-negative and divisions are exact (the dividend is built as divisor × quotient).

| Level | Problem pool |
| :--- | :--- |
| Easy | `a ± b`, 10–99 |
| Medium | `a ± b` (10–99), `a × b` (2–12 times tables), `a ÷ b` (divisor and quotient 2–12) |
| Hard | `a ± b` (100–999), `a × b` (12–25 × 3–9), `a ÷ b` (divisor 3–12, quotient 12–25), proper fractions `p/q ± r/s` with q, s in 2–6 |

Every answer is stored as a fraction `{n, d}`. The checker accepts whole numbers and **any equivalent fraction** (`7/12`, `14/24`; `1` or `2/2` when the result is one), and rejects a zero denominator. Fraction problems switch the input to `inputMode: 'text'` so the `/` key is available on virtual keyboards.

**Anagram by level.** 4 / 6 / 8-letter word lists. Every word must have *no other valid anagram* (e.g. `garden`/`danger` and `lamp`/`palm` are excluded), or users would type a real word and be rejected. A test enforces that no two words in a level are anagrams of each other.

| Type | Phase | Rules |
| :--- | :--- | :--- |
| `math` | MVP | See above. |
| `anagram` | 2 | See above. Scramble guaranteed ≠ original. Case-insensitive. |
| `affirmation` | 2 | Type a displayed intention sentence exactly (TBD, pending product decision). |
| `riddle` | 3 | Curated list with accepted-answer aliases (TBD). |

### 6.7 Background service worker (`background/index.ts`)

MV3 workers are ephemeral. This one holds no state that matters across restarts. Its jobs:

1. **Stat queue.** Each `{ type: 'stat', field }` message is chained onto a single promise, so read-modify-write increments from multiple tabs never interleave. If the worker is killed mid-queue, at most a few increments are lost, which is acceptable for an estimate.
2. **Close tab.** `chrome.tabs.remove(sender.tab.id)`. A content script can't `window.close()` a tab it didn't open.
3. **Open settings.** `chrome.runtime.openOptionsPage()` for the gate's ⚙️ button. That API isn't available to content scripts.

### 6.8 Shared quick settings (`shared/quick-settings.ts`)

The status toggle, friction frequency, challenge type, and level slider appear in **both** the popup and the settings page. `createQuickSettings(settings, { autoOffHint })` builds them once and returns three sections (`status`, `frequency`, `challenge`) that each page inserts where it wants, plus:

- `read()` returns `{ enabled, interval, challengeType, difficulty }` from the controls.
- `refreshStatus(base)` re-renders `ACTIVE` / `PAUSED` / `AUTO-OFF` via `gatingStatus({ ...base, ...read() })`, so a page can pass unsaved values (e.g. the settings page's auto-off rows).
- `setScope(scope)` relabels the frequency options ("Every 3 Shorts/Reels" ↔ "Every 3 videos") and keeps the selection.

Options come from the shared constant arrays, so they can't drift from the schema. The **Level** slider is an `<input type="range" min=0 max=2>` mapped to `DIFFICULTIES`, and its hint text comes from `DIFFICULTY_HINTS[challengeType][level]`.

### 6.9 Popup (`popup/`)

Order: status, today's stats, frequency, challenge/level, Save, then an **"⚙️ All settings (auto-off times & more) →"** text link. The header also has a ⚙️ icon. Both call `chrome.runtime.openOptionsPage()`. The text link exists because a lone gear icon is easy to miss.

Writes on **Save** using `updateSettings(quick.read())`. `updateSettings` re-reads storage and merges only the given fields, so the popup and the settings page can't overwrite each other's changes. The content script picks up the change via `storage.onChanged` with no reload needed.

### 6.10 Settings page (`options/`)

Opens in a tab (`options_ui.open_in_tab`). It's reachable from the popup (⚙️ and the text link) and from the gate's ⚙️. It contains **every** setting, so users who never open the toolbar popup can still change everything:

- **Status** toggle (shared).
- **Sites.** One checkbox per adapter in `SITES` ("YouTube Shorts", "Instagram Reels"), all on by default.
- **Where to gate.** Radio for `scope: 'shorts' | 'all'` ("Shorts and Reels only" / "All videos"). `'all'` only adds pages on sites with `hasWatchPages` (YouTube `/watch`). Changing it calls `quick.setScope()` immediately.
- **Friction frequency** and **Challenge type / Level** (shared).
- **Auto-off times.** The gate is on by default. An enable checkbox, then a list of off-windows. Each row has Mon–Sun day chips (visually-hidden checkboxes, still keyboard-focusable), "Off from / to" `<input type="time">`, and a ✕ remove button. "+ Add another time" appends a row (Mon–Fri 12:00–13:00 as a starting point). The status at the top is recomputed from the *unsaved* rows on every input. Saving with auto-off on is rejected inline if there are no rows, or if any row has no days.
- **Support & share.** See 6.12.

One Save button writes all of it: `updateSettings({ ...quick.read(), sites, scope, autoOff })`.

### 6.11 Auto-off logic (`shared/schedule.ts`)

The gate is **on unless** the current time falls inside any off-window. All functions are pure and unit-tested.

- `isInWindow(window, now)`: `false` unless today is one of the window's days. Then:
  - `start < end` (e.g. 12:00–13:00): off within `[start, end)`.
  - `start === end`: off all day.
  - `start > end` (e.g. 17:00–09:00): off from `start` to midnight **and** from midnight to `end`, *on the same calendar day*. So "Mon–Fri 17:00–09:00" covers Monday 07:00 and Friday 18:00, but not Saturday 07:00. This is deliberate: each day chip means "on this day", with no hidden spill-over into the next day.
- `isAutoOff(autoOff, now)`: `autoOff.enabled && windows.some(isInWindow)`.
- `gatingStatus(settings, now)`: `'paused'` (master toggle off), `'auto-off'`, or `'active'`.

Default `windows` = `SUGGESTED_OFF_WINDOWS`: Mon–Fri 17:00–09:00 plus Sat–Sun all day ("off after work and at weekends"). They're shown greyed out until the user ticks the checkbox.

Uses the browser's local time zone. The content script checks it on each new video view. A gate that's already open stays open if an off-window starts mid-gate.

### 6.12 Support & share (`shared/links.ts`)

```ts
export const LINKS = {
  support: 'https://ko-fi.com/jazzad',
  supportQrImage: '', // file in public/, e.g. 'support-qr.png' (SnapScan, Zapper, PayPal QR...)
  share: '',          // override; defaults to the Chrome Web Store listing
};
```

- **Empty values hide their button**, so the extension can ship before accounts exist.
- **Share URL** defaults to `https://chromewebstore.google.com/detail/<chrome.runtime.id>`. A store-installed extension's runtime ID *is* its store ID, so this is correct with no configuration once published. (Unpacked/dev installs have a different ID.)
- **Share action:** `navigator.share()` (native share sheet) when available, otherwise the blurb and URL are copied to the clipboard with a "✓ Link copied" confirmation.
- **Where:** the tip and share links show on the gate (small, under the escape hatches) and on the settings page. They are not in the popup.
- **QR** is shown only on the settings page (it's too large for the gate). It's a static image you drop into `public/`, not generated at runtime, so no QR library is needed.
- Links open via `<a target="_blank" rel="noopener">`. No remote code or tracking pixels.

### 6.13 Site adapters (`src/sites/`)

Everything site-specific sits behind one interface. Adapters are plain data plus pure functions with no DOM access, so they're unit-tested without mocks. `content/navigation.ts` and `content/player.ts` do the DOM work using the adapter's data.

```ts
interface SiteAdapter {
  id: 'youtube' | 'instagram';
  name: string;                 // "YouTube" → "Close YouTube Tab"
  shortNoun: string;            // "Shorts" / "Reels" → gate context line
  hostnames: string[];
  parseVideo(url: URL): VideoRef | null;
  hasWatchPages: boolean;       // does scope 'all' add anything here?
  convertUrl?(video): string;   // omitted → no Convert button
  navigationEvents: string[];   // site SPA events, e.g. 'yt-navigate-finish'
  navigationRoot?: string;      // MutationObserver root (default body)
  videoSelectors: Partial<Record<'short' | 'watch', string[]>>;
}
```

| | YouTube | Instagram |
| :--- | :--- | :--- |
| Gated URLs | `/shorts/:id`; `/watch?v=:id` when scope = all | `/reels/:code/` (Reels tab; URL updates per Reel), `/reel/:code/` and `/:user/reel/:code/` |
| Not gated | Inline previews on home/search | Reels in the home feed, Stories, DMs (URL doesn't change); `/p/` posts |
| Navigation signal | `yt-navigate-finish`, then fallbacks | `popstate` + `MutationObserver` on `body` |
| Active video | Selectors, then most-visible `<video>` | Most-visible `<video>` |
| Convert | → `/watch?v=:id` | Hidden |

Instagram shortcodes are matched as 6+ characters of `[A-Za-z0-9_-]`, which also excludes pages like `/reels/audio/:id/`.

**Adding a site:** write `src/sites/<site>.ts` (+ tests), add its id to `SITE_IDS`, register it in `SITES`, and add its origin to `content_scripts.matches`. The settings page picks it up automatically.

---

## 7. Data Model

### Settings: `chrome.storage.sync["settings"]`
Synced across the user's Chrome profiles (well under the 8 KB/item quota).

```ts
interface Settings {
  enabled: boolean;                       // default true
  sites: { youtube: boolean; instagram: boolean }; // default all true
  scope: 'shorts' | 'all';                // default 'shorts'
  interval: 1 | 3 | 5 | 10;               // default 1 (every video)
  challengeType: 'math' | 'anagram';      // default 'math'
  difficulty: 'easy' | 'medium' | 'hard'; // default 'easy'
  cooldownSeconds: number;                // default 3 (not exposed in UI)
  autoOff: {
    enabled: boolean;                     // default false → gate always on
    windows: Array<{
      days: number[];                     // Date.getDay() values (0 = Sun)
      start: string;                      // "HH:MM"
      end: string;                        // "HH:MM"
    }>;                                   // default SUGGESTED_OFF_WINDOWS (see 6.11)
  };
}
```
Reads always merge over `DEFAULT_SETTINGS` (including nested merges for `sites` and `autoOff`, so a new site defaults to on for existing users), so adding a field is backwards-compatible without a migration. A window is about 60 B, so even dozens fit comfortably in the 8 KB sync item quota.

### Daily stats: `chrome.storage.local["stats:YYYY-MM-DD"]`
Keyed by the user's **local** date, so "today" matches their wall clock.

```ts
interface DailyStats {
  date: string;
  videosViewed: number;  gatesShown: number;   gatesSolved: number;
  gatesFailed: number;   conversions: number;  tabsClosed: number;
}
```
**Retention:** unbounded in the spike. Each day is about 150 B, so that's roughly 55 KB per year, well under the 10 MB local quota. Add pruning (>90 days) with the Phase 3 dashboard.

**"Time saved (est.)":** currently `tabsClosed × 5 min`, a placeholder (see Q1).

### Messages: `content → background`
```ts
type Message = { type: 'stat'; field: StatField } | { type: 'closeTab' } | { type: 'openSettings' };
```
Fire-and-forget. Send failures (worker restarting, orphaned content script after an extension reload) are swallowed.

---

## 8. Edge Cases

| Scenario | Behaviour |
| :--- | :--- |
| Land directly on `/shorts/:id` (fresh load) | Controller runs `handleUrl(location.href)` on startup. |
| Home → Shorts via SPA | Caught by `yt-navigate-finish` / MutationObserver. |
| Swipe while gated | Blocked by input lock. If it somehow navigates (e.g. Back button), the gate stays and "Convert" retargets. |
| Leave Shorts while gated (Back to Home) | Gate torn down, video **not** resumed. The gate is still owed: the next gated video (including Forward to the same one) re-opens it. |
| Swipe back to an already-seen Short | Not counted, not gated. |
| Page reload during cooldown | Cooldown lost, fresh challenge. Accepted (friction, not security). See Q3. |
| Multiple YouTube tabs | Independent counters per tab. Stats aggregated safely via the background queue. |
| Extension updated/reloaded with YouTube open | Old content script is orphaned and its messages fail silently. User must reload the tab for gating to resume. |
| YouTube changes DOM / selectors | Gate still appears (URL-based), but pause may miss. Mitigated by the play-capture listener pausing *any* video and the most-visible-video fallback. Update `youtube.videoSelectors`. |
| Instagram: scroll the Reels tab | Each Reel changes the URL to `/reels/:code/`, caught by the MutationObserver. |
| Instagram: open a Reel from the feed (modal) | URL becomes `/reel/:code/` → gated. Closing the modal returns to `/` → gate torn down. |
| Instagram: Reel playing inline in the home feed | Not gated (URL unchanged). Known limitation. |
| Instagram site turned off while gated | Gate closes, video resumes. |
| User toggles "disabled" while gated | Gate closes, video resumes. |
| Convert a Short with scope = "All of YouTube" | The resulting `/watch` page is not gated again (sessionStorage hand-off). |
| Watch-page autoplay moves to the next video (scope = all) | Counts as a new view and can trigger a gate. This is intended. |
| An auto-off time starts while a gate is open | Gate stays until solved/escaped. The next video isn't gated. |
| Overlapping auto-off times | Fine: off if *any* window matches. |
| Scope switched to "Shorts only" while gated on a `/watch` page | The gate stays until the next navigation, which tears it down. |

---

## 9. Testing Strategy

| Layer | Tooling | Coverage |
| :--- | :--- | :--- |
| Pure logic | Vitest | `GateTracker`, challenge generators at every level (property-style loops checked against an independent evaluator), auto-off windows (daytime, "after X / before Y", all-day, suggested defaults), site adapters' URL parsing and host lookup. **In place (33 tests).** |
| DOM (overlay, player) | Vitest + `happy-dom` | Focus trap, cooldown timing (fake timers), submit/escape callbacks, play-event re-pausing. *Next.* |
| Storage/messaging | Vitest + a small in-memory `chrome.storage` fake | Settings defaults merge, stat queue serialisation. *Next.* |
| End-to-end | Playwright with the unpacked `dist/` loaded via `--load-extension` | Load a real Short, assert overlay, solve, assert resume; SPA navigation path. Run nightly/manual (hits live YouTube, so expect flakiness). *Phase 2.* |
| Manual QA checklist | `docs/` | Selector drift check against live YouTube, and Reels-tab URL behaviour on live Instagram (logged in), before each release. |

---

## 10. Build, Dev & Release

```bash
npm install
npm run dev        # Vite + CRXJS dev build in dist/ with HMR
npm test
npm run build      # typecheck + production build → dist/
```

**Load locally:** `chrome://extensions` → Developer mode → *Load unpacked* → select `dist/`.

**Release:** bump `version` in `package.json` (the manifest reads it), `npm run build`, zip `dist/`, upload to the Chrome Web Store. CI (GitHub Actions) should run `typecheck`, `test`, and `build` on every PR and attach the zip as an artifact on tags. *Not yet set up.*

**Icons:** `assets/icon-source.png` (brain + switched-on light bulb) → `scripts/make-icons.py` (Pillow) rounds the corners transparent and writes `public/icons/icon-{16,32,48,128}.png`, which Vite copies to `dist/icons/`. If the 16px toolbar icon reads poorly, consider a simplified variant without the ring.

**Still needed before store submission:** store listing assets (screenshots, 440×280 promo tile), a privacy policy stating no data is collected or transmitted, and (optionally) a support QR image in `src/shared/links.ts`.

---

## 11. Roadmap Mapping

| UX roadmap item | Status in spike |
| :--- | :--- |
| **P1** MV3 + local DOM injection | ✅ |
| **P1** Math generator (add/subtract) | ✅ |
| **P1** Gate on every Short | ✅ (default `interval: 1`) |
| **P1** Redirect to standard player | ✅ |
| **P2** Popup: interval 1/3/5/10 | ✅ |
| **P2** Word Unscramble | ✅ |
| **P2** Difficulty slider (easy/medium/hard) | ✅ |
| **P2** Settings page (⚙️): scope, auto-off times | ✅ |
| **P2** Support / share links | ✅ (links to fill in) |
| **P2** Type Affirmation | ⬜ (pending decision) |
| **P2** Daily local stats | ✅ |
| **P3** Custom challenge lists | ⬜ |
| **P3** Local analytics dashboard | ⬜ (settings page reading `stats:*` keys) |
| — Per-site adapters + Instagram Reels | ✅ |
| — TikTok | ⬜ (needs play-based detection) |
| — 10-continuous-minutes trigger (persona: Mindful Professional) | ⬜ (see Q4) |

---

## 12. Risks

| Risk | Likelihood | Mitigation |
| :--- | :--- | :--- |
| YouTube DOM/selector changes break pause or detection | High (ongoing) | URL-based detection, any-video pause fallback, selectors centralised, E2E smoke test. |
| `yt-navigate-finish` renamed/removed | Medium | MutationObserver + popstate fallbacks already in place. |
| Instagram stops updating the URL per Reel, or changes the `/reels/` paths | Medium | Adapter is isolated and tested; would need play-based detection (a new `<video>` starting), the same approach planned for TikTok. |
| YouTube plays audio through a non-`<video>` path | Low | Monitor; would need muting via the player API in the main world. |
| Chrome Web Store flags "blocking" behaviour | Low | Single-purpose description, minimal permissions, no remote code. |

---

## 13. Open Questions

1. **"Time saved" formula.** The UX mock shows 4 gates solved → ~25 min. Do we credit only tab closes, or also conversions and abandoned gates (shown − solved − closes)? We need a defensible heuristic, or else drop the stat.
2. **Counter scope.** Should "every N Shorts" count per tab (current), per browser session (`chrome.storage.session`), or per day? Per-day is stickier but makes the first Short of the morning feel random.
3. **Persist cooldown across reloads?** Less pressing now that the cooldown is 3 seconds; probably not worth it.
4. **Time-based trigger.** Persona 2 wants "after 10 continuous minutes". Define "continuous": wall clock on `/shorts/*`, or video play time? This needs a new trigger type in `Settings` and `GateTracker`.
5. **Overlay scope.** Is full-viewport acceptable, or must it sit only over the player as drawn?
6. **Accent colour.** The UX doc offers YouTube Red *or* Focus Blue. The spike uses Focus Blue (`#3EA6FF`) to read as "calm" rather than "error".
7. **Type Affirmation.** Keep, cut, or replace?
