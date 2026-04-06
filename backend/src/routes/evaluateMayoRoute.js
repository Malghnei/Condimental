import { Router } from "express";

export function createEvaluateMayoRoute({ evaluateMayoController }) {
  const router = Router();

  router.post("/evaluate-mayo", evaluateMayoController);

  return router;
}
