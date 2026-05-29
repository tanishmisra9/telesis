# Telesis

F1 intelligence platform: pace spread analysis and circuit maps from FastF1 telemetry.

## Structure

- `backend/` — FastAPI + data engine
- `frontend/` — Vite + React

## Backend (local)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000 --timeout-keep-alive 300
```

- Health: `GET http://localhost:8000/health`
- Pace (cache-first, blocks on first load): `GET http://localhost:8000/sessions/{year}/{round}/{session_type}/pace`

**Timeouts:** The first request for a session runs the full FastF1 pipeline inline and can take several minutes. Use a long `--timeout-keep-alive` locally. On Railway or any reverse proxy, raise the upstream request timeout so cold loads are not cut off.

## Frontend (local)

```bash
cd frontend
npm install
npm run dev
```

Copy `frontend/.env.example` to `frontend/.env` if you need a custom API URL (default: `http://localhost:8000`).

## Verify M4 (circuit map)

```bash
cd backend && source .venv/bin/activate
python -m app.engine.verify_circuit 2024 1 R    # Bahrain
python -m app.engine.verify_circuit 2024 16 R   # Monza
python -m app.engine.verify_circuit 2024 1 Q      # Quali geometry
```

API:

```bash
curl -s http://localhost:8000/sessions/2024/1/R/circuit | head -c 400
```

Frontend loads pace first, then circuit (sequential) so a cold session runs the pipeline once.

## Verify M3 (pace chart)

1. Start backend and frontend (`npm run dev` in `frontend/`).
2. Load **2024 · R1 · R** (defaults in the picker).
3. Confirm chart: fastest left, box/median/mean/whiskers/outliers, constructor toggle.
4. Reload same session: should be near-instant from SQLite cache.
5. Cross-check VER, PER, SAI against `python -m app.engine.verify_pace` table.

## Verify M1 (telemetry)

```bash
cd backend && source .venv/bin/activate
python -m app.engine.verify_telemetry
```

## Verify M2 (pace)

Print box-plot stats locally:

```bash
cd backend && source .venv/bin/activate
python -m app.engine.verify_pace
```

Cold cache then cached via API:

```bash
rm -f backend/app/data/telesis.db
time curl -s http://localhost:8000/sessions/2024/1/R/pace -o /tmp/pace.json
time curl -s -o /dev/null http://localhost:8000/sessions/2024/1/R/pace
```
