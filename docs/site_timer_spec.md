# Site Timers: Product & Technical Specification
## Product: 🧠💡 Short the Shorts (feature: time limits on any website)

| | |
| :--- | :--- |
| **Status** | Draft (proposal, not implemented) |
| **Companion docs** | [`user_design_specification.md`](./user_design_specification.md), [`tech_spec.md`](./tech_spec.md) |
| **Target** | Chrome (desktop) 120+, Manifest V3 |

---

## 1. Summary

Users can add **any website** (e.g. `reddit.com`) with a **daily time limit, 15 minutes by default**. While they are on that site, a small **countdown** shows in the top-right of the page and on the toolbar icon's badge. When the time runs out, the existing **Mindful Pause** gate appears (same challenges, cooldown, Settings and Close Tab buttons). Solving it grants a few **extra minutes** (default 5), after which the gate returns.

Original request: *"add a timer function that allows you to add any website and then it starts a timer and does the same pop-up after you reach the time spent on that website - default timer to 15 min - and show a countdown overlay in the top corner - maybe protruding from the extension icon - or near it"*.

Like the rest of the extension it is 100% local: no backend, no analytics. The timed sites list syncs with the user's other settings via `chrome.storage.sync`. Daily usage stays in `chrome.storage.local`.

### Goals
- Add or remove a site in two clicks from the popup ("Time this site"), or manage the list in Settings.
- Count only time the user is actually spending on the site. Never double-count across tabs. Survive the MV3 service worker being shut down.
- **No new install-time permission warning.** Existing users must not be disabled by the update.
- Reuse the existing gate (`overlay.ts`), challenge engine, settings and stats patterns.

### Non-goals (for now)
- Hard blocking, or "no more today". This stays a speed bump (see tech spec §1 non-goals).
- Per-weekday limits, site groups (e.g. `x.com` + `twitter.com` sharing one budget), path-level limits (`reddit.com/r/foo`).
- Incognito (see Q12), mobile, non-Chromium browsers.
- Counting time in iframes embedded on other sites (e.g. a YouTube embed on a news site).

---

## 2. UX

### 2.1 Adding and removing a site

**From the popup (primary path).** The popup reads the current tab's URL (via `activeTab`, see §4) and shows a context-aware **Site timer** card at the top:

```
+--------------------------------------------------+
|  🧠💡 Short the Shorts                 [ ⚙️ ]   |
+--------------------------------------------------+
|  SITE TIMER                                      |
|  reddit.com is not timed                         |
|  [ ⏱ Time this site · 15 min a day ]             |
|  ----------------------------------------------  |
|  STATUS: ACTIVE                   [ toggle ]     |
|  ...existing popup...                            |
```

Already timed:

```
|  SITE TIMER                                      |
|  reddit.com · 9 min left today (of 15)           |
|  [ Change limit in ⚙️ Settings ]   [ Remove ]    |
```

Timed but access missing (synced from another device, or revoked in `chrome://extensions`):

```
|  SITE TIMER                                      |
|  reddit.com · ⚠ needs access to run              |
|  [ Grant access ]                  [ Remove ]    |
```

Pages a timer can't run on (`chrome://`, the Chrome Web Store, `file://`, the PDF viewer, extension pages):

```
|  SITE TIMER                                      |
|  Timers can't run on this page.                  |
```

**"Time this site" flow:** click, then Chrome's permission prompt ("Read and change your data on all reddit.com sites"), then **Allow**. The countdown appears on the open reddit.com tab(s) immediately, with no reload needed. If the user clicks **Deny**, the popup shows: *"The timer needs permission to see when you're on reddit.com. Nothing was added."*

**From Settings (full list).** A new **Site timers** section sits after "Auto-off times":

```
|  SITE TIMERS                                           |
|  Get a challenge after a set time on a site each day.  |
|  Time resets at midnight.                              |
|                                                        |
|  ┌──────────────────────────────────────────────────┐  |
|  │ reddit.com      [ 15 min ▼ ] a day   9 min left ✕│  |
|  │ x.com           [ 30 min ▼ ] a day   30 min left ✕│ |
|  │ news.ycomb...   [ 15 min ▼ ] a day ⚠ [Grant] ✕   │  |
|  └──────────────────────────────────────────────────┘  |
|  Add a site: [ e.g. reddit.com           ] [ + Add ]   |
|                                                        |
|  After solving, keep going for  [ 5 min ▼ ]            |
|  [x] Show the countdown on the page                    |
|      (the toolbar icon always shows minutes left)      |
```

- **Limit options:** 5, 10, **15** (default), 20, 30, 45, 60, 90, 120 minutes.
- **Add field:** accepts a bare host or a pasted URL (`https://www.reddit.com/r/all` → `reddit.com`). Invalid or unsupported input is rejected inline. A host already covered by an existing entry shows *"reddit.com is already timed"*.
- **✕ Remove:** removes the row and, after **Save**, also revokes the site's host permission (§4). This keeps the permission footprint equal to the list.
- **Limit changes** take effect on Save, mid-day included (see Q5).
- **Cap:** 50 sites (sync quota, §8).

### 2.2 What counts as "time spent"

The clock for a site runs while **at least one tab on that site is active**, where *active* means:

| Signal | Rule |
| :--- | :--- |
| Tab visible | `document.visibilityState === 'visible'` (not a background tab, not a minimised window, not prerendering). Required. |
| User present | **Either** the Chrome window has focus (`document.hasFocus()`) and there was mouse, keyboard, scroll or touch input on the page in the last **2 min**, **or** a `<video>`/`<audio>` on the page is playing. |
| Screen | Not locked (`chrome.idle` state ≠ `locked`). Always stops the clock. |
| Gate | The clock doesn't run while the time's-up gate is showing. |
| Extension | Paused by the master toggle or an auto-off time → clock stops (see Q4). |

This means:
- Watching a video on a second monitor while typing in another app **counts** (media playing).
- A tab left open on another monitor with nothing playing **stops counting** after 2 min.
- **Multiple tabs on the same site share one clock** (time is the union, not the sum). Two different timed sites visible side by side each run their own clock.
- Subdomains count as the same site: `old.reddit.com` and `www.reddit.com` are both `reddit.com`.

### 2.3 When the counter resets

- **Daily, at local midnight**, keyed by the local date like the daily stats (`localDateKey()`).
- Reload, a new tab, closing the browser or restarting the computer do **not** reset it.
- A gate already open at midnight stays until solved or escaped. This matches how auto-off treats a gate that's already open. The next tick after solving uses the new day's full allowance.

### 2.4 When time runs out

1. The pill turns red in the last minute (§3.3), then the **gate** appears. Media is paused (all `<video>` and `<audio>`), scroll and keyboard navigation are blocked, and fullscreen is exited. This uses the same mechanics as the Shorts gate.
2. Copy:

```
+-------------------------------------------------------------+
|   +-----------------------------------------------------+   |
|   |  🧠 Mindful Pause                            [ ⚙️ ] |   |
|   |  You've spent 15 min on reddit.com today.           |   |
|   |                                                     |   |
|   |  Solve to keep going for 5 more minutes:            |   |
|   |                ┌─────────────────┐                  |   |
|   |                │   47  +  38  =  ? │                  |   |
|   |                └─────────────────┘                  |   |
|   |  [ Enter Answer...           ]  [ Submit ]          |   |
|   |  -------------------------------------------------  |   |
|   |  [ 🚪 Close reddit.com Tab ]                        |   |
|   +-----------------------------------------------------+   |
+-------------------------------------------------------------+
```

   After the first extension the context line reads *"You've spent 25 min on reddit.com today (limit 15 min)."* The cooldown on a wrong answer, a fresh puzzle after cooldown, and the ⚙️ button all behave as today. There is no Convert button.
3. **Solved:** the gate closes, media that was playing resumes, and the remaining time becomes exactly **N minutes** (`extraMinutes`, default 5) regardless of overshoot. The pill flashes `+5:00`. When those run out, the gate returns.
4. **Already expired** when the page loads (reload, new tab, another tab becoming visible): the gate shows **immediately**, before any time is counted.
5. **Solved in one tab:** other open tabs of the same site that are showing a gate re-check when they become visible, and close their gate if time is available.

---

## 3. The countdown

### 3.1 Constraint: nothing can come out of the toolbar icon

A content script can only draw **inside the page viewport**. Chrome draws the toolbar, the omnibox and the extension icon, and pages can't paint there. The extension's own surfaces in that area are:
- the **action badge**: up to ~4 characters on the icon, coloured per tab;
- the **popup**: shown only when the user clicks the icon;
- the **side panel**: a full-height panel, overkill and needs the user to open it.

So "protruding from the extension icon" can be approximated only by a badge on the icon plus an in-page element placed in the top-right corner, visually right under it.

### 3.2 Options compared

| | In-page pill (top-right) | Toolbar badge (`setBadgeText`, e.g. `12m`) | Both |
| :--- | :--- | :--- | :--- |
| Visible when icon is unpinned (Chrome's default after install) | ✅ | ❌ (hidden in the puzzle-piece menu) | ✅ |
| Visible in fullscreen video | ✅ (top layer, §3.5) | ❌ (toolbar hidden) | ✅ |
| Seconds precision / last-minute warning | ✅ | Coarse (`45s` steps of 5 s) | ✅ |
| Never covers site UI | ❌ (mitigated: collapse, drag) | ✅ | Pill can be turned off |
| Literally "on the icon" | ❌ | ✅ | ✅ |
| Cost | Shadow DOM element, ~2 KB | Free (background already handles ticks) | |

**Recommendation: both.** The badge is always on for timed tabs (cheap, unobtrusive, as close to "from the icon" as Chrome allows). The pill is **on by default** and can be switched off in Settings (`showCountdown`). The pill is also what makes the warning state noticeable.

### 3.3 Pill design and states

Default position: `top: 12px; right: 12px`, i.e. directly below the toolbar icon area. Dark surface (`--surface`, 90% opacity), 28 px tall, `--font`, tabular numerals.

```
┌─ Chrome toolbar ──────────────────────────────────────────────────────────┐
│  ◀ ▶ ⟳  │ 🔒 reddit.com/r/all                         │ ☆  [🧠 12m]  ⋮  │  ← badge "12m"
├───────────────────────────────────────────────────────────────────────────┤
│  reddit  [ search ...................... ]                ┌────────────┐ │
│                                                             │ ⏱ 12:34  – │ │  ← pill
│  ┌──────────────┐                                           └────────────┘ │
│  │ post ...     │                                                          │
```

| State | Pill | Badge | Notes |
| :--- | :--- | :--- | :--- |
| Running | `( ⏱ 12:34  – )` | `12m`, Focus Blue `#3EA6FF`, dark text | Ticks every second (local interpolation, §5.4). |
| Paused (not active, §2.2) | `( ⏸ 12:34  – )` at 50% opacity | unchanged | Tooltip: "Paused: tab not in use". |
| Warning (≤ 1:00 left) | `( ⏱ 0:42  – )`, red text `--error`, one pulse at 1:00 | `45s` … `5s`, red `#FF4E4E` | Forces expanded. Screen readers hear "1 minute left on reddit.com" once. Pulse is disabled under `prefers-reduced-motion`. |
| Expired | Hidden behind the gate | `0m`, `#CC0000` | Gate shown (§2.4). |
| Extra time granted | `( +5:00 )`, accent background for 2 s | `5m` | Then back to Running. |
| Collapsed | `( 12 )`, 28 px circle, minutes only | unchanged | Default after 4 s without hover. Expands on hover or focus. |
| Off (master toggle / auto-off) | Hidden | Cleared | |

Collapsed versus expanded, in the corner:

```
   expanded                       collapsed (default after 4 s)
   ┌────────────┐                 ┌────┐
   │ ⏱ 12:34  – │                 │ 12 │
   └────────────┘                 └────┘
```

### 3.4 Interaction and avoiding clashes with site UI

Many sites put an avatar or menu in the top-right corner. Mitigations:
- **Auto-collapse** to a 28 px chip after 4 s, so it covers about as much as a favicon. The `–` button collapses it immediately.
- **Drag to move.** Pointer-drag anywhere on the pill. On release it snaps to the nearest of the four corners (12 px inset). The corner and collapsed state are remembered **per site** in `storage.local["timerPill:<host>"]`.
- The host element has zero size and `pointer-events: none`. Only the pill itself takes clicks, so nothing else on the page is blocked.
- `z-index: 2147483646` (one below the gate), `:host { all: initial }` and a closed Shadow DOM, the same isolation as the gate.
- The pill never takes focus on its own and never intercepts keys. Its buttons are reachable by Tab like any page control.
- If it's still in the way: Settings → untick "Show the countdown on the page". The badge remains.

### 3.5 Fullscreen

A fullscreen element sits in the browser's **top layer**, above any `z-index`, so a normal fixed element disappears in fullscreen video. The pill host uses `popover="manual"` and calls `showPopover()`. On every `fullscreenchange` it calls `hidePopover()` and `showPopover()` again, so it moves to the top of the top-layer stack, above the fullscreen element (Chrome 114+). Popover default styles (`inset`, `margin`, `border`, `padding`) are reset with inline `!important` styles on the host. When time runs out in fullscreen, the gate exits fullscreen first, as `overlay.ts` does today.

---

## 4. Manifest & Permissions

### 4.1 Approaches compared

| | A. Static `<all_urls>` content script | **B. `optional_host_permissions` + runtime `registerContentScripts` (recommended)** | C. `activeTab` only |
| :--- | :--- | :--- | :--- |
| Install warning | "Read and change all your data on all websites" | **Unchanged**: "Read and change your data on www.instagram.com and www.youtube.com" | Unchanged |
| Effect on existing users when shipped as an update | Chrome **disables** the extension until they accept the new warning | **None**: no new warning-bearing permissions | None |
| Web Store review | Broad host permission → in-depth review, slower, more justification | Light. Each permission still needs a one-line justification. | Light |
| Runtime prompt | None | Per site, on add: "Read and change your data on all reddit.com sites" | None |
| Code runs on | Every page the user visits (perf and privacy optics) | Only the sites the user chose | — |
| Works across reloads/navigation | ✅ | ✅ | ❌ Access ends when the tab navigates. The user would have to click the icon on every visit. Not viable. |
| Moving parts | Fewest | `permissions.request`, `registerContentScripts`, reconciling the list on install and update | — |

**Recommendation: B.** It is the only option that keeps the install warning and Web Store review exactly as they are today. It doesn't disable the extension for existing users on update, and it only touches sites the user explicitly chose. It also matches the narrow-permissions approach in `tech_spec.md` §5. The extra moving parts are contained in one background module (§6.3).

### 4.2 Manifest changes (`manifest.config.ts`)

```ts
permissions: ['storage', 'scripting', 'activeTab', 'idle'],
optional_host_permissions: ['https://*/*', 'http://*/*'],
// content_scripts unchanged (YouTube + Instagram, static)
```

| Permission | Why | Install warning |
| :--- | :--- | :--- |
| `scripting` | `registerContentScripts` / `updateContentScripts` for timed sites; `executeScript` to start the timer on already-open tabs without a reload. | None |
| `activeTab` | The popup reads the current tab's URL to offer "Time this site". It also grants temporary access to that tab. | None |
| `idle` | `chrome.idle.onStateChanged` / `queryState` to stop the clock when the screen is locked. | None |
| `optional_host_permissions` | Lets the extension ask for individual sites at runtime. It isn't granted at install. | None at install. A per-site prompt when the user adds a site. |

Still **not** needed:
- **`tabs`:** the background reads `sender.tab.id`. For URLs of timed tabs, the host permission already exposes `tab.url`.
- **`alarms`:** see §5.5.
- **`<all_urls>`:** see §4.1.

### 4.3 Requested origins

For host `reddit.com` request `['https://*.reddit.com/*', 'http://*.reddit.com/*']`. In Chrome match patterns, `*.reddit.com` also matches the bare `reddit.com`. `http` is included because some sites still redirect through it. It could be dropped to `https` only (see Q6).

### 4.4 Chrome Web Store impact

- **Single purpose.** The listing must describe one purpose that covers both features, e.g. *"Adds a small puzzle to break mindless browsing: between Shorts/Reels, and after a daily time limit on sites you choose."* The name "Short the Shorts" still fits but undersells it (see Q9).
- **Permission justifications** (Privacy practices tab): one line each for `scripting`, `activeTab`, `idle` and the optional host permissions, as in the table above.
- **Data disclosure / privacy policy.** Nothing is transmitted to us. The policy should say the list of timed hostnames and daily minutes per site are stored on the device, and the list syncs through the user's Chrome account (`storage.sync`). Check the current CWS "user data" definitions when filling in the form.
- **No remote code.** The timer script is bundled. It is registered by file path, not by string.

---

## 5. Timekeeping design

### 5.1 Options compared

| | **Content-script ticks → background (recommended)** | Background-only, event-driven | Content script counts on its own |
| :--- | :--- | :--- | :--- |
| How | The page script decides "active" (§2.2) and sends `timerTick` every 5 s. The background credits elapsed time to a shared per-site record. | The background tracks `tabs.onActivated`, `windows.onFocusChanged`, `tabs.onUpdated`, `idle` and stores `{site, since}`. An alarm fires at expiry. | Each tab keeps its own counter and saves periodically. |
| Knows visibility / media / input | ✅ | ❌ Only the active tab of the focused window. Can't see a video playing on a second monitor or a user who walked away. | ✅ |
| Multi-tab union | ✅ Shared `lastTickAt` per site | ✅ | ❌ Double counts, or needs locking |
| Survives SW shutdown | ✅ All state is in storage. Ticks wake the SW. | Needs `alarms` and careful persistence | n/a |
| Runaway risk | Low: a missed tick credits nothing | `onFocusChanged` is unreliable on macOS (devtools, popups) and can leave the clock running | — |

### 5.2 The tick protocol

Content script (`content/timer/index.ts`):
- Recomputes `active` on `visibilitychange`, `focus`/`blur`, media `play`/`pause`/`ended` (capture phase on `document`), and a 1 s local timer. Input timestamps come from passive `pointermove`/`pointerdown`/`keydown`/`wheel`/`scroll`/`touchstart` listeners, which only store `Date.now()`.
- While `active`: sends `{ type: 'timerTick', host, active: true }` every **5 s** (`TICK_MS`), plus immediately on becoming active.
- On becoming inactive (including `pagehide`): sends one final `{ active: false }` tick, best effort.
- Every tick returns a `TimerStatus` (§8.3). The pill re-syncs from it.

Background (`background/timers.ts`), on each tick, serialised on the same promise queue as stats:

```
if idle state is 'locked'            → credit 0, counting = false
rec = usage[today][host]
if rec expired                       → credit 0, reply expired
delta = now - rec.lastTickAt
credit = (rec.lastTickAt && 0 < delta <= MAX_GAP_MS) ? delta : 0     // MAX_GAP_MS = 15 s
rec.usedMs += credit
rec.lastTickAt = active ? now : 0     // final tick closes the segment
write; set the badge for sender.tab.id; reply status
```

- **No double counting:** every tab on the site updates the same `lastTickAt`, so each credit is the wall-clock time since the *previous tick from any tab*. Two tabs ticking alternately add up to wall-clock time, not twice it.
- **Sleep / lid closed / tab killed / lost final tick:** the next tick's `delta` is larger than `MAX_GAP_MS`, so it credits 0. The worst case if a final tick is lost is ≤ 15 s of over-count.
- **Clock changes:** a negative `delta` (system clock moved back) credits 0.
- **Precision:** the pill interpolates locally between ticks. When its local estimate hits 0 it sends an immediate tick, so the gate appears within about a second of the real limit and never more than one tick late.

### 5.3 MV3 service worker lifecycle

- The SW holds **no state that matters** in memory. The usage record, including `lastTickAt`, is written to `storage.local` on every tick. Writes to `storage.local` have no rate quota, and one small object every 5 s is trivial.
- In-memory caches are rebuilt on wake: settings via `loadSettings()`, idle state via `chrome.idle.queryState(60)`, then kept fresh by `idle.onStateChanged` and `storage.onChanged`.
- Each tick message resets the SW's 30 s idle timer, so it stays alive while a timed site is in use and sleeps otherwise. There are no `setInterval`s in the SW.
- `storage.session` holds only short-lived coordination state: the pending popup add (§6.3). It survives SW restarts, not browser restarts, which is what we want.

### 5.4 Focus, visibility, sleep and lock

| Event | Effect |
| :--- | :--- |
| Switch to another tab / minimise window | `visibilitychange → hidden` → final tick → clock stops. |
| Switch to another app, window still visible | `blur`. The clock continues only while media plays. Otherwise it stops at blur (focus is required for the input rule). |
| No input for 2 min, nothing playing | Inactive → final tick. Resumes on the next input. |
| Screen locked | `chrome.idle` → `locked`. The SW credits 0 even if the page keeps ticking. |
| Laptop sleep | Page timers are suspended, so no ticks. After wake the first delta is larger than `MAX_GAP_MS` and credits 0. |
| Page restored from back/forward cache | `pageshow` → recompute `active`; `lastTickAt` gap rule applies. |
| Prerendered page | `visibilityState` is `hidden` → not active until shown. |

### 5.5 Why no `chrome.alarms`

The clock only moves while a timed tab is active, and an active tab is already ticking, so nothing needs to wake up on a schedule. Expiry is detected on a tick, and the daily reset is lazy (a new date key). This mirrors `tech_spec.md` §5 ("No `alarms` permission for auto-off"). Revisit if we ever add notifications for tabs that aren't in view (e.g. "5 min left" while on another site).

---

## 6. Component design

### 6.1 Architecture

```
┌──────────── timed site tab (e.g. reddit.com) ───────────────────────────────┐
│ Timer content script (registered at runtime, top frame only)                 │
│ ┌──────────────┐ active? ┌──────────────────┐ status ┌────────────────────┐ │
│ │ activity.ts  ├────────►│ timer/index.ts   ├───────►│ pill.ts (Shadow DOM│ │
│ │ vis/focus/   │         │ (controller)     │        │ countdown)         │ │
│ │ input/media  │         │                  ├─expired►│ overlay.ts (gate)  │ │
│ └──────────────┘         └───────┬──────────┘        │ player.holdMedia() │ │
│                                   │ timerTick/Status/Solved (sendMessage)  │ │
└───────────────────────────────────┼─────────────────────────────────────────┘
                                    ▼
┌──────────────────────── Background SW ──────────────────────────────────────┐
│ index.ts (router + one write queue)    timers.ts                              │
│   stat / closeTab / openSettings  ──►   credit ticks, grant extra time        │
│                                         setBadgeText/Color per tab            │
│                                         reconcile registerContentScripts      │
│                                         permissions.onAdded/onRemoved         │
│                                         idle.onStateChanged                   │
└───────────┬──────────────────────────────────────────┬───────────────────────┘
            ▼                                          ▼
 storage.local  timers:YYYY-MM-DD, timerPill:<host>   storage.sync settings.siteTimers
 storage.session timerPendingAdd                      ▲ Popup ("Time this site")
                                                      ▲ Settings page (list)
```

The existing YouTube/Instagram content script is unchanged except for one guard (§6.6).

### 6.2 New and changed modules

| File | New / changed | Responsibility |
| :--- | :--- | :--- |
| `src/shared/site-timers.ts` (+ `.test.ts`) | **New, pure** | `normaliseHost(input)`, `originPatterns(host)`, `hostMatches(hostname, host)`, `findTimedSite(hostname, sites)`, `isActive(signals)`, `credit(rec, now, active)`, `grantExtra(rec, limitMs, extraMs)`, `remainingMs(rec, limitMs)`, `formatClock(ms)`, `badgeText(ms)`, constants `TICK_MS`, `MAX_GAP_MS`, `IDLE_AFTER_MS`. No `chrome.*`, no DOM. |
| `src/shared/timer-usage.ts` | **New** | `storage.local` I/O for `timers:YYYY-MM-DD` (like `stats.ts`). |
| `src/shared/settings.ts` | Changed | `siteTimers` schema, defaults and sanitising in `withDefaults` (§8.1). |
| `src/shared/messages.ts` | Changed | New message types plus a `requestMessage<T>()` that resolves to `T \| null`. Today's `sendMessage` is fire-and-forget. |
| `src/background/index.ts` | Changed | Routes timer messages into `timers.ts`. The stat queue becomes a general `enqueue()` shared by stats and ticks. |
| `src/background/timers.ts` | **New** | Tick crediting, badge, script registration reconcile, permission events, pending add, idle state. |
| `src/content/timer/index.ts` | **New** (entry) | Timer controller: find the timed site, tick loop, pill, gate, settings changes. |
| `src/content/timer/activity.ts` | **New** | DOM listeners → `ActivitySignals` → `isActive()`. |
| `src/content/timer/pill.ts` + `pill.css` | **New** | Countdown pill (Shadow DOM, popover, drag, collapse, states). |
| `src/content/overlay/overlay.ts` | Changed | New options `label?: string` (default "Solve to continue scrolling:") and `kind?: 'video' \| 'timer'` (sets `host.dataset.kind`). |
| `src/content/player.ts` | Changed | Add `holdMedia(): (resume: boolean) => void`. It pauses all `video, audio`, re-pauses on capture-phase `play`, remembers which were playing and resumes only those. `holdPlayback` stays for Shorts. |
| `src/content/index.ts` | Changed | Doesn't open a Shorts gate while `short-the-shorts-gate[data-kind="timer"]` is mounted (sets `gateOwed`). |
| `src/popup/index.html`, `popup.ts` | Changed | Site timer card (§2.1). |
| `src/options/index.html`, `options.ts` | Changed | Site timers section (§2.1). Save includes `siteTimers`. |
| `manifest.config.ts` | Changed | §4.2. |

### 6.3 Background: registration and permissions (`background/timers.ts`)

**Building the script.** `import timerScript from '../content/timer/index.ts?script&iife'` (CRXJS). Use **IIFE** so the file is self-contained. CRXJS's default loader format dynamically imports chunks, which must be web-accessible on the page's origin. That would need `web_accessible_resources` on `<all_urls>` (see the `dist/manifest.json` WAR block today). The file name is content-hashed and changes with every build.

**`reconcileTimerScripts()`** is idempotent. It runs on `runtime.onInstalled` (covers updates, which matters because the file name changes), `runtime.onStartup`, `permissions.onAdded/onRemoved`, and `storage.onChanged` for settings:

```
granted = (await chrome.permissions.getAll()).origins
matches = siteTimers.sites
            .filter(s => originPatterns(s.host).every(p => granted.includes(p)))
            .flatMap(s => originPatterns(s.host))
if matches empty → unregisterContentScripts({ ids: ['site-timer'] })
else register or update { id: 'site-timer', js: [timerScript], matches,
                          runAt: 'document_idle', allFrames: false, persistAcrossSessions: true }
revoke origins that are granted (optional) but no longer in the list → chrome.permissions.remove
```

`allFrames: false` stops embeds of a timed site inside other pages from counting.

**Adding from the popup.** On some platforms Chrome's permission prompt closes the popup, so the popup's `await permissions.request()` may never resolve. The popup therefore, in the same click handler and before any `await`:
1. `sendMessage({ type: 'timerPendingAdd', host })`. The background stores `{ host, at }` in `storage.session["timerPendingAdd"]`.
2. `chrome.permissions.request({ origins: originPatterns(host) })`. Calling it before any `await` keeps the user gesture.

The background's `permissions.onAdded` checks for a pending add whose origins match (within 2 min). If found, it appends `{ host, limitMinutes: 15 }` via `updateSettings`, reconciles, and calls `scripting.executeScript({ target: { tabId }, files: [timerScript] })` for open tabs matching the patterns (`tabs.query({ url: patterns })` works with the host permission). If the popup is still open and gets `true`, it sends `timerAdd`, which does the same thing. Both paths are idempotent. The Settings page calls `permissions.request` directly because it doesn't close.

**Badge.** Per tab: `action.setBadgeText({ tabId, text })`, `setBadgeBackgroundColor`, `setBadgeTextColor` (Chrome 110+). The badge is set on every tick and status reply. It is cleared on `tabs.onUpdated` with `status: 'loading'` (fires without `tabs` permission); the new page's script sets it again if it's still timed. It is also cleared when a site is removed. Text: `≥ 1 min → "12m"`, `< 1 min → "45s"`, expired → `"0m"`.

### 6.4 Timer content script (`content/timer/index.ts`)

```
start:
  settings = loadSettings(); site = findTimedSite(location.hostname, settings.siteTimers.sites)
  if !site → exit                       (stale registration, or removed between Save and reconcile)
  status = requestMessage({ type: 'timerStatus', host })
  if status.expired → openTimerGate()   (before counting anything)
  mount pill if settings.siteTimers.showCountdown && gatingStatus(settings) === 'active'
  activity.onChange(active → start/stop tick loop; send final tick on stop)
  every TICK_MS while active and no gate: tick → update pill + check expired
  local 1 s render: pill shows status.remainingMs - (now - status.at) while active
  on local estimate ≤ 0 → tick now
  on visibilitychange→visible → timerStatus (picks up solves/limit changes from other tabs)
onSettingsChanged:
  site removed or master off / auto-off → stop ticking, remove pill, close gate (resume media)
  showCountdown toggled → mount/unmount pill
  limit changed → timerStatus → update pill; close the gate if no longer expired
openTimerGate:
  stat('gatesShown'); release = holdMedia(); block = blockScrollNavigation(overlay.host)
  showOverlay({ kind: 'timer', generate, contextLine, label: `Solve to keep going for ${n} more minutes:`,
                siteName: host, showConvert: false, cooldownSeconds,
                onSolved → stat('gatesSolved'); requestMessage({ type: 'timerSolved', host }) → close gate, resume,
                           pill "+n:00"
                onFailed → stat('gatesFailed'); onCloseTab → stat('tabsClosed') + closeTab; onOpenSettings → as today })
```

Auto-off is checked with the existing `isAutoOff(settings.autoOff)` at each tick and on status checks. It's cheap, and it matches how the Shorts controller checks on each video view.

### 6.5 Pill (`content/timer/pill.ts`)

`createPill({ host, corner, collapsed, onMove, onCollapse }) → { update(status, active), flash(text), destroy() }`.

- Custom element `<short-the-shorts-timer>` on `document.documentElement`, outside the site's app tree, the same reasoning as the gate (tech spec §6.5).
- Closed shadow root with styles from `theme.css?inline` + `pill.css?inline`, and a `popover="manual"` host (§3.5).
- `role="timer"` with `aria-live="off"`, plus a separate visually hidden `aria-live="polite"` node that announces once at 1:00.
- Text is set with `textContent` only.
- Drag uses Pointer Events with `setPointerCapture`. Snapping to a corner calls `onMove(corner)`, which writes `timerPill:<host>` to `storage.local` directly (content scripts can write storage, and this needs no queue because it's last-write-wins).

### 6.6 Coexisting with the Shorts gate

If the user times `youtube.com` or `instagram.com`, both content scripts run in the same isolated world but as separate bundles. Rules:
- The Shorts controller doesn't open its gate while `short-the-shorts-gate[data-kind="timer"]` exists. It sets `gateOwed`, so the next Short after the timer gate is solved is gated as usual.
- If a Shorts gate is open when time runs out, the timer gate mounts on top (appended later, same z-index). Both media holds stay active until each gate is solved. A video only plays once no hold remains, because each hold's capture listener re-pauses `play`.
- Time spent on a Shorts gate counts as time on youtube.com, but only while active (§2.2). That's acceptable: the user is on the site.

---

## 7. Messages (`shared/messages.ts`)

```ts
type Message =
  | { type: 'stat'; field: StatField } | { type: 'closeTab' } | { type: 'openSettings' }   // existing
  | { type: 'timerTick'; host: string; active: boolean }    // → TimerStatus
  | { type: 'timerStatus'; host: string }                   // → TimerStatus
  | { type: 'timerSolved'; host: string }                   // → TimerStatus (grants extraMinutes)
  | { type: 'timerPendingAdd'; host: string }               // popup, before permissions.request
  | { type: 'timerAdd'; host: string };                     // popup, after a granted request

interface TimerStatus {
  host: string;
  limitMs: number;        // limitMinutes plus any granted extra
  remainingMs: number;
  expired: boolean;
  counting: boolean;      // false when locked or switched off
  at: number;             // background Date.now() when computed
}
```

- The background answers with `sendResponse` + `return true` (async). `requestMessage` swallows failures the same way `sendMessage` does and resolves to `null`. On `null` the content script keeps its last status and retries on the next tick.
- The background ignores a `host` that doesn't match `new URL(sender.tab.url).hostname` via `hostMatches`. The URL is readable because of the host permission. This means a message can't move another site's clock.

---

## 8. Data model

### 8.1 Settings: `chrome.storage.sync["settings"].siteTimers`

```ts
export const TIMER_LIMITS = [5, 10, 15, 20, 30, 45, 60, 90, 120] as const;   // minutes
export const TIMER_EXTRAS = [1, 5, 10, 15] as const;                         // minutes
export const DEFAULT_TIMER_MINUTES = 15;
export const MAX_TIMED_SITES = 50;

export interface TimedSite {
  host: string;           // normalised: lowercase, punycode, no "www.", no port, e.g. "reddit.com"
  limitMinutes: TimerLimit;
}

export interface SiteTimers {
  showCountdown: boolean;  // default true (the in-page pill; the badge is always on)
  extraMinutes: TimerExtra; // default 5
  sites: TimedSite[];      // default []
}

// Settings gains: siteTimers: SiteTimers
// DEFAULT_SETTINGS.siteTimers = { showCountdown: true, extraMinutes: 5, sites: [] }
```

**`withDefaults` changes** (consistent with how `sites` and `autoOff` are merged today):

```ts
const merged = { ...,
  siteTimers: { ...DEFAULT_SETTINGS.siteTimers, ...partial?.siteTimers } };
return { ...,
  siteTimers: {
    showCountdown: merged.siteTimers.showCountdown !== false,
    extraMinutes: oneOf(TIMER_EXTRAS, merged.siteTimers.extraMinutes, 5),
    sites: sanitiseTimedSites(merged.siteTimers.sites),
  } };
```

`sanitiseTimedSites` (pure, in `site-timers.ts`):
- Non-array → `[]`.
- Drops entries whose `host` fails `normaliseHost`.
- Normalises hosts and de-duplicates them (first entry wins).
- Applies `oneOf(TIMER_LIMITS, limitMinutes, 15)`.
- Truncates to `MAX_TIMED_SITES`.

**Migration:** none needed. Existing users load without `siteTimers` and get the defaults. As with challenge types, a newer device may sync values this build doesn't know, and those fall back to defaults instead of crashing. `changedFields` already compares with `JSON.stringify`, so editing the `sites` array saves correctly.

**Quota:** a site entry is about 45 B, so 50 sites ≈ 2.3 KB. That plus the existing settings stays well under the 8 KB per-item sync limit.

**Synced list, unsynced permission.** Host permissions granted on one device don't apply on another. On a second device the list arrives via sync but the sites show "⚠ needs access" (§2.1) until the user grants them. `reconcileTimerScripts` only registers granted sites.

### 8.2 Daily usage: `chrome.storage.local["timers:YYYY-MM-DD"]`

```ts
type TimerUsage = Record<string /* host */, {
  usedMs: number;      // credited active time today
  extraMs: number;     // added on top of the limit by solving gates
  lastTickAt: number;  // 0 = no open segment
  gates: number;       // time's-up gates shown today
}>;
```

- `limitMs = limitMinutes × 60 000 + extraMs`; `remainingMs = max(0, limitMs − usedMs)`; `expired = remainingMs === 0`.
- `grantExtra` sets `extraMs = usedMs + extraMinutes × 60 000 − limitMinutes × 60 000`, so the remaining time is exactly the extra minutes even after an overshoot.
- Size is about 80 B per site per day. Retention matches daily stats: unbounded in the spike, with pruning (> 90 days) added alongside stats pruning.

### 8.3 Pill position: `chrome.storage.local["timerPill:<host>"]`

`{ corner: 'tr' | 'tl' | 'br' | 'bl'; collapsed: boolean }`. Default `{ corner: 'tr', collapsed: true }`. The pill starts expanded for 4 s on each page load, then collapses.

### 8.4 Stats

Timer gates reuse `gatesShown`, `gatesSolved`, `gatesFailed` and `tabsClosed`, so "Gates solved" in the popup includes them. The popup adds one line when any site is timed: *"Timed sites today: 23 min"*, the sum of `usedMs` across hosts. No new `StatField` is needed.

---

## 9. Edge cases

| Scenario | Behaviour |
| :--- | :--- |
| Same site in two tabs, both visible (two windows) | One shared clock (`lastTickAt` union). Each tab's pill shows the same remaining time. |
| Two different timed sites visible at once | Each runs its own clock. |
| Reload or new tab when expired | Gate shows immediately (status check on start). |
| Gate solved in tab A, tab B (same site) shows a gate | B re-checks on `visibilitychange→visible` and closes its gate without resuming media. |
| Midnight while browsing | The next tick uses the new date key and the full allowance. A gate already open stays until solved. |
| Limit lowered below today's usage | Expires on the next tick. |
| Limit raised or site removed while the gate is open | The gate closes and media resumes. This is a speed bump, consistent with today's "disable closes the gate" (see Q5). |
| Master toggle off or auto-off starts | Clock stops, pill hidden, badge cleared. A gate already open stays (same as Shorts). |
| User denies the permission prompt | Nothing is added. The popup or Settings explains why. |
| Popup closes during the permission prompt | The background completes the add via `permissions.onAdded` plus the pending record. |
| User revokes site access in `chrome://extensions`, or sets the extension to "On click" | `permissions.onRemoved` → reconcile unregisters it. The row shows "⚠ needs access". |
| Settings synced to a new device | Rows show "⚠ needs access" until granted. |
| Extension updated | `onInstalled` → re-register with the new hashed file name. Content scripts already on the page are orphaned: their ticks fail silently, and gating resumes after the user reloads (as tech spec §8). |
| `chrome://`, Chrome Web Store, PDF viewer, `file://`, `view-source:` | Can't be timed. The popup shows "Timers can't run on this page". |
| User enters `www.reddit.com/r/all`, `REDDIT.com`, `reddit.com:443` | All normalise to `reddit.com`. |
| User enters `evil-reddit.com` while `reddit.com` is timed | Separate site. `hostMatches` requires an exact match or a `.` boundary. |
| `old.reddit.com` added when `reddit.com` already exists | Rejected as already covered. |
| Second-level country domains (`bbc.co.uk`) | Kept as typed (`bbc.co.uk`), with no public-suffix list. Adding `co.uk` is rejected (no public suffixes from a small built-in blocklist), or allowed but harmless? See Q6. |
| Embedded iframe of a timed site on another site | Not counted (`allFrames: false`). |
| Fullscreen video | Pill stays visible (popover top layer). The gate exits fullscreen. |
| Site re-renders and removes unknown nodes | Pill and gate are mounted on `documentElement`, outside the app tree. |
| Site CSS targets `[popover]` or custom elements | Inline `!important` host styles, a closed shadow and `all: initial`. |
| Lid closed / sleep / lock | No credit (gap rule, idle `locked`). |
| Video playing in a background tab | Not counted (tab hidden). |
| SW killed between ticks | No effect: state is in `storage.local`. The next tick wakes it. |
| Incognito | Not supported unless the user enables "Allow in Incognito". Then `storage` is shared in spanning mode, which is acceptable (see Q12). |

---

## 10. Testing strategy

| Layer | Tooling | Coverage |
| :--- | :--- | :--- |
| Pure logic (`site-timers.ts`) | Vitest | `normaliseHost` (URLs, `www.`, ports, case, IDN → punycode, IPs, `chrome://`, `file:`, empty, Web Store host rejected), `originPatterns`, `hostMatches` (subdomains, the `evil-reddit.com` boundary), `credit` (first tick 0, normal delta, gap > `MAX_GAP_MS` → 0, negative delta → 0, final tick closes the segment, **two tabs interleaved = wall-clock time**), `grantExtra` (overshoot), `remainingMs`, `formatClock` (`h:mm:ss` ≥ 60 min), `badgeText` boundaries (60 000 / 59 999 / 0), `isActive` truth table (visible × focused × recent input × media), `sanitiseTimedSites` (non-array, bad host, duplicate, bad limit → 15, > 50). |
| Settings | Vitest | `withDefaults` with no `siteTimers`, a partial `siteTimers`, unknown `extraMinutes`. `changedFields` detects `sites` edits. |
| Background | Vitest + in-memory `chrome.storage` / `permissions` / `scripting` / `idle` fake | Tick serialisation from two "tabs", `locked` veto, date rollover, `timerSolved` grant, reconcile (granted vs not, empty list → unregister, removed → `permissions.remove`), pending add via `onAdded` (fresh vs stale), sender host mismatch ignored. |
| DOM | Vitest + `happy-dom` + fake timers | Pill states (running, paused, warning at 60 s, flash, collapsed), drag snap to the nearest corner, overlay `label`/`kind` options, `holdMedia` resumes only media that was playing. |
| Manual QA (before release) | Real Chrome, `dist/` unpacked | Add from popup: Allow, Deny, and the popup closing during the prompt. Add from Settings. Remove (permission revoked in `chrome://extensions`). Two tabs, two windows side by side, minimise, switch app with and without video, lock screen, sleep, reload when expired, fullscreen YouTube with the pill and expiry, timing `youtube.com` together with the Shorts gate, system clock past midnight, extension update with tabs open (re-registered with the new file name), sync to a second profile ("needs access"), Web Store and `chrome://` pages, a site with a busy top-right header (pill collapse and drag). |
| Store | Upload a draft | Confirm that the CWS dashboard shows no new install warning and that it accepts the permission justifications. |

---

## 11. Rollout

1. Pure module + tests (`site-timers.ts`), settings schema + `withDefaults`.
2. `holdMedia`, overlay options (`label`, `kind`), Shorts guard (§6.6).
3. Background `timers.ts` + messages + manifest permissions. Verify the CRXJS `?script&iife` output in **both** `npm run dev` and `npm run build`.
4. Timer content script: activity → ticks → gate (no pill), then the pill.
5. Settings page section, then the popup card.
6. Update `tech_spec.md` (§2 diagram, §4 layout, §5 permissions, §7 data model) and `user_design_specification.md` (popup/settings mockups, roadmap). Update the store listing and privacy policy.
7. Version bump. No new permission warning, so no forced re-approval for existing users.

This also partly answers tech spec Q4 ("10 continuous minutes"): a user can time `youtube.com` at 10 min. A Shorts-only time trigger remains a separate decision.

---

## 12. Risks

| Risk | Likelihood | Mitigation |
| :--- | :--- | :--- |
| Popup closes during the permission prompt and the add is lost | Medium (platform-dependent) | Pending add handled by the background (§6.3). |
| CRXJS dynamic-script output changes, or the loader format needs WAR | Medium | Use `?script&iife`. Reconcile on `onInstalled`. Check `dist/` in the release checklist. |
| Pill clashes with a site's header | Medium | Auto-collapse, drag/snap per site, global off switch, badge as fallback. |
| Ticks every 5 s cost battery or perf | Low | Only while active. One small message and one `storage.local` write. |
| CWS reviewer questions single purpose | Low–Medium | Listing copy in §4.4. Minimal permissions. Optional hosts only. |
| Users see "Read and change your data on reddit.com" and get worried | Medium | Explain it in the UI next to the button: *"Chrome will ask to let the timer see when you're on this site. Nothing leaves your computer."* |
| Media-based activity misses Web Audio-only pages | Low | Those still count while focused with recent input. |

---

## 13. Accessibility

- The pill is keyboard reachable (Tab), with `aria-label`s on collapse and drag-free alternatives. A focused pill can be moved to the next corner with the arrow keys.
- The one-minute warning is announced via `aria-live="polite"`.
- The gate keeps its existing focus trap, `aria-modal` and live regions.
- Colour is never the only signal: warning also shows the seconds and a pulse (or no pulse under reduced motion). Text contrast meets 4.5:1 on `--surface`.

---

## 14. Copy

| Where | Text |
| :--- | :--- |
| Popup button | ⏱ Time this site · 15 min a day |
| Popup timed | reddit.com · 9 min left today (of 15) |
| Pre-prompt hint | Chrome will ask to let the timer see when you're on this site. Nothing leaves your computer. |
| Denied | The timer needs permission to see when you're on reddit.com. Nothing was added. |
| Gate context | You've spent 15 min on reddit.com today. |
| Gate label | Solve to keep going for 5 more minutes: |
| Gate escape | 🚪 Close reddit.com Tab |
| Pill paused tooltip | Paused: tab not in use |
| Live announcement | 1 minute left on reddit.com |

---

## 15. Open questions

1. **What counts as time.** Recommended: visible, and either focused with input in the last 2 min or media playing (§2.2). Alternatives: any visible tab (simpler, over-counts a second monitor), or the active tab of the focused window only (under-counts video on a second monitor). Is 2 min the right idle cut-off?
2. **Reset.** Local midnight (recommended), a rolling 24 h, or per browser session?
3. **Extra time after solving.** A fixed 5 min (recommended, configurable 1/5/10/15)? Or escalating friction: shorter grants or harder levels after each solve?
4. **Master toggle and auto-off.** Should they also pause site timers (recommended: yes, the clock doesn't run while "off")? Or should timers be a separate switch?
5. **Changing limits mid-day.** Should raising a limit or removing a site take effect immediately, even on an open gate (recommended, consistent with "speed bump, not a lock")? Or only from tomorrow, to resist impulse cheating?
6. **What a "site" is.** Subdomains included, `www.` stripped, no public-suffix list (recommended)? Should `http://` be requested too, or `https` only? Should `youtube.com`/`instagram.com` be allowed alongside Shorts gating (recommended: yes)? Site groups (`x.com` + `twitter.com`) later?
7. **Pill defaults.** On by default, top-right, auto-collapsing (recommended)? Warning at 1 min only, or also a heads-up at 5 min?
8. **Badge.** Always on for timed tabs (recommended), or a setting?
9. **Positioning and naming.** Is "Short the Shorts" still the right name and single-purpose statement once it times any site? The listing copy needs updating either way.
10. **Escape hatches.** Is "Close tab" enough? Should there be a "Done for today" that gates the site without offering extra time until midnight? (Hard blocking is currently a non-goal.)
11. **Per-site extras.** Is a per-site extra-time value worth the UI, or is one global value enough (recommended)?
12. **Incognito.** Leave it unsupported (default), or document "Allow in Incognito" with a shared budget?
