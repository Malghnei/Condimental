import {
  decodeBase64Image,
  getImageDimensions,
  normalizedToAbsoluteBox,
  stripDataUrlPrefix
} from "../utils/image.js";
import { buildInpaintMask } from "./maskService.js";

export function createEvaluateMayoUseCase({ geminiService }) {
  return async function evaluateMayo({ imageBase64 }) {
    const normalizedImageBase64 = stripDataUrlPrefix(imageBase64);
    const originalImageBuffer = decodeBase64Image(normalizedImageBase64);

    const dimensions = await getImageDimensions(originalImageBuffer);

    const vision = await geminiService.analyzeVision(normalizedImageBase64);
    const absoluteBox = normalizedToAbsoluteBox(vision.bounding_box, dimensions);

    const maskBuffer = await buildInpaintMask({
      width: dimensions.width,
      height: dimensions.height,
      box: absoluteBox
    });

    try {
      const augmentedImageBase64 = await geminiService.generateMayonnaiseImage({
        sourceImageBase64: normalizedImageBase64,
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
      return {
        status: "partial",
        originalImageBase64: normalizedImageBase64,
        augmentedImageBase64: null,
        vision,
        warning:
          error instanceof Error
            ? error.message
            : "Image generation failed after successful vision analysis."
      };
    }
  };
}
