import { z } from "zod";

const evaluateResponseSchema = z.object({
  status: z.enum(["complete", "partial"]),
  originalImageBase64: z.string(),
  augmentedImageBase64: z.string().nullable(),
  vision: z.object({
    identified_object: z.string(),
    mayo_score: z.number().min(0).max(100),
    review: z.string(),
    bounding_box: z.object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number()
    })
  }),
  warning: z.string().nullable()
});

export type EvaluateMayoResponse = z.infer<typeof evaluateResponseSchema>;

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";

export type EvaluateMayoRequestOptions = {
  /** Raw base64 PNG mask (no data URL prefix), same dimensions as the image */
  maskBase64?: string;
};

export async function evaluateMayoImage(
  imageBase64DataUrl: string,
  options: EvaluateMayoRequestOptions = {}
): Promise<EvaluateMayoResponse> {
  const body: Record<string, string> = {
    imageBase64: imageBase64DataUrl
  };
  if (options.maskBase64) {
    body.maskBase64 = options.maskBase64;
  }

  const response = await fetch(`${apiBaseUrl}/api/evaluate-mayo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const payload = await response.json();

  if (!response.ok) {
    const message =
      typeof payload?.message === "string"
        ? payload.message
        : "Request failed.";
    throw new Error(message);
  }

  return evaluateResponseSchema.parse(payload);
}
