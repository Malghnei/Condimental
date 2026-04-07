import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../src/errors/httpErrors.js";
import { createGeminiService } from "../src/services/geminiService.js";

const env = {
  geminiApiKey: "test-key",
  geminiVisionModel: "vision-model",
  geminiImageModel: "image-model"
};

const validVisionJson = JSON.stringify({
  identified_object: "burger",
  mayo_score: 88,
  review: "Great mayo candidate.",
  bounding_box: { x: 0.1, y: 0.1, width: 0.6, height: 0.6 }
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("geminiService", () => {
  it("uses provided MIME type for vision analysis", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      async json() {
        return {
          candidates: [{ content: { parts: [{ text: validVisionJson }] } }]
        };
      }
    });
    vi.stubGlobal("fetch", fetchMock);

    const service = createGeminiService(env);
    await service.analyzeVision("source-base64", "image/webp");

    const [, requestConfig] = fetchMock.mock.calls[0];
    const body = JSON.parse(requestConfig.body);
    expect(body.contents[0].parts[1].inlineData.mimeType).toBe("image/webp");
  });

  it("parses fenced JSON response from vision model", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      async json() {
        return {
          candidates: [
            {
              content: {
                parts: [{ text: "```\n" + validVisionJson + "\n```" }]
              }
            }
          ]
        };
      }
    });
    vi.stubGlobal("fetch", fetchMock);

    const service = createGeminiService(env);
    const result = await service.analyzeVision("source-base64", "image/png");

    expect(result.identified_object).toBe("burger");
    expect(result.mayo_score).toBe(88);
  });

  it("throws typed error when vision response has no text", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      async json() {
        return { candidates: [] };
      }
    });
    vi.stubGlobal("fetch", fetchMock);

    const service = createGeminiService(env);

    await expect(
      service.analyzeVision("source-base64", "image/png")
    ).rejects.toMatchObject({
      statusCode: 502,
      code: "VISION_RESPONSE_EMPTY"
    });
  });

  it("uses source image MIME when generating mayonnaise image", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      async json() {
        return {
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: "image/png",
                      data: "generated-image"
                    }
                  }
                ]
              }
            }
          ]
        };
      }
    });
    vi.stubGlobal("fetch", fetchMock);

    const service = createGeminiService(env);
    const result = await service.generateMayonnaiseImage({
      sourceImageBase64: "source-base64",
      sourceImageMimeType: "image/jpeg",
      maskBase64: "mask-base64"
    });

    expect(result).toBe("generated-image");
    const [, requestConfig] = fetchMock.mock.calls[0];
    const body = JSON.parse(requestConfig.body);
    expect(body.contents[0].parts[1].inlineData.mimeType).toBe("image/jpeg");
    expect(body.contents[0].parts[2].inlineData.mimeType).toBe("image/png");
  });

  it("throws typed error when generation response has no image", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      async json() {
        return { candidates: [] };
      }
    });
    vi.stubGlobal("fetch", fetchMock);

    const service = createGeminiService(env);

    try {
      await service.generateMayonnaiseImage({
        sourceImageBase64: "source-base64",
        sourceImageMimeType: "image/png",
        maskBase64: "mask-base64"
      });
      throw new Error("Expected generation to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect(error).toMatchObject({
        statusCode: 502,
        code: "IMAGE_RESPONSE_EMPTY"
      });
    }
  });
});
