import { describe, expect, it } from "vitest";
import {
  decodeBase64Image,
  getMimeTypeFromDataUrl,
  normalizedToAbsoluteBox,
  resolveImageMimeType,
  stripDataUrlPrefix
} from "../src/utils/image.js";

const onePixelPngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X5QAAAABJRU5ErkJggg==";

describe("image utils", () => {
  it("strips base64 prefix from data URL", () => {
    const dataUrl = `data:image/png;base64,${onePixelPngBase64}`;
    expect(stripDataUrlPrefix(dataUrl)).toBe(onePixelPngBase64);
  });

  it("extracts MIME type from data URL", () => {
    const dataUrl = `data:image/webp;base64,${onePixelPngBase64}`;
    expect(getMimeTypeFromDataUrl(dataUrl)).toBe("image/webp");
  });

  it("infers MIME type from image buffer when no data URL", async () => {
    const buffer = decodeBase64Image(onePixelPngBase64);
    const mimeType = await resolveImageMimeType({
      rawInput: onePixelPngBase64,
      imageBuffer: buffer
    });

    expect(mimeType).toBe("image/png");
  });

  it("keeps coordinates within image boundaries", () => {
    const absolute = normalizedToAbsoluteBox(
      { x: 0.95, y: 0.95, width: 0.4, height: 0.4 },
      { width: 100, height: 80 }
    );

    expect(absolute.x).toBeLessThan(100);
    expect(absolute.y).toBeLessThan(80);
    expect(absolute.width).toBeLessThanOrEqual(100);
    expect(absolute.height).toBeLessThanOrEqual(80);
  });
});
