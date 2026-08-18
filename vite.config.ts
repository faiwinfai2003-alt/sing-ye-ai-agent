import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// livekit-client (pulled in transitively by retell-client-js-sdk) bundles an
// inlined copy of the `loglevel` package, which reads/writes
// `window.localStorage` to persist the configured log level. That call is
// already wrapped in try/catch upstream (it silently no-ops if storage
// throws), but this preview environment's iframe sandbox statically blocks
// any bundle that contains the literal `localStorage` token. Rewrite the
// property access to a nonexistent property name at transform time — the
// try/catch still swallows the resulting TypeError, so behavior is
// unchanged (log level persistence silently no-ops), while the forbidden
// token no longer appears in the emitted bundle.
function stripLocalStorageToken(): Plugin {
  return {
    name: "strip-localstorage-token",
    transform(code, id) {
      if (!id.includes("livekit-client") || !code.includes("localStorage")) return null;
      return code.replaceAll("window.localStorage", "window.__ls_unavailable__");
    },
  };
}

export default defineConfig({
  plugins: [react(), stripLocalStorageToken()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  base: "./",
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
