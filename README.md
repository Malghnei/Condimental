# Condimental

Condiments meet AI.

Condimental is a webcam-based demo app that:

- captures a frame in a React frontend,
- runs Gemini Vision analysis for object + mayo score + review + bounding box,
- generates a mask in memory with `sharp`,
- requests Cloudflare Workers AI inpainting (`@cf/runwayml/stable-diffusion-v1-5-inpainting`) for mayonnaise-style editing,
- returns side-by-side original and augmented results.

## Project Structure

- `frontend/` React + Vite + `react-webcam`
- `backend/` Express + clean-ish routing/controller/use-case/services layers
- `docs/api-contract.md` API request/response contract
- `PRD.md` project requirements

## Requirements

- Node.js 20+
- npm 10+
- Gemini API key (vision)
- Cloudflare account + Workers AI API token (image generation)

## Environment Variables

Create `backend/.env`:

```bash
PORT=3001
FRONTEND_ORIGIN=http://localhost:5173
GEMINI_API_KEY=your_gemini_key_here
GEMINI_VISION_MODEL=gemini-2.5-flash
CF_ACCOUNT_ID=your_cloudflare_account_id
CF_API_TOKEN=your_cloudflare_api_token

# Optional image-generation tuning
CF_IMAGE_MODEL=@cf/runwayml/stable-diffusion-v1-5-inpainting
CF_IMG2IMG_STRENGTH=0.5
CF_IMG2IMG_GUIDANCE=7.5
```

The frontend uses `@imgly/background-removal` to build an inpainting mask in the browser (with a server-side fallback to the vision bounding-box mask if that step fails).

Optional for frontend (`frontend/.env`):

```bash
VITE_API_BASE_URL=http://localhost:3001
```

## Install

```bash
npm install
```

## Run Locally

In one terminal:

```bash
npm run dev:backend
```

In a second terminal:

```bash
npm run dev:frontend
```

Frontend: <http://localhost:5173>  
Backend health: <http://localhost:3001/health>

## Scripts

From repo root:

- `npm run dev:frontend` start Vite frontend
- `npm run dev:backend` start Express backend with watch mode
- `npm run test --workspaces` run frontend + backend tests
- `npm run build --workspaces` build frontend (backend build is no-op)
- `npm run lint --workspaces` run workspace lint placeholders

## API Contract

### `POST /api/evaluate-mayo`

Request body:

```json
{
  "imageBase64": "data:image/jpeg;base64,...",
  "maskBase64": "optional raw base64 PNG (same size as image; from client-side segmentation)"
}
```

Response body (`status: complete | partial`):

```json
{
  "status": "complete",
  "originalImageBase64": "<base64>",
  "augmentedImageBase64": "<base64-or-null>",
  "vision": {
    "identified_object": "burger",
    "mayo_score": 88,
    "review": "Great mayo candidate.",
    "bounding_box": { "x": 0.1, "y": 0.1, "width": 0.6, "height": 0.6 }
  },
  "warning": null
}
```

## Privacy and Security Notes

- API keys are server-side only (`backend/.env`).
- Backend enforces `express.json({ limit: "10mb" })`.
- CORS allowlist is controlled by `FRONTEND_ORIGIN`.
- Rate limiting is enabled (`express-rate-limit`).
- Image handling is in-memory only: no writes to disk for user frames/masks.
- Frontend requires explicit consent before showing camera feed.

## Validation Checklist (Implemented)

- Backend tests:
  - success flow
  - vision failure
  - generation failure (partial response)
  - oversized payload (`413`)
  - rate limiting (`429`)
- Frontend tests:
  - consent gate required before webcam
  - successful snap shows result

## Troubleshooting

- **`Vision analysis failed.`**  
  Verify `GEMINI_API_KEY` and `GEMINI_VISION_MODEL` in `backend/.env`.

- **`Image generation failed` / partial result with no augmented image**  
  Verify `CF_ACCOUNT_ID` and `CF_API_TOKEN`, then check access to Workers AI and model path in `CF_IMAGE_MODEL` (default `@cf/runwayml/stable-diffusion-v1-5-inpainting`).

- **CORS errors in browser console**  
  Confirm `FRONTEND_ORIGIN` exactly matches your frontend origin.

- **Payload too large (`413`)**  
  Use default webcam quality and avoid manually huge data URLs.

- **No generated image but text result appears**  
  This is graceful degradation when generation fails; inspect backend logs and model availability.
