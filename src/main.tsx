import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import "./i18n";
import { installGlobalErrorHandlers } from "@/lib/errorLogger";
import { clearChunkReloadFlag } from "@/lib/lazyRetry";

installGlobalErrorHandlers();
clearChunkReloadFlag();

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
