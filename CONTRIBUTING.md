# Contributing to Nuclear Escape Router

Thank you for your interest in contributing. This document covers how to run the project locally, coding conventions, and how to make specific types of changes.

---

## Running the Project Locally

### Prerequisites

- Node.js 18 or higher
- pnpm 9 or higher (`npm install -g pnpm`)

### Setup

```bash
git clone <repo-url>
cd nuclear-escape-router
pnpm install
```

### Starting Services

Each artifact runs as a separate service. Open two terminals:

```bash
# Terminal 1 — Frontend
cd artifacts/nuclear-escape
PORT=3000 pnpm dev

# Terminal 2 — Backend API
cd artifacts/api-server
PORT=3001 pnpm dev
```

The frontend runs at `http://localhost:3000`. The API server is at `http://localhost:3001`.

### Environment Variables

Copy the example environment file and fill in your API keys:

```bash
cp artifacts/api-server/.env.example artifacts/api-server/.env
```

See [README.md](README.md#environment-variables) for the full variable table. The app runs without API keys (using fallback/simulated data), so keys are optional for development.

### Type Checking

```bash
# Check frontend types
cd artifacts/nuclear-escape
pnpm typecheck

# Check backend types
cd artifacts/api-server
pnpm typecheck
```

---

## Branch Naming Conventions

Use the following prefixes:

| Prefix | Use For |
|---|---|
| `feat/` | New features (`feat/add-shelter-filter`) |
| `fix/` | Bug fixes (`fix/blast-radius-calculation`) |
| `docs/` | Documentation only (`docs/update-architecture`) |
| `chore/` | Maintenance, deps, config (`chore/upgrade-leaflet`) |
| `refactor/` | Code restructuring without behavior change |

Branch names should be lowercase, hyphen-separated, and descriptive. Example: `feat/real-weather-api-integration`.

---

## Pull Request Process

1. **Fork** the repository and create your branch from `main`.
2. Make your changes, keeping commits focused and atomic.
3. Ensure `pnpm typecheck` passes in all affected artifacts.
4. Test your changes manually in the browser (or run the e2e test suite if configured).
5. Update relevant documentation — if you change the API, update `lib/api-spec/openapi.yaml`. If you change the architecture, update `docs/ARCHITECTURE.md`.
6. Open a PR against `main` with a clear title and description explaining what changed and why.
7. Reference any related issues in the PR description.

PRs should be small and focused. Large sweeping changes should be discussed in an issue first.

---

## Code Style

- **TypeScript everywhere** — no plain `.js` files in `src/` directories.
- **No `any`** — use proper types or `unknown` with type guards.
- **Functional React components** — no class components.
- **Hooks for state** — use `useState`, `useEffect`, `useCallback`, `useRef`. Avoid global mutable state.
- **Tailwind for styling** — use utility classes. Avoid inline `style=` except for dynamic values (animations, transforms, colors derived from data).
- **No unused imports** — clean up any unused variables or imports before committing.
- **Named exports for components** — default exports are acceptable for page-level components.
- **Comments for complex logic** — spatial math, API transformations, and non-obvious business logic should have brief inline comments.

The codebase does not use a linter (yet). Follow the patterns established in `NuclearEscapeRouter.tsx` as the style reference.

---

## How to Add New Shelter Locations

Shelter data lives in `SHELTERS` array in:

```
artifacts/nuclear-escape/src/pages/NuclearEscapeRouter.tsx
```

To add a new shelter:

1. Find the `SHELTERS: Shelter[]` constant (around line 97).
2. Add a new entry following the existing format:

```typescript
{
  name: "Shelter Name",
  type: "subway" | "hospital" | "parking" | "building",
  lat: 40.1234,
  lng: -73.5678,
  floors: "3 levels underground",  // descriptive depth string
  capacity: "~2,000 people",        // approximate capacity
  address: "123 Example St, Borough"
}
```

3. Verify the `lat`/`lng` are accurate — cross-check with OpenStreetMap.
4. Choose the correct `type`:
   - `subway` — subway stations with underground platforms
   - `hospital` — hospitals with reinforced basements
   - `parking` — below-grade parking structures
   - `building` — other reinforced concrete structures

The shelter will automatically appear on the map and be included in nearest-shelter calculations.

---

## How to Update Blast Radius Data

Blast zone configurations live in the `YIELD_CONFIGS` constant in:

```
artifacts/nuclear-escape/src/pages/NuclearEscapeRouter.tsx
```

Each yield type defines an array of zones with the following properties:

```typescript
{
  radius: number,       // radius in meters
  label: string,        // display name shown in legend and popup
  color: string,        // CSS color string (hex)
  fillOpacity: number,  // 0–1, opacity of the filled circle
  desc: string,         // short description shown in map popup
}
```

To update radii:

1. Find the `YIELD_CONFIGS` constant (around line 50).
2. Update the `radius` values for the relevant yield type.
3. Zones must be ordered from **innermost (smallest radius) to outermost** — the rendering code reverses the array to paint larger zones first.
4. The `fireballZone` (index 0 of the zones array) is also used to determine the shelter-in-place vs. evacuate decision threshold. Update accordingly.
5. Source any changes from publicly available, properly attributed sources. Add the source as a comment.

---

## Adding New API Endpoints

1. Add the route handler in `artifacts/api-server/src/routes/nuclear.ts` (or a new file).
2. Register the new router in `artifacts/api-server/src/routes/index.ts`.
3. Document the endpoint in `lib/api-spec/openapi.yaml`.
4. Run `pnpm codegen` (if configured) to regenerate Zod schemas and React Query hooks.
5. Update `artifacts/api-server/README.md` with the new endpoint reference.

---

## Updating the Disclaimer

The disclaimer text is version-controlled in `docs/DISCLAIMER.md`. The in-app modal (`artifacts/nuclear-escape/src/components/DisclaimerModal.tsx`) and disclaimer page (`artifacts/nuclear-escape/src/pages/DisclaimerPage.tsx`) should be kept in sync with this file.

When updating the disclaimer:
1. Edit `docs/DISCLAIMER.md`.
2. Mirror the relevant changes to `DisclaimerModal.tsx` and `DisclaimerPage.tsx`.
3. Bump the version string and update date in all three locations.
4. Consider whether the change is significant enough to reset the user's localStorage acceptance (change the `STORAGE_KEY` constant to invalidate prior acceptances).
