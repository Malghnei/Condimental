import { HttpError } from "../errors/httpErrors.js";

const mayoPrompt =
  "Add a large, realistic, and shiny dollop of mayonnaise directly on top of the main subject of this image.";

/**
 * Builds the Hugging Face Inference Providers URL for a model.
 * The legacy api-inference.huggingface.co host returns 410; use the router instead.
 * @see https://huggingface.co/docs/api-inference
 */
function buildInferenceUrl(modelId) {
  const encoded = encodeURIComponent(modelId);
  return `https://router.huggingface.co/hf-inference/models/${encoded}`;
}

/**
 * Parses HF inference response: binary image bytes or JSON-wrapped image data.
 */
async function parseImageResponse(response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const data = await response.json();
    if (data?.error) {
      return { error: typeof data.error === "string" ? data.error : JSON.stringify(data.error) };
    }
    // Some pipelines return { image: "base64..." } or nested blob
    const base64 =
      typeof data?.image === "string"
        ? data.image
        : typeof data?.generated_image === "string"
          ? data.generated_image
          : Array.isArray(data) && typeof data[0]?.image === "string"
            ? data[0].image
            : null;
    if (base64) {
      return { base64: base64.replace(/^data:image\/\w+;base64,/, "") };
    }
    return { error: "IMAGE_RESPONSE_UNEXPECTED_JSON" };
  }

  const buffer = await response.arrayBuffer();
  if (!buffer.byteLength) {
    return { error: "IMAGE_RESPONSE_EMPTY_BODY" };
  }
  return { base64: Buffer.from(buffer).toString("base64") };
}

export function createHuggingFaceImageService(env) {
  async function generateMayonnaiseImage({
    sourceImageBase64,
    sourceImageMimeType,
    maskBase64: _maskBase64
  }) {
    // instruct-pix2pix is instruction-based; mask is unused (kept for API compatibility).
    void _maskBase64;

    const url = buildInferenceUrl(env.hfImageModel);
    const body = JSON.stringify({
      inputs: sourceImageBase64,
      parameters: {
        prompt: mayoPrompt
      }
    });

    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.hfApiKey}`,
          "Content-Type": "application/json"
        },
        body
      });
    } catch (error) {
      throw new HttpError({
        statusCode: 502,
        publicMessage: "Image generation failed.",
        code: "IMAGE_API_UNAVAILABLE",
        cause: error
      });
    }

    const errorText = async () => {
      try {
        return (await response.text()).slice(0, 800);
      } catch {
        return "";
      }
    };

    if (!response.ok) {
      const snippet = await errorText();
      throw new HttpError({
        statusCode: 502,
        publicMessage: "Image generation failed.",
        code: "IMAGE_API_FAILED",
        cause: { status: response.status, body: snippet }
      });
    }

    const parsed = await parseImageResponse(response);

    if (parsed.error) {
      throw new HttpError({
        statusCode: 502,
        publicMessage: "Image generation failed.",
        code: "IMAGE_RESPONSE_EMPTY",
        cause: { detail: parsed.error }
      });
    }

    if (!parsed.base64) {
      throw new HttpError({
        statusCode: 502,
        publicMessage: "Image generation failed.",
        code: "IMAGE_RESPONSE_EMPTY",
        cause: { detail: "No image bytes in response" }
      });
    }

    return parsed.base64;
  }

  return {
    generateMayonnaiseImage
  };
}
