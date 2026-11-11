import { describe, expect, it } from "vitest";
import {
  NYC_SAFE_ZONES,
  OUTSIDE_BLAST_ZONE,
  YIELD_CONFIGS,
  classifyZone,
  decodePolyline,
  findSafeEscapeDest,
  haversineDistance,
  offsetLatLng,
  sortByDistance,
  walkMinutesFor,
  windDegToDir,
  type YieldOption,
} from "./geo";

const TIMES_SQUARE = { lat: 40.758, lng: -73.9855 };
const CITY_HALL = { lat: 40.7128, lng: -74.006 };

describe("haversineDistance", () => {
  it("is zero for the same point", () => {
    expect(haversineDistance(TIMES_SQUARE, TIMES_SQUARE)).toBe(0);
  });

  it("is symmetric", () => {
    expect(haversineDistance(TIMES_SQUARE, CITY_HALL)).toBeCloseTo(haversineDistance(CITY_HALL, TIMES_SQUARE), 6);
  });

  it("matches a known distance: Times Square to City Hall is about 5.3 km", () => {
    const d = haversineDistance(TIMES_SQUARE, CITY_HALL);
    expect(d).toBeGreaterThan(5_200);
    expect(d).toBeLessThan(5_400);
  });

  it("puts one degree of latitude at about 111 km", () => {
    expect(haversineDistance({ lat: 40, lng: -74 }, { lat: 41, lng: -74 })).toBeCloseTo(111_195, -2);
  });
});

describe("offsetLatLng", () => {
  it.each([0, 90, 180, 270, 37])("moves the requested distance at bearing %i°", (bearing) => {
    const moved = offsetLatLng(CITY_HALL, 10_000, bearing);
    expect(haversineDistance(CITY_HALL, moved)).toBeCloseTo(10_000, 0);
  });

  it("moves north at bearing 0 and east at bearing 90", () => {
    const north = offsetLatLng(CITY_HALL, 1_000, 0);
    const east = offsetLatLng(CITY_HALL, 1_000, 90);
    expect(north.lat).toBeGreaterThan(CITY_HALL.lat);
    expect(north.lng).toBeCloseTo(CITY_HALL.lng, 6);
    expect(east.lng).toBeGreaterThan(CITY_HALL.lng);
  });
});

describe("YIELD_CONFIGS", () => {
  const yields = Object.keys(YIELD_CONFIGS) as YieldOption[];

  it.each(yields)("%s zones are ordered innermost to outermost", (y) => {
    const radii = YIELD_CONFIGS[y].zones.map((z) => z.radius);
    expect(radii).toEqual([...radii].sort((a, b) => a - b));
    expect(new Set(radii).size).toBe(radii.length);
  });

  it("bigger weapons reach further", () => {
    const outer = (y: YieldOption) => Math.max(...YIELD_CONFIGS[y].zones.map((z) => z.radius));
    expect(outer("dirty")).toBeLessThan(outer("10kt"));
    expect(outer("10kt")).toBeLessThan(outer("100kt"));
    expect(outer("100kt")).toBeLessThan(outer("1mt"));
  });
});

describe("classifyZone", () => {
  const zones = YIELD_CONFIGS["10kt"].zones; // 500 m, 2 km, 6 km

  it("returns the innermost zone that contains the point", () => {
    expect(classifyZone(0, zones)).toBe("Fireball Zone");
    expect(classifyZone(499, zones)).toBe("Fireball Zone");
    expect(classifyZone(1_000, zones)).toBe("Heavy Blast Zone");
    expect(classifyZone(5_999, zones)).toBe("Light Blast Zone");
  });

  it("treats the radius itself as the edge of the next zone out", () => {
    expect(classifyZone(500, zones)).toBe("Heavy Blast Zone");
    expect(classifyZone(6_000, zones)).toBe(OUTSIDE_BLAST_ZONE);
  });

  it("does not depend on the order the zones are listed in", () => {
    expect(classifyZone(1_000, [...zones].reverse())).toBe("Heavy Blast Zone");
  });

  it("handles any number of zones", () => {
    expect(classifyZone(50, [{ radius: 100, label: "Only" }])).toBe("Only");
    expect(classifyZone(50, [])).toBe(OUTSIDE_BLAST_ZONE);
  });
});

describe("sortByDistance and walkMinutesFor", () => {
  const shelters = [
    { name: "far", lat: 40.8, lng: -73.95 },
    { name: "near", lat: 40.7135, lng: -74.0065 },
    { name: "mid", lat: 40.73, lng: -74.0 },
  ];

  it("orders shelters nearest first and attaches the distance", () => {
    const sorted = sortByDistance(CITY_HALL, shelters);
    expect(sorted.map((s) => s.name)).toEqual(["near", "mid", "far"]);
    expect(sorted[0].dist).toBeCloseTo(haversineDistance(CITY_HALL, shelters[1]), 6);
  });

  it("does not mutate the input list", () => {
    const before = shelters.map((s) => s.name);
    sortByDistance(CITY_HALL, shelters);
    expect(shelters.map((s) => s.name)).toEqual(before);
  });

  it("walks at 80 m per minute, never less than 1 minute", () => {
    expect(walkMinutesFor(0)).toBe(1);
    expect(walkMinutesFor(800)).toBe(10);
    expect(walkMinutesFor(1_000)).toBe(13);
  });
});

describe("findSafeEscapeDest", () => {
  it("always picks a listed safe zone at least 15 km from the user", () => {
    for (const windDeg of [0, 90, 180, 270]) {
      const dest = findSafeEscapeDest(CITY_HALL, TIMES_SQUARE, 6_000, windDeg);
      expect(NYC_SAFE_ZONES.map((z) => z.name)).toContain(dest.name);
      expect(haversineDistance(CITY_HALL, dest)).toBeGreaterThanOrEqual(15_000);
    }
  });

  it("heads away from the blast: a blast to the east sends you west", () => {
    const blastEast = offsetLatLng(CITY_HALL, 3_000, 90);
    const dest = findSafeEscapeDest(CITY_HALL, blastEast, 6_000, 0);
    expect(dest.lng).toBeLessThan(CITY_HALL.lng);
  });

  it("heads away from the blast: a blast to the south sends you north", () => {
    const blastSouth = offsetLatLng(CITY_HALL, 3_000, 180);
    const dest = findSafeEscapeDest(CITY_HALL, blastSouth, 6_000, 0);
    expect(dest.lat).toBeGreaterThan(CITY_HALL.lat);
  });
});

describe("decodePolyline", () => {
  it("decodes Google's reference example", () => {
    expect(decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@")).toEqual([
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
    ]);
  });

  it("returns no points for an empty string", () => {
    expect(decodePolyline("")).toEqual([]);
  });
});

describe("windDegToDir", () => {
  it.each([
    [0, "N"],
    [90, "E"],
    [180, "S"],
    [270, "W"],
    [359, "N"],
    [22.5, "NNE"],
    [225, "SW"],
  ])("%s° is %s", (deg, dir) => {
    expect(windDegToDir(deg)).toBe(dir);
  });
});
