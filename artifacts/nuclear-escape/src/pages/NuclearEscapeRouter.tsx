import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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

interface ResultData {
  location: LatLng;
  address: string;
  weather: WeatherData;
  escape: EscapeInfo;
  decision: "shelter" | "evacuate";
  distanceFromCenter: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const NYC_CENTER: LatLng = { lat: 40.7128, lng: -74.006 };

const SUBWAY_SHELTERS = [
  { name: "Times Square 42 St", lat: 40.758, lng: -73.9855 },
  { name: "Grand Central Terminal", lat: 40.7527, lng: -73.9772 },
  { name: "Penn Station", lat: 40.7505, lng: -73.9934 },
  { name: "Union Square", lat: 40.7352, lng: -73.9896 },
  { name: "Jay St MetroTech", lat: 40.6923, lng: -73.9872 },
  { name: "Fulton St", lat: 40.7095, lng: -74.0074 },
  { name: "Atlantic Av", lat: 40.6841, lng: -73.9776 },
  { name: "Jackson Heights", lat: 40.7463, lng: -73.8914 },
  { name: "Flushing Main St", lat: 40.7596, lng: -73.83 },
  { name: "161 St Yankee Stadium", lat: 40.8278, lng: -73.9258 },
  { name: "86 St (Upper East)", lat: 40.7766, lng: -73.9518 },
  { name: "Court Sq–23 St", lat: 40.7468, lng: -73.9456 },
];

const PRESET_ADDRESSES: Record<string, LatLng> = {
  "times square": { lat: 40.758, lng: -73.9855 },
  "empire state building": { lat: 40.7484, lng: -73.9967 },
  "central park": { lat: 40.7851, lng: -73.9683 },
  "brooklyn bridge": { lat: 40.7061, lng: -73.9969 },
  "wall street": { lat: 40.7074, lng: -74.0113 },
  "yankee stadium": { lat: 40.8296, lng: -73.9262 },
  "jfk airport": { lat: 40.6413, lng: -73.7781 },
  "laguardia airport": { lat: 40.7769, lng: -73.874 },
  "columbia university": { lat: 40.8075, lng: -73.9626 },
  "brooklyn": { lat: 40.6782, lng: -73.9442 },
  "queens": { lat: 40.7282, lng: -73.7949 },
  "bronx": { lat: 40.8448, lng: -73.8648 },
  "staten island": { lat: 40.5795, lng: -74.1502 },
};

// BLAST_ZONES in km
const BLAST_ZONES = [
  { radius: 500, label: "Fireball Zone", color: "#ff2020", fillOpacity: 0.25, desc: "Immediate death – no escape possible" },
  { radius: 2000, label: "Heavy Blast Zone", color: "#ff8c00", fillOpacity: 0.15, desc: "Severe structural damage – evacuate immediately" },
  { radius: 6000, label: "Light Blast Zone", color: "#ffd700", fillOpacity: 0.08, desc: "Significant damage – evacuation recommended" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function haversineDistance(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function offsetLatLng(origin: LatLng, distanceM: number, bearingDeg: number): LatLng {
  const R = 6371000;
  const bearing = (bearingDeg * Math.PI) / 180;
  const lat1 = (origin.lat * Math.PI) / 180;
  const lng1 = (origin.lng * Math.PI) / 180;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(distanceM / R) +
      Math.cos(lat1) * Math.sin(distanceM / R) * Math.cos(bearing)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(distanceM / R) * Math.cos(lat1),
      Math.cos(distanceM / R) - Math.sin(lat1) * Math.sin(lat2)
    );
  return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI };
}

function geocodeAddress(raw: string): LatLng | null {
  const q = raw.toLowerCase().trim();
  for (const [key, coords] of Object.entries(PRESET_ADDRESSES)) {
    if (q.includes(key)) return coords;
  }
  // Simple NYC zip-code simulation
  const zipMatch = q.match(/\b1(0|1)\d{3}\b/);
  if (zipMatch) {
    const seed = parseInt(zipMatch[0]) % 100;
    return {
      lat: 40.65 + (seed / 100) * 0.35,
      lng: -74.05 + (seed / 100) * 0.3,
    };
  }
  // Any street address in NY: place somewhere in Manhattan
  if (q.match(/\d+/) && (q.includes("ny") || q.includes("new york") || q.includes("ave") || q.includes("st") || q.includes("blvd"))) {
    const num = parseInt(q.match(/\d+/)?.[0] ?? "100");
    return {
      lat: 40.71 + ((num % 60) / 60) * 0.12,
      lng: -74.02 + ((num % 40) / 40) * 0.08,
    };
  }
  return null;
}

function getDummyWeather(): WeatherData {
  const conditions = ["clear sky", "partly cloudy", "overcast clouds", "light breeze", "scattered clouds"];
  return {
    windSpeed: 4 + Math.random() * 6,
    windDeg: Math.floor(Math.random() * 360),
    description: conditions[Math.floor(Math.random() * conditions.length)],
    temp: 12 + Math.floor(Math.random() * 15),
    humidity: 45 + Math.floor(Math.random() * 35),
  };
}

function getDummyEscape(origin: LatLng, dest: LatLng): EscapeInfo {
  const dist = haversineDistance(origin, dest);
  const km = (dist / 1000).toFixed(1);
  const mins = Math.round(dist / 400); // ~24 km/h avg
  return {
    distance: `${km} km`,
    duration: mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}min`,
    steps: [
      "Head north on the nearest main street",
      "Turn right onto a major avenue",
      "Continue straight for 2 miles",
      "Merge onto the nearest highway heading outbound",
      "Follow signs toward New Jersey / Upstate NY",
      "Continue to designated safe zone (15km+ from blast center)",
    ],
  };
}

function windDegToDir(deg: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

// ─── Map Component ─────────────────────────────────────────────────────────────

export default function NuclearEscapeRouter() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.Layer[]>([]);

  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ResultData | null>(null);
  const [activeTab, setActiveTab] = useState<"info" | "route">("info");

  // ── Initialize map ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [NYC_CENTER.lat, NYC_CENTER.lng],
      zoom: 12,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;
    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // ── Clear overlay layers ────────────────────────────────────────────────────
  const clearLayers = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    layersRef.current.forEach((l) => map.removeLayer(l));
    layersRef.current = [];
  }, []);

  // ── Draw everything on map ──────────────────────────────────────────────────
  const drawOverlays = useCallback((data: ResultData) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    clearLayers();

    const { location, weather } = data;
    const latlng: L.LatLngExpression = [location.lat, location.lng];

    // Blast circles (outermost first so innermost renders on top)
    [...BLAST_ZONES].reverse().forEach((zone) => {
      const circle = L.circle(latlng, {
        radius: zone.radius,
        color: zone.color,
        weight: 2,
        fillColor: zone.color,
        fillOpacity: zone.fillOpacity,
        dashArray: zone.radius === 500 ? undefined : "6 4",
      }).addTo(map);
      circle.bindPopup(`<b>${zone.label}</b><br/>${zone.desc}`);
      layersRef.current.push(circle);
    });

    // Ground zero marker
    const gzIcon = L.divIcon({
      html: `<div style="width:24px;height:24px;background:radial-gradient(circle,#ff2020,#8b0000);border-radius:50%;border:2px solid #fff;box-shadow:0 0 12px #ff2020;"></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      className: "",
    });
    const gzMarker = L.marker(latlng, { icon: gzIcon })
      .addTo(map)
      .bindPopup(`<b>☢ Ground Zero</b><br/>${data.address}`);
    layersRef.current.push(gzMarker);

    // Wind direction arrow (fallout drift direction)
    const windArrowDest = offsetLatLng(location, 8000, weather.windDeg);
    const windLine = L.polyline([[location.lat, location.lng], [windArrowDest.lat, windArrowDest.lng]], {
      color: "#a78bfa",
      weight: 3,
      dashArray: "8 4",
      opacity: 0.85,
    }).addTo(map);
    windLine.bindPopup(`<b>Fallout Drift Direction</b><br/>Wind: ${weather.windDeg}° (${windDegToDir(weather.windDeg)}) at ${weather.windSpeed.toFixed(1)} m/s`);
    layersRef.current.push(windLine);

    // Wind arrowhead
    const arrowIcon = L.divIcon({
      html: `<div style="width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-bottom:16px solid #a78bfa;transform:rotate(${weather.windDeg}deg);transform-origin:center center;"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
      className: "",
    });
    const arrowMarker = L.marker([windArrowDest.lat, windArrowDest.lng], { icon: arrowIcon }).addTo(map);
    layersRef.current.push(arrowMarker);

    // Subway shelter markers
    SUBWAY_SHELTERS.forEach((s) => {
      const shelterIcon = L.divIcon({
        html: `<div style="background:#1a3d5c;border:2px solid #38bdf8;border-radius:4px;padding:2px 4px;font-size:10px;font-weight:700;color:#38bdf8;white-space:nowrap;">⬇ ${s.name.split(" ").slice(0, 2).join(" ")}</div>`,
        iconSize: [90, 22],
        iconAnchor: [45, 11],
        className: "",
      });
      const m = L.marker([s.lat, s.lng], { icon: shelterIcon })
        .addTo(map)
        .bindPopup(`<b>🛡 ${s.name}</b><br/>Fallout Shelter`);
      layersRef.current.push(m);
    });

    // Escape route: simple polyline from origin toward escape destination
    const escapeDest = offsetLatLng(location, 15000, (weather.windDeg + 180) % 360);
    const midpoint1 = offsetLatLng(location, 5000, (weather.windDeg + 150) % 360);
    const midpoint2 = offsetLatLng(location, 10000, (weather.windDeg + 170) % 360);
    const routeLine = L.polyline(
      [
        [location.lat, location.lng],
        [midpoint1.lat, midpoint1.lng],
        [midpoint2.lat, midpoint2.lng],
        [escapeDest.lat, escapeDest.lng],
      ],
      { color: "#22d3ee", weight: 4, opacity: 0.9, dashArray: "12 6" }
    ).addTo(map);
    routeLine.bindPopup("<b>Escape Route</b><br/>Drive away from blast zone");
    layersRef.current.push(routeLine);

    // Escape destination marker
    const escIcon = L.divIcon({
      html: `<div style="background:#064e3b;border:2px solid #10b981;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:16px;">✓</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      className: "",
    });
    const escMarker = L.marker([escapeDest.lat, escapeDest.lng], { icon: escIcon })
      .addTo(map)
      .bindPopup("<b>Safe Zone</b><br/>15km from blast center");
    layersRef.current.push(escMarker);

    // Fit map to show everything
    const allLatlngs: L.LatLngExpression[] = [
      [location.lat, location.lng],
      [escapeDest.lat, escapeDest.lng],
    ];
    map.fitBounds(L.latLngBounds(allLatlngs), { padding: [40, 40] });
  }, [clearLayers]);

  // ── Search handler ──────────────────────────────────────────────────────────
  const handleSearch = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!address.trim()) return;

    setLoading(true);
    setError("");

    await new Promise((r) => setTimeout(r, 800)); // Simulate network call

    const coords = geocodeAddress(address);
    if (!coords) {
      setError("Address not found. Try a well-known NYC landmark or include a zip code. Examples: 'Times Square', '350 5th Ave New York', '10001'");
      setLoading(false);
      return;
    }

    const weather = getDummyWeather();
    const escapeDest = offsetLatLng(coords, 15000, (weather.windDeg + 180) % 360);
    const escape = getDummyEscape(coords, escapeDest);
    const distFromCenter = haversineDistance(NYC_CENTER, coords);

    let decision: "shelter" | "evacuate";
    if (distFromCenter < 500) {
      decision = "shelter";
    } else {
      decision = "evacuate";
    }

    const data: ResultData = {
      location: coords,
      address,
      weather,
      escape,
      decision,
      distanceFromCenter: distFromCenter,
    };

    setResult(data);
    setLoading(false);
    drawOverlays(data);
  }, [address, drawOverlays]);

  const getZone = (dist: number) => {
    if (dist < 500) return { label: "Fireball Zone", color: "text-red-400", bg: "bg-red-950/60 border-red-800" };
    if (dist < 2000) return { label: "Heavy Blast Zone", color: "text-orange-400", bg: "bg-orange-950/60 border-orange-800" };
    if (dist < 6000) return { label: "Light Blast Zone", color: "text-yellow-400", bg: "bg-yellow-950/60 border-yellow-800" };
    return { label: "Outside Blast Zone", color: "text-green-400", bg: "bg-green-950/60 border-green-800" };
  };

  return (
    <div className="h-screen w-full flex flex-col bg-background text-foreground overflow-hidden">
      {/* Header */}
      <header className="flex-none border-b border-border bg-card px-4 py-3 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-red-600/20 border border-red-600 flex items-center justify-center pulse-red">
            <span className="text-sm">☢</span>
          </div>
          <div>
            <h1 className="text-base font-bold text-foreground leading-none">Nuclear Escape Router</h1>
            <p className="text-xs text-muted-foreground">NYC Emergency Preparedness</p>
          </div>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="flex-1 flex gap-2 max-w-xl ml-4">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Enter NYC address or landmark (e.g. Times Square, 10001)"
            className="flex-1 bg-muted border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={loading || !address.trim()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity whitespace-nowrap"
          >
            {loading ? "Calculating..." : "Analyze"}
          </button>
        </form>
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Map */}
        <div className="flex-1 relative">
          <div ref={mapRef} className="w-full h-full" />

          {/* Initial hint overlay */}
          {!result && !loading && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-card/90 border border-border rounded-xl p-6 max-w-sm text-center shadow-xl">
                <div className="text-4xl mb-3">☢</div>
                <h2 className="text-lg font-bold mb-2">Enter an NYC Address</h2>
                <p className="text-sm text-muted-foreground mb-3">
                  We'll calculate blast radius zones, fallout drift, and your best escape route.
                </p>
                <div className="text-xs text-muted-foreground space-y-1 text-left bg-muted/50 rounded-lg p-3">
                  <p className="font-medium text-foreground mb-1">Try these examples:</p>
                  <p>• Times Square</p>
                  <p>• Empire State Building</p>
                  <p>• Brooklyn Bridge</p>
                  <p>• Wall Street</p>
                  <p>• 10001 (zip code)</p>
                </div>
              </div>
            </div>
          )}

          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60">
              <div className="bg-card border border-border rounded-xl p-6 text-center shadow-xl">
                <div className="text-3xl mb-3 animate-spin">☢</div>
                <p className="font-semibold">Calculating threat zones...</p>
                <p className="text-xs text-muted-foreground mt-1">Analyzing blast radius & wind data</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute bottom-4 left-4 right-4 bg-destructive/20 border border-destructive/60 rounded-lg p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Map Legend */}
          <div className="absolute top-3 left-3 bg-card/95 border border-border rounded-lg p-3 text-xs space-y-1.5 shadow-lg">
            <p className="font-semibold text-foreground text-[11px] uppercase tracking-wide mb-2">Blast Zones</p>
            {BLAST_ZONES.map((z) => (
              <div key={z.radius} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full flex-none" style={{ background: z.color, opacity: 0.9 }} />
                <span className="text-muted-foreground">{z.label} ({z.radius >= 1000 ? `${z.radius / 1000}km` : `${z.radius}m`})</span>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-1 border-t border-border">
              <div className="w-3 h-0.5 bg-purple-400 flex-none" />
              <span className="text-muted-foreground">Fallout drift</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-cyan-400 flex-none" />
              <span className="text-muted-foreground">Escape route</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-blue-900 border border-sky-400 flex-none" />
              <span className="text-muted-foreground">Subway shelter</span>
            </div>
          </div>
        </div>

        {/* Right Panel */}
        {result && (
          <div className="w-80 flex-none border-l border-border bg-card flex flex-col overflow-hidden">
            {/* Decision Banner */}
            {result.decision === "shelter" ? (
              <div className="bg-red-950 border-b border-red-800 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">🔴</span>
                  <span className="text-xl font-black text-red-300 tracking-wide">SHELTER IN PLACE</span>
                </div>
                <p className="text-xs text-red-400">You are in the fireball zone. Evacuation is not survivable. Shelter underground immediately.</p>
              </div>
            ) : (
              <div className="bg-green-950 border-b border-green-800 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">🟢</span>
                  <span className="text-xl font-black text-green-300 tracking-wide">EVACUATE NOW</span>
                </div>
                <p className="text-xs text-green-400">Leave immediately via the escape route. Travel opposite to fallout drift direction.</p>
              </div>
            )}

            {/* Tabs */}
            <div className="flex border-b border-border">
              {(["info", "route"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2.5 text-xs font-medium capitalize transition-colors ${
                    activeTab === tab
                      ? "text-primary border-b-2 border-primary bg-primary/5"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab === "info" ? "Threat Info" : "Escape Route"}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {activeTab === "info" ? (
                <>
                  {/* Zone Status */}
                  {(() => {
                    const zone = getZone(result.distanceFromCenter);
                    return (
                      <div className={`rounded-lg border p-3 ${zone.bg}`}>
                        <p className="text-xs text-muted-foreground mb-0.5">Your Zone</p>
                        <p className={`font-bold text-sm ${zone.color}`}>{zone.label}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {result.distanceFromCenter < 1000
                            ? `${Math.round(result.distanceFromCenter)}m from city center`
                            : `${(result.distanceFromCenter / 1000).toFixed(1)}km from city center`}
                        </p>
                      </div>
                    );
                  })()}

                  {/* Wind Data */}
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Wind / Fallout Drift</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Speed</p>
                        <p className="font-semibold text-sm">{result.weather.windSpeed.toFixed(1)} m/s</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Direction</p>
                        <p className="font-semibold text-sm">{windDegToDir(result.weather.windDeg)} ({Math.round(result.weather.windDeg)}°)</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Conditions</p>
                        <p className="font-semibold text-sm capitalize">{result.weather.description}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Temperature</p>
                        <p className="font-semibold text-sm">{result.weather.temp}°C</p>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-border">
                      <p className="text-xs text-muted-foreground">
                        ☁ Fallout will drift <strong className="text-purple-400">{windDegToDir(result.weather.windDeg)}</strong> — escape in the <strong className="text-cyan-400">{windDegToDir((result.weather.windDeg + 180) % 360)}</strong> direction
                      </p>
                    </div>
                  </div>

                  {/* Blast Zone Guide */}
                  <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Blast Zone Guide</p>
                    {BLAST_ZONES.map((z) => (
                      <div key={z.radius} className="flex gap-2 items-start">
                        <div className="w-2.5 h-2.5 rounded-full flex-none mt-0.5" style={{ background: z.color }} />
                        <div>
                          <p className="text-xs font-medium" style={{ color: z.color }}>{z.label}</p>
                          <p className="text-xs text-muted-foreground">{z.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Subway Shelters */}
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Nearest Subway Shelters</p>
                    {SUBWAY_SHELTERS
                      .map((s) => ({ ...s, dist: haversineDistance(result.location, s) }))
                      .sort((a, b) => a.dist - b.dist)
                      .slice(0, 3)
                      .map((s) => (
                        <div key={s.name} className="flex justify-between items-center py-1 border-b border-border/50 last:border-0">
                          <p className="text-xs text-foreground">⬇ {s.name}</p>
                          <p className="text-xs text-muted-foreground">{(s.dist / 1000).toFixed(1)}km</p>
                        </div>
                      ))
                    }
                  </div>
                </>
              ) : (
                <>
                  {/* Escape Stats */}
                  <div className="rounded-lg border border-border bg-cyan-950/30 border-cyan-900 p-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Escape Summary</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Distance</p>
                        <p className="font-bold text-cyan-400">{result.escape.distance}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Est. Drive Time</p>
                        <p className="font-bold text-cyan-400">{result.escape.duration}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Drive toward <strong className="text-cyan-400">{windDegToDir((result.weather.windDeg + 180) % 360)}</strong> — away from fallout drift
                    </p>
                  </div>

                  {/* Turn-by-turn */}
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Escape Directions</p>
                    <div className="space-y-2">
                      {result.escape.steps.map((step, i) => (
                        <div key={i} className="flex gap-2">
                          <div className="w-5 h-5 rounded-full bg-cyan-900 border border-cyan-700 flex-none flex items-center justify-center">
                            <span className="text-[10px] font-bold text-cyan-400">{i + 1}</span>
                          </div>
                          <p className="text-xs text-foreground leading-relaxed">{step}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Emergency tips */}
                  <div className="rounded-lg border border-yellow-900/60 bg-yellow-950/20 p-3">
                    <p className="text-xs font-medium text-yellow-400 uppercase tracking-wide mb-2">⚠ Emergency Tips</p>
                    <ul className="space-y-1">
                      {[
                        "Grab go-bag before leaving (water, documents, meds)",
                        "Keep windows closed while driving",
                        "Do NOT use subway — it may be compromised",
                        "Listen to emergency broadcasts on AM radio",
                        "Avoid breathing outdoor air if possible",
                      ].map((tip, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                          <span className="text-yellow-600 flex-none">•</span>
                          {tip}
                        </li>
                      ))}
                    </ul>
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
