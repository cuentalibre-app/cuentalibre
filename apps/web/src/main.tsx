import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import "./index.css";
import { router } from "@/app/router";
import { connectApi } from "@/data/api";

// Without VITE_API_URL the app runs on the sample data, in memory.
const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
if (apiUrl) await connectApi(apiUrl);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
