# User Experience & Interface Design Specification
## Product: 🧠💡 Short the Shorts (YouTube Shorts & Instagram Reels Chrome Extension)

---

## 1. Product Overview & Core Philosophy

**Short the Shorts** is a lightweight, client-side Chrome extension designed to introduce intentional friction into short-form content consumption. Rather than completely blocking YouTube Shorts, it replaces zero-friction swiping with a short mental gate (math problem, anagram, or riddle), shifting the user from passive dopamine consumption back to conscious intent.

### Key Goals:
- **Zero-touch maintenance:** Runs 100% client-side with zero remote backend requirements.
- **Micro-friction UX:** Keeps the UI clean, modern, and non-confrontational—positioning the prompt as a helpful breather rather than a harsh penalty.
- **Privacy First:** No user data collection, remote tracking, or accounts required.

---

## 2. Target User Personas & Use Cases

| Persona | Motivation | Desired Experience |
| :--- | :--- | :--- |
| **The "Dopamine-Loop" Student** | Spends hours scrolling Shorts while studying; wants a gentle check-in to break the loop. | Configures friction to trigger on *every single* Short. Prefers rapid arithmetic challenges. |
| **The Mindful Professional** | Enjoys Shorts during lunch break, but wants to cap browsing time without hard-blocking YouTube. | Configures friction to trigger *every 5 Shorts* or after *10 continuous minutes*. |
| **The Scrubber/Scrapper** | Dislikes the desktop Shorts layout and wants full HTML5 video controls. | Uses the overlay's "Open as Standard Video" button to convert Shorts into normal YouTube watch pages. |

---

## 3. User Flow Architecture

```
[ User Lands on /shorts/* or Swipes ]
[ or opens /watch?v=... when scope = "All of YouTube" ]
                 │
                 ▼
     [ Extension Intercepts ]
                 │
   Does it meet friction criteria?
      (enabled, not in an auto-off time, interval count)
        ┌────────┴────────┐
        ▼                 ▼
     [ YES ]           [ NO ]
        │                 │
        │           [ Play Video ]
        ▼
[ Pause HTML5 <video> ]
[ Inject Overlay Modal ]
        │
   User Action:
     ├── 1. Solves Puzzle ──► [ Unpause Video & Hide Modal ]
     ├── 2. Fails Puzzle  ──► [ 3-sec Cooldown Timer → new puzzle ]
     └── 3. Click "Standard Video" ──► [ Redirect to /watch?v=... ] (Shorts only)
```

---

## 4. Detailed Screen & UI Component Designs

### A. In-Player Friction Overlay (The Gate / "Mindful Pause" Modal)

The modal renders directly over the active YouTube Shorts container, dimming the background video and pausing playback.

```
+-------------------------------------------------------------+
|                                                             |
|   +-----------------------------------------------------+   |
|   |  🧠 Mindful Pause                            [ ⚙️ ] |   |
|   |  You've watched 5 Shorts in a row.                  |   |
|   |                                                     |   |
|   |  Solve to continue scrolling:                       |   |
|   |                                                     |   |
|   |                ┌─────────────────┐                  |   |
|   |                │   47  +  38  =  ? │                  |   |
|   |                └─────────────────┘                  |   |
|   |                                                     |   |
|   |  [ Enter Answer...           ]  [ Submit ]          |   |
|   |                                                     |   |
|   |  -------------------------------------------------  |   |
|   |                                                     |   |
|   |  [ 🎬 Convert to Standard Video ]                   |   |
|   |  [ 🚪 Close YouTube Tab ]                           |   |
|   |                                                     |   |
|   |     ☕ Give me a tip        🔗 Share with a friend    |   |
|   +-----------------------------------------------------+   |
|                                                             |
+-------------------------------------------------------------+
```

#### UI Elements Breakdown:
1. **Backdrop Blur & Dim:** `backdrop-filter: blur(8px); background: rgba(0, 0, 0, 0.75);` visually isolates the user from the video preview.
2. **Header & Context Badge:** Displays current streak or time spent (e.g., *"Shorts watched this session: 8"*). A **⚙️ Settings** button in the header opens the full Settings page in a new tab, so users can find settings from where they actually meet the extension. The gate stays up on the YouTube tab.
3. **Challenge Box:** Clear, high-contrast typography displaying the prompt.
4. **Interactive Form:**
   - Input field auto-focused on load.
   - Pressing `Enter` automatically submits.
   - Shake animation on incorrect submission + 3-second cooldown timer.
5. **Escape Hatches (Secondary Actions):**
   - **Convert Button:** Redirects `/shorts/VIDEO_ID` to `youtube.com/watch?v=VIDEO_ID`. Hidden when the gate appears on a regular video. The converted video is not gated again.
   - **Leave Button:** Closes the current browser tab.
6. **Support & Share:** two small, muted links under the escape hatches: **☕ Give me a tip** (Ko-fi) and **🔗 Share with a friend**. They sit at the point where the user feels the extension working, and stay low-key so they never compete with the challenge.

---

### B. Extension Popup UI (Quick Settings & Stats)

Accessible when the user clicks the extension icon in the Chrome toolbar.

```
+--------------------------------------------------+
|  🧠💡 Short the Shorts                 [ ⚙️ ]   |
+--------------------------------------------------+
|  STATUS: ACTIVE | PAUSED | AUTO-OFF              |
|  [ Enable / Disable Toggle ]                     |
|                                                  |
|  TODAY'S SUMMARY                                 |
|  • Shorts Viewed: 14                             |
|  • Gates Solved: 4                               |
|  • Time Saved (Est.): ~25 mins                   |
|                                                  |
|  FRICTION FREQUENCY                              |
|  (•) Every Short                                 |
|  ( ) Every 3 Shorts                              |
|  ( ) Every 5 Shorts                              |
|  ( ) Every 10 Shorts                             |
|                                                  |
|  CHALLENGE TYPE                                  |
|  [ Micro Math                             ▼ ]    |
|                                                  |
|  LEVEL: MEDIUM                                   |
|  Easy ────────────●──────────── Hard             |
|  Adds times tables & division, e.g. 7 × 8        |
|                                                  |
|  [ Save Settings ]                               |
|  ⚙️ All settings (auto-off times & more) →       |
+--------------------------------------------------+
```

- **⚙️** (header) and the **All settings →** link both open the full Settings page (section C).
- Labels say "videos" instead of "Shorts/Reels" when the scope is "All videos".
- **Level slider** (Easy / Medium / Hard) applies to whichever challenge type is selected:

| Level | Micro Math | Word Unscramble |
| :--- | :--- | :--- |
| **Easy** | 2-digit add/subtract (`47 + 38`) | 4-letter words |
| **Medium** | + times tables & exact division (`7 × 8`, `56 ÷ 7`) | 6-letter words |
| **Hard** | 3-digit add/subtract, `18 × 7`, `204 ÷ 12`, fractions (`1/3 + 1/4`, any equivalent answer accepted) | 8-letter words |

---

### C. Settings Page (opened from ⚙️)

Opens in a full tab, from the popup's ⚙️ / "All settings" link or the gate's ⚙️. It holds **every** setting: the popup's quick settings are repeated here, so users who never open the toolbar popup can still change everything.

```
+--------------------------------------------------------+
|  🧠💡 Short the Shorts · Settings                      |
|                                                        |
|  STATUS: ACTIVE                         [ toggle ]     |
|                                                        |
|  SITES                                                 |
|  [x] YouTube Shorts                                    |
|  [x] Instagram Reels                                   |
|                                                        |
|  WHERE TO GATE                                         |
|  (•) Shorts and Reels only                             |
|  ( ) All videos (adds regular YouTube videos)          |
|                                                        |
|  FRICTION FREQUENCY                                    |
|  (•) Every Short  ( ) 3  ( ) 5  ( ) 10                 |
|                                                        |
|  CHALLENGE TYPE                                        |
|  [ Micro Math                                   ▼ ]    |
|  LEVEL: MEDIUM                                         |
|  Easy ───────────────●─────────────── Hard             |
|                                                        |
|  AUTO-OFF TIMES                                        |
|  The gate is always on unless you add times here.      |
|  [x] Switch off automatically at these times           |
|  ┌──────────────────────────────────────────────────┐  |
|  │ (Mon)(Tue)(Wed)(Thu)(Fri) ( Sat )( Sun )         │  |
|  │ Off from [ 17:00 ] to [ 09:00 ]              ✕   │  |
|  └──────────────────────────────────────────────────┘  |
|  ┌──────────────────────────────────────────────────┐  |
|  │ ( Mon )( Tue )( Wed )( Thu )( Fri ) (Sat)(Sun)   │  |
|  │ Off from [ 00:00 ] to [ 00:00 ]              ✕   │  |
|  └──────────────────────────────────────────────────┘  |
|  [ + Add another time ]                                |
|                                                        |
|  [ Save Settings ]                                     |
|  ----------------------------------------------------  |
|  SUPPORT & SHARE                                       |
|  Short the Shorts is free, forever.                    |
|  [ ☕ Give me a tip ]     [ 🔗 Share with a friend ]    |
|            [ QR code (optional) ]                      |
+--------------------------------------------------------+
```

- **Auto-off times:** the gate is **on by default**. Users add one or more times when it should switch off, each with its own days and hours. The list starts pre-filled (greyed out until the box is ticked) with a suggestion: weekday evenings and nights (Mon–Fri 17:00 → 09:00) plus all weekend (Sat–Sun, all day).
  - Same start and end time = the whole day.
  - Start later than end (17:00 → 09:00) = after 17:00 *and* before 09:00 on each selected day.
  - The status at the top previews the unsaved times live (e.g. flips to AUTO-OFF), so users can check before saving.
- **Sites:** each supported site can be switched off on its own. On Instagram, the gate covers the Reels tab and Reel links, not Reels in the home feed or Stories. The gate on Instagram has no "Convert" button, and its close button reads "Close Instagram Tab".
- **Frequency labels** switch between "Shorts/Reels" and "videos" as soon as the scope radio changes.
- **Support:** the tip button and QR code only appear once a link/image is configured. The product is always free; support is optional.
- **Share:** uses the native share sheet where available, otherwise copies a short blurb and the Chrome Web Store link to the clipboard.

---

## 5. Visual Styling & Theme Specifications

To maintain native feel and visual harmony, the UI matches YouTube Dark Mode aesthetics.

### Color Palette

| Token | Hex Code | Usage |
| :--- | :--- | :--- |
| **Background Overlay** | `#0F0F0F` (with 85% opacity) | Main backdrop dimming layer |
| **Card Surface** | `#212121` | Modal container background |
| **Primary Accent** | `#FF0000` (YouTube Red) or `#3EA6FF` (Focus Blue) | Primary button & focus rings |
| **Text Primary** | `#F1F1F1` | Headings, prompts, and active text |
| **Text Secondary** | `#AAAAAA` | Subtitles, statistics, and metadata |
| **Error / Cooldown** | `#CC0000` / `#FF4E4E` | Failed attempt feedback and timers |

### Typography & Component Specs
- **Font Family:** `Roboto`, `-apple-system`, `BlinkMacSystemFont`, `sans-serif` (matches native YouTube font stack).
- **Border Radius:** `12px` cards, `8px` inputs and buttons.
- **Transitions:** `all 0.2s ease-in-out` for snappy, native feel.

---

## 6. Functional & Edge Case Behaviors

1. **YouTube Navigation via SPA (Single Page Application):**
   - YouTube doesn't do full page reloads when moving between videos or pages.
   - *Design Solution:* The extension uses a `MutationObserver` on the `#content` container and checks `window.location.href` changes to trigger gates reliably.

2. **Keyboard Accessibility:**
   - Focus is automatically pulled into the challenge input when the modal appears.
   - Pressing `Tab` cycles exclusively within the modal elements (focus trapping) until the challenge is completed.

3. **Incorrect Answer Penalty:**
   - Input flashes red with a horizontal shake animation (`@keyframes shake`).
   - Submit button is disabled for 3 seconds, displaying a countdown: `"Try again in 3s..."`. A fresh puzzle loads when it ends.

---

## 7. Development Roadmap & MVP Scope

### Phase 1: MVP (Minimum Viable Product)
- Manifest V3 architecture with local DOM injection.
- Basic Math prompt generator (Addition & Subtraction).
- Soft gate on *every* Short.
- "Redirect to Standard Video Player" escape button.

### Phase 2: User Settings & Polish
- Popup menu for configuration (Interval selection: Every 1, 3, 5, or 10 Shorts).
- Additional challenge modes (Word Unscramble, Type Affirmation).
- Difficulty slider (Easy / Medium / Hard).
- Settings page: sites, gate scope (Shorts and Reels only / All videos) and auto-off times.
- Instagram Reels support (Reels tab and Reel links).
- Local storage session stats (Daily count).
- Support (Ko-fi tip / QR) and Share links.

### Phase 3: Extras (always free)
- Custom challenge lists.
- Local analytics dashboard.