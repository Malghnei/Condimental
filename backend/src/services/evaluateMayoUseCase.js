import { HttpError } from "../errors/httpErrors.js";
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
  return async function evaluateMayo({ imageBase64, maskBase64 }) {
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

    let maskBuffer;
    if (maskBase64) {
      const normalizedMaskBase64 = stripDataUrlPrefix(maskBase64);
      const clientMaskBuffer = decodeBase64Image(normalizedMaskBase64);
      if (!clientMaskBuffer.length) {
        throw new HttpError({
          statusCode: 400,
          publicMessage: "Invalid inpainting mask.",
          code: "MASK_INVALID"
        });
      }
      const maskDimensions = await getImageDimensions(clientMaskBuffer);
      if (
        maskDimensions.width !== dimensions.width ||
        maskDimensions.height !== dimensions.height
      ) {
        throw new HttpError({
          statusCode: 400,
          publicMessage:
            "Mask size must match the source image width and height.",
          code: "MASK_DIMENSION_MISMATCH"
        });
      }
      maskBuffer = clientMaskBuffer;
    } else {
      maskBuffer = await buildInpaintMask({
        width: dimensions.width,
        height: dimensions.height,
        box: absoluteBox
      });
    }

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
