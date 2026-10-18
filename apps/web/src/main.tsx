import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import "./index.css";
import { router } from "@/app/router";
import { startSession } from "@/features/auth/session";

// Signed in, the app runs on the API; in the demo, or without VITE_API_URL, on the sample data in memory.
await startSession();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
