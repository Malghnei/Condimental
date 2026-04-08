import dotenv from "dotenv";

dotenv.config();

const required = ["GEMINI_API_KEY", "CF_ACCOUNT_ID", "CF_API_TOKEN"];

export function getEnv() {
  const missing = required.filter((key) => !process.env[key]);
  const cfImg2ImgStrength = Number(process.env.CF_IMG2IMG_STRENGTH ?? 0.5);
  const cfImg2ImgGuidance = Number(process.env.CF_IMG2IMG_GUIDANCE ?? 7.5);

  return {
    nodeEnv: process.env.NODE_ENV ?? "development",
    port: Number(process.env.PORT ?? 3001),
    frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
    geminiApiKey: process.env.GEMINI_API_KEY ?? "",
    geminiVisionModel: process.env.GEMINI_VISION_MODEL ?? "gemini-2.5-flash",
    cfAccountId: process.env.CF_ACCOUNT_ID ?? "",
    cfApiToken: process.env.CF_API_TOKEN ?? "",
    cfImageModel:
      process.env.CF_IMAGE_MODEL ?? "@cf/runwayml/stable-diffusion-v1-5-img2img",
    cfImg2ImgStrength: Number.isFinite(cfImg2ImgStrength) ? cfImg2ImgStrength : 0.5,
    cfImg2ImgGuidance: Number.isFinite(cfImg2ImgGuidance) ? cfImg2ImgGuidance : 7.5,
    hasMissingRequired: missing.length > 0,
    missingRequired: missing
  };
}
