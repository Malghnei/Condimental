import { ZodError } from "zod";
import {
  evaluateRequestSchema,
  evaluateResponseSchema
} from "../domain/schemas.js";
import { isHttpError } from "../errors/httpErrors.js";

export function createEvaluateMayoController({ evaluateMayoUseCase }) {
  return async function evaluateMayoController(req, res) {
    let input;
    try {
      input = evaluateRequestSchema.parse(req.body);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          message: "Invalid request schema.",
          issues: error.issues
        });
      }
      return res.status(500).json({
        message: "Unexpected backend error."
      });
    }

    let output;
    try {
      output = await evaluateMayoUseCase(input);
    } catch (error) {
      if (isHttpError(error)) {
        return res.status(error.statusCode).json({
          message: error.publicMessage,
          code: error.code
        });
      }
      return res.status(500).json({
        message: "Unexpected backend error."
      });
    }

    try {
      const validatedOutput = evaluateResponseSchema.parse(output);
      return res.status(200).json(validatedOutput);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(500).json({
          message: "Internal response validation failed.",
          code: "RESPONSE_SCHEMA_INVALID"
        });
      }
      return res.status(500).json({
        message: "Unexpected backend error."
      });
    }
  };
}
