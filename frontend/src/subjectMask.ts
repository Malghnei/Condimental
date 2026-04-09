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

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load source image."));
    img.src = src;
  });
}

const ALPHA_THRESHOLD = 32;

/**
 * Removes the background in-browser, then builds a grayscale PNG mask from the
 * foreground alpha (white ≈ subject, black ≈ background) at the same size as the
 * source image for Cloudflare inpainting.
 */
export async function createSubjectMaskBase64(imageDataUrl: string): Promise<string> {
  const foregroundBlob = await removeBackground(imageDataUrl, {
    output: { format: "image/png" }
  });

  const [sourceImage, fgBitmap] = await Promise.all([
    loadHtmlImage(imageDataUrl),
    createImageBitmap(foregroundBlob)
  ]);

  const width = sourceImage.naturalWidth;
  const height = sourceImage.naturalHeight;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    fgBitmap.close();
    throw new Error("Canvas 2D context is not available.");
  }

  ctx.drawImage(fgBitmap, 0, 0, width, height);
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

  const pngBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) {
        resolve(b);
        return;
      }
      reject(new Error("Failed to encode mask PNG."));
    }, "image/png");
  });

  return blobToRawBase64(pngBlob);
}
