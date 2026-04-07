import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../src/errors/httpErrors.js";

const mockImageToImage = vi.hoisted(() => vi.fn());

vi.mock("@huggingface/inference", () => ({
  InferenceClient: class {
    constructor() {
      this.imageToImage = mockImageToImage;
    }
  }
}));

import { createHuggingFaceImageService } from "../src/services/huggingFaceImageService.js";

const env = {
  hfApiKey: "hf-test-token",
  hfImageModel: "timbrooks/instruct-pix2pix"
};

const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

afterEach(() => {
  vi.clearAllMocks();
});

describe("huggingFaceImageService", () => {
  it("returns base64 from imageToImage Blob result", async () => {
    mockImageToImage.mockResolvedValue(
      new Blob([pngBytes], { type: "image/png" })
    );

    const service = createHuggingFaceImageService(env);
    const result = await service.generateMayonnaiseImage({
      sourceImageBase64: Buffer.from("hello").toString("base64"),
      sourceImageMimeType: "image/png",
      maskBase64: "mask-base64"
    });

    expect(result).toBe(Buffer.from(pngBytes).toString("base64"));
    expect(mockImageToImage).toHaveBeenCalledTimes(1);

    const call = mockImageToImage.mock.calls[0][0];
    expect(call.model).toBe("timbrooks/instruct-pix2pix");
    expect(call.inputs).toBeInstanceOf(Blob);
    expect(call.parameters.prompt).toContain("mayonnaise");
    expect(call.parameters.image_guidance_scale).toBe(1.5);
    expect(call.parameters.guidance_scale).toBe(7);
  });

  it("maps SDK failures to IMAGE_API_FAILED", async () => {
    mockImageToImage.mockRejectedValue(new Error("Model error"));

    const service = createHuggingFaceImageService(env);

    await expect(
      service.generateMayonnaiseImage({
        sourceImageBase64: Buffer.from("x").toString("base64"),
        sourceImageMimeType: "image/png",
        maskBase64: "mask-base64"
      })
    ).rejects.toMatchObject({
      statusCode: 502,
      code: "IMAGE_API_FAILED"
    });
  });

  it("throws typed error when imageToImage returns non-Blob", async () => {
    mockImageToImage.mockResolvedValue(null);

    const service = createHuggingFaceImageService(env);

    try {
      await service.generateMayonnaiseImage({
        sourceImageBase64: Buffer.from("x").toString("base64"),
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
