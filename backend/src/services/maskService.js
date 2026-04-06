import sharp from "sharp";

function svgHole({ width, height, box }) {
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const radiusX = Math.max(1, box.width / 2);
  const radiusY = Math.max(1, box.height / 2);

  return `
  <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${width}" height="${height}" fill="white"/>
    <ellipse cx="${centerX}" cy="${centerY}" rx="${radiusX}" ry="${radiusY}" fill="black"/>
  </svg>`;
}

export async function buildInpaintMask({ width, height, box }) {
  const maskSvg = svgHole({ width, height, box });

  const buffer = await sharp(Buffer.from(maskSvg))
    .png()
    .toBuffer();

  return buffer;
}
