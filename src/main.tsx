import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { AppProvider } from "./store";
import { App } from "./components/App";
import { initCloud } from "./services/cloud";
import { initAdmin } from "./services/admin";
import { initTeams } from "./services/teams";
import { initTheme } from "./services/theme";

/* apply the saved theme before first paint to avoid a flash */
initTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>
);

/* Register the offline service worker in production builds only. In dev, the
   SW's cache-first asset strategy would serve stale transformed modules and
   mask every edit — HMR already handles dev reloads. */
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => { /* offline not critical */ });
  });
}

/* restore a saved cloud session and start syncing (no-op until Supabase is configured) */
void initCloud().then(() => { initAdmin(); initTeams(); });
