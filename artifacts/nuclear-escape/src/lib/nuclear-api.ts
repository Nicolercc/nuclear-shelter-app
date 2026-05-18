/**
 * Backend integration for nuclear escape proxies (OpenWeather, Google Maps).
 * When `VITE_API_BASE_URL` is unset, callers use `/api/*` relative URLs so the
 * Vite dev proxy (or reverse proxy) forwards to Express.
 */

function apiOriginTrimmed(): string {
  const v = import.meta.env.VITE_API_BASE_URL?.trim();
  return v ? v.replace(/\/+$/, "") : "";
}

/** Full URL for `/api/...` given a path starting with `/` (e.g. `/weather`). */
export function resolveApiUrl(pathWithLeadingSlash: string): string {
  const path = pathWithLeadingSlash.startsWith("/") ? pathWithLeadingSlash : `/${pathWithLeadingSlash}`;
  const prefix = `/api${path}`;
  const origin = apiOriginTrimmed();
  return origin ? `${origin}${prefix}` : prefix;
}

async function fetchJson<T>(
  url: string,
  signal?: AbortSignal,
): Promise<{ ok: true; data: T } | { ok: false }> {
  try {
    const res = await fetch(url, {
      signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch {
    return { ok: false };
  }
}

export async function fetchLiveWeather(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<{
  windSpeed: number;
  windDeg: number;
  description: string;
  temp: number;
  humidity: number;
} | null> {
  const u = new URL(resolveApiUrl("/weather"));
  u.searchParams.set("lat", String(lat));
  u.searchParams.set("lon", String(lon));
  type Row = {
    windSpeed?: number;
    windDeg?: number;
    description?: string;
    temp?: number;
    humidity?: number;
  };
  const r = await fetchJson<Row>(u.toString(), signal);
  if (!r.ok) return null;
  const d = r.data;
  if (
    typeof d.windSpeed !== "number" ||
    typeof d.windDeg !== "number" ||
    typeof d.description !== "string" ||
    typeof d.temp !== "number" ||
    typeof d.humidity !== "number"
  ) {
    return null;
  }
  return {
    windSpeed: d.windSpeed,
    windDeg: d.windDeg,
    description: d.description,
    temp: d.temp,
    humidity: d.humidity,
  };
}

export async function fetchLiveGeocode(
  address: string,
  signal?: AbortSignal,
): Promise<{ lat: number; lng: number; formattedAddress: string } | null> {
  const u = new URL(resolveApiUrl("/geocode"));
  u.searchParams.set("address", address);
  type Row = { lat?: number; lng?: number; formattedAddress?: string };
  const r = await fetchJson<Row>(u.toString(), signal);
  if (!r.ok) return null;
  const d = r.data;
  if (
    typeof d.lat !== "number" ||
    typeof d.lng !== "number" ||
    typeof d.formattedAddress !== "string"
  ) {
    return null;
  }
  return {
    lat: d.lat,
    lng: d.lng,
    formattedAddress: d.formattedAddress,
  };
}

export async function fetchLiveEscapeRoute(
  originLat: number,
  originLon: number,
  destLat: number,
  destLon: number,
  signal?: AbortSignal,
): Promise<{
  distanceText: string;
  durationText: string;
  steps: string[];
} | null> {
  const u = new URL(resolveApiUrl("/escape-route"));
  u.searchParams.set("originLat", String(originLat));
  u.searchParams.set("originLon", String(originLon));
  u.searchParams.set("destLat", String(destLat));
  u.searchParams.set("destLon", String(destLon));
  type Step = { instruction?: string };
  type Row = {
    distanceText?: string;
    durationText?: string;
    steps?: Step[];
  };
  const r = await fetchJson<Row>(u.toString(), signal);
  if (!r.ok) return null;
  const d = r.data;
  if (
    typeof d.distanceText !== "string" ||
    typeof d.durationText !== "string" ||
    !Array.isArray(d.steps)
  ) {
    return null;
  }
  const steps = d.steps.map((s) => (typeof s.instruction === "string" ? s.instruction : "")).filter(Boolean);
  if (steps.length === 0) return null;
  return {
    distanceText: d.distanceText,
    durationText: d.durationText,
    steps,
  };
}
