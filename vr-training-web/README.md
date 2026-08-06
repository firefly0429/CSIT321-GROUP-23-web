# VR Training Simulator — Web Demonstration Prototype

## Fixes applied after the first review

A review of the initial handoff found a build-breaking TypeScript error
plus several UX/logic gaps. Fixed:

| # | Issue | Fix |
|---|---|---|
| 1 | **`npm run build` would fail** — `TrainingPage.tsx`'s `handleHint()` accessed `activeSession.taskResults` without a null check, and TypeScript doesn't carry a null-check from an outer scope into a nested function | Added `if (!activeSession) return;` at the top of `handleHint()`. Checked every other `activeSession.` access in the file for the same risk — all others are safe (same-scope, not nested closures). |
| 2 | Refreshing mid-scenario reset the *visual* scene (hazard cone back, helmet back on the table, locks/rungs reset) even though the checklist correctly showed completed tasks | Added a `useEffect` keyed on `activeSession?.sessionId` that restores `hazardRemoved`/`helmetWorn`/lock state/rung answers from the persisted task-completion data. **Known limit:** progress *within* an unfinished task (e.g. one lock activated but not the other) still isn't persisted — only whole-task completion is. |
| 3 | Pause → Settings → Back left the page in a "stuck paused" state (dialog gone, timer stopped, scene looking active) | The pause menu's Settings button now calls `resumeSession()` before navigating away. |
| 4 | The Text Size slider barely affected most on-screen text | Fixed to scale `document.documentElement`'s root font-size (percentage) instead of an inline `rem` style on a wrapper `<div>` — Tailwind's text utilities are `rem`-based and resolve against the root, not an ancestor. |
| 5 | Educator's "Review Sessions" always showed "No training attempts yet" | `HistoryPage` now shows every session when the signed-in user is an Educator, instead of filtering to sessions matching the educator's own `userId` (which never has any). Added a conditional "User" column. Also added a `RequireRole` route guard so a Trainee typing `/educator` directly can no longer reach it. |
| 6 | "Clear Demo Data" actually deleted *all* session data, including real attempts | Added `sessionRepository.clearDemoSessions()` / the store's `clearDemoData()`, which only removes records with a `demo-` session id prefix; rewired the button and its confirmation dialog to match. |
| — | Clicking "Generate Demo Data" repeatedly kept appending another ~12 rows each time | `seedDemoData` now replaces previously-generated demo rows instead of appending on top of them. |
| — | Generated demo sessions had `endTime === startTime` while claiming several minutes of `durationSeconds` | Fixed to `endTime = startTime + durationSeconds`. |
| — | No Date Range filter on the Educator Dashboard (present in the original spec) | Added start/end date inputs wired into the filter logic. |
| — | Clickable `Card` tiles (Role Selection, Scenario Selection, Main Menu, ...) were mouse-only — not reachable or activatable via Tab/Enter/Space | Fixed once in the shared `Card` component (auto-adds `role="button"`, `tabIndex`, and Enter/Space handling whenever `onClick` is passed), covering every page that uses it. |
| — | High Contrast mode only changed card border colours | Expanded to also brighten `text-muted` text and strengthen borders on buttons/inputs/selects. |
| — | The "Sound effects" setting had no actual effect anywhere | Added a small Web Audio API tone utility (`src/lib/sound.ts`, no audio files needed) and wired it into the training simulation's success/mistake feedback via a `notify()` wrapper, gated on the setting. |

### Still open

- **Reduced Motion is only partially covered.** The CSS rule
  (`.reduced-motion * { animation-duration: 0.001ms !important; ... }`)
  works for CSS-driven animation, but several effects (page transitions,
  the Dialog modal, the Feedback score ring, the rung-answer popover) are
  driven by Framer Motion directly setting styles via JavaScript, which a
  CSS override can't fully suppress. Training-scene ambient animation
  (scanning line, hazard bob) already checks `settings.reducedMotion` in
  code and is fully respected.
- **Subtitles setting only controls toasts**, not a separate always-on
  feedback channel — toasts are treated as the primary feedback mechanism
  here rather than a true VR-style subtitle bar overlay.
- **No `package-lock.json`** is committed, since `npm install` has never
  actually been run against this project in the environment it was
  written in (no network access there). Run `npm install` once locally
  and commit the generated lockfile before treating this as final.
- Inter is loaded via a Google Fonts `<link>` in `index.html` (not a
  missing font as such), but that does mean it silently falls back to
  the system font on a fully offline machine — self-hosting the font
  file would remove that dependency if it matters for your demo
  environment.

## Project purpose

This is a browser-based demonstration of the proposed VR Training Simulator's
complete user journey and interface behaviour. It is **not** a VR
application and does not use Unity or Unity WebGL — physical XR
interactions (grab, place, activate, inspect) are represented with
web-native equivalents: dragging, clicking, hotspots, and animated
feedback. Its purpose is to let a supervisor, client, or classmate click
through the entire proposed system today, before the real Unity VR build
exists.

> "This browser prototype demonstrates the complete user journey and
> interface behaviour of the proposed VR Training Simulator. Physical XR
> interactions are represented using web-based animation and pointer
> interactions pending Unity integration."

## Technology stack

- React 18 + TypeScript
- Vite (dev server & build)
- React Router (routing)
- Tailwind CSS (styling)
- Framer Motion (page transitions, drag interactions, animated feedback)
- Recharts (Educator Dashboard charts)
- Lucide React (icons)
- Zustand (global state)
- Browser `localStorage` (all persistence — no backend, no database)

## Installation

```
npm install
```

## Running in development

```
npm run dev
```

Opens on `http://localhost:5173` by default.

## Building for production

```
npm run build
npm run preview   # optional - serve the production build locally
```

The `build` script runs `tsc -b` before `vite build`, so a type error will
fail the build rather than silently shipping.

**A note on verification:** this project was written in an offline
environment with no network access, so `npm install` / `npm run build`
have not actually been executed against it here. The source was checked
by hand for the usual failure points (unresolved imports, unused/missing
imports, `React` namespace usage without an import, a risky
`Object.fromEntries` type-inference case in the training simulation) and
those issues were found and fixed — but "checked by hand" is not the same
guarantee as a real compile. **Run `npm install && npm run build` as the
first step** and treat any errors it surfaces as expected follow-up work,
not a sign the whole approach is wrong.

## Routes

| Route | Page |
|---|---|
| `/` | Redirects to `/role` |
| `/role` | Role selection |
| `/home` | Main menu (branches by role) |
| `/scenarios` | Scenario selection |
| `/briefing/:scenarioId` | Scenario briefing |
| `/training/:scenarioId` | Interactive training simulation |
| `/feedback/:sessionId` | End-of-scenario feedback |
| `/history` | Session history |
| `/educator` | Educator dashboard |
| `/settings` | Accessibility & comfort settings |

## Test accounts

No login/authentication exists. Selecting a role on `/role` signs in as a
fixed prototype account:

- **Trainee01** — Trainee role
- **Educator01** — Educator role
- Administrator is shown but locked ("Coming Soon")

## Demonstration flow

1. `/role` → choose **Trainee**.
2. `/home` → **Start Training**.
3. `/scenarios` → **Ladder Inspection** (the only fully built scenario;
   Fire Extinguisher Inspection and Equipment Safety Check are shown as
   "Coming Soon" cards so the multi-scenario design is visible without
   being fully built out; Healthcare Training and Technical Maintenance
   domains are shown the same way).
4. `/briefing/ladder-inspection` → review objectives/controls/safety →
   **Start Simulation**.
5. `/training/ladder-inspection` → complete the 5 tasks in order:
   remove the floor hazard, drag the helmet onto the trainee, activate
   both ladder locks, inspect all 5 rungs (rung 3 is damaged — mark it
   correctly), then confirm the final inspection.
   - Try clicking the ladder before removing the hazard to see the
     "inspect the area first" mistake path.
   - Try the **Pause** button to see the pause menu (Resume / Restart /
     Settings / Exit), and **Exit** to see a session saved with status
     `exited`.
6. `/feedback/:sessionId` → animated score ring, per-task breakdown,
   improvement notes.
7. `/history` → the just-completed attempt appears in the table.
8. Sign out, sign back in as **Educator01** (or click **Open Educator
   Dashboard** directly) → `/educator` → click **Generate Demo Data** to
   populate all four charts with ~12 realistic records, then explore the
   filters and **Export JSON**.
9. `/settings` → change text size / high contrast / reduced motion and
   watch it apply immediately across the app; refresh the page to see it
   persisted.

## Persistence explanation

Everything lives in the browser's `localStorage` under four keys:

- `vr-user-session` — the currently signed-in role/user
- `vr-active-session` — the in-progress training attempt, if any (so
  refreshing mid-scenario resumes where you left off)
- `vr-training-sessions` — every completed/exited session record
- `vr-accessibility-settings` — saved accessibility preferences

All reads are wrapped in `try`/`catch`; corrupted or missing data falls
back to sensible defaults instead of crashing the app (see
`sessionRepository.ts` / `settingsService.ts`).

There is no server, no database, and no account system — clearing your
browser's site data resets the prototype entirely.

## Scoring rules (this web prototype's version)

The source documentation didn't mandate one specific formula, so this
prototype uses a simple, explicit rule set:

- 5 tasks, 20 points each (100 total)
- Completed task: full 20 points; incomplete task: 0
- Each mistake: -5 points
- Score is clamped to 0–100
- Pass score: 70

## Current limitations

- **Not a Unity/VR application.** All "physical" interactions (grab,
  place, activate) are simulated with pointer/drag/click events on a 2.5D
  scene, not real 3D or XR input.
- **Only Ladder Inspection is fully built.** The other two Workplace
  Safety scenarios and both other domains (Healthcare Training, Technical
  Maintenance) are visible as "Coming Soon" cards with no task content,
  so the multi-domain design is demonstrable without three more full
  simulations having been built.
- **No accounts, no backend, no real multi-user data** — this is a
  single-browser demonstration, not a deployed multi-user system.
- **No automated tests.** Correctness was checked by careful manual
  review, not a test suite.
- **Not yet verified against a real `npm run build`** in this
  environment — see the note under "Building for production" above.

## Future Unity integration plan

This prototype's data model (`src/types/index.ts`) and session lifecycle
(`src/store/useTrainingStore.ts`) were deliberately kept close to the
shape used in the team's parallel Unity/C# prototype (`SessionResult`,
`TrainingTask`, required/mistake-penalty scoring, session states). The
intent is that:

1. This web prototype continues to serve as the fast-iterating UX/flow
   reference and stakeholder demo.
2. The Unity build is where real VR interactions, 3D environments, and
   XR Interaction Toolkit input actually live.
3. If useful, this web app's screens could later become a companion
   desktop/browser dashboard (Session History, Educator Dashboard)
   reading real exported session data from the Unity build, rather than
   being replaced outright.

No code sharing between the two is assumed or required — they are
intentionally independent today.
