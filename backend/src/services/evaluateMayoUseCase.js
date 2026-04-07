import {
  decodeBase64Image,
  getImageDimensions,
  normalizedToAbsoluteBox,
  resolveImageMimeType,
  stripDataUrlPrefix
} from "../utils/image.js";
import { buildInpaintMask } from "./maskService.js";

export function createEvaluateMayoUseCase({
  geminiVisionService,
  imageGenerationService
}) {
  return async function evaluateMayo({ imageBase64 }) {
    const normalizedImageBase64 = stripDataUrlPrefix(imageBase64);
    const originalImageBuffer = decodeBase64Image(normalizedImageBase64);
    const sourceImageMimeType = await resolveImageMimeType({
      rawInput: imageBase64,
      imageBuffer: originalImageBuffer
    });

    const dimensions = await getImageDimensions(originalImageBuffer);

    const vision = await geminiVisionService.analyzeVision(
      normalizedImageBase64,
      sourceImageMimeType
    );
    const absoluteBox = normalizedToAbsoluteBox(vision.bounding_box, dimensions);

    const maskBuffer = await buildInpaintMask({
      width: dimensions.width,
      height: dimensions.height,
      box: absoluteBox
    });

    try {
      const augmentedImageBase64 =
        await imageGenerationService.generateMayonnaiseImage({
          sourceImageBase64: normalizedImageBase64,
          sourceImageMimeType,
          maskBase64: maskBuffer.toString("base64")
        });

      return {
        status: "complete",
        originalImageBase64: normalizedImageBase64,
        augmentedImageBase64,
        vision,
        warning: null
      };
    } catch (error) {
      // Keep partial success UX, but surface generation diagnostics in server logs.
      console.warn("Image generation fallback triggered", {
        code: error?.code ?? null,
        message: error?.message ?? "Unknown image generation error",
        cause: error?.cause ?? null
      });
      return {
        status: "partial",
        originalImageBase64: normalizedImageBase64,
        augmentedImageBase64: null,
        vision,
        warning: "Image generation failed after successful vision analysis."
      };
    }
  };
}
