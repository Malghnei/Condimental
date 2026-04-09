import request from "supertest";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app/createApp.js";
import { HttpError } from "../src/errors/httpErrors.js";

const onePixelPngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X5QAAAABJRU5ErkJggg==";

const env = {
  frontendOrigin: "http://localhost:5173",
  geminiApiKey: "test-key",
  geminiVisionModel: "vision-model",
  hfApiKey: "hf-test-key",
  hfImageModel: "timbrooks/instruct-pix2pix"
};

function createMockServices({
  failVision = false,
  failGeneration = false,
  invalidGenerationPayload = false
} = {}) {
  return {
    geminiVisionService: {
      async analyzeVision() {
        if (failVision) {
          throw new HttpError({
            statusCode: 502,
            publicMessage: "Vision analysis failed.",
            code: "VISION_API_FAILED"
          });
        }
        return {
          identified_object: "burger",
          mayo_score: 88,
          review: "Great mayo candidate.",
          bounding_box: { x: 0.1, y: 0.1, width: 0.6, height: 0.6 }
        };
      }
    },
    imageGenerationService: {
      async generateMayonnaiseImage() {
        if (failGeneration) {
          throw new Error("Image API failed (500): generation error");
        }
        if (invalidGenerationPayload) {
          return 12345;
        }
        return onePixelPngBase64;
      }
    }
  };
}

describe("POST /api/evaluate-mayo", () => {
  it("returns full response on successful vision + generation", async () => {
    const app = createApp({
      env,
      ...createMockServices()
    });

    const response = await request(app).post("/api/evaluate-mayo").send({
      imageBase64: onePixelPngBase64
    });

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe("complete");
    expect(response.body.augmentedImageBase64).toBeTruthy();
    expect(response.body.warning).toBeNull();
  });

  it("returns partial response when generation fails", async () => {
    const app = createApp({
      env,
      ...createMockServices({ failGeneration: true })
    });

    const response = await request(app).post("/api/evaluate-mayo").send({
      imageBase64: onePixelPngBase64
    });

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe("partial");
    expect(response.body.augmentedImageBase64).toBeNull();
    expect(response.body.warning).toBe(
      "Image generation failed after successful vision analysis."
    );
  });

  it("returns 502 when vision fails", async () => {
    const app = createApp({
      env,
      ...createMockServices({ failVision: true })
    });

    const response = await request(app).post("/api/evaluate-mayo").send({
      imageBase64: onePixelPngBase64
    });

    expect(response.statusCode).toBe(502);
    expect(response.body.message).toBe("Vision analysis failed.");
    expect(response.body.code).toBe("VISION_API_FAILED");
  });

  it("returns 400 when request schema is invalid", async () => {
    const app = createApp({
      env,
      ...createMockServices()
    });

    const response = await request(app).post("/api/evaluate-mayo").send({
      imageBase64: "too-short"
    });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe("Invalid request schema.");
  });

  it("returns 500 when response schema is invalid", async () => {
    const app = createApp({
      env,
      ...createMockServices({ invalidGenerationPayload: true })
    });

    const response = await request(app).post("/api/evaluate-mayo").send({
      imageBase64: onePixelPngBase64
    });

    expect(response.statusCode).toBe(500);
    expect(response.body.message).toBe("Internal response validation failed.");
    expect(response.body.code).toBe("RESPONSE_SCHEMA_INVALID");
  });

  it("returns 413 when payload is oversized", async () => {
    const app = createApp({
      env,
      ...createMockServices()
    });
    const hugeImage = "A".repeat(11 * 1024 * 1024);

    const response = await request(app).post("/api/evaluate-mayo").send({
      imageBase64: hugeImage
    });

    expect(response.statusCode).toBe(413);
  });

  it("accepts optional client mask when dimensions match the image", async () => {
    const app = createApp({
      env,
      ...createMockServices()
    });

    const response = await request(app).post("/api/evaluate-mayo").send({
      imageBase64: onePixelPngBase64,
      maskBase64: onePixelPngBase64
    });

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe("complete");
  });

  it("returns 400 when client mask dimensions do not match the image", async () => {
    const app = createApp({
      env,
      ...createMockServices()
    });

    const mask2x2Base64 = (
      await sharp({
        create: {
          width: 2,
          height: 2,
          channels: 3,
          background: { r: 255, g: 255, b: 255 }
        }
      })
        .png()
        .toBuffer()
    ).toString("base64");

    const response = await request(app).post("/api/evaluate-mayo").send({
      imageBase64: onePixelPngBase64,
      maskBase64: mask2x2Base64
    });

    expect(response.statusCode).toBe(400);
    expect(response.body.code).toBe("MASK_DIMENSION_MISMATCH");
  });

  it("returns 429 when rate limit is exceeded", async () => {
    const app = createApp({
      env,
      ...createMockServices(),
      rateLimitMax: 1
    });

    const first = await request(app).post("/api/evaluate-mayo").send({
      imageBase64: onePixelPngBase64
    });
    const second = await request(app).post("/api/evaluate-mayo").send({
      imageBase64: onePixelPngBase64
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(429);
  });
});
