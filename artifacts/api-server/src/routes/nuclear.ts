import { Router, type IRouter } from "express";

const router: IRouter = Router();

const GOOGLE_MAPS_KEY = process.env.GOOGLE_MAPS_KEY;
const OPENWEATHER_KEY = process.env.OPENWEATHER_API_KEY;

router.get("/weather", async (req, res) => {
  const { lat, lon } = req.query as { lat: string; lon: string };

  if (!lat || !lon) {
    res.status(400).json({ error: "lat and lon are required" });
    return;
  }

  if (!OPENWEATHER_KEY) {
    res.status(500).json({ error: "OpenWeather API key not configured" });
    return;
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_KEY}&units=metric`;
    const response = await fetch(url);

    if (!response.ok) {
      const text = await response.text();
      req.log.error({ status: response.status, body: text }, "OpenWeather error");
      res.status(500).json({ error: "Failed to fetch weather data" });
      return;
    }

    const data = (await response.json()) as {
      wind?: { speed?: number; deg?: number; gust?: number };
      weather?: Array<{ description?: string }>;
      main?: { temp?: number; humidity?: number };
    };

    res.json({
      windSpeed: data.wind?.speed ?? 0,
      windDeg: data.wind?.deg ?? 0,
      windGust: data.wind?.gust ?? null,
      description: data.weather?.[0]?.description ?? "unknown",
      temp: data.main?.temp ?? 0,
      humidity: data.main?.humidity ?? 0,
    });
  } catch (err) {
    req.log.error({ err }, "Weather fetch failed");
    res.status(500).json({ error: "Failed to fetch weather data" });
  }
});

router.get("/geocode", async (req, res) => {
  const { address } = req.query as { address: string };

  if (!address) {
    res.status(400).json({ error: "address is required" });
    return;
  }

  if (!GOOGLE_MAPS_KEY) {
    res.status(500).json({ error: "Google Maps API key not configured" });
    return;
  }

  try {
    const encoded = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${GOOGLE_MAPS_KEY}`;
    const response = await fetch(url);
    const data = (await response.json()) as {
      status: string;
      results?: Array<{
        geometry?: { location?: { lat?: number; lng?: number } };
        formatted_address?: string;
      }>;
    };

    if (data.status === "ZERO_RESULTS" || !data.results || data.results.length === 0) {
      res.status(404).json({ error: "Address not found" });
      return;
    }

    if (data.status !== "OK") {
      req.log.error({ status: data.status }, "Geocode API error");
      res.status(500).json({ error: "Geocoding failed" });
      return;
    }

    const result = data.results[0];
    const location = result.geometry?.location;

    res.json({
      lat: location?.lat ?? 0,
      lng: location?.lng ?? 0,
      formattedAddress: result.formatted_address ?? address,
    });
  } catch (err) {
    req.log.error({ err }, "Geocode fetch failed");
    res.status(500).json({ error: "Failed to geocode address" });
  }
});

router.get("/escape-route", async (req, res) => {
  const { originLat, originLon, destLat, destLon } = req.query as {
    originLat: string;
    originLon: string;
    destLat: string;
    destLon: string;
  };

  if (!originLat || !originLon || !destLat || !destLon) {
    res.status(400).json({ error: "originLat, originLon, destLat, destLon are required" });
    return;
  }

  if (!GOOGLE_MAPS_KEY) {
    res.status(500).json({ error: "Google Maps API key not configured" });
    return;
  }

  try {
    const origin = `${originLat},${originLon}`;
    const dest = `${destLat},${destLon}`;
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${dest}&mode=driving&key=${GOOGLE_MAPS_KEY}`;

    const response = await fetch(url);
    const data = (await response.json()) as {
      status: string;
      routes?: Array<{
        overview_polyline?: { points?: string };
        legs?: Array<{
          distance?: { text?: string; value?: number };
          duration?: { text?: string; value?: number };
          steps?: Array<{
            html_instructions?: string;
            distance?: { text?: string };
            duration?: { text?: string };
          }>;
        }>;
      }>;
    };

    if (data.status !== "OK" || !data.routes || data.routes.length === 0) {
      req.log.error({ status: data.status }, "Directions API error");
      res.status(500).json({ error: "Failed to get escape route" });
      return;
    }

    const route = data.routes[0];
    const leg = route.legs?.[0];

    const steps = (leg?.steps ?? []).map((step) => ({
      instruction: (step.html_instructions ?? "").replace(/<[^>]+>/g, ""),
      distanceText: step.distance?.text ?? "",
      durationText: step.duration?.text ?? "",
    }));

    res.json({
      encodedPolyline: route.overview_polyline?.points ?? "",
      distanceText: leg?.distance?.text ?? "",
      durationText: leg?.duration?.text ?? "",
      distanceMeters: leg?.distance?.value ?? 0,
      durationSeconds: leg?.duration?.value ?? 0,
      steps,
    });
  } catch (err) {
    req.log.error({ err }, "Escape route fetch failed");
    res.status(500).json({ error: "Failed to get escape route" });
  }
});

export default router;
