import sharp from "sharp";

export function stripDataUrlPrefix(base64OrDataUrl) {
  const marker = "base64,";
  const index = base64OrDataUrl.indexOf(marker);
  if (index === -1) {
    return base64OrDataUrl;
  }
  return base64OrDataUrl.slice(index + marker.length);
}

export function decodeBase64Image(base64OrDataUrl) {
  return Buffer.from(stripDataUrlPrefix(base64OrDataUrl), "base64");
}

export async function getImageDimensions(imageBuffer) {
  const metadata = await sharp(imageBuffer).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error("Unable to read image dimensions.");
  }
  return { width: metadata.width, height: metadata.height };
}

export function normalizedToAbsoluteBox(normalizedBox, dimensions) {
  const x = Math.max(0, Math.floor(normalizedBox.x * dimensions.width));
  const y = Math.max(0, Math.floor(normalizedBox.y * dimensions.height));
  const width = Math.max(1, Math.floor(normalizedBox.width * dimensions.width));
  const height = Math.max(
    1,
    Math.floor(normalizedBox.height * dimensions.height)
  );

  return {
    x: Math.min(x, dimensions.width - 1),
    y: Math.min(y, dimensions.height - 1),
    width: Math.min(width, dimensions.width),
    height: Math.min(height, dimensions.height)
  };
}
