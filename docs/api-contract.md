# API Contract

## `POST /api/evaluate-mayo`

Request body:

```json
{
  "imageBase64": "base64-data-or-data-url",
  "maskBase64": "optional-raw-base64-png-same-dimensions-as-image"
}
```

`maskBase64` is optional. When omitted, the server builds a mask from the vision bounding box. When provided (for example from in-browser background removal), it must be a PNG whose width and height match the decoded source image.

Successful response:

```json
{
  "status": "complete",
  "originalImageBase64": "<base64>",
  "augmentedImageBase64": "<base64>",
  "vision": {
    "identified_object": "burger",
    "mayo_score": 88,
    "review": "Great mayo candidate.",
    "bounding_box": {
      "x": 0.1,
      "y": 0.1,
      "width": 0.6,
      "height": 0.6
    }
  },
  "warning": null
}
```

Partial response when generation fails:

```json
{
  "status": "partial",
  "originalImageBase64": "<base64>",
  "augmentedImageBase64": null,
  "vision": {
    "identified_object": "burger",
    "mayo_score": 88,
    "review": "Great mayo candidate.",
    "bounding_box": {
      "x": 0.1,
      "y": 0.1,
      "width": 0.6,
      "height": 0.6
    }
  },
  "warning": "Image generation failed after successful vision analysis."
}
```

Image generation uses Cloudflare Workers AI inpainting (`@cf/runwayml/stable-diffusion-v1-5-inpainting` by default). The server builds a mask PNG from the vision bounding box and sends it with the source image and a fixed mayonnaise prompt.

Error responses:

- `400` invalid request schema
- `413` payload too large (`express.json` limit 10mb)
- `429` rate limit exceeded
- `502` vision provider failure
- `500` unexpected server error
