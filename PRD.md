# Product Requirements Document (PRD)

# & System Architecture

## 1. Objective & Scope

Build an interactive web application that captures user webcam imagery, executes culinary
analysis via a multimodal Vision AI, and dynamically augments the image by digitally rendering
a photorealistic dollop of mayonnaise onto the primary subject using Generative AI inpainting.

## 2. Tech Stack

```
● Frontend: React.js, react-webcam
● Backend: Node.js, Express.js
● Image Processing: sharp (via libvips) for high-speed, server-side masking 1
● AI Services:
○ Multimodal Vision API (e.g., GPT-4o or Gemini).
○ Generative Image API (e.g., OpenAI gpt-image-1.5 responses or edit endpoint).^2
```
## 3. Frontend Architecture (React.js)

### 3.1 Component Breakdown

```
● Camera Component: Mounts the live video feed using the react-webcam library. Uses
the getScreenshot() method to synchronously capture the current frame as a
Base64-encoded string.^4
● Result View: A Flexbox/Grid comparative view. Parses the aggregated backend JSON to
display the original image alongside the augmented image, the textual AI review, and the
numeric mayo_score.
```
### 3.2 State Management

The UI strictly follows a deterministic state machine to prevent race conditions during
asynchronous AI processing:
**State Description UI Element**
idle Waiting for user input. Live feed, interactive "Snap"
button.
capturing Transient capture phase. Frozen frame, disabled "Snap"
button.
analyzing_vision Awaiting Vision API. Loading indicator ("Analyzing
culinary potential...").
generating_mayo Awaiting Generative API. Loading indicator ("Applying
digital mayonnaise...").


```
result Transaction complete. Side-by-side images, review
text, reset button.
```
## 4. Backend Architecture (Node.js & Express)

### 4.1 API Gateway & Boundaries

```
● Architecture Pattern: Utilize Clean Architecture principles, ensuring strict separation of
concerns between routing, controllers, and core AI orchestration use cases.
● Primary Endpoint: POST /api/evaluate-mayo
● Middleware Defensive Configuration:
○ Payload Limit: Base64 encoding inflates binary size by ~33%.^6 Enforce
express.json({ limit: '10mb' }) to prevent heap memory exhaustion and
Out-Of-Memory (OOM) crashes.
○ CORS: Strictly whitelist the specific frontend origin (e.g., http://localhost:5173) to
prevent unauthorized cross-origin leeching.
○ Rate Limiting: Implement express-rate-limit to restrict per-IP frequency, mitigating
DDoS vectors and AI API credit drain.
```
### 4.2 Data Flow & AI Orchestration (Saga Pattern)

The orchestration relies on sequential dependencies. If the Vision step fails, the pipeline halts; if
Generative fails, it degrades gracefully to return partial textual results.^7

1. **Vision Prompting:** The backend submits the Base64 image to the Vision model. The
    prompt explicitly enforces a JSON schema output containing: identified_object,
    mayo_score, review, and normalized bounding box coordinates.
2. **Coordinate Descaling:** Convert the returned normalized bounding box percentages into
    absolute pixels:
    $$x_{absolute}=x_{normalized}\times Width$$
    $$y_{absolute}=y_{normalized}\times Height$$
3. **Algorithmic Mask Generation:** Utilize sharp to dynamically generate a transparency
    mask.^1 Create a blank 4-channel (RGBA) canvas, define an overlay shape using the
    absolute bounding box coordinates, and apply the dest-out composite blend mode to
    punch a transparent "hole" perfectly aligned over the subject.^8
4. **Generative Inpainting:** Submit the original image buffer, the sharp-generated transparent
    mask buffer, and the text prompt ("Add a large, realistic, and shiny dollop of mayonnaise
    directly on top of the main subject of this image") to the generative endpoint.
5. **Aggregation:** Bundle the returned generative image data (URL or Base64) and the Vision
    JSON data into a unified HTTP 200 OK response payload.

## 5. Security & Compliance

```
● Credential Protection: API keys must never touch the React code. They must be
```

```
sequestered exclusively in a .env file on the Node.js server and accessed via
process.env.
● Privacy Law Compliance (PIPEDA):
○ Consent: Because webcam captures of human faces qualify as biometric data
under PIPEDA, the React frontend must implement an explicit, meaningful consent
dialogue prior to initiating the camera.^9
○ Ephemeral Storage (Data Minimization): To strictly adhere to PIPEDA's data
retention limitations, the backend must process all image buffers entirely in RAM.^11
Absolutely no user images or intermediate masks may be written to disk or
persistent databases.
```
#### Works cited

#### 1. High performance Node.js image processing | sharp, accessed March 28, 2026,

#### https://sharp.pixelplumbing.com/

#### 2. Image generation | OpenAI API, accessed March 28, 2026,

#### https://developers.openai.com/api/docs/guides/image-generation

#### 3. Azure OpenAI image generation models - Microsoft Learn, accessed March 28,

#### 2026, https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/dall-e

#### 4. Thank You Cloudinary!. A Beginner's Guide to React Webcam and... | by Rachel

#### Lum | Medium, accessed March 28, 2026,

#### https://medium.com/@lumrachele/thank-you-cloudinary-22b25aca65a

#### 5. A quick and dirty primer on using react-webcam | by Razibul Ahmed | Medium,

#### accessed March 28, 2026,

#### https://medium.com/@razibul.ahmed/a-quick-and-dirty-primer-on-using-react-web

#### cam-d3e65faa1a

#### 6. Issue with base64 encoded image with OpenAI API, gpt4o model - Reddit,

#### accessed March 28, 2026,

#### https://www.reddit.com/r/OpenAI/comments/1ec6coo/issue_with_base64_encoded

#### _image_with_openai_api/

#### 7. Designing an Effective API Orchestration Layer - API7.ai, accessed March 28,

#### 2026, https://api7.ai/blog/designing-an-effective-api-orchestration-layer

#### 8. Compositing images | sharp, accessed March 28, 2026,

#### https://sharp.pixelplumbing.com/api-composite

#### 9. Guidance for processing biometrics – for federal institutions - Office of the Privacy

#### Commissioner of Canada, accessed March 28, 2026,

#### https://www.priv.gc.ca/en/privacy-topics/health-genetic-and-other-body-information

#### /biometrics/gd_bio_fed-final/

#### 10. PIPEDA fair information principles - Office of the Privacy Commissioner of

#### Canada, accessed March 28, 2026,

#### https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-infor

#### mation-protection-and-electronic-documents-act-pipeda/p_principle/

#### 11. Understanding PIPEDA | Compliance Requirements, Scope, and Enforcement in

#### Canada, accessed March 28, 2026, https://secureprivacy.ai/blog/what-is-pipeda


