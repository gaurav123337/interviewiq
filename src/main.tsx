import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { AppProvider } from "./store";
import { App } from "./components/App";
import { initCloud } from "./services/cloud";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => { /* offline not critical */ });
  });
}

/* restore a saved cloud session and start syncing (no-op until Supabase is configured) */
void initCloud();
