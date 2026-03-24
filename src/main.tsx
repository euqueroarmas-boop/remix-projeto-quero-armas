import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installGlobalErrorHandlers } from "@/lib/errorLogger";
import { clearChunkReloadFlag } from "@/lib/lazyRetry";

installGlobalErrorHandlers();
clearChunkReloadFlag();

createRoot(document.getElementById("root")!).render(<App />);
