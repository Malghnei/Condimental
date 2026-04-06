import { useMemo, useRef, useState } from "react";
import Webcam from "react-webcam";
import { evaluateMayoImage, type EvaluateMayoResponse } from "./api";
import "./App.css";

type UiState =
  | "idle"
  | "capturing"
  | "analyzing_vision"
  | "generating_mayo"
  | "result";

function App() {
  const webcamRef = useRef<Webcam | null>(null);
  const [hasConsent, setHasConsent] = useState(false);
  const [uiState, setUiState] = useState<UiState>("idle");
  const [result, setResult] = useState<EvaluateMayoResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capturedFrame, setCapturedFrame] = useState<string | null>(null);

  const busy = uiState === "capturing" || uiState === "analyzing_vision" || uiState === "generating_mayo";

  const statusLabel = useMemo(() => {
    if (uiState === "analyzing_vision") {
      return "Analyzing culinary potential...";
    }
    if (uiState === "generating_mayo") {
      return "Applying digital mayonnaise...";
    }
    return null;
  }, [uiState]);

  async function handleSnap() {
    setError(null);
    setResult(null);
    setUiState("capturing");

    const screenshot = webcamRef.current?.getScreenshot();
    if (!screenshot) {
      setError("Failed to capture a frame from the webcam.");
      setUiState("idle");
      return;
    }

    setCapturedFrame(screenshot);
    setUiState("analyzing_vision");

    let markGenerating = true;
    const timer = window.setTimeout(() => {
      if (markGenerating) {
        setUiState("generating_mayo");
      }
    }, 700);

    try {
      const response = await evaluateMayoImage(screenshot);
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

  function resetFlow() {
    setCapturedFrame(null);
    setResult(null);
    setError(null);
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
            {uiState === "result" && capturedFrame ? (
              <img src={capturedFrame} alt="Captured frame" />
            ) : (
              <Webcam
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode: "environment" }}
              />
            )}
          </div>
          <div className="actions">
            <button onClick={handleSnap} disabled={busy}>
              {busy ? "Processing..." : "Snap"}
            </button>
            <button onClick={resetFlow} disabled={busy}>
              Reset
            </button>
          </div>
          {statusLabel && <p className="status">{statusLabel}</p>}
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
