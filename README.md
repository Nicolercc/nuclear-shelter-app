# Nuclear Escape Router

An interactive nuclear emergency preparedness and simulation tool for New York City. Built for educational use — visualize blast zones, find the nearest shelter, and plan evacuation routes based on your location and the type of event.

> **Disclaimer:** This is an educational simulation tool only. In a real emergency, follow official guidance from [NYC OEM](https://nyc.gov/emergency) and [FEMA](https://ready.gov). See [docs/DISCLAIMER.md](docs/DISCLAIMER.md) for the full disclaimer.

---

## Features

- **Interactive Leaflet Map** — dark-themed NYC map with layer rendering  
- **Blast zone visualization** — four yield types with concentric zones  
- **Click-to-place blast center** — set the detonation point on the map  
- **Address search** — heuristic lookup offline; upgrade to Google Geocoding via the API when `GOOGLE_MAPS_KEY` is set  
- **GPS location** — browser geolocation for your position  
- **Shelter finder** — distance ordering over a fixed NYC shelter set  
- **Escape route panel** — Google Directions via API when configured; otherwise illustrative steps  

---

## Architecture

pnpm monorepo:

```
/
├── artifacts/
│   ├── nuclear-escape/      # React + Vite SPA
│   └── api-server/          # Express API (weather, geocode, directions proxies)
├── lib/
│   ├── api-spec/, api-zod/, api-client-react/   # OpenAPI + codegen
│   └── db/                  # Drizzle (optional future persistence)
├── docs/
│   ├── ARCHITECTURE.md
│   └── DISCLAIMER.md
├── .github/workflows/ci.yml
├── Dockerfile               # Production image for api-server only
└── README.md
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for diagrams and data flow.

---

## Quick start

**Prerequisites:** Node.js 20+, pnpm 9+, Corepack enabled (`corepack enable pnpm`).

```bash
git clone <repo-url>
cd Nuclear-Force
pnpm install

# Terminal 1 — frontend (proxies /api → :3001 in dev)
cd artifacts/nuclear-escape
PORT=3000 pnpm dev

# Terminal 2 — API
cd artifacts/api-server
PORT=3001 pnpm dev
```

Open `http://localhost:3000`. Configure API keys so the SPA can reach live providers (optional — heuristics and simulated weather work without keys).

---

## Environment variables

| Variable | Where | Purpose |
|---------|-------|---------|
| `PORT` | Both apps | Listen port (`3000` / `3001` typical) |
| `VITE_API_BASE_URL` | Frontend build only | Cross-origin API base (omit for same-origin `/api`) |
| `API_PROXY_TARGET` | Frontend dev (`vite`) | Proxy target for `/api` (default `http://127.0.0.1:3001`) |
| `CORS_ORIGIN` | API | Comma-separated allowed browser origins (`https://yourapp.com`) |
| `OPENWEATHER_API_KEY` | API | Live wind/weather (`/api/weather`) |
| `GOOGLE_MAPS_KEY` | API | Geocoding + Directions (`/api/geocode`, `/api/escape-route`) |

Copy `artifacts/api-server/.env.example` and `artifacts/nuclear-escape/.env.example` into `.env` files as needed — never commit real secrets.

---

## Build & CI

From the repo root:

```bash
pnpm run typecheck   # libs + artifacts
pnpm run build       # production build for all workspaces that define build
```

GitHub Actions runs the same on every push / PR (`/.github/workflows/ci.yml`).

---

## Deployment

### Docker (recommended — single container)

Builds the SPA and API; serves both on port **8080** (same origin, no `VITE_API_BASE_URL` needed).

```bash
docker compose up --build
# open http://localhost:8080
```

### Google Cloud Run

The root `Dockerfile` is tuned for Cloud Run: listens on **`0.0.0.0`**, uses **`PORT=8080`**, and serves the built SPA from `STATIC_DIR`.

1. Enable APIs and create an Artifact Registry repo (once per project):

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
gcloud artifacts repositories create cloud-run-source-deploy \
  --repository-format=docker --location=us-central1
```

2. Build with Cloud Build (uses `cloudbuild.yaml`):

```bash
gcloud builds submit --config=cloudbuild.yaml
```

3. Deploy the image:

```bash
gcloud run deploy nuclear-force \
  --image us-central1-docker.pkg.dev/YOUR_PROJECT_ID/cloud-run-source-deploy/nuclear-force:latest \
  --region us-central1 \
  --port 8080 \
  --allow-unauthenticated \
  --set-env-vars "STATIC_DIR=/app/public" \
  --set-secrets "OPENWEATHER_API_KEY=openweather:latest,GOOGLE_MAPS_KEY=google-maps:latest"
```

Create secrets in Secret Manager first, or pass keys with `--set-env-vars` for testing. Optional: `CORS_ORIGIN` if you split the frontend to another host later.

Pass API keys via environment or a `.env` file next to `docker-compose.yml`:

```yaml
environment:
  OPENWEATHER_API_KEY: "..."
  GOOGLE_MAPS_KEY: "..."
```

### Split deploy

**Frontend only:** `pnpm --filter @workspace/nuclear-escape run build` → upload `artifacts/nuclear-escape/dist/public`.  
Set `VITE_API_BASE_URL` at build time if the API is on another host; set `CORS_ORIGIN` on the API.

**API only:** `pnpm --filter @workspace/api-server run build` → run `node artifacts/api-server/dist/index.mjs` with `PORT=3001`.

---

## Documentation

- [artifacts/nuclear-escape/README.md](artifacts/nuclear-escape/README.md) — frontend specifics  
- [artifacts/api-server/README.md](artifacts/api-server/README.md) — API routes  
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system diagram  
- [docs/DISCLAIMER.md](docs/DISCLAIMER.md) — legal disclaimer  
- [CONTRIBUTING.md](CONTRIBUTING.md) — contributing  

---

## License

MIT — see [LICENSE](LICENSE). This project is educational; see [docs/DISCLAIMER.md](docs/DISCLAIMER.md) for usage expectations.
