import { Router, type IRouter } from "express";

const router: IRouter = Router();

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

router.post("/brief", async (req, res) => {
  if (!ANTHROPIC_KEY) {
    res.status(500).json({ error: "Anthropic API key not configured" });
    return;
  }

  const {
    blastLocation,
    userLocation,
    distanceKm,
    yieldLabel,
    zoneName,
    decision,
    weatherDesc,
    windDir,
    windSpeed,
    nearestShelterName,
    nearestShelterDistance,
    nearestShelterWalkMinutes,
    safeZoneName,
    escapeDuration,
  } = req.body as {
    blastLocation: string;
    userLocation: string;
    distanceKm: string;
    yieldLabel: string;
    zoneName: string;
    decision: string;
    weatherDesc: string;
    windDir: string;
    windSpeed: string;
    nearestShelterName: string;
    nearestShelterDistance: string;
    nearestShelterWalkMinutes: string;
    safeZoneName: string;
    escapeDuration: string;
  };

  const prompt = `You are an expert emergency management advisor. 
A ${yieldLabel} nuclear detonation has occurred at ${blastLocation}.
The user is located at ${userLocation}, approximately ${distanceKm}km from the blast center.
They are in the ${zoneName}.
Current conditions: ${weatherDesc}, wind ${windDir} at ${windSpeed} m/s.
Nearest shelter: ${nearestShelterName}, ${nearestShelterDistance} away (${nearestShelterWalkMinutes} min walk).
Safe evacuation zone: ${safeZoneName}, estimated drive time ${escapeDuration}.
Recommended action: ${decision === "shelter" ? "SHELTER IN PLACE" : "EVACUATE"}.

Write exactly 3 sentences as a calm, authoritative emergency advisor speaking directly to this person. 
Be specific to their exact situation — mention their zone, the shelter name, and their best action. 
Do not use bullet points. Do not add headers. Do not repeat the word "nuclear". 
Use plain English a frightened person can understand in seconds.
Start with their immediate situation, then their best action, then one key survival fact.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      req.log.error({ status: response.status, body: text }, "Anthropic API error");
      res.status(500).json({ error: "Failed to generate brief" });
      return;
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text: string }>;
    };

    const text = data.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    res.json({ brief: text });
  } catch (err) {
    req.log.error({ err }, "Brief generation failed");
    res.status(500).json({ error: "Failed to generate brief" });
  }
});

export default router;
