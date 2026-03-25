# Nuclear Escape Router — Frontend

The React + Vite single-page application for Nuclear Escape Router. Renders an interactive Leaflet map with blast zone visualization, shelter recommendations, and evacuation routing for NYC.

---

## Setup

```bash
# From the repo root
pnpm install

# Run the dev server
cd artifacts/nuclear-escape
PORT=3000 pnpm dev
```

The app will be available at `http://localhost:3000`.

---

## Available Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start the Vite dev server with HMR (requires `PORT` env var) |
| `pnpm build` | Build for production (outputs to `dist/`) |
| `pnpm serve` | Preview the production build locally |
| `pnpm typecheck` | Run TypeScript type checking without emitting files |

---

## Vite Configuration

Key configuration in `vite.config.ts`:

- **Port:** Read from `process.env.PORT` — do not hardcode a port
- **Host:** `0.0.0.0` — required for Replit's proxied preview pane
- **Allowed Hosts:** `true` — allows the Replit proxy iframe origin
- **Path alias:** `@/` maps to `src/`

---

## Leaflet Map Notes

This app uses [Leaflet](https://leafletjs.com/) for the interactive map via the `leaflet` npm package (not `react-leaflet`). The map is initialized imperatively in a `useEffect` using a `ref` attached to the map container `<div>`.

**Important patterns:**

- The map instance is stored in `mapInstanceRef.current` (a `useRef<L.Map | null>`)
- All dynamically added layers (circles, markers, polylines) are tracked in `layersRef.current: L.Layer[]` and cleared before each new analysis via `clearLayers()`
- The map is initialized once on mount and cleaned up on unmount — the `useEffect` guard `if (!mapRef.current || mapInstanceRef.current) return;` prevents double-initialization in React Strict Mode
- Custom map icons are created with `L.divIcon()` using inline HTML/CSS for full styling control
- **Dark theme:** Leaflet tile layers are inverted using `filter: brightness(0.75) saturate(0.8) hue-rotate(180deg) invert(1)` in `index.css`

**Map tiles:** OpenStreetMap tiles are used via `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`. Attribution is shown in the map's attribution control.

---

## Component Guide

### `src/App.tsx`

Root component. Sets up:
- `QueryClientProvider` (React Query)
- `TooltipProvider` (Radix UI)
- `DisclaimerModal` — rendered at the root level so it appears on all routes
- Wouter `<Switch>` router with two routes: `/disclaimer` and the catch-all (main map)

### `src/pages/NuclearEscapeRouter.tsx`

The main application page (~1,040 lines). Contains all map logic, state management, and the right-side results panel. Key sections (marked with `// ─── ` comments):

- **Types** — TypeScript interfaces (`LatLng`, `WeatherData`, `EscapeInfo`, etc.)
- **Constants** — `YIELD_CONFIGS`, `SHELTERS[]`, `PRESET_ADDRESSES`
- **Helpers** — Pure functions: `haversineDistance`, `offsetLatLng`, `geocodeAddress`, `getDummyWeather`, `getDummyEscape`, `windDegToDir`, shelter utilities
- **Main Component** — `NuclearEscapeRouter` functional component with all state and effects
- **analyze()** — Core calculation function that runs all spatial math and renders map layers
- **JSX** — Header (yield selector, search, GPS, disclaimer link), map div, right panel (shelter/threat/route tabs)

### `src/pages/DisclaimerPage.tsx`

The `/disclaimer` route. Renders the full legal disclaimer text as a standalone readable page with a "Back to App" link. Uses Wouter's `<Link>` for navigation.

### `src/components/DisclaimerModal.tsx`

First-launch disclaimer modal. On mount, checks `localStorage["nuclear-escape-disclaimer-accepted"]`. If not set, renders a full-screen overlay portal via `react-dom/createPortal` that blocks the entire viewport. The modal cannot be dismissed without clicking "I Understand & Accept" — there is no backdrop click dismiss, no close button, and no keyboard escape. On acceptance, sets the localStorage key and the component unmounts.

Also exports `useDisclaimerAccepted()` — a convenience hook that returns whether the user has accepted.

Implementation note: Uses a custom portal modal rather than the Radix UI `Dialog` component to avoid hook initialization conflicts during React module reloading. The overlay is rendered into `document.body` via `createPortal`.

### `src/components/ui/`

shadcn/ui component library, configured for this project's dark theme. Key components used:

- `dialog.tsx` — Radix UI Dialog (available for general use)
- `tooltip.tsx` — Radix UI Tooltip, used in the map header

---

## Styling

- **Tailwind CSS v4** — via `@import "tailwindcss"` in `index.css`
- **tw-animate-css** — for Tailwind animation utilities
- **@tailwindcss/typography** — for prose-styled text blocks
- **Dark theme only** — CSS variables are defined in `:root` in `index.css`, all dark-themed. There is no light mode.
- **Leaflet overrides** — custom dark theme overrides for Leaflet UI elements are in `index.css` below the Tailwind imports

---

## Key Dependencies

| Package | Version | Purpose |
|---|---|---|
| `leaflet` | ^1.9 | Interactive map rendering |
| `wouter` | ^3.3 | Client-side routing |
| `@tanstack/react-query` | catalog | API data fetching |
| `@radix-ui/react-dialog` | ^1.1 | Accessible modal (available, not used by DisclaimerModal) |
| `tailwindcss` | catalog | Utility-first CSS |
| `lucide-react` | catalog | Icon library |
| `framer-motion` | catalog | Animation (available, not heavily used) |
