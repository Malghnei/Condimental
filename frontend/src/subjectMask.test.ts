import { describe, expect, it } from "vitest";
import { getSegmentationDimensions } from "./subjectMask";

describe("getSegmentationDimensions", () => {
  it("keeps dimensions when already under max side", () => {
    expect(getSegmentationDimensions(800, 600)).toEqual({
      width: 800,
      height: 600
    });
  });

  it("downscales oversized landscape images preserving aspect ratio", () => {
    const result = getSegmentationDimensions(4000, 3000);
    expect(result.width).toBe(1024);
    expect(result.height).toBe(768);
  });

  it("downscales oversized portrait images preserving aspect ratio", () => {
    const result = getSegmentationDimensions(1500, 3000);
    expect(result.width).toBe(512);
    expect(result.height).toBe(1024);
  });
});
