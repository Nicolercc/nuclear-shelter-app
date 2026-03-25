# API Server — Nuclear Escape Router

The Express backend API for Nuclear Escape Router. Acts as a secure proxy for third-party APIs (OpenWeather, Google Maps), keeping API keys out of the frontend bundle.

---

## Setup

```bash
# From the repo root
pnpm install

# Run the dev server
cd artifacts/api-server
PORT=3001 pnpm dev
```

The server listens at `http://localhost:3001`. All routes are prefixed with `/api`.

---

## Available Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Build then start the server (runs `build` then `start`) |
| `pnpm build` | Bundle with esbuild (outputs to `dist/index.mjs`) |
| `pnpm start` | Start the bundled server (`node ./dist/index.mjs`) |
| `pnpm typecheck` | Run TypeScript type checking without emitting files |

---

## API Key Configuration

Create a `.env` file at `artifacts/api-server/.env` (do not commit this file):

```env
OPENWEATHER_API_KEY=your_openweather_api_key_here
GOOGLE_MAPS_KEY=your_google_maps_api_key_here
```

### Getting API Keys

**OpenWeather API:**
1. Sign up at [openweathermap.org](https://openweathermap.org/api)
2. Go to your API Keys page and create a free key
3. The app uses the `Current Weather Data` endpoint (`/data/2.5/weather`)

**Google Maps Platform:**
1. Go to [console.cloud.google.com](https://console.cloud.google.com/)
2. Create or select a project
3. Enable **Geocoding API** and **Directions API**
4. Create an API key and restrict it to these two APIs

If either key is missing, the corresponding endpoint returns a `500` with `{ "error": "... API key not configured" }`. The frontend handles this gracefully by falling back to simulated/offline data.

---

## API Endpoint Reference

All endpoints are prefixed with `/api`. The server binds to `PORT` (required env var).

---

### `GET /api/health`

Health check endpoint.

**Response `200`:**
```json
{ "status": "ok" }
```

---

### `GET /api/weather`

Returns current weather and wind data for a location. Proxies OpenWeather `Current Weather Data` API.

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `lat` | number | Yes | Latitude |
| `lon` | number | Yes | Longitude |

**Response `200`:**
```json
{
  "windSpeed": 5.2,
  "windDeg": 270,
  "windGust": 8.1,
  "description": "light breeze",
  "temp": 14.3,
  "humidity": 62
}
```

| Field | Type | Description |
|---|---|---|
| `windSpeed` | number | Wind speed in m/s |
| `windDeg` | number | Wind direction in degrees (meteorological, 0=N) |
| `windGust` | number \| null | Wind gust speed in m/s, or null if not available |
| `description` | string | Human-readable weather description |
| `temp` | number | Temperature in Celsius |
| `humidity` | number | Humidity percentage (0–100) |

**Error Responses:**

| Status | Body | Reason |
|---|---|---|
| `400` | `{ "error": "lat and lon are required" }` | Missing query params |
| `500` | `{ "error": "OpenWeather API key not configured" }` | Missing `OPENWEATHER_API_KEY` |
| `500` | `{ "error": "Failed to fetch weather data" }` | OpenWeather API error or network failure |

---

### `GET /api/geocode`

Converts a street address to lat/lng coordinates. Proxies Google Maps Geocoding API.

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `address` | string | Yes | Address string to geocode (URL-encoded) |

**Response `200`:**
```json
{
  "lat": 40.758,
  "lng": -73.9855,
  "formattedAddress": "Times Square, New York, NY, USA"
}
```

**Error Responses:**

| Status | Body | Reason |
|---|---|---|
| `400` | `{ "error": "address is required" }` | Missing query param |
| `404` | `{ "error": "Address not found" }` | Google returned ZERO_RESULTS |
| `500` | `{ "error": "Google Maps API key not configured" }` | Missing `GOOGLE_MAPS_KEY` |
| `500` | `{ "error": "Geocoding failed" }` | Google API error |
| `500` | `{ "error": "Failed to geocode address" }` | Network failure |

---

### `GET /api/escape-route`

Returns driving directions between two coordinates. Proxies Google Maps Directions API.

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `originLat` | number | Yes | Origin latitude |
| `originLon` | number | Yes | Origin longitude |
| `destLat` | number | Yes | Destination latitude |
| `destLon` | number | Yes | Destination longitude |

**Response `200`:**
```json
{
  "distance": "12.4 km",
  "duration": "18 mins",
  "steps": [
    "Head south on 7th Ave toward W 41st St",
    "Take the ramp onto I-278 W",
    "..."
  ],
  "polyline": "encoded_polyline_string_here"
}
```

**Error Responses:**

| Status | Body | Reason |
|---|---|---|
| `400` | `{ "error": "originLat, originLon, destLat, destLon are required" }` | Missing params |
| `404` | `{ "error": "No route found" }` | Google could not find a route |
| `500` | `{ "error": "Google Maps API key not configured" }` | Missing `GOOGLE_MAPS_KEY` |
| `500` | `{ "error": "Directions API error" }` | Google API error |
| `500` | `{ "error": "Failed to fetch escape route" }` | Network failure |

---

## Error Handling Notes

- All route handlers wrap third-party API calls in `try/catch`. Network failures and API errors are caught and returned as `500` responses with a descriptive JSON body.
- Errors are logged with full context using the Pino logger (`req.log.error()`). Check server logs for details when debugging.
- The frontend is designed to gracefully degrade when API endpoints fail or are unconfigured — it falls back to offline preset lookups and simulated data.

---

## Logging

The server uses [Pino](https://getpino.io/) for structured JSON logging via `pino-http`. In development (`NODE_ENV=development`), logs are pretty-printed. In production, logs are plain JSON.

Request logs include: request ID, HTTP method, URL path (query string stripped), response status code.

---

## Build System

The backend uses [esbuild](https://esbuild.github.io/) (via `build.mjs`) instead of `tsc` for faster bundling. The output is a single ESM bundle at `dist/index.mjs`. Source maps are enabled (`--enable-source-maps` in the start command).
