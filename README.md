# VIDE CORTEX — web app

Control-room console for **Vide Industrial** fault detection and predictive maintenance.
Next.js 16 + TypeScript + Tailwind v4. Rebuilt from the original 5 static HTML pages
(still in git history at commit `dd6d0f2`) with the same pixel/terminal design.

| Route | Page |
|---|---|
| `/` | **Overview** — fleet tiles, selected machine, instant ML prediction, attention queue |
| `/machines` | **Machines** — registry, profile + engineer contact, photos, flagged notes, send report |
| `/devices` | **Devices** — edge-node registry, machine linking, feed health, firmware provisioning |
| `/diagnostics?m=<machine>` | **Diagnostics** — live graph, edge vs cloud analysis, verdict, maintenance, LLM chat |
| `/predictions?m=<machine>` | **Predictions** — fused failure forecast, degradation graph, audit log, deep-context LLM, print report |

## Run

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

**No backend yet?** Mock mode is on by default (`NEXT_PUBLIC_USE_MOCKS=true`): a fake 4-machine
fleet with live-updating readings. Toggle it at runtime from **SOURCE** (top bar) or the
Overview connection card.

**Real backend:** start FastAPI (`python main.py`, serves `http://127.0.0.1:8000/api`), untick
mock data, set the URL, press **Test connection**. Either add `http://localhost:3000` to
`api.cors_origins` in the backend's `config.yaml`, or use the proxy: set
`API_PROXY_TARGET=http://127.0.0.1:8000` and `NEXT_PUBLIC_DEFAULT_API_URL=/api`.

| Env var | Purpose |
|---|---|
| `NEXT_PUBLIC_DEFAULT_API_URL` | Backend base URL when the operator hasn't saved one |
| `NEXT_PUBLIC_USE_MOCKS` | `true` = fake fleet by default |
| `API_PROXY_TARGET` | Optional: proxy `/api/*` to the backend (no CORS needed) |

Scripts: `npm run typecheck`, `npm run lint`, `npm run build`, `npm start`.

## Where the API calls are

All backend calls are in **`src/lib/api/endpoints.ts`**, each with an `API:` comment
(path, backend status, returned shape). Responses are validated in `src/lib/api/normalize.ts`.
Outstanding server work: `grep -rn "TODO(backend)" src`.

| Call | Path used | Backend status |
|---|---|---|
| health | `GET /health/detailed` | exists |
| machines | `GET /machines`, `POST /machines` | exists |
| profile sync | `PATCH /machines/{name}` | **missing** — profiles stay local |
| readings | `GET /readings/recent/{m}?limit=N` | exists (404 when empty → treated as `[]`) |
| critical events | `GET /diagnostics/critical-events?limit=N` | exists |
| analyze | `POST /diagnostics/analyze` | exists (verify temperature/vibration fields aren't dropped) |
| LLM chat | `POST /diagnostics/chat {message}` | exists (confirm response field name) |
| maintenance | `GET /maintenance/history/{m}`, `POST /maintenance/record` | exists (confirm body fields) |
| devices | `GET/POST /devices`, `PATCH /devices/{id}` | **missing** — registry stays local |

## Fixed vs. the HTML version

- Cloud analysis now shows the LLM text (`llm_analysis`) and the reason when it's unavailable (`llm_error`).
- LLM chat calls the real `POST /diagnostics/chat` (the old chain never reached it).
- Maintenance uses the real routes; backend and local rows are shown separately and delete only touches local rows.
- Overview goes OFFLINE when the backend dies (one global health check drives every badge), has a machine selector, and sends the same analysis inputs as Diagnostics.
- Devices: "last payload" is the newest reading (was the oldest); health counts only readings from that `device_id` when readings carry one; shown and copied POST URLs match; https URLs no longer get `:80`.
- Predictions: forecast is plotted on a real time axis; RUL never goes negative; urgency can't say NONE when hours-left is short; no LLM call on every load; no duplicate log entries; the real history span is shown instead of a fixed "2 months" label.
- Diagnostics: an engineer message you've edited isn't overwritten by live updates; the chart no longer reallocates its canvas every frame, animates at ~30fps only while LIVE, and is sharp on HiDPI screens.
- All backend text is rendered safely (no `innerHTML`); `prompt`/`confirm`/`alert` replaced with themed modals.
- Light/dark theme is global (all pages, charts included) with no flash on load; JetBrains Mono is bundled; the pixel-grid background is actually visible now (the old CSS covered it).
- Machines created offline are registered with `POST /machines` when the backend is reachable.

Coding conventions: see [CLAUDE.md](CLAUDE.md).
