import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import { createEvaluateMayoController } from "../controllers/evaluateMayoController.js";
import { isHttpError } from "../errors/httpErrors.js";
import { createEvaluateMayoRoute } from "../routes/evaluateMayoRoute.js";
import { createEvaluateMayoUseCase } from "../services/evaluateMayoUseCase.js";
import { createGeminiService } from "../services/geminiService.js";
import { createHuggingFaceImageService } from "../services/huggingFaceImageService.js";

function splitOrigins(frontendOrigin) {
  return frontendOrigin.split(",").map((value) => value.trim());
}

export function createApp({
  env,
  geminiVisionService = createGeminiService(env),
  imageGenerationService = createHuggingFaceImageService(env),
  rateLimitMax = 15
}) {
  const app = express();

  app.use(express.json({ limit: "10mb" }));

  app.use(
    cors({
      origin(origin, callback) {
        const allowlist = splitOrigins(env.frontendOrigin);
        if (!origin || allowlist.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error("CORS blocked by allowlist"));
      }
    })
  );

  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: rateLimitMax,
      standardHeaders: true,
      legacyHeaders: false
    })
  );

  const evaluateMayoUseCase = createEvaluateMayoUseCase({
    geminiVisionService,
    imageGenerationService
  });
  const evaluateMayoController = createEvaluateMayoController({
    evaluateMayoUseCase
  });
  const evaluateMayoRoute = createEvaluateMayoRoute({ evaluateMayoController });

  app.get("/health", (_, res) => {
    res.json({
      status: "ok",
      service: "condimental-backend"
    });
  });

  app.use("/api", evaluateMayoRoute);

  app.use((error, _req, res, _next) => {
    if (error?.type === "entity.too.large") {
      return res.status(413).json({
        message: "Payload exceeds the 10mb limit."
      });
    }

    if (isHttpError(error)) {
      return res.status(error.statusCode).json({
        message: error.publicMessage,
        code: error.code
      });
    }

    res.status(500).json({
      message: "Unhandled application error."
    });
  });

  return app;
}
