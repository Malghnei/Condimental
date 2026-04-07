import { InferenceClient } from "@huggingface/inference";
import { HttpError } from "../errors/httpErrors.js";

const mayoPrompt =
  "Add a large, realistic, and shiny dollop of mayonnaise directly on top of the main subject of this image.";

export function createHuggingFaceImageService(env) {
  const hf = new InferenceClient(env.hfApiKey);

  async function generateMayonnaiseImage({
    sourceImageBase64,
    sourceImageMimeType,
    maskBase64: _maskBase64
  }) {
    void _maskBase64;

    const imageBuffer = Buffer.from(sourceImageBase64, "base64");
    if (!imageBuffer.length) {
      throw new HttpError({
        statusCode: 502,
        publicMessage: "Image generation failed.",
        code: "IMAGE_API_FAILED",
        cause: { detail: "Empty source image" }
      });
    }

    const mimeType = sourceImageMimeType || "image/png";
    const imageBlob = new Blob([imageBuffer], { type: mimeType });

    try {
      const resultBlob = await hf.imageToImage({
        model: env.hfImageModel,
        inputs: imageBlob,
        parameters: {
          prompt: mayoPrompt,
          image_guidance_scale: 1.5,
          guidance_scale: 7
        }
      });

      if (!(resultBlob instanceof Blob)) {
        throw new HttpError({
          statusCode: 502,
          publicMessage: "Image generation failed.",
          code: "IMAGE_RESPONSE_EMPTY",
          cause: { detail: "Expected Blob from imageToImage" }
        });
      }

      const arrayBuffer = await resultBlob.arrayBuffer();
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
