import { removeBackground } from "@imgly/background-removal";

function blobToRawBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Expected data URL from FileReader."));
        return;
      }
      const marker = "base64,";
      const index = result.indexOf(marker);
      if (index === -1) {
        reject(new Error("Unexpected FileReader result format."));
        return;
      }
      resolve(result.slice(index + marker.length));
    };
    reader.onerror = () => reject(reader.error ?? new Error("FileReader failed."));
    reader.readAsDataURL(blob);
  });
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) {
        resolve(b);
        return;
      }
      reject(new Error("Failed to encode mask PNG."));
    }, "image/png");
  });
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load source image."));
    img.src = src;
  });
}

const ALPHA_THRESHOLD = 32;
const MAX_SEGMENTATION_SIDE = 1024;
const MAX_MASK_OUTPUT_PIXELS = 6_000_000;

export function getSegmentationDimensions(width: number, height: number) {
  const maxSide = Math.max(width, height);
  if (maxSide <= MAX_SEGMENTATION_SIDE) {
    return { width, height };
  }
  const scale = MAX_SEGMENTATION_SIDE / maxSide;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

/**
 * Removes the background in-browser, then builds a grayscale PNG mask from the
 * foreground alpha (white ≈ subject, black ≈ background) at the same size as the
 * source image for Cloudflare inpainting.
 */
export async function createSubjectMaskBase64(imageDataUrl: string): Promise<string> {
  const sourceImage = await loadHtmlImage(imageDataUrl);

  const width = sourceImage.naturalWidth;
  const height = sourceImage.naturalHeight;
  if (width * height > MAX_MASK_OUTPUT_PIXELS) {
    throw new Error("Image is too large for in-browser background removal.");
  }

  const segmentationSize = getSegmentationDimensions(width, height);
  let segmentationInput = imageDataUrl;
  if (
    segmentationSize.width !== width ||
    segmentationSize.height !== height
  ) {
    const resizeCanvas = document.createElement("canvas");
    resizeCanvas.width = segmentationSize.width;
    resizeCanvas.height = segmentationSize.height;
    const resizeCtx = resizeCanvas.getContext("2d");
    if (!resizeCtx) {
      throw new Error("Canvas 2D context is not available.");
    }
    resizeCtx.drawImage(sourceImage, 0, 0, segmentationSize.width, segmentationSize.height);
    segmentationInput = resizeCanvas.toDataURL("image/png");
  }

  const foregroundBlob = await removeBackground(segmentationInput, {
    output: { format: "image/png" }
  });

  const fgBitmap = await createImageBitmap(foregroundBlob);

  const canvas = document.createElement("canvas");
  canvas.width = segmentationSize.width;
  canvas.height = segmentationSize.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    fgBitmap.close();
    throw new Error("Canvas 2D context is not available.");
  }

  ctx.drawImage(fgBitmap, 0, 0, segmentationSize.width, segmentationSize.height);
  fgBitmap.close();

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    const v = a > ALPHA_THRESHOLD ? 255 : 0;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);

  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = width;
  outputCanvas.height = height;
  const outputCtx = outputCanvas.getContext("2d");
  if (!outputCtx) {
    throw new Error("Canvas 2D context is not available.");
  }
  outputCtx.imageSmoothingEnabled = false;
  outputCtx.drawImage(canvas, 0, 0, width, height);

  const pngBlob = await canvasToPngBlob(outputCanvas);

  return blobToRawBase64(pngBlob);
}
