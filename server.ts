import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Set payload limits high for base64 scan images
app.use(express.json({ limit: "60mb" }));
app.use(express.urlencoded({ extended: true, limit: "60mb" }));

// Lazy init Gemini AI client
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is missing");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Recommended candidate models with fallback hierarchy (valid current Gemini models)
const CANDIDATE_MODELS = [
  "gemini-flash-latest",
  "gemini-3.8-flash",
  "gemini-3.1-flash-lite",
];

async function generateWithFallback(
  ai: GoogleGenAI,
  requestParams: { contents: any; config?: any },
  maxRetriesPerModel: number = 2
) {
  let lastError: any = null;

  for (const model of CANDIDATE_MODELS) {
    for (let attempt = 0; attempt < maxRetriesPerModel; attempt++) {
      try {
        console.log(`Calling Gemini API using model: ${model} (attempt ${attempt + 1})...`);
        const response = await ai.models.generateContent({
          model,
          contents: requestParams.contents,
          config: requestParams.config,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        const errString = err.message || JSON.stringify(err);
        console.warn(`Model ${model} (attempt ${attempt + 1}) encountered error:`, errString);

        const isQuotaOrRateLimit =
          errString.includes("429") ||
          errString.includes("quota") ||
          errString.includes("RESOURCE_EXHAUSTED") ||
          errString.includes("Quota exceeded");

        if (isQuotaOrRateLimit) {
          // Immediately try next model in candidate list
          console.warn(`Model ${model} hit quota/rate limit. Switching to next candidate model...`);
          break;
        }

        const isUnavailable =
          errString.includes("503") ||
          errString.includes("UNAVAILABLE") ||
          errString.includes("high demand");

        if (isUnavailable && attempt < maxRetriesPerModel - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    }
  }

  throw lastError || new Error("All candidate models failed to generate content.");
}

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

// Endpoint: AI Card Auto-Detection & Edge Finding (Bounding Boxes & Orientation for un-templated or loose scans)
app.post("/api/detect-cards", async (req, res) => {
  try {
    const { imageBase64, mimeType = "image/jpeg" } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: "Missing imageBase64 in request body" });
    }

    let actualMime = mimeType;
    if (typeof imageBase64 === "string" && imageBase64.startsWith("data:")) {
      const mimeMatch = imageBase64.match(/^data:([^;]+);base64,/);
      if (mimeMatch) actualMime = mimeMatch[1];
    }
    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, "");

    const ai = getGeminiClient();

    const prompt = `You are a high-precision computer vision edge-detector for sports trading cards, TCG cards, and graded slabs placed on flatbed scanners.
Analyze this scanner bed image carefully.
Detect all individual trading cards or graded slab rectangles in the image.

For each card/slab found:
1. "box_2d": [ymin, xmin, ymax, xmax] with coordinates normalized between 0 and 1000.
   CRITICAL: Include the FULL outer perimeter of the card including all 4 borders and corners with 1-2% safety margin around the card edge so no corner or edge is clipped.
2. "orientation": Estimated clockwise rotation needed in degrees (0, 90, 180, or 270) to orient the card right-side up for upright reading. If the card was placed horizontally/landscape on the bed, indicate the rotation (e.g. 90 or 270) to make it upright.
3. "isLandscape": true if the card's visual artwork/layout is landscape/horizontal, false if portrait/vertical.
4. "isSlab": true if it is a graded plastic slab (PSA, BGS, CGC, SGC), false if it is a raw card / top loader.
5. "detectedBrand": PSA, BGS, CGC, SGC, TopLoader, or Raw.
6. "label": Player name, card title, or descriptive label if visible (e.g. "Geovany Soto", "Tyler Colvin", "Raw Card 1").

Sort all detected cards in standard reading order: top-to-bottom, then left-to-right.`;

    const response = await generateWithFallback(ai, {
      contents: {
        parts: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: actualMime,
            },
          },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detectedCards: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  box_2d: {
                    type: Type.ARRAY,
                    items: { type: Type.INTEGER },
                    description: "[ymin, xmin, ymax, xmax] in 0-1000 scale",
                  },
                  label: { type: Type.STRING },
                  isSlab: { type: Type.BOOLEAN },
                  detectedBrand: { type: Type.STRING, description: "PSA, BGS, CGC, SGC, TopLoader, or Raw" },
                  orientation: { type: Type.INTEGER, description: "0, 90, 180, 270 clockwise rotation needed to make upright" },
                  isLandscape: { type: Type.BOOLEAN },
                  confidence: { type: Type.NUMBER },
                },
                required: ["box_2d", "isSlab"],
              },
            },
          },
          required: ["detectedCards"],
        },
      },
    });

    const text = response?.text || "{}";
    const parsed = JSON.parse(text);
    return res.json(parsed);
  } catch (error: any) {
    console.error("Card detection error:", error);
    // Graceful fallback if AI is unavailable or rate-limited: provide default 8-card grid coordinates
    return res.json({
      fallback: true,
      detectedCards: [
        { box_2d: [30, 50, 250, 480], label: "Card 1", isSlab: false, detectedBrand: "Raw", orientation: 0 },
        { box_2d: [30, 520, 250, 950], label: "Card 2", isSlab: false, detectedBrand: "Raw", orientation: 0 },
        { box_2d: [270, 50, 490, 480], label: "Card 3", isSlab: false, detectedBrand: "Raw", orientation: 0 },
        { box_2d: [270, 520, 490, 950], label: "Card 4", isSlab: false, detectedBrand: "Raw", orientation: 0 },
        { box_2d: [510, 50, 730, 480], label: "Card 5", isSlab: false, detectedBrand: "Raw", orientation: 0 },
        { box_2d: [510, 520, 730, 950], label: "Card 6", isSlab: false, detectedBrand: "Raw", orientation: 0 },
        { box_2d: [750, 50, 970, 480], label: "Card 7", isSlab: false, detectedBrand: "Raw", orientation: 0 },
        { box_2d: [750, 520, 970, 950], label: "Card 8", isSlab: false, detectedBrand: "Raw", orientation: 0 },
      ],
      warning: "AI auto-detection hit a rate limit or service delay. Fallback card slots generated.",
    });
  }
});

// Shared OCR extraction instructions and response schema for single-card and batch endpoints
const CARD_EXTRACTION_INSTRUCTIONS = `
Accuracy rules:
- Only report what is visible. If a field cannot be read with confidence, return an empty string (or omit it). Never invent cert numbers, grades, years or sets.
- If a "decoded barcode cert" is given for a card, it was read directly from the slab barcode and is authoritative: use it as certNumber.

For each card extract:
1. Card Identity:
   - name: Player name, character name, or primary card title (e.g. "Michael Jordan", "Charizard", "Ken Griffey Jr.").
   - year: Release or copyright year (e.g. "1986", "2023").
   - set: Card set / product line (e.g. "Fleer", "Topps Chrome", "Panini Prizm", "Base Set 1st Edition").
   - cardNumber: Card number with '#' prefix (e.g. "#57", "#4/102", "#US175").
   - category: One of "Basketball", "Baseball", "Football", "Hockey", "Soccer", "Pokemon", "Magic: The Gathering", "Yu-Gi-Oh!", "Non-Sport / Marvel", "Other".
   - variation: Parallel, insert, or variant details (e.g. "Rookie Card (RC)", "Refractor", "Silver Prizm", "Autograph", "Patch /99"). Empty if base.
2. Grading Information:
   - isGraded: true if encapsulated in a grading slab (PSA, BGS, CGC, SGC, TAG), false if raw card.
   - gradingCompany: "PSA", "BGS", "CGC", "SGC", "TAG", or "Raw".
   - grade: Grade exactly as printed on the label (e.g. "10", "9.5", "Authentic"). Empty if raw.
   - certNumber: Certification / serial number printed on the slab label. Empty if raw.
   - subgrades: Centering, Corners, Edges, Surface, Autograph if printed on the label (BGS/CGC).
3. Condition & Value:
   - estimatedCondition: For raw cards, assess visible corners/centering/surface (e.g. "Near Mint-Mint (NM-MT 8-9)"). Empty for slabs.
   - estimatedValue: Conservative USD market estimate as a number, or omit if unsure.
   - tags: Useful tags (e.g. ["RC", "HOF", "Vintage", "Holo", "PSA 10"]).
   - frontOcrText: Key text printed on the front and slab label (up to 60 words).
   - backOcrText: Key text printed on the back: stats line, serial numbering, copyright (up to 60 words).
   - notes: Anything notable for a collector, brief.
4. Orientation:
   - frontRotation: Clockwise degrees (0, 90, 180 or 270) the FRONT image must be rotated so its text reads upright.
   - backRotation: Same for the BACK image (0 if no back image).`;

const CARD_RESPONSE_PROPERTIES = {
  name: { type: Type.STRING },
  year: { type: Type.STRING },
  set: { type: Type.STRING },
  cardNumber: { type: Type.STRING },
  category: { type: Type.STRING },
  variation: { type: Type.STRING },
  isGraded: { type: Type.BOOLEAN },
  gradingCompany: { type: Type.STRING },
  grade: { type: Type.STRING },
  certNumber: { type: Type.STRING },
  subgrades: {
    type: Type.OBJECT,
    properties: {
      centering: { type: Type.STRING },
      corners: { type: Type.STRING },
      edges: { type: Type.STRING },
      surface: { type: Type.STRING },
      auto: { type: Type.STRING },
    },
  },
  estimatedCondition: { type: Type.STRING },
  estimatedValue: { type: Type.NUMBER },
  tags: { type: Type.ARRAY, items: { type: Type.STRING } },
  frontOcrText: { type: Type.STRING },
  backOcrText: { type: Type.STRING },
  notes: { type: Type.STRING },
  frontRotation: { type: Type.INTEGER },
  backRotation: { type: Type.INTEGER },
};

const stripDataUrl = (b64: string) => b64.replace(/^data:image\/[a-z]+;base64,/, "");

function cardHintLine(c: { barcodeCert?: string; barcodeCompany?: string }): string {
  if (!c.barcodeCert) return "";
  return `Decoded barcode cert: ${c.barcodeCert}${c.barcodeCompany ? ` (${c.barcodeCompany})` : ""}.\n`;
}

// Endpoint: AI OCR & Structured Cataloging for one cropped card (Front + optional Back)
app.post("/api/ocr-card", async (req, res) => {
  try {
    const { frontImageBase64, backImageBase64, templateHint, isSlabHint, barcodeCert, barcodeCompany } = req.body;
    if (!frontImageBase64) {
      return res.status(400).json({ error: "frontImageBase64 is required" });
    }

    const ai = getGeminiClient();
    const parts: any[] = [{ inlineData: { data: stripDataUrl(frontImageBase64), mimeType: "image/jpeg" } }];
    if (backImageBase64) {
      parts.push({ inlineData: { data: stripDataUrl(backImageBase64), mimeType: "image/jpeg" } });
    }

    const prompt =
      `You are an expert sports card and trading card game (TCG) authenticator, grader, and cataloger.\n` +
      `The first image is the FRONT of one trading card. If a second image is provided, it is the BACK of the same card.\n` +
      `Template context hint: ${templateHint || "Standard Scan"}. Is slab hint: ${isSlabHint ? "Yes" : "Unknown"}.\n` +
      cardHintLine({ barcodeCert, barcodeCompany }) +
      CARD_EXTRACTION_INSTRUCTIONS;
    parts.push({ text: prompt });

    const response = await generateWithFallback(ai, {
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: CARD_RESPONSE_PROPERTIES,
          required: ["name", "category", "isGraded", "gradingCompany"],
        },
      },
    });

    return res.json(JSON.parse(response?.text || "{}"));
  } catch (error: any) {
    console.error("Card OCR extraction error:", error);
    return res.status(502).json({ error: error.message || "Failed to process card OCR" });
  }
});

// Endpoint: Batch OCR. The client sends small chunks; on failure it returns an error (never placeholder records)
app.post("/api/ocr-batch", async (req, res) => {
  const { cards, templateHint, isSlabHint } = req.body;
  if (!cards || !Array.isArray(cards) || cards.length === 0) {
    return res.status(400).json({ error: "cards array is required" });
  }

  let text = "";
  try {
    const ai = getGeminiClient();
    const parts: any[] = [];

    let prompt = `You are an expert sports card and trading card game (TCG) authenticator, grader, and cataloger.\n`;
    prompt += `The images below show ${cards.length} trading card(s), in order. For each card there is a FRONT image, then optionally its BACK image.\n`;
    prompt += `Template context hint: ${templateHint || "Standard Scan"}. Is slab hint: ${isSlabHint ? "Yes" : "Unknown"}.\n`;

    cards.forEach((c: any, index: number) => {
      prompt += `\nCard ${index + 1} (ID: ${c.id}): ${c.backImageBase64 ? "front + back images" : "front image only"}.\n`;
      prompt += cardHintLine(c);
      parts.push({ inlineData: { data: stripDataUrl(c.frontImageBase64), mimeType: "image/jpeg" } });
      if (c.backImageBase64) {
        parts.push({ inlineData: { data: stripDataUrl(c.backImageBase64), mimeType: "image/jpeg" } });
      }
    });

    prompt += `\nReturn one object per card, with "id" set to that card's ID.\n` + CARD_EXTRACTION_INSTRUCTIONS;
    parts.push({ text: prompt });

    const response = await generateWithFallback(ai, {
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: { id: { type: Type.STRING }, ...CARD_RESPONSE_PROPERTIES },
            required: ["id", "name", "category", "isGraded", "gradingCompany"],
          },
        },
      },
    });

    text = response?.text || "[]";
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error("OCR response was not a list of cards");
    return res.json(parsed);
  } catch (error: any) {
    console.error("Batch OCR error:", error, text ? `Response text (first 300 chars): ${text.slice(0, 300)}` : "");
    const message = error instanceof SyntaxError ? "OCR response was incomplete or malformed" : error.message;
    return res.status(502).json({ error: message || "Batch OCR failed" });
  }
});

// Dedicated API Error Handler: ensures API endpoints ALWAYS return JSON, never HTML error pages
app.use("/api", (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(`API Error on ${req.method} ${req.path}:`, err?.message || err);
  res.status(err?.status || err?.statusCode || 500).json({
    error: err?.message || "An unexpected error occurred while processing the API request.",
    code: err?.code || "API_ERROR",
  });
});

// Explicit API 404 Handler: prevents unmatched API routes from falling through to Vite's index.html
app.all("/api/*", (req, res) => {
  res.status(404).json({
    error: `Endpoint not found: ${req.method} ${req.path}`,
    code: "NOT_FOUND",
  });
});

// Vite & Express Integration
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`CardVault server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
