import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../src/errors/httpErrors.js";

import { createHuggingFaceImageService } from "../src/services/huggingFaceImageService.js";

const env = {
  cfAccountId: "cf-account",
  cfApiToken: "cf-token",
  cfImageModel: "@cf/lykon/dreamshaper-8-lcm",
  cfImg2ImgStrength: 0.5,
  cfImg2ImgGuidance: 7.5
};

const maskPngBytes = new Uint8Array([137, 80, 78, 71, 2, 2, 2, 2]);
const maskBase64 = Buffer.from(maskPngBytes).toString("base64");

const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const fetchMock = vi.fn();

function bytesToArrayBuffer(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("huggingFaceImageService", () => {
  it("returns base64 from Cloudflare dreamshaper img2img binary response", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(bytesToArrayBuffer(pngBytes))
    });

    const service = createHuggingFaceImageService(env);
    const result = await service.generateMayonnaiseImage({
      sourceImageBase64: Buffer.from("hello").toString("base64"),
      sourceImageMimeType: "image/png",
      maskBase64
    });

    expect(result).toBe(Buffer.from(pngBytes).toString("base64"));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://api.cloudflare.com/client/v4/accounts/cf-account/ai/run/@cf/lykon/dreamshaper-8-lcm"
    );
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toBe("Bearer cf-token");

    const payload = JSON.parse(options.body);
    expect(payload.prompt).toContain("mayonnaise");
    expect(payload.image).toEqual(Array.from(Buffer.from("hello")));
    expect(payload.mask).toEqual(Array.from(maskPngBytes));
    expect(payload.strength).toBe(0.5);
    expect(payload.guidance).toBe(7.5);
  });

  it("maps Cloudflare API non-2xx responses to IMAGE_API_FAILED", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      text: vi.fn().mockResolvedValue("Rate limit")
    });

    const service = createHuggingFaceImageService(env);

    await expect(
      service.generateMayonnaiseImage({
        sourceImageBase64: Buffer.from("x").toString("base64"),
        sourceImageMimeType: "image/png",
        maskBase64
      })
    ).rejects.toMatchObject({
      statusCode: 502,
      code: "IMAGE_API_FAILED"
    });
  });

  it("throws typed error when Cloudflare returns an empty payload", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0))
    });

    const service = createHuggingFaceImageService(env);

    try {
      await service.generateMayonnaiseImage({
        sourceImageBase64: Buffer.from("x").toString("base64"),
        sourceImageMimeType: "image/png",
        maskBase64
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

  it("rejects empty inpainting mask", async () => {
    const service = createHuggingFaceImageService(env);

    await expect(
      service.generateMayonnaiseImage({
        sourceImageBase64: Buffer.from("x").toString("base64"),
        sourceImageMimeType: "image/png",
        maskBase64: ""
      })
    ).rejects.toMatchObject({
      statusCode: 502,
      code: "IMAGE_API_FAILED"
    });
  });
});
