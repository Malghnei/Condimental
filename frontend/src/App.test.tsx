import { render, screen, waitFor } from "@testing-library/react";
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

    await userEvent.click(screen.getByRole("button", { name: /i consent/i }));
    expect(screen.getByTestId("webcam-mock")).toBeInTheDocument();
  });

  it("shows result after successful snap flow", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => successfulPayload
      })
    );

    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: /i consent/i }));
    await userEvent.click(screen.getByRole("button", { name: "Snap" }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Result" })).toBeInTheDocument()
    );
    expect(screen.getByText(/90\/100/i)).toBeInTheDocument();
  });
});
