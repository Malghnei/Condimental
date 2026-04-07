import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../src/errors/httpErrors.js";
import { createHuggingFaceImageService } from "../src/services/huggingFaceImageService.js";

const env = {
  hfApiKey: "hf-test-token",
  hfImageModel: "timbrooks/instruct-pix2pix"
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("huggingFaceImageService", () => {
  it("returns base64 when API responds with image/png bytes", async () => {
    const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "image/png" }),
      async arrayBuffer() {
        return pngBytes.buffer;
      }
    });
    vi.stubGlobal("fetch", fetchMock);

    const service = createHuggingFaceImageService(env);
    const result = await service.generateMayonnaiseImage({
      sourceImageBase64: "source-base64",
      sourceImageMimeType: "image/png",
      maskBase64: "mask-base64"
    });

    expect(result).toBe(Buffer.from(pngBytes).toString("base64"));
    const [url, requestConfig] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://router.huggingface.co/hf-inference/models/timbrooks/instruct-pix2pix"
    );
    expect(requestConfig.headers.Authorization).toBe("Bearer hf-test-token");
    const body = JSON.parse(requestConfig.body);
    expect(body.inputs).toBe("source-base64");
    expect(body.parameters.prompt).toContain("mayonnaise");
  });

  it("throws typed error when response has no image", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      async json() {
        return { error: "Model error" };
      },
      async arrayBuffer() {
        return new ArrayBuffer(0);
      }
    });
    vi.stubGlobal("fetch", fetchMock);

    const service = createHuggingFaceImageService(env);

    await expect(
      service.generateMayonnaiseImage({
        sourceImageBase64: "source-base64",
        sourceImageMimeType: "image/png",
        maskBase64: "mask-base64"
      })
    ).rejects.toMatchObject({
      statusCode: 502,
      code: "IMAGE_RESPONSE_EMPTY"
    });
  });

  it("throws typed error when HTTP status is not ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      async text() {
        return "unavailable";
      }
    });
    vi.stubGlobal("fetch", fetchMock);

    const service = createHuggingFaceImageService(env);

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
        code: "IMAGE_API_FAILED"
      });
    }
  });
});
