import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { installGlobalErrorHandlers } from "@/lib/errorLogger";
import { clearChunkReloadFlag } from "@/lib/lazyRetry";

installGlobalErrorHandlers();
clearChunkReloadFlag();

// Vite emits 'vite:preloadError' when a dynamic import preload fails (stale
// chunk on Safari iOS after deploy). Force a cache-busted reload once.
window.addEventListener("vite:preloadError", (event) => {
  const RELOAD_KEY = "qa_chunk_reload";
  if (sessionStorage.getItem(RELOAD_KEY)) return;
  sessionStorage.setItem(RELOAD_KEY, Date.now().toString());
  event.preventDefault();
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("_cb", Date.now().toString());
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
});

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
