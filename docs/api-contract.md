# API Contract

## `POST /api/evaluate-mayo`

Request body:

```json
{
  "imageBase64": "base64-data-or-data-url"
}
```

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
  "warning": "Image API failed ..."
}
```

Error responses:

- `400` invalid request schema
- `413` payload too large (`express.json` limit 10mb)
- `429` rate limit exceeded
- `502` vision provider failure
- `500` unexpected server error
