import { z } from "zod";

const normalizedCoordinate = z.number().min(0).max(1);

export const evaluateRequestSchema = z.object({
  imageBase64: z.string().min(20, "imageBase64 payload is too small")
});

export const visionResultSchema = z.object({
  identified_object: z.string().min(1),
  mayo_score: z.number().min(0).max(100),
  review: z.string().min(1),
  bounding_box: z.object({
    x: normalizedCoordinate,
    y: normalizedCoordinate,
    width: normalizedCoordinate,
    height: normalizedCoordinate
  })
});

export const evaluateResponseSchema = z.object({
  status: z.enum(["complete", "partial"]),
  originalImageBase64: z.string(),
  augmentedImageBase64: z.string().nullable(),
  vision: visionResultSchema,
  warning: z.string().nullable()
});
