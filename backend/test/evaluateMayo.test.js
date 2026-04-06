import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app/createApp.js";

const onePixelPngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X5QAAAABJRU5ErkJggg==";

const env = {
  frontendOrigin: "http://localhost:5173",
  geminiApiKey: "test-key",
  geminiVisionModel: "vision-model",
  geminiImageModel: "image-model"
};

function createMockGeminiService({
  failVision = false,
  failGeneration = false
} = {}) {
  return {
    async analyzeVision() {
      if (failVision) {
        throw new Error("Vision API failed (503): unavailable");
      }
      return {
        identified_object: "burger",
        mayo_score: 88,
        review: "Great mayo candidate.",
        bounding_box: { x: 0.1, y: 0.1, width: 0.6, height: 0.6 }
      };
    },
    async generateMayonnaiseImage() {
      if (failGeneration) {
        throw new Error("Image API failed (500): generation error");
      }
      return onePixelPngBase64;
    }
  };
}

describe("POST /api/evaluate-mayo", () => {
  it("returns full response on successful vision + generation", async () => {
    const app = createApp({
      env,
      geminiService: createMockGeminiService()
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
      geminiService: createMockGeminiService({ failGeneration: true })
    });

    const response = await request(app).post("/api/evaluate-mayo").send({
      imageBase64: onePixelPngBase64
    });

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe("partial");
    expect(response.body.augmentedImageBase64).toBeNull();
    expect(response.body.warning).toContain("Image API failed");
  });

  it("returns 502 when vision fails", async () => {
    const app = createApp({
      env,
      geminiService: createMockGeminiService({ failVision: true })
    });

    const response = await request(app).post("/api/evaluate-mayo").send({
      imageBase64: onePixelPngBase64
    });

    expect(response.statusCode).toBe(502);
    expect(response.body.message).toBe("Vision analysis failed.");
  });

  it("returns 413 when payload is oversized", async () => {
    const app = createApp({
      env,
      geminiService: createMockGeminiService()
    });
    const hugeImage = "A".repeat(11 * 1024 * 1024);

    const response = await request(app).post("/api/evaluate-mayo").send({
      imageBase64: hugeImage
    });

    expect(response.statusCode).toBe(413);
  });

  it("returns 429 when rate limit is exceeded", async () => {
    const app = createApp({
      env,
      geminiService: createMockGeminiService(),
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
