import dotenv from "dotenv";

dotenv.config();

const required = ["GEMINI_API_KEY", "HF_API_KEY"];

export function getEnv() {
  const missing = required.filter((key) => !process.env[key]);

  return {
    nodeEnv: process.env.NODE_ENV ?? "development",
    port: Number(process.env.PORT ?? 3001),
    frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
    geminiApiKey: process.env.GEMINI_API_KEY ?? "",
    geminiVisionModel: process.env.GEMINI_VISION_MODEL ?? "gemini-2.5-flash",
    hfApiKey: process.env.HF_API_KEY ?? "",
    hfImageModel:
      process.env.HF_IMAGE_MODEL ?? "timbrooks/instruct-pix2pix",
    hasMissingRequired: missing.length > 0,
    missingRequired: missing
  };
}
