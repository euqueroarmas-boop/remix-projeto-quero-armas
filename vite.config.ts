import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { prerenderOg } from "./scripts/prerender-og.mjs";

function queroArmasPrerenderOgPlugin() {
  let outDir = path.resolve(process.cwd(), "dist");

  return {
    name: "quero-armas-prerender-og",
    apply: "build" as const,
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir || "dist");
    },
    closeBundle() {
      prerenderOg({ distDir: outDir });
    },
  };
}

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: { overlay: false },
  },
  plugins: [react(), queroArmasPrerenderOgPlugin(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "es2020",
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-motion": ["framer-motion"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-ui": ["@radix-ui/react-dialog", "@radix-ui/react-accordion", "@radix-ui/react-tooltip", "@radix-ui/react-popover"],
        },
      },
    },
  },
}));
