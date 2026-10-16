# CLAUDE.md — VIDE CORTEX web app

Conventions for anyone (human or AI) changing this codebase. Read before editing.

## What this is

Factory control-room console for **Vide Industrial** (fault detection + predictive maintenance).
Next.js 16 (App Router) + TypeScript (strict) + Tailwind v4. Talks to a Python FastAPI backend
(not in this repo) over HTTP polling. Converted from 5 static HTML pages (see git history, commit `dd6d0f2`).

```bash
npm run dev        # http://localhost:3000
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run build      # production build — must pass before committing
```

## Ground rules

- **Never push to GitHub.** Commit locally on a branch only; the owner pushes.
- **No authentication.** The console runs open on the factory LAN by decision of the owner.
  Do not add login, PIN, API keys or middleware auth unless explicitly asked.
- **The backend is not finished.** The app must never crash on missing, renamed or failing endpoints.
- Bundle everything (fonts included). No CDNs, analytics or external requests — sites may be offline.

## Project structure

```
src/
  app/                    routes only: page.tsx = server component with metadata → renders a *View
    layout.tsx            Sidebar + Topbar + FooterBar + providers + no-flash theme script
    globals.css           ALL design tokens (dark + light) + Tailwind @theme mapping
    error.tsx             route error boundary (page fault card, layout stays usable)
  components/
    ui/                   design-system primitives (Card, Tile, KV, Badge/Pill, Button, Field, Modal…)
    layout/               Sidebar, Topbar, FooterBar, ConnectionPanel, PixelLogo, PageIntro
    charts/               canvas charts + useCanvas + palette (reads --chart-* tokens)
    chat/                 ChatPanel (LLM)
    shared/               cross-page pieces (AnalysisSummary, ContactButtons)
    <page>/               page-specific components; <Page>View.tsx is the page's client root
  hooks/                  usePoll, useMachines, useReadings, useMaintenance, useLocalStore, …
  lib/
    api/endpoints.ts      ← EVERY backend call
    api/normalize.ts      ← response guards (unknown → typed)
    api/client.ts         fetch wrapper that never throws
    api/mock/             fake fleet, same VideApi interface
    domain/               pure logic: status scores, regression/forecast, messages, firmware…
    storage.ts            localStorage keys + validated read/write
    types.ts, constants.ts, format.ts
  providers/              ApiProvider (connection), ToastProvider, PageTitleProvider
```

Where new code goes:
- New backend call → a function in `lib/api/endpoints.ts` **and** `lib/api/mock/index.ts`.
- Pure calculation → `lib/domain/*` (no React, no fetch, easy to test).
- Reusable visual piece → `components/ui`. Page-only piece → `components/<page>/`.

## API rules (most important)

1. **Components never call `fetch`.** They call `api.someFunction()` from `useApi()`.
2. Every function in `endpoints.ts` has an `API:` comment block:
   ```ts
   /**
    * API:     METHOD /path (relative to base URL, which ends in /api)
    * Backend: exists / DOES NOT EXIST YET / known quirks
    * Returns: normalised shape
    * TODO(backend): what the server needs to change
    */
   ```
   Call sites in components add a one-line `// API: …` pointer when the call is not obvious.
   `grep -rn "TODO(backend)" src` lists all outstanding backend work.
3. **Nothing throws.** `request()` returns `ApiResult<T>` = `{ ok: true, data } | { ok: false, error }`.
   Always branch on `res.ok`.
4. **Every response goes through a normaliser** in `normalize.ts`. Treat raw data as `unknown`.
   Accept bare arrays and wrapped objects; field-name fallbacks live only in the normaliser.
5. "No data" is not an error: a 404 for readings/history becomes `[]`.
6. Readings are **newest-first** everywhere they leave the API layer. Use `oldestFirst()` to plot.
7. Keep the mock (`lib/api/mock`) in sync — it represents the backend **as it should be** once the
   TODOs are done, so pages can be built and demoed without a server.
8. Polling uses `usePoll` (skips hidden tabs, no overlapping requests). Batch per tick; the backend
   is single-worker SQLite.

## Resilience patterns

- Tag async results with what they belong to (`{ api, machine, … }`) and ignore stale ones,
  instead of clearing state in effects. See `useReadings`, `useMachines`, `useMaintenance`.
- On a failed refresh keep the last good data and show an OFFLINE/error line — never blank the page.
- Format numbers through `lib/format.ts` (`fmt.temp`, `fmt.vib`, …); they return "—" for null/NaN.
- `noUncheckedIndexedAccess` is on: handle `arr[0]` being `undefined`.
- One connection status for the whole app (`useApi().status`) from `GET /health/detailed`.

## Design rules (do not "modernise")

- Colours only via tokens: `bg-panel`, `text-accent`, `border-line`, `text-crit` …
  Never hardcode hex in components. New colour → add a token for **both** themes in `globals.css`.
- Canvas charts read `--chart-*` tokens via `readPalette()` so they follow the theme.
- JetBrains Mono everywhere (self-hosted via `@fontsource/jetbrains-mono`).
- Hard edges: 2px borders, `border-radius: 0` (rounded/shadow utilities are disabled), no shadows.
- Dashed dividers (`KV` rows, tables), corner notch (`notch` utility on cards), 4px pixel-grid body.
- Motion is steppy: `animate-tick` (`steps(4)`), `animate-blink` (`steps(2)`), 1px button press.
- Fixed chart scales (temp 0–100, vib 0–10, power 0–15, load 0–100). Do not auto-scale.
- Copy voice: terse, operational, UPPERCASE labels (`FLEET ONLINE`, `ATTENTION QUEUE`).
  Eyebrows are written in caps in the source (no CSS uppercase, so machine names keep their case).
- Keyboard/kiosk friendly: real `<button>`s, labelled inputs, visible focus, no hover-only actions.
- Use `Modal` / `PromptModal` / `ConfirmModal` — never `alert()`, `prompt()`, `confirm()`.

## localStorage contract

Keys are shared with the old HTML pages — **never rename** (`lib/storage.ts`):
`vide_backend_url`, `vide_theme`, `vide_machine_profiles`, `vide_machine_notes`,
`vide_machine_photos`, `vide_devices`, `vide_maintenance_log`, `vide_pred_log`
(+ `vide_use_mocks`, new). Read with `useLocalStore(key)`; writes return `false` when storage
is full — handle it (toast). Photos are downscaled to ≤800px JPEG before saving.

## Code style

- TypeScript strict; no `any`. Types for domain objects live in `lib/types.ts`.
- Function components, named exports. File = one main component, PascalCase name.
- `"use client"` only where needed (views, hooks, interactive components). `app/**/page.tsx` stays
  a server component that exports `metadata` and renders the client view.
- Props: inline type or a local `interface Props`. Keep components under ~200 lines; split by card.
- Constants that carry product meaning go in `lib/constants.ts` with a comment (thresholds, timings).
- Comments explain **why** (backend quirks, deliberate design choices), not what the code says.
- React 19 hook rules are enforced by ESLint (no `Date.now()`/random during render, no setState
  directly in effect bodies). Use `useEffectEvent` (see `usePoll`) for callbacks used inside effects.
- Before committing: `npm run typecheck && npm run lint && npm run build`.
