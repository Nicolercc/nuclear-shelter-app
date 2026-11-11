// Pure geometry and blast-zone helpers for the escape router.
// Kept free of React and Leaflet so they can be unit tested.

export interface LatLng { lat: number; lng: number }

export type YieldOption = "dirty" | "10kt" | "100kt" | "1mt";

export interface BlastZone { radius: number; label: string; color: string; fillOpacity: number; desc: string }

// Blast radii in meters per yield type
export const YIELD_CONFIGS: Record<YieldOption, { label: string; zones: BlastZone[] }> = {
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

export const OUTSIDE_BLAST_ZONE = "Outside Blast Zone";

/** Label of the innermost zone containing a point `distanceM` meters from ground zero. */
export function classifyZone(distanceM: number, zones: Pick<BlastZone, "radius" | "label">[]): string {
  const inside = [...zones].sort((a, b) => a.radius - b.radius).find((z) => distanceM < z.radius);
  return inside ? inside.label : OUTSIDE_BLAST_ZONE;
}

const WALK_METERS_PER_MINUTE = 80;

/** Walking time in whole minutes (at least 1) at an average 80 m/min pace. */
export function walkMinutesFor(distanceM: number): number {
  return Math.max(1, Math.round(distanceM / WALK_METERS_PER_MINUTE));
}

/** Items annotated with their distance from `origin` in meters, nearest first. */
export function sortByDistance<T extends LatLng>(origin: LatLng, items: readonly T[]): (T & { dist: number })[] {
  return items
    .map((item) => ({ ...item, dist: haversineDistance(origin, item) }))
    .sort((a, b) => a.dist - b.dist);
}

export function decodePolyline(encoded: string): [number, number][] {
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

export function haversineDistance(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function offsetLatLng(origin: LatLng, distanceM: number, bearingDeg: number): LatLng {
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

export const NYC_SAFE_ZONES: Array<{ name: string; lat: number; lng: number }> = [
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

export function findSafeEscapeDest(
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

export function windDegToDir(deg: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}
