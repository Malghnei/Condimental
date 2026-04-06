import { ZodError } from "zod";
import {
  evaluateRequestSchema,
  evaluateResponseSchema
} from "../domain/schemas.js";

export function createEvaluateMayoController({ evaluateMayoUseCase }) {
  return async function evaluateMayoController(req, res) {
    try {
      const input = evaluateRequestSchema.parse(req.body);
      const output = await evaluateMayoUseCase(input);
      const validatedOutput = evaluateResponseSchema.parse(output);
      return res.status(200).json(validatedOutput);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          message: "Invalid request or response schema.",
          issues: error.issues
        });
      }

      if (error instanceof Error && error.message.includes("Vision API failed")) {
        return res.status(502).json({
          message: "Vision analysis failed.",
          details: error.message
        });
      }

      return res.status(500).json({
        message: "Unexpected backend error.",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };
}
