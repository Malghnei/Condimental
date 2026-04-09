import { type ChangeEvent, type DragEvent, useMemo, useRef, useState } from "react";
import Webcam from "react-webcam";
import { evaluateMayoImage, type EvaluateMayoResponse } from "./api";
import { createSubjectMaskBase64 } from "./subjectMask";
import "./App.css";

type UiState =
  | "idle"
  | "capturing"
  | "segmenting_subject"
  | "analyzing_vision"
  | "generating_mayo"
  | "result";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_UPLOAD_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function App() {
  const webcamRef = useRef<Webcam | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [hasConsent, setHasConsent] = useState(false);
  const [uiState, setUiState] = useState<UiState>("idle");
  const [result, setResult] = useState<EvaluateMayoResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [capturedFrame, setCapturedFrame] = useState<string | null>(null);
  const [pendingUpload, setPendingUpload] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const busy =
    uiState === "capturing" ||
    uiState === "segmenting_subject" ||
    uiState === "analyzing_vision" ||
    uiState === "generating_mayo";
  const displayImage = pendingUpload ?? (uiState === "result" ? capturedFrame : null);

  const statusLabel = useMemo(() => {
    if (uiState === "segmenting_subject") {
      return "Removing background & building mask...";
    }
    if (uiState === "analyzing_vision") {
      return "Analyzing culinary potential...";
    }
    if (uiState === "generating_mayo") {
      return "Applying digital mayonnaise...";
    }
    return null;
  }, [uiState]);

  async function analyzeImage(imageDataUrl: string) {
    setError(null);
    setResult(null);
    setUiState("capturing");
    setCapturedFrame(imageDataUrl);
    setPendingUpload(null);
    setUiState("segmenting_subject");

    let maskBase64: string | undefined;
    try {
      maskBase64 = await createSubjectMaskBase64(imageDataUrl);
    } catch (segmentError) {
      console.warn(
        "Background removal failed; server will fall back to vision bbox mask.",
        segmentError
      );
    }

    setUiState("analyzing_vision");

    let markGenerating = true;
    const timer = window.setTimeout(() => {
      if (markGenerating) {
        setUiState("generating_mayo");
      }
    }, 700);

    try {
      const response = await evaluateMayoImage(imageDataUrl, {
        maskBase64
      });
      setResult(response);
      setUiState("result");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unexpected request error."
      );
      setUiState("idle");
    } finally {
      markGenerating = false;
      window.clearTimeout(timer);
    }
  }

  async function handleSnap() {
    const screenshot = webcamRef.current?.getScreenshot();
    if (!screenshot) {
      setError("Failed to capture a frame from the webcam.");
      setUiState("idle");
      return;
    }
    await analyzeImage(screenshot);
  }

  function validateUploadFile(file: File): string | null {
    if (!ALLOWED_UPLOAD_TYPES.has(file.type)) {
      return "Unsupported file type. Use JPG, PNG, or WebP.";
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return "File is too large. Maximum size is 5 MB.";
    }

    return null;
  }

  function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
          return;
        }
        reject(new Error("Unable to read file."));
      };
      reader.onerror = () => reject(new Error("Unable to read file."));
      reader.readAsDataURL(file);
    });
  }

  async function prepareUpload(file: File) {
    setError(null);
    setUploadError(null);

    const validationError = validateUploadFile(file);
    if (validationError) {
      setUploadError(validationError);
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setPendingUpload(dataUrl);
      setResult(null);
      setUiState("idle");
    } catch {
      setUploadError("Failed to read this file.");
    }
  }

  async function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    await prepareUpload(file);
    event.target.value = "";
  }

  async function confirmUpload() {
    if (!pendingUpload) {
      return;
    }
    await analyzeImage(pendingUpload);
  }

  function cancelUpload() {
    setPendingUpload(null);
    setUploadError(null);
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!busy) {
      setIsDragActive(true);
    }
  }

  function onDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragActive(false);
  }

  async function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragActive(false);
    if (busy) {
      return;
    }

    const file = event.dataTransfer.files?.[0];
    if (!file) {
      setUploadError("No file found in drop payload.");
      return;
    }
    await prepareUpload(file);
  }

  function resetFlow() {
    setCapturedFrame(null);
    setPendingUpload(null);
    setResult(null);
    setError(null);
    setUploadError(null);
    setUiState("idle");
  }

  return (
    <main className="app">
      <header className="header">
        <h1>Condimental</h1>
        <p>Capture a dish and see if it deserves premium mayonnaise.</p>
      </header>

      {!hasConsent && (
        <section className="card consent">
          <h2>Camera & biometric consent</h2>
          <p>
            This app uses your webcam image for one-time AI processing only. No
            image files are stored on disk.
          </p>
          <button onClick={() => setHasConsent(true)}>I consent and continue</button>
        </section>
      )}

      {hasConsent && (
        <section className="card">
          <h2>Live camera</h2>
          <div className="cameraFrame">
            {displayImage ? (
              <img src={displayImage} alt="Captured frame" />
            ) : (
              <Webcam
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode: "environment" }}
              />
            )}
          </div>
          <div
            className={`dropzone ${isDragActive ? "active" : ""}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            data-testid="upload-dropzone"
          >
            <p>Drag and drop a local photo here, or choose a file.</p>
            <button type="button" onClick={openFilePicker} disabled={busy}>
              Choose Photo
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileInputChange}
              className="hiddenInput"
              aria-label="Upload photo"
            />
          </div>

          {pendingUpload && (
            <div className="uploadConfirm">
              <p>Use this photo for analysis?</p>
              <div className="actions">
                <button type="button" onClick={confirmUpload} disabled={busy}>
                  Use This Photo
                </button>
                <button type="button" onClick={cancelUpload} disabled={busy}>
                  Cancel Photo
                </button>
              </div>
            </div>
          )}

          <div className="actions">
            <button onClick={handleSnap} disabled={busy || Boolean(pendingUpload)}>
              {busy ? "Processing..." : "Snap"}
            </button>
            <button onClick={resetFlow} disabled={busy}>
              Reset
            </button>
          </div>
          {statusLabel && <p className="status">{statusLabel}</p>}
          {uploadError && <p className="error">{uploadError}</p>}
          {error && <p className="error">{error}</p>}
        </section>
      )}

      {result && (
        <section className="card result">
          <h2>Result</h2>
          <div className="comparison">
            <figure>
              <figcaption>Original</figcaption>
              <img
                src={`data:image/png;base64,${result.originalImageBase64}`}
                alt="Original submission"
              />
            </figure>
            <figure>
              <figcaption>Augmented</figcaption>
              {result.augmentedImageBase64 ? (
                <img
                  src={`data:image/png;base64,${result.augmentedImageBase64}`}
                  alt="Mayonnaise-augmented"
                />
              ) : (
                <div className="placeholder">Generation unavailable</div>
              )}
            </figure>
          </div>
          <div className="review">
            <p>
              <strong>Object:</strong> {result.vision.identified_object}
            </p>
            <p>
              <strong>Mayo score:</strong> {result.vision.mayo_score}/100
            </p>
            <p>
              <strong>Review:</strong> {result.vision.review}
            </p>
            {result.warning && (
              <p className="warning">
                <strong>Warning:</strong> {result.warning}
              </p>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

export default App;
