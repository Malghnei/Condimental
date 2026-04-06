import { visionResultSchema } from "../domain/schemas.js";

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

const mayoPrompt =
  "Add a large, realistic, and shiny dollop of mayonnaise directly on top of the main subject of this image.";

function buildEndpoint(model, apiKey) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
}

function extractText(candidates) {
  const parts = candidates?.[0]?.content?.parts ?? [];
  const textPart = parts.find((part) => typeof part.text === "string");
  return textPart?.text ?? "";
}

function extractImageInlineData(candidates) {
  const parts = candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find(
    (part) => part.inlineData?.mimeType?.startsWith("image/")
  );
  return imagePart?.inlineData?.data ?? null;
}

function parseVisionJson(rawText) {
  const trimmed = rawText.trim();
  const asCodeBlock = trimmed.match(/```json([\s\S]*?)```/i)?.[1]?.trim();
  const payload = asCodeBlock ?? trimmed;
  return JSON.parse(payload);
}

export function createGeminiService(env) {
  async function analyzeVision(imageBase64) {
    const response = await fetch(buildEndpoint(env.geminiVisionModel, env.geminiApiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: visionPrompt },
              { inlineData: { mimeType: "image/jpeg", data: imageBase64 } }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Vision API failed (${response.status}): ${details}`);
    }

    const result = await response.json();
    const text = extractText(result.candidates);
    const parsed = parseVisionJson(text);
    return visionResultSchema.parse(parsed);
  }

  async function generateMayonnaiseImage({ sourceImageBase64, maskBase64 }) {
    const response = await fetch(buildEndpoint(env.geminiImageModel, env.geminiApiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: mayoPrompt },
              {
                inlineData: {
                  mimeType: "image/png",
                  data: sourceImageBase64
                }
              },
              {
                inlineData: {
                  mimeType: "image/png",
                  data: maskBase64
                }
              }
            ]
          }
        ],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"]
        }
      })
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Image API failed (${response.status}): ${details}`);
    }

    const result = await response.json();
    const generatedBase64 = extractImageInlineData(result.candidates);

    if (!generatedBase64) {
      throw new Error("Image API did not return generated image data.");
    }

    return generatedBase64;
  }

  return {
    analyzeVision,
    generateMayonnaiseImage
  };
}
