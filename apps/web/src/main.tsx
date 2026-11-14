import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import "./index.css";
import "@/lib/appearance";
import { router } from "@/app/router";
import { startSession } from "@/features/auth/session";

// iOS zooms into any field with text under 16px as it takes the focus, and ours are 14px. A maximum
// scale stops that zoom; iOS still lets people pinch to zoom, unlike Android, which never needed it.
// iPads report themselves as a Mac, told apart by their touch screen.
if (
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
) {
  document
    .querySelector('meta[name="viewport"]')
    ?.setAttribute("content", "width=device-width, initial-scale=1.0, maximum-scale=1.0");
}

// Signed in, the app runs on the API; in the demo, or without VITE_API_URL, on the sample data in memory.
// `VITE_API_URL=/` means the API serves the app from its own origin.
await startSession();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
