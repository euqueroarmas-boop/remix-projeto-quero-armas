import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { installGlobalErrorHandlers } from "@/lib/errorLogger";
import { attemptChunkReload, clearChunkReloadFlag } from "@/lib/lazyRetry";

installGlobalErrorHandlers();
clearChunkReloadFlag();

// Vite emits 'vite:preloadError' when a dynamic import preload fails (stale
// chunk on Safari after deploy). Retry with cache-busted reloads, capped.
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  attemptChunkReload("vite-preload-error", undefined, (event as any).payload);
});

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
