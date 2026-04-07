import sharp from "sharp";

const formatToMime = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif"
};
const supportedMimeTypes = new Set(Object.values(formatToMime));

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

export function getMimeTypeFromDataUrl(base64OrDataUrl) {
  const match = base64OrDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
  if (!match) {
    return null;
  }
  return match[1].toLowerCase();
}

export async function inferImageMimeType(imageBuffer) {
  const metadata = await sharp(imageBuffer).metadata();
  const mimeType = formatToMime[metadata.format];
  if (!mimeType) {
    throw new Error("Unsupported image format.");
  }
  return mimeType;
}

export async function resolveImageMimeType({ rawInput, imageBuffer }) {
  const dataUrlMimeType = getMimeTypeFromDataUrl(rawInput);
  if (dataUrlMimeType) {
    if (dataUrlMimeType === "image/jpg") {
      return "image/jpeg";
    }
    if (supportedMimeTypes.has(dataUrlMimeType)) {
      return dataUrlMimeType;
    }
    throw new Error("Unsupported image MIME type.");
  }
  return inferImageMimeType(imageBuffer);
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
