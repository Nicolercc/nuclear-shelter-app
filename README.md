# Nuclear Escape Router

An interactive nuclear emergency preparedness and simulation tool for New York City. Built for educational use — visualize blast zones, find the nearest shelter, and plan evacuation routes based on your location and the type of event.

> **Disclaimer:** This is an educational simulation tool only. In a real emergency, follow official guidance from [NYC OEM](https://nyc.gov/emergency) and [FEMA](https://ready.gov). See [docs/DISCLAIMER.md](docs/DISCLAIMER.md) for the full disclaimer.

---

## Features

- **Interactive Leaflet Map** — dark-themed NYC map with real-time layer rendering
- **Blast Zone Visualization** — concentric color-coded zones for four yield types: Dirty Bomb, 10 Kiloton, 100 Kiloton, 1 Megaton
- **Click-to-Place Blast Center** — click anywhere on the map to set the detonation point
- **Address Search** — search by NYC neighborhood, landmark, zip code, or street address
- **GPS Location** — use your browser's geolocation to set your position
- **Nearest Shelter Finder** — calculates the closest of 17 pre-loaded NYC shelters (subway stations, hospitals, parking garages, reinforced buildings)
- **Shelter Recommendations** — walking directions, estimated walk time, depth, and capacity
- **Fallout Drift Arrow** — wind-direction-based fallout plume visualization
- **Escape Route** — algorithmically generated evacuation path away from the blast zone
- **Shelter-in-Place vs. Evacuate Decision** — recommends the optimal response based on your distance from the fireball zone
- **Disclaimer Modal** — first-launch disclaimer with localStorage-based acceptance gate
- **Persistent Disclaimer Link** — always-visible link to the full disclaimer page

---

## Architecture

This is a **pnpm monorepo** with two main artifacts and shared libraries:

```
/
├── artifacts/
│   ├── nuclear-escape/      # React + Vite frontend (Leaflet map SPA)
│   └── api-server/          # Express backend API (proxies OpenWeather + Google Maps)
├── lib/
│   ├── api-spec/            # OpenAPI specification (YAML)
│   ├── api-zod/             # Generated Zod schemas
│   └── api-client-react/    # Generated React Query hooks
└── docs/
    ├── ARCHITECTURE.md      # Full architecture diagram and data flow
    └── DISCLAIMER.md        # Version-controlled legal disclaimer text
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full architecture diagram, data flow walkthrough, and spatial calculation logic.

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/) 9+

### Installation

```bash
# Clone the repo
git clone <repo-url>
cd nuclear-escape-router

# Install all dependencies
pnpm install
```

### Running the App

```bash
# Start the frontend (React + Vite)
cd artifacts/nuclear-escape
PORT=3000 pnpm dev

# Start the backend (Express API server) — in a separate terminal
cd artifacts/api-server
PORT=3001 pnpm dev
```

The frontend will be available at `http://localhost:3000`. The API server runs at `http://localhost:3001`.

> In the Replit environment, workflows manage port assignment automatically via the `PORT` environment variable.

### Build for Production

```bash
# Build the frontend
cd artifacts/nuclear-escape
pnpm build

# Build the backend
cd artifacts/api-server
pnpm build
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | **Yes** | Port for each service (assigned automatically in Replit) |
| `OPENWEATHER_API_KEY` | No | OpenWeather API key for real-time wind and weather data. Without this, the app falls back to simulated weather. Get one at [openweathermap.org](https://openweathermap.org/api). |
| `GOOGLE_MAPS_KEY` | No | Google Maps Platform API key (Geocoding + Directions APIs). Without this, geocoding falls back to an offline lookup table, and escape routes are algorithmically approximated. Get one at [console.cloud.google.com](https://console.cloud.google.com/). |

Set these in `.env` files at the artifact level, or configure them as environment secrets in Replit:

```bash
# artifacts/api-server/.env (do not commit this file)
OPENWEATHER_API_KEY=your_key_here
GOOGLE_MAPS_KEY=your_key_here
```

---

## Sub-Project Documentation

- [artifacts/nuclear-escape/README.md](artifacts/nuclear-escape/README.md) — Frontend setup, Vite config, Leaflet notes, component guide
- [artifacts/api-server/README.md](artifacts/api-server/README.md) — Backend setup, API endpoint reference, error handling
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — System architecture, data flow, spatial logic
- [docs/DISCLAIMER.md](docs/DISCLAIMER.md) — Full legal disclaimer text
- [CONTRIBUTING.md](CONTRIBUTING.md) — How to contribute, branch conventions, adding shelters

---

## License

This project is provided for educational and preparedness planning purposes only. See [docs/DISCLAIMER.md](docs/DISCLAIMER.md) for terms of use.
