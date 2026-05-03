import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";

// Deregister any previously installed SW — web3 blob path needs no SW.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister());
  });
}


const root = document.getElementById("root");
if (!root) throw new Error("No #root element found");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
