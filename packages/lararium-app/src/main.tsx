import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";

// Register service worker for engine script integrity verification.
// SW intercepts tiddlywikicore-*.js fetches and verifies sha256 against the
// catalog engine entry posted by lararium-browser-host after catalog sync.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((e) => {
    console.warn("[lararium] SW registration failed (non-fatal):", e);
  });
}

const root = document.getElementById("root");
if (!root) throw new Error("No #root element found");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
