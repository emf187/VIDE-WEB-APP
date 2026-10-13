# vide-webapp — VIDE CORTEX frontend (standalone)

Single-page frontend. Visual copy of `vide ml/static/index.html`.

## Run

Option 1 — just open it:
```
Documents/vide-webapp/index.html
```
Double-click. Then set backend URL (default `http://127.0.0.1:8000/api`) and click **Test connection**.

Option 2 — serve locally (avoids file:// CORS quirks):
```powershell
cd "$env:USERPROFILE\Documents\vide-webapp"
python -m http.server 8080
# open http://127.0.0.1:8080
```

## Backend expected endpoints (base = configurable URL, default http://127.0.0.1:8000/api)

- GET `/health/detailed`
- GET `/machines`
- GET `/readings/recent/{machine}?limit=1`
- GET `/diagnostics/critical-events?limit=5`
- POST `/diagnostics/analyze`

Start backend from the `vide ml` folder:
```powershell
python main.py
# or
python start_server.py
```

## Notes

- Training / ML is handled elsewhere. This page calls `POST /diagnostics/analyze` with `force_ml:true` to get the trained-model prediction.
- Sidebar items other than Overview are stubbed with a toast in this single-page build.
- Backend URL is saved in localStorage (`vide_backend_url`).
