import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("react-webcam", async () => {
  const React = await import("react");

  return {
    default: React.forwardRef((_props, ref) => {
      React.useImperativeHandle(ref, () => ({
        getScreenshot: () =>
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB"
      }));
      return <div data-testid="webcam-mock">webcam</div>;
    })
  };
});

vi.mock("./subjectMask", () => ({
  createSubjectMaskBase64: vi.fn().mockResolvedValue(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X5QAAAABJRU5ErkJggg=="
  )
}));

const successfulPayload = {
  status: "complete",
  originalImageBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB",
  augmentedImageBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB",
  vision: {
    identified_object: "burger",
    mayo_score: 90,
    review: "Looks excellent for mayo.",
    bounding_box: { x: 0.1, y: 0.2, width: 0.4, height: 0.4 }
  },
  warning: null
};

describe("App", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("requires explicit consent before showing camera", async () => {
    render(<App />);

    expect(screen.getByText(/Camera & biometric consent/i)).toBeInTheDocument();
    expect(screen.queryByTestId("webcam-mock")).not.toBeInTheDocument();
    expect(screen.queryByTestId("upload-dropzone")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /i consent/i }));
    expect(screen.getByTestId("webcam-mock")).toBeInTheDocument();
    expect(screen.getByTestId("upload-dropzone")).toBeInTheDocument();
  });

  it("shows result after successful snap flow", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => successfulPayload
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: /i consent/i }));
    await userEvent.click(screen.getByRole("button", { name: "Snap" }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Result" })).toBeInTheDocument()
    );
    expect(screen.getByText(/90\/100/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uploads a valid local photo and waits for confirmation before sending", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => successfulPayload
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: /i consent/i }));

    const input = screen.getByLabelText(/upload photo/i);
    const file = new File(["photo"], "plate.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() =>
      expect(screen.getByText(/Use this photo for analysis\?/i)).toBeInTheDocument()
    );
    expect(fetchMock).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /Use This Photo/i }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Result" })).toBeInTheDocument()
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects unsupported upload types", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: /i consent/i }));

    const input = screen.getByLabelText(/upload photo/i);
    const file = new File(["not-image"], "notes.txt", { type: "text/plain" });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() =>
      expect(
        screen.getByText(/Unsupported file type\. Use JPG, PNG, or WebP\./i)
      ).toBeInTheDocument()
    );
  });

  it("rejects files larger than 5 MB", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: /i consent/i }));

    const input = screen.getByLabelText(/upload photo/i);
    const file = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.jpg", {
      type: "image/jpeg"
    });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() =>
      expect(screen.getByText(/File is too large\. Maximum size is 5 MB\./i)).toBeInTheDocument()
    );
  });

  it("can cancel a pending uploaded photo without calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: /i consent/i }));

    const input = screen.getByLabelText(/upload photo/i);
    const file = new File(["photo"], "plate.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() =>
      expect(screen.getByText(/Use this photo for analysis\?/i)).toBeInTheDocument()
    );
    await userEvent.click(screen.getByRole("button", { name: /Cancel Photo/i }));

    expect(screen.queryByText(/Use this photo for analysis\?/i)).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
