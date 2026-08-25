import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider as ReduxProvider } from "react-redux";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n";
import "./index.css";
import { AppProvider } from "./store";
import { store } from "./store/index";
import { App } from "./components/App";
import { initCloud } from "./services/cloud";
import { initAdmin } from "./services/admin";
import { initTeams } from "./services/teams";
import { initTheme } from "./services/theme";

/* apply the saved theme before first paint to avoid a flash */
initTheme();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <ReduxProvider store={store}>
        <QueryClientProvider client={queryClient}>
          <AppProvider>
            <App />
          </AppProvider>
        </QueryClientProvider>
      </ReduxProvider>
    </I18nextProvider>
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
