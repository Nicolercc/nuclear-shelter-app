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
  blastCenter: LatLng;
  userLocation: LatLng;
  address: string;
  weather: WeatherData;
  escape: EscapeInfo;
  decision: "shelter" | "evacuate";
  distanceFromBlast: number;
  yield: YieldOption;
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

const SUBWAY_SHELTERS = [
  { name: "Times Square 42 St", lat: 40.758, lng: -73.9855 },
  { name: "Grand Central", lat: 40.7527, lng: -73.9772 },
  { name: "Penn Station", lat: 40.7505, lng: -73.9934 },
  { name: "Union Square", lat: 40.7352, lng: -73.9896 },
  { name: "Jay St MetroTech", lat: 40.6923, lng: -73.9872 },
  { name: "Fulton St", lat: 40.7095, lng: -74.0074 },
  { name: "Atlantic Av", lat: 40.6841, lng: -73.9776 },
  { name: "Jackson Heights", lat: 40.7463, lng: -73.8914 },
  { name: "Flushing Main St", lat: 40.7596, lng: -73.83 },
  { name: "161 St Yankee Stadium", lat: 40.8278, lng: -73.9258 },
  { name: "86 St Upper East", lat: 40.7766, lng: -73.9518 },
  { name: "Court Sq–23 St", lat: 40.7468, lng: -73.9456 },
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

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function NuclearEscapeRouter() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.Layer[]>([]);
  const clickHandlerRef = useRef<((e: L.LeafletMouseEvent) => void) | null>(null);

  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ResultData | null>(null);
  const [activeTab, setActiveTab] = useState<"info" | "route">("info");
  const [clickMode, setClickMode] = useState(false);
  const [selectedYield, setSelectedYield] = useState<YieldOption>("10kt");
  const [blastCenter, setBlastCenter] = useState<LatLng | null>(null);

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

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // ── Clear layers ────────────────────────────────────────────────────────────
  const clearLayers = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    layersRef.current.forEach((l) => map.removeLayer(l));
    layersRef.current = [];
  }, []);

  // ── Core analysis function (shared by search, geo, click) ───────────────────
  const analyze = useCallback((userCoords: LatLng, blastCoords: LatLng, label: string, yieldType: YieldOption) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    clearLayers();

    const weather = getDummyWeather();
    const zones = YIELD_CONFIGS[yieldType].zones;
    const maxRadius = zones[zones.length - 1].radius;
    const distFromBlast = haversineDistance(userCoords, blastCoords);

    // Determine decision based on distance from blast
    const fireballRadius = zones[0].radius;
    const decision: "shelter" | "evacuate" = distFromBlast < fireballRadius ? "shelter" : "evacuate";

    const escapeDest = offsetLatLng(userCoords, Math.max(maxRadius + 5000, 15000), (weather.windDeg + 180) % 360);
    const escape = getDummyEscape(userCoords, escapeDest);

    const data: ResultData = {
      blastCenter: blastCoords,
      userLocation: userCoords,
      address: label,
      weather,
      escape,
      decision,
      distanceFromBlast: distFromBlast,
      yield: yieldType,
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

    // ── Subway shelters ──
    SUBWAY_SHELTERS.forEach((s) => {
      const shelterIcon = L.divIcon({
        html: `<div style="background:#0f3460;border:2px solid #38bdf8;border-radius:4px;padding:2px 5px;font-size:10px;font-weight:700;color:#38bdf8;white-space:nowrap;">⬇ ${s.name.split(" ").slice(0, 2).join(" ")}</div>`,
        iconSize: [92, 22],
        iconAnchor: [46, 11],
        className: "",
      });
      const m = L.marker([s.lat, s.lng], { icon: shelterIcon }).addTo(map)
        .bindPopup(`<b>🛡 ${s.name}</b><br/>Fallout Shelter`);
      layersRef.current.push(m);
    });

    // ── Escape route ──
    const mid1 = offsetLatLng(userCoords, Math.max(maxRadius * 0.8, 4000), (weather.windDeg + 155) % 360);
    const mid2 = offsetLatLng(userCoords, Math.max(maxRadius * 1.4, 9000), (weather.windDeg + 170) % 360);
    const routeLine = L.polyline(
      [[userCoords.lat, userCoords.lng], [mid1.lat, mid1.lng], [mid2.lat, mid2.lng], [escapeDest.lat, escapeDest.lng]],
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
        .bindPopup("<b>Safe Zone</b><br/>Outside blast radius")
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
      { padding: [50, 50] }
    );

    setResult(data);
    setLoading(false);
    setGeoLoading(false);
  }, [clearLayers]);

  // ── Handle address search ───────────────────────────────────────────────────
  const handleSearch = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!address.trim()) return;

    setLoading(true);
    setError("");
    await new Promise((r) => setTimeout(r, 700));

    const coords = geocodeAddress(address);
    if (!coords) {
      setError("Address not found. Try: 'Times Square', 'Brooklyn Bridge', '10001', or a NYC neighborhood name.");
      setLoading(false);
      return;
    }

    // Default blast center = midtown (Times Square) if none placed
    const blast = blastCenter ?? { lat: 40.758, lng: -73.9855 };
    analyze(coords, blast, address, selectedYield);
  }, [address, blastCenter, selectedYield, analyze]);

  // ── Geolocation ─────────────────────────────────────────────────────────────
  const handleGeolocate = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    setGeoLoading(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const blast = blastCenter ?? { lat: 40.758, lng: -73.9855 };
        setAddress("My Location");
        analyze(userCoords, blast, "My Location (GPS)", selectedYield);
      },
      (err) => {
        setGeoLoading(false);
        setError("Could not get your location. Please allow location access or enter an address manually. Error: " + err.message);
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
          analyze(result.userLocation, clicked, result.address, selectedYield);
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
      <header className="flex-none border-b border-border bg-card px-4 py-2.5 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-none">
          <div className="w-8 h-8 rounded-full bg-red-600/20 border border-red-600 flex items-center justify-center" style={{ animation: "pulse 2s infinite" }}>
            <span className="text-sm">☢</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground leading-none">Nuclear Escape Router</h1>
            <p className="text-[10px] text-muted-foreground">NYC Emergency Preparedness</p>
          </div>
        </div>

        {/* Yield selector */}
        <div className="flex items-center gap-1.5 flex-none">
          <span className="text-xs text-muted-foreground hidden sm:block">Yield:</span>
          <div className="flex gap-1">
            {(Object.keys(YIELD_CONFIGS) as YieldOption[]).map((y) => (
              <button
                key={y}
                onClick={() => setSelectedYield(y)}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                  selectedYield === y
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {YIELD_CONFIGS[y].label}
              </button>
            ))}
          </div>
        </div>

        {/* Search + actions */}
        <form onSubmit={handleSearch} className="flex-1 flex gap-2 min-w-0">
          <div className="flex-1 flex gap-2 min-w-0">
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Your location: Times Square, 10001, Brooklyn..."
              className="flex-1 min-w-0 bg-muted border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              disabled={loading || geoLoading || !address.trim()}
              className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              {loading ? "..." : "Analyze"}
            </button>
          </div>
        </form>

        {/* GPS + Place blast buttons */}
        <div className="flex gap-2 flex-none">
          <button
            onClick={handleGeolocate}
            disabled={geoLoading || loading}
            title="Use my current GPS location"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-900 hover:bg-blue-800 text-blue-200 border border-blue-700 rounded-md text-xs font-medium disabled:opacity-50 transition-colors"
          >
            {geoLoading ? "📡 Locating..." : "📍 GPS"}
          </button>
          <button
            onClick={() => setClickMode((v) => !v)}
            title="Click on the map to place the blast center"
            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-md text-xs font-medium transition-colors ${
              clickMode
                ? "bg-red-700 text-white border-red-500 ring-2 ring-red-500/50"
                : "bg-red-950 hover:bg-red-900 text-red-300 border-red-800"
            }`}
          >
            ☢ {clickMode ? "Click map..." : "Place Blast"}
          </button>
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
            <div className="absolute bottom-10 left-4 z-[500] bg-card/95 border border-border rounded-xl p-4 max-w-xs shadow-xl">
              <p className="text-xs font-semibold text-foreground mb-2">How to use:</p>
              <ol className="text-xs text-muted-foreground space-y-1 list-none">
                <li><span className="text-red-400 font-bold">1.</span> Click <span className="text-red-400 font-medium">☢ Place Blast</span> to mark where the bomb drops</li>
                <li><span className="text-blue-400 font-bold">2.</span> Enter your address <span className="text-blue-400 font-medium">or click 📍 GPS</span></li>
                <li><span className="text-cyan-400 font-bold">3.</span> Hit <span className="text-primary font-medium">Analyze</span> to see your escape route</li>
              </ol>
              <div className="mt-2 pt-2 border-t border-border text-xs text-muted-foreground">
                Try: <span className="text-foreground">Times Square, Wall Street, 10001</span>
              </div>
            </div>
          )}

          {/* Loading overlay */}
          {(loading || geoLoading) && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-[500]">
              <div className="bg-card border border-border rounded-xl p-5 text-center shadow-xl">
                <div className="text-3xl mb-2" style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>☢</div>
                <p className="font-semibold text-sm">{geoLoading ? "Getting your location..." : "Calculating threat zones..."}</p>
                <p className="text-xs text-muted-foreground mt-1">Analyzing blast radius & wind patterns</p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="absolute bottom-4 left-4 right-4 z-[500] bg-destructive/20 border border-destructive/60 rounded-lg p-3 text-xs text-red-300 flex justify-between items-start gap-2">
              <span>{error}</span>
              <button onClick={() => setError("")} className="text-red-400 hover:text-red-200 flex-none font-bold">✕</button>
            </div>
          )}

          {/* Blast center set indicator */}
          {blastCenter && !clickMode && !result && (
            <div className="absolute top-3 left-3 z-[500] bg-red-950/90 border border-red-800 rounded-lg px-3 py-1.5 text-xs text-red-300">
              ☢ Blast center set — now enter your location
            </div>
          )}

          {/* Map Legend */}
          <div className="absolute top-3 right-3 z-[500] bg-card/95 border border-border rounded-lg p-2.5 text-xs space-y-1 shadow-lg max-w-[160px]">
            <p className="font-semibold text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Legend</p>
            {YIELD_CONFIGS[selectedYield].zones.map((z) => (
              <div key={z.radius} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full flex-none" style={{ background: z.color }} />
                <span className="text-muted-foreground leading-none">{z.label}</span>
              </div>
            ))}
            <div className="pt-1 border-t border-border space-y-1">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-0.5 bg-purple-400 flex-none" />
                <span className="text-muted-foreground">Fallout drift</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-0.5 bg-cyan-400 flex-none" />
                <span className="text-muted-foreground">Escape route</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-600 flex-none" />
                <span className="text-muted-foreground">Your location</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2 rounded bg-blue-900 border border-sky-500 flex-none" />
                <span className="text-muted-foreground">Subway shelter</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right Panel ── */}
        {result && (
          <div className="w-72 flex-none border-l border-border bg-card flex flex-col overflow-hidden">
            {/* Decision */}
            {result.decision === "shelter" ? (
              <div className="bg-red-950 border-b border-red-900 p-3.5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">🔴</span>
                  <span className="text-base font-black text-red-300 tracking-wide">SHELTER IN PLACE</span>
                </div>
                <p className="text-xs text-red-400/90">You are in the fireball zone. Do not attempt to flee. Go underground immediately.</p>
              </div>
            ) : (
              <div className="bg-green-950 border-b border-green-900 p-3.5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">🟢</span>
                  <span className="text-base font-black text-green-300 tracking-wide">EVACUATE NOW</span>
                </div>
                <p className="text-xs text-green-400/90">Leave immediately via the escape route. Travel opposite to fallout drift.</p>
              </div>
            )}

            {/* Tabs */}
            <div className="flex border-b border-border">
              {(["info", "route"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2 text-xs font-medium capitalize transition-colors ${
                    activeTab === tab
                      ? "text-primary border-b-2 border-primary bg-primary/5"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab === "info" ? "Threat Info" : "Escape Route"}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {activeTab === "info" ? (
                <>
                  {/* Zone */}
                  {(() => {
                    const zone = getZoneInfo(result.distanceFromBlast, result.yield);
                    return (
                      <div className={`rounded-lg border p-3 ${zone.bg}`}>
                        <p className="text-[10px] text-muted-foreground mb-0.5 uppercase tracking-wide">Your Zone</p>
                        <p className={`font-bold text-sm ${zone.color}`}>{zone.label}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {result.distanceFromBlast < 1000
                            ? `${Math.round(result.distanceFromBlast)}m from blast center`
                            : `${(result.distanceFromBlast / 1000).toFixed(1)}km from blast center`}
                        </p>
                      </div>
                    );
                  })()}

                  {/* Wind */}
                  <div className="rounded-lg border border-border bg-muted/20 p-3">
                    <p className="text-[10px] font-medium text-muted-foreground mb-2 uppercase tracking-wide">Wind / Fallout Direction</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Speed</p>
                        <p className="font-semibold text-sm">{result.weather.windSpeed.toFixed(1)} m/s</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Direction</p>
                        <p className="font-semibold text-sm">{windDegToDir(result.weather.windDeg)} ({Math.round(result.weather.windDeg)}°)</p>
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
                    <div className="mt-2 pt-2 border-t border-border text-xs text-muted-foreground">
                      Fallout drifts <span className="text-purple-400 font-medium">{windDegToDir(result.weather.windDeg)}</span> — escape <span className="text-cyan-400 font-medium">{windDegToDir((result.weather.windDeg + 180) % 360)}</span>
                    </div>
                  </div>

                  {/* Blast zones */}
                  <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{YIELD_CONFIGS[result.yield].label} — Blast Zones</p>
                    {YIELD_CONFIGS[result.yield].zones.map((z) => (
                      <div key={z.radius} className="flex gap-2 items-start">
                        <div className="w-2 h-2 rounded-full flex-none mt-1" style={{ background: z.color }} />
                        <div>
                          <p className="text-xs font-medium" style={{ color: z.color }}>{z.label} ({z.radius >= 1000 ? `${z.radius / 1000}km` : `${z.radius}m`})</p>
                          <p className="text-[10px] text-muted-foreground">{z.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Nearest shelters */}
                  <div className="rounded-lg border border-border bg-muted/20 p-3">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Nearest Subway Shelters</p>
                    {SUBWAY_SHELTERS
                      .map((s) => ({ ...s, dist: haversineDistance(result.userLocation, s) }))
                      .sort((a, b) => a.dist - b.dist)
                      .slice(0, 4)
                      .map((s) => (
                        <div key={s.name} className="flex justify-between items-center py-1 border-b border-border/40 last:border-0">
                          <p className="text-xs text-foreground">⬇ {s.name}</p>
                          <p className="text-xs text-muted-foreground">{(s.dist / 1000).toFixed(1)}km</p>
                        </div>
                      ))}
                  </div>
                </>
              ) : (
                <>
                  {/* Escape summary */}
                  <div className="rounded-lg border border-cyan-900 bg-cyan-950/30 p-3">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Escape Summary</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Distance</p>
                        <p className="font-bold text-cyan-400">{result.escape.distance}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Est. Drive Time</p>
                        <p className="font-bold text-cyan-400">{result.escape.duration}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Head <span className="text-cyan-400 font-medium">{windDegToDir((result.weather.windDeg + 180) % 360)}</span> — opposite to fallout drift
                    </p>
                  </div>

                  {/* Turn-by-turn */}
                  <div className="rounded-lg border border-border bg-muted/20 p-3">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Step-by-Step Directions</p>
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

                  {/* Emergency tips */}
                  <div className="rounded-lg border border-yellow-900/50 bg-yellow-950/20 p-3">
                    <p className="text-[10px] font-medium text-yellow-500 uppercase tracking-wide mb-2">⚠ Emergency Tips</p>
                    <ul className="space-y-1.5">
                      {[
                        "Grab go-bag before leaving (water, docs, meds)",
                        "Keep all windows closed while driving",
                        "Avoid subway — may be compromised",
                        "Tune to AM radio for emergency broadcasts",
                        "Do not stop moving until outside the zone",
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
