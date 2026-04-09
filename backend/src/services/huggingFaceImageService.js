import { HttpError } from "../errors/httpErrors.js";

const mayoPrompt =
  "Add a large, realistic, and shiny dollop of mayonnaise directly on top of the main subject of this image.";

export function createHuggingFaceImageService(env) {
  async function generateMayonnaiseImage({
    sourceImageBase64,
    sourceImageMimeType: _sourceImageMimeType,
    maskBase64
  }) {
    void _sourceImageMimeType;

    const imageBuffer = Buffer.from(sourceImageBase64, "base64");
    if (!imageBuffer.length) {
      throw new HttpError({
        statusCode: 502,
        publicMessage: "Image generation failed.",
        code: "IMAGE_API_FAILED",
        cause: { detail: "Empty source image" }
      });
    }

    const maskBuffer = Buffer.from(maskBase64, "base64");
    if (!maskBuffer.length) {
      throw new HttpError({
        statusCode: 502,
        publicMessage: "Image generation failed.",
        code: "IMAGE_API_FAILED",
        cause: { detail: "Empty inpainting mask" }
      });
    }

    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${env.cfAccountId}/ai/run/${env.cfImageModel}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.cfApiToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            prompt: mayoPrompt,
            image: Array.from(imageBuffer),
            mask: Array.from(maskBuffer),
            strength: env.cfImg2ImgStrength,
            guidance: env.cfImg2ImgGuidance
          })
        }
      );

      if (!response.ok) {
        const detail = await response.text();
        throw new HttpError({
          statusCode: 502,
          publicMessage: "Image generation failed.",
          code: "IMAGE_API_FAILED",
          cause: {
            detail,
            status: response.status
          }
        });
      }

      const arrayBuffer = await response.arrayBuffer();
      if (!arrayBuffer.byteLength) {
        throw new HttpError({
          statusCode: 502,
          publicMessage: "Image generation failed.",
          code: "IMAGE_RESPONSE_EMPTY",
          cause: { detail: "Empty response image payload" }
        });
      }

      return Buffer.from(arrayBuffer).toString("base64");
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw new HttpError({
        statusCode: 502,
        publicMessage: "Image generation failed.",
        code: "IMAGE_API_FAILED",
        cause: {
          message: error?.message ?? String(error),
          name: error?.name
        }
      });
    }
  }

  return {
    generateMayonnaiseImage
  };
}
