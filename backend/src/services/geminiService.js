import { visionResultSchema } from "../domain/schemas.js";
import { HttpError } from "../errors/httpErrors.js";

const visionPrompt = `
Analyze the main subject in this image for culinary mayonnaise compatibility.
Return strictly valid JSON with this exact schema and no additional keys:
{
  "identified_object": string,
  "mayo_score": number (0-100),
  "review": string,
  "bounding_box": {
    "x": number (0-1),
    "y": number (0-1),
    "width": number (0-1),
    "height": number (0-1)
  }
}
`.trim();

function buildEndpoint(model, apiKey) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
}

function extractText(candidates) {
  const parts = candidates?.[0]?.content?.parts ?? [];
  const textPart = parts.find((part) => typeof part.text === "string");
  return textPart?.text ?? "";
}

function parseVisionJson(rawText) {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error("Vision response text is empty.");
  }
  const asJsonCodeBlock = trimmed.match(/```json([\s\S]*?)```/i)?.[1]?.trim();
  const asCodeBlock = trimmed.match(/```([\s\S]*?)```/i)?.[1]?.trim();
  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");
  const extractedObject =
    objectStart >= 0 && objectEnd > objectStart
      ? trimmed.slice(objectStart, objectEnd + 1)
      : null;
  const payload = asJsonCodeBlock ?? asCodeBlock ?? extractedObject ?? trimmed;
  return JSON.parse(payload);
}

/**
 * Gemini-only vision service (mayo scoring, bounding box). Image generation is handled separately.
 */
export function createGeminiService(env) {
  async function analyzeVision(imageBase64, imageMimeType) {
    let response;
    try {
      response = await fetch(
        buildEndpoint(env.geminiVisionModel, env.geminiApiKey),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  { text: visionPrompt },
                  { inlineData: { mimeType: imageMimeType, data: imageBase64 } }
                ]
              }
            ],
            generationConfig: {
              responseMimeType: "application/json"
            }
          })
        }
      );
    } catch (error) {
      throw new HttpError({
        statusCode: 502,
        publicMessage: "Vision analysis failed.",
        code: "VISION_API_UNAVAILABLE",
        cause: error
      });
    }

    if (!response.ok) {
      throw new HttpError({
        statusCode: 502,
        publicMessage: "Vision analysis failed.",
        code: "VISION_API_FAILED"
      });
    }

    let result;
    try {
      result = await response.json();
    } catch (error) {
      throw new HttpError({
        statusCode: 502,
        publicMessage: "Vision analysis failed.",
        code: "VISION_RESPONSE_INVALID_JSON",
        cause: error
      });
    }

    const text = extractText(result.candidates);
    if (!text) {
      throw new HttpError({
        statusCode: 502,
        publicMessage: "Vision analysis failed.",
        code: "VISION_RESPONSE_EMPTY"
      });
    }

    let parsed;
    try {
      parsed = parseVisionJson(text);
    } catch (error) {
      throw new HttpError({
        statusCode: 502,
        publicMessage: "Vision analysis failed.",
        code: "VISION_RESPONSE_MALFORMED",
        cause: error
      });
    }

    try {
      return visionResultSchema.parse(parsed);
    } catch (error) {
      throw new HttpError({
        statusCode: 502,
        publicMessage: "Vision analysis failed.",
        code: "VISION_RESPONSE_SCHEMA_INVALID",
        cause: error
      });
    }
  }

  return {
    analyzeVision
  };
}
