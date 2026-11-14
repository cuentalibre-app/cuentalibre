import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import "./index.css";
import "@/lib/appearance";
import { router } from "@/app/router";
import { startSession } from "@/features/auth/session";

// The app never zooms on a phone, as a native app wouldn't. The viewport forbids it (index.html), and
// Safari, which ignores that for a pinch, has the gesture cancelled here; it fires only on iOS and macOS.
for (const type of ["gesturestart", "gesturechange"]) {
  document.addEventListener(type, (event) => event.preventDefault(), { passive: false });
}

// Signed in, the app runs on the API; in the demo, or without VITE_API_URL, on the sample data in memory.
// `VITE_API_URL=/` means the API serves the app from its own origin.
await startSession();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
