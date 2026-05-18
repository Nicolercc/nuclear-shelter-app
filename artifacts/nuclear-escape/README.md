# Nuclear Escape Router — Frontend

The React + Vite single-page application for Nuclear Escape Router. Renders an interactive Leaflet map with blast zone visualization, shelter recommendations, and evacuation routing for NYC.

---

## Setup

```bash
# From the repo root
pnpm install

# Run the dev server (proxies /api → http://127.0.0.1:3001 by default)
cd artifacts/nuclear-escape
PORT=3000 pnpm dev
```

Start the API alongside (separate terminal):

```bash
cd artifacts/api-server
PORT=3001 pnpm dev
```

The SPA is at `http://localhost:3000`. With keys on the API, the app uses live weather, geocoding, and directions; otherwise it falls back to heuristics.

---

## Environment

See [`.env.example`](./.env.example). `VITE_API_BASE_URL` is only needed when the API is on another origin; for local dev leave it unset and rely on the Vite proxy.

Optional: `API_PROXY_TARGET` (Vite) if the API is not on port 3001.

---

## Available Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start the Vite dev server with HMR |
| `pnpm build` | Production build → `dist/public` |
| `pnpm serve` | Preview the production build |
| `pnpm typecheck` | TypeScript check (no emit) |

---

## Vite configuration

- **Port:** `process.env.PORT`, default `3000`
- **Host:** `0.0.0.0` for container and tunnel use
- **Dev proxy:** `/api` → `API_PROXY_TARGET` (default `http://127.0.0.1:3001`)
- **Alias:** `@/` → `src/`

---

## Leaflet map notes

This app uses [Leaflet](https://leafletjs.com/) for the interactive map via the `leaflet` npm package (not `react-leaflet`). The map is initialized imperatively in a `useEffect` using a `ref` attached to the map container `<div>`.

**Important patterns:**

- The map instance is stored in `mapInstanceRef.current` (a `useRef<L.Map | null>`)
- All dynamically added layers (circles, markers, polylines) are tracked in `layersRef.current: L.Layer[]` and cleared before each new analysis via `clearLayers()`
- The map is initialized once on mount and cleaned up on unmount — the `useEffect` guard `if (!mapRef.current || mapInstanceRef.current) return;` prevents double-initialization in React Strict Mode
- Custom map icons are created with `L.divIcon()` using inline HTML/CSS for full styling control
- **Dark theme:** Leaflet tile layers are inverted using `filter` in `index.css`

**Map tiles:** OpenStreetMap attribution is included in the map control.

---

## Component guide

### `src/App.tsx`

Root: `QueryClientProvider`, `TooltipProvider`, disclaimer modal gate, Wouter router.

### `src/pages/NuclearEscapeRouter.tsx`

Main map page: yield presets, shelters, blast visualization, optional backend-backed weather/geocode/route via `src/lib/nuclear-api.ts`.

### `src/pages/DisclaimerPage.tsx`

Standalone `/disclaimer` route.

### `src/components/DisclaimerModal.tsx`

First-launch gate using `localStorage` and a portal overlay.

### `src/components/ui/`

shadcn/ui primitives (Radix + Tailwind).

---

## Dependencies

Leaflet, Wouter, React Query, Tailwind CSS v4, Radix primitives. See [`package.json`](./package.json).
