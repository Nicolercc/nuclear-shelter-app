import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { fetchAISurvivalBrief, fetchLiveEscapeRoute, fetchLiveGeocode, fetchLiveWeather } from "@/lib/nuclear-api";

// ─── Types ───────────────────────────────────────────────────────────────────

interface LatLng { lat: number; lng: number }

interface WeatherData {
  windSpeed: number;
  windDeg: number;
  description: string;
  temp: number;
  humidity: number;
}

interface EscapeInfo {
  distance: string;
  duration: string;
  steps: string[];
}

interface NearestShelterInfo {
  shelter: Shelter;
  distance: number; // meters
  walkMinutes: number;
  walkSteps: string[];
}

interface ResultData {
  blastCenter: LatLng;
  userLocation: LatLng;
  address: string;
  weather: WeatherData;
  escape: EscapeInfo;
  decision: "shelter" | "evacuate";
  distanceFromBlast: number;
  yield: YieldOption;
  nearestShelter: NearestShelterInfo;
  topShelters: (Shelter & { distance: number; walkMinutes: number })[];
}

type YieldOption = "dirty" | "10kt" | "100kt" | "1mt";

// ─── Constants ────────────────────────────────────────────────────────────────

const NYC_CENTER: LatLng = { lat: 40.7128, lng: -74.006 };

// Blast radii in meters per yield type
const YIELD_CONFIGS: Record<YieldOption, { label: string; zones: { radius: number; label: string; color: string; fillOpacity: number; desc: string }[] }> = {
  dirty: {
    label: "Dirty Bomb",
    zones: [
      { radius: 100, label: "Detonation Zone", color: "#ff2020", fillOpacity: 0.4, desc: "Immediate – stay away" },
      { radius: 500, label: "Radiation Zone", color: "#ff8c00", fillOpacity: 0.2, desc: "High radiation exposure" },
      { radius: 2000, label: "Contamination Zone", color: "#ffd700", fillOpacity: 0.1, desc: "Shelter in place, seal windows" },
    ],
  },
  "10kt": {
    label: "10 Kiloton",
    zones: [
      { radius: 500, label: "Fireball Zone", color: "#ff2020", fillOpacity: 0.35, desc: "Immediate death – no escape possible" },
      { radius: 2000, label: "Heavy Blast Zone", color: "#ff8c00", fillOpacity: 0.18, desc: "Severe structural damage – evacuate now" },
      { radius: 6000, label: "Light Blast Zone", color: "#ffd700", fillOpacity: 0.09, desc: "Significant damage – evacuation recommended" },
    ],
  },
  "100kt": {
    label: "100 Kiloton",
    zones: [
      { radius: 2000, label: "Fireball Zone", color: "#ff2020", fillOpacity: 0.35, desc: "Total destruction" },
      { radius: 8000, label: "Heavy Blast Zone", color: "#ff8c00", fillOpacity: 0.18, desc: "Severe damage – evacuate immediately" },
      { radius: 20000, label: "Light Blast Zone", color: "#ffd700", fillOpacity: 0.09, desc: "Widespread damage – evacuate" },
    ],
  },
  "1mt": {
    label: "1 Megaton",
    zones: [
      { radius: 8000, label: "Fireball Zone", color: "#ff2020", fillOpacity: 0.35, desc: "Complete destruction" },
      { radius: 25000, label: "Heavy Blast Zone", color: "#ff8c00", fillOpacity: 0.18, desc: "Total devastation" },
      { radius: 60000, label: "Light Blast Zone", color: "#ffd700", fillOpacity: 0.09, desc: "Severe damage across entire region" },
    ],
  },
};

type ShelterType = "subway" | "hospital" | "parking" | "building";

interface Shelter {
  name: string;
  type: ShelterType;
  lat: number;
  lng: number;
  floors: string; // e.g. "3 levels underground"
  capacity: string;
  address: string;
}

const SHELTERS: Shelter[] = [
  // Subway stations (deep underground = best protection)
  { name: "Times Square–42 St Station", type: "subway", lat: 40.758, lng: -73.9855, floors: "4 levels underground", capacity: "~5,000 people", address: "42nd St & 7th Ave, Manhattan" },
  { name: "Grand Central–42 St Station", type: "subway", lat: 40.7527, lng: -73.9772, floors: "3 levels underground", capacity: "~4,000 people", address: "42nd St & Lexington Ave, Manhattan" },
  { name: "Penn Station / 34 St", type: "subway", lat: 40.7505, lng: -73.9934, floors: "3 levels underground", capacity: "~6,000 people", address: "34th St & 8th Ave, Manhattan" },
  { name: "Union Square–14 St Station", type: "subway", lat: 40.7352, lng: -73.9896, floors: "3 levels underground", capacity: "~3,000 people", address: "14th St & Union Square W, Manhattan" },
  { name: "Jay St–MetroTech Station", type: "subway", lat: 40.6923, lng: -73.9872, floors: "3 levels underground", capacity: "~2,500 people", address: "Jay St & MetroTech, Brooklyn" },
  { name: "Fulton St Station", type: "subway", lat: 40.7095, lng: -74.0074, floors: "4 levels underground", capacity: "~3,500 people", address: "Fulton St & Broadway, Manhattan" },
  { name: "Atlantic Av–Barclays Station", type: "subway", lat: 40.6841, lng: -73.9776, floors: "3 levels underground", capacity: "~3,000 people", address: "Atlantic Ave & Flatbush, Brooklyn" },
  { name: "Jackson Heights–Roosevelt", type: "subway", lat: 40.7463, lng: -73.8914, floors: "2 levels underground", capacity: "~2,000 people", address: "Roosevelt Ave, Queens" },
  { name: "Flushing–Main St Station", type: "subway", lat: 40.7596, lng: -73.83, floors: "2 levels underground", capacity: "~2,000 people", address: "Main St & Roosevelt Ave, Queens" },
  { name: "161 St–Yankee Stadium", type: "subway", lat: 40.8278, lng: -73.9258, floors: "3 levels underground", capacity: "~2,000 people", address: "161st St & River Ave, Bronx" },
  { name: "86 St Station (Upper East)", type: "subway", lat: 40.7766, lng: -73.9518, floors: "2 levels underground", capacity: "~1,500 people", address: "86th St & Lexington Ave, Manhattan" },
  { name: "Court Sq–23 St Station", type: "subway", lat: 40.7468, lng: -73.9456, floors: "3 levels underground", capacity: "~2,000 people", address: "23rd St & Jackson Ave, Queens" },
  // Hospitals with deep basements
  { name: "Bellevue Hospital", type: "hospital", lat: 40.7390, lng: -73.9759, floors: "Reinforced basement", capacity: "~1,000 people", address: "462 First Ave, Manhattan" },
  { name: "NY-Presbyterian / Columbia", type: "hospital", lat: 40.8404, lng: -73.9419, floors: "Deep basement complex", capacity: "~800 people", address: "630 W 168th St, Manhattan" },
  { name: "Kings County Hospital", type: "hospital", lat: 40.6561, lng: -73.9440, floors: "Reinforced basement", capacity: "~700 people", address: "451 Clarkson Ave, Brooklyn" },
  // Parking garages (below-grade)
  { name: "Hudson Yards Garage (sub-grade)", type: "parking", lat: 40.7536, lng: -74.0010, floors: "4 levels below ground", capacity: "~800 people", address: "33rd St & 11th Ave, Manhattan" },
  { name: "World Trade Center Parking", type: "parking", lat: 40.7116, lng: -74.0131, floors: "7 levels below ground", capacity: "~1,200 people", address: "Church St, Lower Manhattan" },
  // Reinforced concrete buildings
  { name: "Rockefeller Center Basement", type: "building", lat: 40.7587, lng: -73.9787, floors: "Deep sub-basement", capacity: "~2,000 people", address: "30 Rockefeller Plaza, Manhattan" },
  { name: "Port Authority Bus Terminal", type: "building", lat: 40.7566, lng: -74.0019, floors: "3 levels underground", capacity: "~3,000 people", address: "625 8th Ave, Manhattan" },
];

const PRESET_ADDRESSES: Record<string, LatLng> = {
  "times square": { lat: 40.758, lng: -73.9855 },
  "empire state building": { lat: 40.7484, lng: -73.9967 },
  "empire state": { lat: 40.7484, lng: -73.9967 },
  "central park": { lat: 40.7851, lng: -73.9683 },
  "brooklyn bridge": { lat: 40.7061, lng: -73.9969 },
  "wall street": { lat: 40.7074, lng: -74.0113 },
  "yankee stadium": { lat: 40.8296, lng: -73.9262 },
  "jfk airport": { lat: 40.6413, lng: -73.7781 },
  "jfk": { lat: 40.6413, lng: -73.7781 },
  "laguardia": { lat: 40.7769, lng: -73.874 },
  "columbia university": { lat: 40.8075, lng: -73.9626 },
  "columbia": { lat: 40.8075, lng: -73.9626 },
  "brooklyn": { lat: 40.6782, lng: -73.9442 },
  "queens": { lat: 40.7282, lng: -73.7949 },
  "bronx": { lat: 40.8448, lng: -73.8648 },
  "staten island": { lat: 40.5795, lng: -74.1502 },
  "harlem": { lat: 40.8116, lng: -73.9465 },
  "lower east side": { lat: 40.7157, lng: -73.9863 },
  "greenwich village": { lat: 40.7335, lng: -74.0027 },
  "soho": { lat: 40.7233, lng: -74.003 },
  "chinatown": { lat: 40.7158, lng: -73.9970 },
  "upper west side": { lat: 40.7870, lng: -73.9754 },
  "upper east side": { lat: 40.7736, lng: -73.9566 },
  "midtown": { lat: 40.7549, lng: -73.9840 },
  "downtown": { lat: 40.7127, lng: -74.0059 },
  "rockefeller center": { lat: 40.7587, lng: -73.9787 },
  "world trade center": { lat: 40.7116, lng: -74.0131 },
  "wtc": { lat: 40.7116, lng: -74.0131 },
  "one world trade": { lat: 40.7116, lng: -74.0131 },
  "un headquarters": { lat: 40.7489, lng: -73.9681 },
  "united nations": { lat: 40.7489, lng: -73.9681 },
  "statue of liberty": { lat: 40.6892, lng: -74.0445 },
  "citi field": { lat: 40.7571, lng: -73.8458 },
  "madison square garden": { lat: 40.7505, lng: -73.9934 },
  "msg": { lat: 40.7505, lng: -73.9934 },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let shift = 0, result = 0, byte: number;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

function haversineDistance(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function offsetLatLng(origin: LatLng, distanceM: number, bearingDeg: number): LatLng {
  const R = 6371000;
  const bearing = (bearingDeg * Math.PI) / 180;
  const lat1 = (origin.lat * Math.PI) / 180;
  const lng1 = (origin.lng * Math.PI) / 180;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(distanceM / R) + Math.cos(lat1) * Math.sin(distanceM / R) * Math.cos(bearing)
  );
  const lng2 = lng1 + Math.atan2(
    Math.sin(bearing) * Math.sin(distanceM / R) * Math.cos(lat1),
    Math.cos(distanceM / R) - Math.sin(lat1) * Math.sin(lat2)
  );
  return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI };
}

const NYC_SAFE_ZONES: Array<{ name: string; lat: number; lng: number }> = [
  { name: "Newark, NJ", lat: 40.7357, lng: -74.1724 },
  { name: "White Plains, NY", lat: 41.0340, lng: -73.7629 },
  { name: "Stamford, CT", lat: 41.0534, lng: -73.5387 },
  { name: "Morristown, NJ", lat: 40.7968, lng: -74.4815 },
  { name: "Poughkeepsie, NY", lat: 41.7004, lng: -73.9209 },
  { name: "Allentown, PA", lat: 40.6023, lng: -75.4714 },
  { name: "Trenton, NJ", lat: 40.2171, lng: -74.7429 },
  { name: "Bridgeport, CT", lat: 41.1865, lng: -73.1952 },
  { name: "Paterson, NJ", lat: 40.9168, lng: -74.1718 },
  { name: "New Brunswick, NJ", lat: 40.4872, lng: -74.4454 },
];

function findSafeEscapeDest(
  userCoords: LatLng,
  blastCoords: LatLng,
  _maxRadius: number,
  windDeg: number,
): { lat: number; lng: number; name: string } {
  const dLng = userCoords.lng - blastCoords.lng;
  const y =
    Math.sin((dLng * Math.PI) / 180) * Math.cos((userCoords.lat * Math.PI) / 180);
  const x =
    Math.cos((blastCoords.lat * Math.PI) / 180) * Math.sin((userCoords.lat * Math.PI) / 180) -
    Math.sin((blastCoords.lat * Math.PI) / 180) *
      Math.cos((userCoords.lat * Math.PI) / 180) *
      Math.cos((dLng * Math.PI) / 180);
  const fleeFromBlastBearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;

  const upwindBearing = (windDeg + 180) % 360;

  const scored = NYC_SAFE_ZONES.map((zone) => {
    const dist = haversineDistance(userCoords, zone);
    if (dist < 15000) return { zone, score: -1 };

    const zoneDLng = zone.lng - userCoords.lng;
    const zoneY =
      Math.sin((zoneDLng * Math.PI) / 180) * Math.cos((zone.lat * Math.PI) / 180);
    const zoneX =
      Math.cos((userCoords.lat * Math.PI) / 180) * Math.sin((zone.lat * Math.PI) / 180) -
      Math.sin((userCoords.lat * Math.PI) / 180) *
        Math.cos((zone.lat * Math.PI) / 180) *
        Math.cos((zoneDLng * Math.PI) / 180);
    const bearing = ((Math.atan2(zoneY, zoneX) * 180) / Math.PI + 360) % 360;

    const fleeDiff = Math.abs(((bearing - fleeFromBlastBearing + 540) % 360) - 180);
    const upwindDiff = Math.abs(((bearing - upwindBearing + 540) % 360) - 180);

    const score = 0.7 * (180 - fleeDiff) + 0.3 * (180 - upwindDiff) - dist / 5000;
    return { zone, score };
  })
    .filter((z) => z.score > -1)
    .sort((a, b) => b.score - a.score);

  const best = scored[0]?.zone ?? NYC_SAFE_ZONES[0];
  return { lat: best.lat, lng: best.lng, name: best.name };
}

function geocodeAddress(raw: string): LatLng | null {
  const q = raw.toLowerCase().trim();
  for (const [key, coords] of Object.entries(PRESET_ADDRESSES)) {
    if (q.includes(key)) return coords;
  }
  const zipMatch = q.match(/\b1(0|1)\d{3}\b/);
  if (zipMatch) {
    const seed = parseInt(zipMatch[0]) % 100;
    return { lat: 40.65 + (seed / 100) * 0.35, lng: -74.05 + (seed / 100) * 0.3 };
  }
  if (q.match(/\d+/) && (q.includes("ny") || q.includes("new york") || q.includes("ave") || q.includes("st") || q.includes("blvd") || q.includes("rd"))) {
    const num = parseInt(q.match(/\d+/)?.[0] ?? "100");
    return { lat: 40.71 + ((num % 60) / 60) * 0.12, lng: -74.02 + ((num % 40) / 40) * 0.08 };
  }
  return null;
}

function getDummyWeather(): WeatherData {
  const conditions = ["clear sky", "partly cloudy", "overcast clouds", "light breeze", "scattered clouds"];
  return {
    windSpeed: 3 + Math.random() * 8,
    windDeg: Math.floor(Math.random() * 360),
    description: conditions[Math.floor(Math.random() * conditions.length)],
    temp: 10 + Math.floor(Math.random() * 18),
    humidity: 40 + Math.floor(Math.random() * 40),
  };
}

function getDummyEscape(origin: LatLng, dest: LatLng): EscapeInfo {
  const dist = haversineDistance(origin, dest);
  const km = (dist / 1000).toFixed(1);
  const mins = Math.round(dist / 350);
  return {
    distance: `${km} km`,
    duration: mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}min`,
    steps: [
      "Exit building immediately — do not use elevators",
      "Head in the opposite direction from the blast",
      "Turn onto the nearest major avenue heading outbound",
      "Merge onto highway (I-278, I-87, or NJ Turnpike) away from city",
      "Follow emergency broadcast instructions on AM radio",
      "Continue to designated safe zone 15–30km from blast center",
    ],
  };
}

function windDegToDir(deg: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

function getShelterIcon(type: ShelterType): string {
  switch (type) {
    case "subway": return "🚇";
    case "hospital": return "🏥";
    case "parking": return "🅿";
    case "building": return "🏛";
  }
}

function getShelterWalkSteps(user: LatLng, shelter: Shelter): string[] {
  const latDiff = shelter.lat - user.lat;
  const lngDiff = shelter.lng - user.lng;
  const nsDir = latDiff > 0 ? "north" : "south";
  const ewDir = lngDiff > 0 ? "east" : "west";
  const icon = getShelterIcon(shelter.type);
  return [
    `Head ${Math.abs(latDiff) > Math.abs(lngDiff) ? nsDir : ewDir} on the nearest street`,
    `Continue straight — look for shelter signs`,
    `Arrive at ${icon} ${shelter.name}`,
    `Enter immediately and go as deep underground as possible`,
    `Move to the lowest level — ${shelter.floors}`,
    `Stay away from windows and outer walls`,
    `Wait for official all-clear before leaving`,
  ];
}

function findNearestShelter(user: LatLng): NearestShelterInfo {
  const sorted = SHELTERS
    .map((s) => ({ ...s, dist: haversineDistance(user, s) }))
    .sort((a, b) => a.dist - b.dist);
  const nearest = sorted[0];
  const walkMinutes = Math.max(1, Math.round(nearest.dist / 80)); // 80m/min walking pace
  return {
    shelter: nearest,
    distance: nearest.dist,
    walkMinutes,
    walkSteps: getShelterWalkSteps(user, nearest),
  };
}

function getTopShelters(user: LatLng, count = 5) {
  return SHELTERS
    .map((s) => ({ ...s, distance: haversineDistance(user, s), walkMinutes: 0 }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count)
    .map((s) => ({ ...s, walkMinutes: Math.max(1, Math.round(s.distance / 80)) }));
}

function RadiationDecayTimer() {
  const [running, setRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const elapsedHours = elapsedSeconds / 3600;
  const level = 100 * Math.pow(0.1, elapsedHours / 7);
  const decayProgress = Math.min(100, Math.max(0, 100 - level));

  function formatElapsed(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  return (
    <div className="border-b border-border p-3">
      <div className="border border-border bg-muted/20 rounded-lg p-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2">
          ☢ Radiation Decay Timer
        </p>
        <button
          type="button"
          onClick={() => setRunning(true)}
          disabled={running}
          className="w-full py-2 px-3 bg-primary text-primary-foreground rounded-md text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          {running ? "Running..." : "Start Timer"}
        </button>
        {running && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Elapsed</p>
                <p className="text-xs font-semibold text-foreground">{formatElapsed(elapsedSeconds)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Radiation Level</p>
                <p className="text-xs font-semibold text-foreground">{level.toFixed(2)}%</p>
              </div>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-300"
                style={{ width: `${decayProgress}%` }}
              />
            </div>
            {level < 1 && (
              <p className="text-xs font-semibold text-green-400">Safe to exit shelter</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function isYieldOption(v: string): v is YieldOption {
  return v === "dirty" || v === "10kt" || v === "100kt" || v === "1mt";
}

function parseUrlScenario(search: string): {
  userCoords: LatLng;
  blastCoords: LatLng;
  yield: YieldOption;
} | null {
  const params = new URLSearchParams(search);
  const blat = parseFloat(params.get("blat") ?? "");
  const blng = parseFloat(params.get("blng") ?? "");
  const ulat = parseFloat(params.get("ulat") ?? "");
  const ulng = parseFloat(params.get("ulng") ?? "");
  const yieldParam = params.get("yield") ?? "";
  if (!Number.isFinite(blat) || !Number.isFinite(blng) || !Number.isFinite(ulat) || !Number.isFinite(ulng)) {
    return null;
  }
  if (!isYieldOption(yieldParam)) return null;
  return {
    blastCoords: { lat: blat, lng: blng },
    userCoords: { lat: ulat, lng: ulng },
    yield: yieldParam,
  };
}

function pushScenarioToUrl(blastCoords: LatLng, userCoords: LatLng, yieldType: YieldOption) {
  const params = new URLSearchParams();
  params.set("blat", blastCoords.lat.toFixed(4));
  params.set("blng", blastCoords.lng.toFixed(4));
  params.set("ulat", userCoords.lat.toFixed(4));
  params.set("ulng", userCoords.lng.toFixed(4));
  params.set("yield", yieldType);
  window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function NuclearEscapeRouter() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.Layer[]>([]);
  const clickHandlerRef = useRef<((e: L.LeafletMouseEvent) => void) | null>(null);
  const analyzeAbortRef = useRef<AbortController | null>(null);
  const analyzeRef = useRef<
    (userCoords: LatLng, blastCoords: LatLng, label: string, yieldType: YieldOption) => Promise<void>
  >(async () => {});
  const urlRestoreDoneRef = useRef(false);

  const [address, setAddress] = useState("");
  const [blastAddress, setBlastAddress] = useState("Times Square");
  const [loading, setLoading] = useState(false);
  const [aiBrief, setAiBrief] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [gpsLocked, setGpsLocked] = useState(false);
  const [error, setError] = useState("");
  const [errorType, setErrorType] = useState<"error" | "gps" | "info">("error");
  const [result, setResult] = useState<ResultData | null>(null);
  const [activeTab, setActiveTab] = useState<"shelter" | "info" | "route">("shelter");
  const [clickMode, setClickMode] = useState(false);
  const [selectedYield, setSelectedYield] = useState<YieldOption>("10kt");
  const [blastCenter, setBlastCenter] = useState<LatLng | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [legendCollapsed, setLegendCollapsed] = useState(false);

  // ── Clear layers ────────────────────────────────────────────────────────────
  const clearLayers = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    layersRef.current.forEach((l) => map.removeLayer(l));
    layersRef.current = [];
  }, []);

  // ── Core analysis function (shared by search, geo, click) ───────────────────
  const analyze = useCallback(async (userCoords: LatLng, blastCoords: LatLng, label: string, yieldType: YieldOption) => {
    analyzeAbortRef.current?.abort();
    const controller = new AbortController();
    analyzeAbortRef.current = controller;
    const signal = controller.signal;
    setAiBrief(null);

    const map = mapInstanceRef.current;
    if (!map) return;
    clearLayers();

    const zones = YIELD_CONFIGS[yieldType].zones;

    try {
      const weather =
        (await fetchLiveWeather(userCoords.lat, userCoords.lng, signal)) ?? getDummyWeather();
      const maxRadius = zones[zones.length - 1].radius;
      const distFromBlast = haversineDistance(userCoords, blastCoords);

      const fireballRadius = zones[0].radius;
      const decision: "shelter" | "evacuate" = distFromBlast < fireballRadius ? "shelter" : "evacuate";

      const escapeDest = findSafeEscapeDest(userCoords, blastCoords, maxRadius, weather.windDeg);
      const liveRoute = await fetchLiveEscapeRoute(
        userCoords.lat,
        userCoords.lng,
        escapeDest.lat,
        escapeDest.lng,
        signal,
      );
      const escape: EscapeInfo = liveRoute
        ? {
            distance: liveRoute.distanceText,
            duration: liveRoute.durationText,
            steps: liveRoute.steps,
          }
        : getDummyEscape(userCoords, escapeDest);
      const nearestShelter = findNearestShelter(userCoords);
      const topShelters = getTopShelters(userCoords);

      const data: ResultData = {
        blastCenter: blastCoords,
        userLocation: userCoords,
        address: label,
        weather,
        escape,
        decision,
        distanceFromBlast: distFromBlast,
        yield: yieldType,
        nearestShelter,
        topShelters,
      };

      // ── Draw blast circles ──
    const blastLL: L.LatLngExpression = [blastCoords.lat, blastCoords.lng];
    [...zones].reverse().forEach((zone) => {
      const circle = L.circle(blastLL, {
        radius: zone.radius,
        color: zone.color,
        weight: 2,
        fillColor: zone.color,
        fillOpacity: zone.fillOpacity,
        dashArray: zone.radius === zones[0].radius ? undefined : "6 4",
      }).addTo(map);
      circle.bindPopup(`<b>${zone.label}</b><br/>${zone.desc}`);
      layersRef.current.push(circle);
    });

    // ── Ground zero marker ──
    const gzIcon = L.divIcon({
      html: `<div style="width:22px;height:22px;background:radial-gradient(circle,#ff2020,#8b0000);border-radius:50%;border:2px solid #fff;box-shadow:0 0 14px #ff4040;"></div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
      className: "",
    });
    layersRef.current.push(
      L.marker(blastLL, { icon: gzIcon }).addTo(map).bindPopup(`<b>☢ Ground Zero</b><br/>Blast Center`)
    );

    // ── User location marker ──
    const userLL: L.LatLngExpression = [userCoords.lat, userCoords.lng];
    const userIcon = L.divIcon({
      html: `<div style="width:16px;height:16px;background:#3b82f6;border-radius:50%;border:2px solid #fff;box-shadow:0 0 8px #3b82f6;"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
      className: "",
    });
    layersRef.current.push(
      L.marker(userLL, { icon: userIcon }).addTo(map).bindPopup(`<b>📍 Your Location</b><br/>${label}`)
    );

    // ── Wind arrow (fallout drift) ──
    const windDest = offsetLatLng(blastCoords, Math.max(maxRadius * 1.8, 10000), weather.windDeg);
    const windLine = L.polyline([[blastCoords.lat, blastCoords.lng], [windDest.lat, windDest.lng]], {
      color: "#a78bfa", weight: 3, dashArray: "8 4", opacity: 0.85,
    }).addTo(map);
    windLine.bindPopup(`<b>Fallout Drift</b><br/>${windDegToDir(weather.windDeg)} at ${weather.windSpeed.toFixed(1)} m/s`);
    layersRef.current.push(windLine);

    const arrowIcon = L.divIcon({
      html: `<div style="font-size:18px;transform:rotate(${weather.windDeg}deg);line-height:1;color:#a78bfa;text-shadow:0 0 6px #a78bfa;">▲</div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
      className: "",
    });
    layersRef.current.push(L.marker([windDest.lat, windDest.lng], { icon: arrowIcon }).addTo(map));

    // ── Shelter markers ──
    const shelterColorMap: Record<ShelterType, { bg: string; border: string; text: string }> = {
      subway: { bg: "#0f2d47", border: "#38bdf8", text: "#38bdf8" },
      hospital: { bg: "#1a1a2e", border: "#f472b6", text: "#f472b6" },
      parking: { bg: "#1a2e1a", border: "#4ade80", text: "#4ade80" },
      building: { bg: "#2e2a1a", border: "#fbbf24", text: "#fbbf24" },
    };
    SHELTERS.forEach((s) => {
      const isNearest = s.name === nearestShelter.shelter.name;
      const c = shelterColorMap[s.type];
      const icon = getShelterIcon(s.type);
      const shelterIcon = L.divIcon({
        html: `<div style="background:${c.bg};border:${isNearest ? "2px" : "1.5px"} solid ${c.border};border-radius:4px;padding:2px 5px;font-size:${isNearest ? "11px" : "10px"};font-weight:${isNearest ? "900" : "700"};color:${c.border};white-space:nowrap;${isNearest ? `box-shadow:0 0 8px ${c.border}80;` : ""}">${icon} ${s.name.split("–")[0].split("/")[0].trim().split(" ").slice(0, 3).join(" ")}</div>`,
        iconSize: [110, 22],
        iconAnchor: [55, 11],
        className: "",
      });
      const m = L.marker([s.lat, s.lng], { icon: shelterIcon }).addTo(map)
        .bindPopup(`<b>${icon} ${s.name}</b><br/>${s.address}<br/><em>${s.floors}</em><br/>Capacity: ${s.capacity}${isNearest ? "<br/><b style='color:#38bdf8'>★ NEAREST TO YOU</b>" : ""}`);
      layersRef.current.push(m);
    });

    // ── Walking route to nearest shelter ──
    const shelterLL: L.LatLngExpression = [nearestShelter.shelter.lat, nearestShelter.shelter.lng];
    const shelterLine = L.polyline(
      [[userCoords.lat, userCoords.lng], [nearestShelter.shelter.lat, nearestShelter.shelter.lng]],
      { color: "#38bdf8", weight: 4, opacity: 1, dashArray: "8 5" }
    ).addTo(map);
    shelterLine.bindPopup(`<b>Walk to shelter</b><br/>${nearestShelter.walkMinutes} min walk`);
    layersRef.current.push(shelterLine);

    // Pulsing shelter destination ring
    const shelterPulse = L.circle(shelterLL, {
      radius: 80,
      color: "#38bdf8",
      weight: 3,
      fillColor: "#38bdf8",
      fillOpacity: 0.15,
    }).addTo(map);
    layersRef.current.push(shelterPulse);

    // ── Escape route ──
    const mid1 = offsetLatLng(userCoords, Math.max(maxRadius * 0.8, 4000), (weather.windDeg + 155) % 360);
    const mid2 = offsetLatLng(userCoords, Math.max(maxRadius * 1.4, 9000), (weather.windDeg + 170) % 360);
    const routePoints: L.LatLngExpression[] =
      liveRoute?.encodedPolyline
        ? decodePolyline(liveRoute.encodedPolyline)
        : [
            [userCoords.lat, userCoords.lng],
            [mid1.lat, mid1.lng],
            [mid2.lat, mid2.lng],
            [escapeDest.lat, escapeDest.lng],
          ];
    const routeLine = L.polyline(
      routePoints,
      { color: "#22d3ee", weight: 4, opacity: 0.9, dashArray: "14 6" }
    ).addTo(map);
    routeLine.bindPopup("<b>Escape Route</b><br/>Drive away from blast zone");
    layersRef.current.push(routeLine);

    const escIcon = L.divIcon({
      html: `<div style="background:#064e3b;border:2px solid #10b981;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:14px;">✓</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      className: "",
    });
    layersRef.current.push(
      L.marker([escapeDest.lat, escapeDest.lng], { icon: escIcon }).addTo(map)
        .bindPopup(`<b>✓ Safe Zone</b><br/>${escapeDest.name}<br/>Outside blast radius`)
    );

    // ── Line connecting user to blast ──
    const distLine = L.polyline([[userCoords.lat, userCoords.lng], [blastCoords.lat, blastCoords.lng]], {
      color: "#ef4444", weight: 1.5, opacity: 0.5, dashArray: "4 4",
    }).addTo(map);
    layersRef.current.push(distLine);

    // ── Fit map ──
      map.fitBounds(
        L.latLngBounds([
          [blastCoords.lat, blastCoords.lng],
          [escapeDest.lat, escapeDest.lng],
        ]),
        { padding: [50, 50] },
      );

      setResult(data);

      const zoneInfo = (() => {
        const dist = haversineDistance(userCoords, blastCoords);
        const zones = YIELD_CONFIGS[yieldType].zones;
        if (dist < zones[0].radius) return zones[0].label;
        if (dist < zones[1].radius) return zones[1].label;
        if (dist < zones[2].radius) return zones[2].label;
        return "Outside Blast Zone";
      })();

      fetchAISurvivalBrief({
        blastLocation: blastCoords.lat.toFixed(4) + "," + blastCoords.lng.toFixed(4),
        userLocation: label,
        distanceKm: (haversineDistance(userCoords, blastCoords) / 1000).toFixed(1),
        yieldLabel: YIELD_CONFIGS[yieldType].label,
        zoneName: zoneInfo,
        decision: data.decision,
        weatherDesc: data.weather.description,
        windDir: windDegToDir(data.weather.windDeg),
        windSpeed: data.weather.windSpeed.toFixed(1),
        nearestShelterName: data.nearestShelter.shelter.name,
        nearestShelterDistance: data.nearestShelter.distance < 1000
          ? Math.round(data.nearestShelter.distance) + "m"
          : (data.nearestShelter.distance / 1000).toFixed(1) + "km",
        nearestShelterWalkMinutes: String(data.nearestShelter.walkMinutes),
        safeZoneName: escapeDest.name ?? "safe zone",
        escapeDuration: data.escape.duration,
      }, signal).then((brief) => {
        if (brief) setAiBrief(brief);
      });

      pushScenarioToUrl(blastCoords, userCoords, yieldType);
    } finally {
      setLoading(false);
      setGeoLoading(false);
    }
  }, [clearLayers]);

  analyzeRef.current = analyze;

  // ── Initialize map ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [NYC_CENTER.lat, NYC_CENTER.lng],
      zoom: 12,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    const scenario = parseUrlScenario(window.location.search);
    if (scenario && !urlRestoreDoneRef.current) {
      urlRestoreDoneRef.current = true;
      setAddress("Shared Location");
      setSelectedYield(scenario.yield);
      setBlastCenter(scenario.blastCoords);
      void analyzeRef.current(
        scenario.userCoords,
        scenario.blastCoords,
        "Shared Location",
        scenario.yield,
      );
    }

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(
    () => () => {
      analyzeAbortRef.current?.abort();
    },
    [],
  );

  // ── Handle address search ───────────────────────────────────────────────────
  const handleSearch = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    setGpsLocked(false);
    if (!address.trim()) return;

    setLoading(true);
    setError("");
    setErrorType("error");
    await new Promise((r) => setTimeout(r, 700));

    const fromApi = await fetchLiveGeocode(address.trim());
    const coords = fromApi
      ? { lat: fromApi.lat, lng: fromApi.lng }
      : geocodeAddress(address);
    if (!coords) {
      setError("Address not found. Try: 'Times Square', 'Brooklyn Bridge', '10001', or a NYC neighborhood name.");
      setErrorType("error");
      setLoading(false);
      return;
    }

    const label = fromApi?.formattedAddress ?? address;

    const blastFromInput = blastAddress.trim()
      ? (await fetchLiveGeocode(blastAddress.trim())) ?? geocodeAddress(blastAddress)
      : null;

    const blast = blastFromInput
      ? { lat: blastFromInput.lat, lng: blastFromInput.lng }
      : (blastCenter ?? { lat: 40.758, lng: -73.9855 });
    await analyze(coords, blast, label, selectedYield);
  }, [address, blastAddress, blastCenter, selectedYield, analyze]);

  // ── Geolocation ─────────────────────────────────────────────────────────────
  const handleGeolocate = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      setErrorType("gps");
      return;
    }
    setGeoLoading(true);
    setError("");
    setErrorType("error");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const blast = blastCenter ?? { lat: 40.758, lng: -73.9855 };
        setAddress("My Location");
        setGpsLocked(true);
        void analyze(userCoords, blast, "My Location (GPS)", selectedYield);
      },
      (err) => {
        setGeoLoading(false);

        let userMessage = "";

        if (err.code === 1) {
          // PERMISSION_DENIED
          userMessage =
            "Location access denied. Enter your address manually — try 'Times Square', 'Brooklyn', or your zip code.";
        } else if (err.code === 2) {
          // POSITION_UNAVAILABLE — this is the Mac kCLError
          userMessage =
            "GPS unavailable on this device. Enter your NYC address or zip code in the search bar instead.";
        } else if (err.code === 3) {
          // TIMEOUT
          userMessage = "Location timed out. Try again or enter your address manually.";
        } else {
          userMessage = "Could not get location. Enter your address manually.";
        }

        setError(userMessage);
        setErrorType("gps");
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }, [blastCenter, selectedYield, analyze]);

  // ── Click-to-place mode ─────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (clickHandlerRef.current) {
      map.off("click", clickHandlerRef.current);
      clickHandlerRef.current = null;
    }

    if (clickMode) {
      map.getContainer().style.cursor = "crosshair";
      const handler = (e: L.LeafletMouseEvent) => {
        const clicked = { lat: e.latlng.lat, lng: e.latlng.lng };
        setBlastCenter(clicked);
        setClickMode(false);
        map.getContainer().style.cursor = "";

        // If we already have a result, re-analyze with new blast center
        if (result) {
          void analyze(result.userLocation, clicked, result.address, selectedYield);
        } else {
          // Just show a temporary blast marker
          clearLayers();
          const gzIcon = L.divIcon({
            html: `<div style="width:22px;height:22px;background:radial-gradient(circle,#ff2020,#8b0000);border-radius:50%;border:2px solid #fff;box-shadow:0 0 14px #ff4040;"></div>`,
            iconSize: [22, 22],
            iconAnchor: [11, 11],
            className: "",
          });
          const m = L.marker([clicked.lat, clicked.lng], { icon: gzIcon }).addTo(map)
            .bindPopup("<b>☢ Blast Center Set</b><br/>Now enter your location to analyze");
          layersRef.current.push(m);
          const cfg = YIELD_CONFIGS[selectedYield];
          [...cfg.zones].reverse().forEach((zone) => {
            const c = L.circle([clicked.lat, clicked.lng], {
              radius: zone.radius, color: zone.color, weight: 2,
              fillColor: zone.color, fillOpacity: zone.fillOpacity,
            }).addTo(map);
            layersRef.current.push(c);
          });
          map.setView([clicked.lat, clicked.lng], 12);
        }
      };
      clickHandlerRef.current = handler;
      map.on("click", handler);
    } else {
      map.getContainer().style.cursor = "";
    }

    return () => {
      if (clickHandlerRef.current && map) {
        map.off("click", clickHandlerRef.current);
      }
    };
  }, [clickMode, result, selectedYield, analyze, clearLayers]);

  const getZoneInfo = (dist: number, yieldType: YieldOption) => {
    const zones = YIELD_CONFIGS[yieldType].zones;
    if (dist < zones[0].radius) return { label: zones[0].label, color: "text-red-400", bg: "bg-red-950/60 border-red-800" };
    if (dist < zones[1].radius) return { label: zones[1].label, color: "text-orange-400", bg: "bg-orange-950/60 border-orange-800" };
    if (dist < zones[2].radius) return { label: zones[2].label, color: "text-yellow-400", bg: "bg-yellow-950/60 border-yellow-800" };
    return { label: "Outside Blast Zone", color: "text-green-400", bg: "bg-green-950/60 border-green-800" };
  };

  return (
    <div className="h-screen w-full flex flex-col bg-background text-foreground overflow-hidden">
      {/* ── Header ── */}
      <header className="flex-none flex flex-col">
        {/* Row 1 — brand + status */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-red-900/40">
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center w-8 h-8">
              <div
                className="absolute inset-0 rounded-full bg-red-600/40 blur-md animate-pulse"
                aria-hidden
              />
              <div className="relative w-8 h-8 rounded-full bg-red-600/20 border border-red-600 flex items-center justify-center">
                <span className="text-sm">☢</span>
              </div>
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground leading-none">
                Nuclear Escape Router
              </h1>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                NYC Emergency Preparedness
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full border border-red-600 text-red-400 text-[10px] font-bold uppercase tracking-wider animate-pulse">
            SIMULATION MODE
          </span>
        </div>

        {/* Row 2 — controls */}
        <div className="bg-card border-b border-border px-4 py-2 flex items-center gap-3 flex-wrap">
          {/* Yield selector */}
          <div className="flex flex-col gap-1 flex-none">
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
              YIELD
            </span>
            <div className="flex bg-muted rounded-md p-0.5 gap-0.5">
              {(Object.keys(YIELD_CONFIGS) as YieldOption[]).map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => setSelectedYield(y)}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                    selectedYield === y
                      ? "bg-red-600 text-white"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {YIELD_CONFIGS[y].label}
                </button>
              ))}
            </div>
          </div>

          {/* Search + actions */}
          <form onSubmit={handleSearch} className="flex-1 flex gap-2 min-w-0">
            <div className="flex flex-col gap-1 flex-none w-52">
              <span className="text-[9px] uppercase tracking-widest text-red-400 font-semibold">
                BLAST
              </span>
              <input
                type="text"
                value={blastAddress}
                onChange={(e) => setBlastAddress(e.target.value)}
                placeholder="Blast location: Times Square, Midtown..."
                className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
              />
            </div>
            <div className="flex-1 flex gap-2 min-w-0">
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter your location in NYC..."
                className="flex-1 min-w-0 bg-muted border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                disabled={loading || geoLoading || !address.trim()}
                className="px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-md text-xs font-semibold disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {loading ? "..." : "Analyze"}
              </button>
            </div>
          </form>

          {/* GPS + Place blast + Share + Disclaimer */}
          <div className="flex gap-2 flex-none items-center">
            <button
              type="button"
              onClick={handleGeolocate}
              disabled={gpsLocked || geoLoading || loading}
              title="Use my current GPS location"
              className={`flex items-center gap-1.5 px-3 py-2 border rounded-md text-xs font-medium transition-colors ${
                gpsLocked
                  ? "bg-green-950 border-green-800 text-green-300"
                  : "bg-blue-950 hover:bg-blue-900 text-blue-300 border-blue-800 disabled:opacity-50"
              }`}
            >
              {geoLoading ? "📡 Locating..." : gpsLocked ? "📍 Location Set" : "📍 GPS"}
            </button>
            <button
              type="button"
              onClick={() => setClickMode((v) => !v)}
              title="Click on the map to place the blast center"
              className={`flex items-center gap-1.5 px-3 py-2 border rounded-md text-xs font-medium transition-colors ${
                clickMode
                  ? "ring-2 ring-red-500 bg-red-900 text-white border-red-700"
                  : "bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-700"
              }`}
            >
              ☢ {clickMode ? "Click map..." : "Place Blast"}
            </button>
            {result && (
              <button
                type="button"
                onClick={async () => {
                  const url = window.location.href;
                  try {
                    await navigator.clipboard.writeText(url);
                  } catch {
                    const el = document.createElement("textarea");
                    el.value = url;
                    el.style.position = "fixed";
                    el.style.opacity = "0";
                    document.body.appendChild(el);
                    el.select();
                    document.execCommand("copy");
                    document.body.removeChild(el);
                  }
                  setShareCopied(true);
                  setTimeout(() => setShareCopied(false), 2000);
                }}
                title="Copy shareable link to clipboard"
                className="flex items-center gap-1 px-2.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-md text-xs font-medium transition-colors"
              >
                {shareCopied ? "Copied!" : "🔗 Share"}
              </button>
            )}
            <Link
              href="/disclaimer"
              title="Read the full disclaimer"
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors whitespace-nowrap"
            >
              ⚠ Legal
            </Link>
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Map */}
        <div className="flex-1 relative">
          <div ref={mapRef} className="w-full h-full" />

          {/* Click mode banner */}
          {clickMode && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-red-900/95 border border-red-500 rounded-lg px-4 py-2 text-sm font-semibold text-red-200 shadow-xl">
              ☢ Click anywhere on the map to place the blast center
            </div>
          )}

          {/* Initial hint */}
          {!result && !loading && !geoLoading && (
            <div className="absolute bottom-10 left-4 z-[500] bg-zinc-900/90 border border-zinc-700/50 backdrop-blur-sm rounded-xl p-4 max-w-[260px] shadow-xl">
              <p className="text-[9px] tracking-widest text-zinc-500 uppercase mb-3 font-semibold">
                How to use
              </p>
              <ol className="space-y-3 list-none">
                <li className="flex gap-2.5 items-start">
                  <span className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center flex-none bg-red-900 text-red-300 border border-red-700">
                    1
                  </span>
                  <span className="text-xs text-zinc-300 leading-relaxed">
                    Click <span className="text-red-400 font-medium">☢ Place Blast</span> to mark where the bomb drops
                  </span>
                </li>
                <li className="flex gap-2.5 items-start">
                  <span className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center flex-none bg-blue-900 text-blue-300 border border-blue-700">
                    2
                  </span>
                  <span className="text-xs text-zinc-300 leading-relaxed">
                    Enter your address <span className="text-blue-400 font-medium">or click 📍 GPS</span>
                  </span>
                </li>
                <li className="flex gap-2.5 items-start">
                  <span className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center flex-none bg-orange-900 text-orange-300 border border-orange-700">
                    3
                  </span>
                  <span className="text-xs text-zinc-300 leading-relaxed">
                    Hit <span className="text-orange-400 font-medium">Analyze</span> to see your escape route
                  </span>
                </li>
              </ol>
              <div className="text-[10px] text-zinc-600 border-t border-zinc-800 pt-2 mt-2">
                Try: <span className="text-zinc-400">Times Square, Wall Street, 10001</span>
              </div>
            </div>
          )}

          {/* Loading overlay */}
          {(loading || geoLoading) && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/70 backdrop-blur-sm z-[500]">
              <div className="bg-zinc-900 border border-red-900/60 rounded-2xl p-8 shadow-2xl max-w-xs w-full mx-4 text-center">
                <div className="text-5xl spin-slow">☢</div>
                <p className="text-sm font-black tracking-widest text-red-400 uppercase mt-4">
                  Analyzing threat zones
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  Calculating blast radius &amp; fallout patterns
                </p>
                <div className="flex justify-center gap-1 mt-4 text-red-400 text-xs">
                  <span className="dot-pulse" style={{ animationDelay: "0s" }}>●</span>
                  <span className="dot-pulse" style={{ animationDelay: "0.2s" }}>●</span>
                  <span className="dot-pulse" style={{ animationDelay: "0.4s" }}>●</span>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div
              className={`absolute bottom-4 left-4 right-4 z-[500] rounded-lg p-3 text-xs flex justify-between items-start gap-2 ${
                errorType === "gps"
                  ? "bg-amber-950/20 border border-amber-800/60 text-amber-300"
                  : errorType === "info"
                    ? "bg-blue-950/20 border border-blue-800/60 text-blue-300"
                    : "bg-destructive/20 border border-destructive/60 text-red-300"
              }`}
            >
              <span>{error}</span>
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setErrorType("error");
                }}
                className="text-red-400 hover:text-red-200 flex-none font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {/* Blast center set indicator */}
          {blastCenter && !clickMode && !result && (
            <div className="absolute top-3 left-3 z-[500] bg-red-950/90 border border-red-800 rounded-lg px-3 py-1.5 text-xs text-red-300">
              ☢ Blast center set — now enter your location
            </div>
          )}

          {/* Map Legend */}
          <div className="absolute top-3 right-3 z-[500] bg-card/95 border border-border rounded-lg p-2.5 text-xs shadow-lg max-w-[160px]">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-[8px] tracking-widest text-zinc-600 uppercase font-semibold">
                Legend
              </p>
              <button
                type="button"
                onClick={() => setLegendCollapsed((v) => !v)}
                className="text-zinc-500 hover:text-zinc-300 text-sm leading-none w-4 h-4 flex items-center justify-center"
                aria-expanded={!legendCollapsed}
                aria-label={legendCollapsed ? "Expand legend" : "Collapse legend"}
              >
                {legendCollapsed ? "+" : "−"}
              </button>
            </div>
            {!legendCollapsed && (
              <div className="space-y-1">
                {YIELD_CONFIGS[selectedYield].zones.map((z) => (
                  <div key={z.radius} className="flex items-center gap-1.5">
                    <div
                      className="w-8 h-1.5 rounded-full flex-none"
                      style={{ background: z.color }}
                    />
                    <span className="text-muted-foreground leading-none">{z.label}</span>
                  </div>
                ))}
                <div className="pt-1 border-t border-border space-y-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-8 h-1.5 rounded-full bg-purple-400 flex-none" />
                    <span className="text-muted-foreground">Fallout drift</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-8 h-1.5 rounded-full bg-cyan-400 flex-none" />
                    <span className="text-muted-foreground">Escape route</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-8 h-0 flex-none" style={{ borderTop: "2px dashed #38bdf8" }} />
                    <span className="text-muted-foreground">Walk to shelter</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-8 h-1.5 rounded-full bg-blue-600 flex-none" />
                    <span className="text-muted-foreground">Your location</span>
                  </div>
                </div>
                <div className="pt-1 border-t border-border space-y-1">
                  <p className="text-[9px] uppercase tracking-wide text-muted-foreground/60 font-semibold">
                    Shelters
                  </p>
                  {(["🚇 Subway", "🏥 Hospital", "🅿 Parking", "🏛 Building"] as const).map((s) => (
                    <div key={s} className="flex items-center gap-1.5">
                      <span className="text-sm flex-none">{s.split(" ")[0]}</span>
                      <span className="text-muted-foreground">{s.split(" ")[1]}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right Panel ── */}
        {result && (
          <div className="w-80 flex-none border-l border-border bg-card flex flex-col overflow-hidden">

            {/* ── Primary Decision Banner ── */}
            <div
              className={`p-4 border-b bg-gradient-to-br ${
                result.decision === "shelter"
                  ? "from-red-950 to-red-900 border-red-900"
                  : "from-amber-950 to-amber-900 border-amber-900"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{result.decision === "shelter" ? "🔴" : "🟡"}</span>
                    <span
                      className={`text-sm font-black tracking-wide ${
                        result.decision === "shelter" ? "text-red-300" : "text-amber-300"
                      }`}
                    >
                      {result.decision === "shelter" ? "SHELTER IN PLACE" : "FIND SHELTER OR EVACUATE"}
                    </span>
                  </div>
                  <p
                    className={`text-[11px] leading-relaxed ${
                      result.decision === "shelter" ? "text-red-400" : "text-amber-400"
                    }`}
                  >
                    {result.decision === "shelter"
                      ? "You are in the fireball zone — do NOT flee. Go underground immediately."
                      : `You are ${(result.distanceFromBlast / 1000).toFixed(1)}km from blast. Shelter underground or evacuate now.`}
                  </p>
                  <span
                    className={`inline-block mt-2 px-2.5 py-0.5 rounded-full bg-black/30 text-[11px] font-semibold ${
                      result.decision === "shelter" ? "text-red-200" : "text-amber-200"
                    }`}
                  >
                    {(result.distanceFromBlast / 1000).toFixed(1)} km from blast
                  </span>
                </div>
                <span className="text-3xl flex-none leading-none" aria-hidden>
                  {result.decision === "shelter" ? "🏠" : "🚗"}
                </span>
              </div>
            </div>

            {/* AI Brief */}
            {(aiBrief || loading) && (
              <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/60">
                <p className="text-[9px] uppercase tracking-widest text-orange-400 font-semibold mb-1.5 flex items-center gap-1">
                  <span>⚡</span> AI SURVIVAL BRIEF
                </p>
                {aiBrief ? (
                  <p className="text-xs text-zinc-200 leading-relaxed">
                    {aiBrief}
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    <div className="h-2.5 bg-zinc-700/60 rounded animate-pulse w-full" />
                    <div className="h-2.5 bg-zinc-700/60 rounded animate-pulse w-4/5" />
                    <div className="h-2.5 bg-zinc-700/60 rounded animate-pulse w-3/5" />
                  </div>
                )}
              </div>
            )}

            <RadiationDecayTimer
              key={`${result.blastCenter.lat},${result.blastCenter.lng},${result.userLocation.lat},${result.userLocation.lng}`}
            />

            {/* ── Tabs ── */}
            <div className="flex border-b border-border">
              {(
                [
                  { key: "shelter", icon: "🛡", label: "Shelter" },
                  { key: "info", icon: "☢", label: "Threat" },
                  { key: "route", icon: "🚗", label: "Evacuate" },
                ] as const
              ).map(({ key, icon, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={`flex-1 py-2 text-[11px] font-semibold transition-all duration-200 border-b-2 ${
                    activeTab === key
                      ? "text-white border-red-500 bg-red-950/20"
                      : "text-muted-foreground hover:text-foreground border-transparent"
                  }`}
                >
                  <span className="sm:hidden">{icon}</span>
                  <span className="hidden sm:inline">
                    {icon} {label}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-0">

              {/* ══ SHELTER TAB ══ */}
              {activeTab === "shelter" && (
                <>
                  {/* Nearest shelter hero card */}
                  <div className="relative rounded-xl bg-zinc-900/40 border border-zinc-800/60 p-4">
                    <span className="absolute top-2.5 right-2.5 px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wide bg-sky-600 text-white animate-pulse">
                      ★ Nearest
                    </span>
                    <div className="flex items-center gap-1.5 mb-2 pr-16">
                      <span className="text-lg">{getShelterIcon(result.nearestShelter.shelter.type)}</span>
                      <p className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold">
                        Nearest Shelter
                      </p>
                    </div>
                    <p className="text-base font-bold text-white leading-snug mb-1 w-full">
                      {result.nearestShelter.shelter.name}
                    </p>
                    <p className="text-[11px] text-zinc-400 mb-3">{result.nearestShelter.shelter.address}</p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className="px-2.5 py-1 rounded-full bg-zinc-800/80 text-[10px] font-semibold text-sky-300">
                        {result.nearestShelter.distance < 1000
                          ? `${Math.round(result.nearestShelter.distance)}m`
                          : `${(result.nearestShelter.distance / 1000).toFixed(1)}km`}
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-zinc-800/80 text-[10px] font-semibold text-sky-300">
                        {result.nearestShelter.walkMinutes} min walk
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-zinc-800/80 text-[10px] font-semibold text-sky-300">
                        {result.nearestShelter.shelter.floors
                          .replace("levels", "lvls")
                          .replace("underground", "UG")
                          .replace("below ground", "BG")}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold">
                          Capacity
                        </p>
                        <p className="text-[10px] text-zinc-400">
                          ~60% estimated load
                          {/\d+/.test(result.nearestShelter.shelter.capacity)
                            ? ` · ${result.nearestShelter.shelter.capacity.match(/\d+/)?.[0]} max`
                            : ` · ${result.nearestShelter.shelter.capacity}`}
                        </p>
                      </div>
                      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-sky-500 rounded-full" style={{ width: "60%" }} />
                      </div>
                    </div>
                  </div>

                  {/* Walking directions */}
                  <div className="border-t border-border/40 pt-3 mt-3">
                    <div className="rounded-xl bg-zinc-900/40 border border-zinc-800/60 p-3">
                      <p className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold mb-3">
                        Walking Directions
                      </p>
                      <div className="space-y-2.5">
                        {result.nearestShelter.walkSteps.map((step, i) => {
                          const isLastTwo = i >= result.nearestShelter.walkSteps.length - 2;
                          return (
                            <div
                              key={i}
                              className={`border-l-2 pl-3 ${
                                isLastTwo ? "border-sky-400" : "border-sky-800"
                              }`}
                            >
                              <p
                                className={`text-xs leading-relaxed ${
                                  isLastTwo ? "text-sky-300 font-medium" : "text-foreground"
                                }`}
                              >
                                {step}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Other nearby shelters */}
                  <div className="border-t border-border/40 pt-3 mt-3">
                    <div className="rounded-xl bg-zinc-900/40 border border-zinc-800/60 p-3">
                      <p className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold mb-2">
                        Other Nearby Shelters
                      </p>
                      <div className="space-y-1.5">
                        {result.topShelters.slice(1).map((s) => (
                          <div
                            key={s.name}
                            className="flex items-center gap-2 py-1.5 border-b border-border/40 last:border-0"
                          >
                            <span className="text-base flex-none">{getShelterIcon(s.type)}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground truncate">{s.name}</p>
                              <p className="text-[10px] text-muted-foreground">{s.floors}</p>
                            </div>
                            <div className="text-right flex-none">
                              <p className="text-xs font-bold text-sky-400">
                                {s.distance < 1000
                                  ? `${Math.round(s.distance)}m`
                                  : `${(s.distance / 1000).toFixed(1)}km`}
                              </p>
                              <p className="text-[10px] text-muted-foreground">{s.walkMinutes} min</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Once inside tips */}
                  <div className="border-t border-border/40 pt-3 mt-3 pb-1">
                    <div className="rounded-xl bg-zinc-900/40 border border-yellow-900/40 p-3">
                      <p className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold mb-2">
                        ⚠ Once Inside the Shelter
                      </p>
                      <ul className="space-y-1.5">
                        {[
                          "Go to the lowest level possible — the deeper the better",
                          "Stay away from all windows, doors, and outer walls",
                          "Turn off ventilation systems if possible",
                          "Do NOT leave until authorities give the all-clear",
                          "1 meter of concrete = protection from fallout",
                          "Radiation drops ~90% every 7 hours (7-10 rule)",
                        ].map((tip, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                            <span className="text-yellow-600 flex-none mt-0.5">•</span>
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </>
              )}

              {/* ══ THREAT INFO TAB ══ */}
              {activeTab === "info" && (
                <>
                  {(() => {
                    const zone = getZoneInfo(result.distanceFromBlast, result.yield);
                    return (
                      <div className={`rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-3 ${zone.bg}`}>
                        <p className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold mb-1">
                          Your Zone
                        </p>
                        <p className={`font-bold text-sm ${zone.color}`}>{zone.label}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {result.distanceFromBlast < 1000
                            ? `${Math.round(result.distanceFromBlast)}m from blast center`
                            : `${(result.distanceFromBlast / 1000).toFixed(1)}km from blast center`}
                        </p>
                      </div>
                    );
                  })()}

                  <div className="border-t border-border/40 pt-3 mt-3">
                    <div className="rounded-xl bg-zinc-900/40 border border-zinc-800/60 p-3">
                      <p className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold mb-2">
                        Wind / Fallout Direction
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[10px] text-muted-foreground">Speed</p>
                          <p className="font-semibold text-sm">{result.weather.windSpeed.toFixed(1)} m/s</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Direction</p>
                          <p className="font-semibold text-sm">
                            {windDegToDir(result.weather.windDeg)} ({Math.round(result.weather.windDeg)}°)
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Conditions</p>
                          <p className="font-semibold text-sm capitalize">{result.weather.description}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Temp</p>
                          <p className="font-semibold text-sm">{result.weather.temp}°C</p>
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t border-border/40 text-xs text-muted-foreground">
                        Fallout drifts{" "}
                        <span className="text-purple-400 font-medium">
                          {windDegToDir(result.weather.windDeg)}
                        </span>{" "}
                        — escape{" "}
                        <span className="text-cyan-400 font-medium">
                          {windDegToDir((result.weather.windDeg + 180) % 360)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border/40 pt-3 mt-3 pb-1">
                    <div className="rounded-xl bg-zinc-900/40 border border-zinc-800/60 p-3 space-y-2">
                      <p className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold">
                        {YIELD_CONFIGS[result.yield].label} — Blast Zones
                      </p>
                      {YIELD_CONFIGS[result.yield].zones.map((z) => (
                        <div key={z.radius} className="flex gap-2 items-start">
                          <div
                            className="w-2 h-2 rounded-full flex-none mt-1"
                            style={{ background: z.color }}
                          />
                          <div>
                            <p className="text-xs font-medium" style={{ color: z.color }}>
                              {z.label} ({z.radius >= 1000 ? `${z.radius / 1000}km` : `${z.radius}m`})
                            </p>
                            <p className="text-[10px] text-muted-foreground">{z.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* ══ EVACUATE TAB ══ */}
              {activeTab === "route" && (
                <>
                  <div className="rounded-xl bg-zinc-900/40 border border-cyan-900/40 p-3">
                    <p className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold mb-2">
                      Escape by Car
                    </p>
                    <div className="grid grid-cols-2 gap-3 mb-2">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Distance</p>
                        <p className="font-bold text-cyan-400">{result.escape.distance}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Est. Drive Time</p>
                        <p className="font-bold text-cyan-400">{result.escape.duration}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Head{" "}
                      <span className="text-cyan-400 font-medium">
                        {windDegToDir((result.weather.windDeg + 180) % 360)}
                      </span>{" "}
                      — opposite to fallout drift
                    </p>
                  </div>

                  <div className="border-t border-border/40 pt-3 mt-3">
                    <div className="rounded-xl bg-zinc-900/40 border border-zinc-800/60 p-3">
                      <p className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold mb-2">
                        Step-by-Step Directions
                      </p>
                      <div className="space-y-2">
                        {result.escape.steps.map((step, i) => (
                          <div key={i} className="flex gap-2">
                            <div className="w-4 h-4 rounded-full bg-cyan-900 border border-cyan-700 flex-none flex items-center justify-center mt-0.5">
                              <span className="text-[9px] font-bold text-cyan-400">{i + 1}</span>
                            </div>
                            <p className="text-xs text-foreground leading-relaxed">{step}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border/40 pt-3 mt-3 pb-1">
                    <div className="rounded-xl bg-zinc-900/40 border border-yellow-900/40 p-3">
                      <p className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold mb-2">
                        ⚠ Before You Leave
                      </p>
                      <ul className="space-y-1.5">
                        {[
                          "Grab go-bag (water, docs, meds, cash)",
                          "Keep all car windows fully closed",
                          "Do NOT use subway — may be compromised",
                          "Tune to AM radio for emergency broadcasts",
                          "Do not stop until outside blast zone",
                        ].map((tip, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                            <span className="text-yellow-600 flex-none">•</span>
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
