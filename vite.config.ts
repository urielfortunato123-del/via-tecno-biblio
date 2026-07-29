import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import path from "node:path";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isRender = !!process.env.RENDER || process.env.NITRO_PRESET === "node-server";

// Portable configuration — no dependency on private Lovable packages.
// Works locally (Lovable dev) and on external hosts (Render, etc.).
export default defineConfig({
  plugins: [
    tsconfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart(),
    react(),
    nitro({
      preset: isRender ? "node-server" : "cloudflare-module",
      output: {
        dir: path.resolve(__dirname, "dist"),
        serverDir: path.resolve(__dirname, "dist/server"),
        publicDir: path.resolve(__dirname, "dist/client"),
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
    dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-start"],
  },
  server: {
    host: true,
    port: 8080,
    strictPort: true,
  },
  environments: {
    server: {
      build: {
        rollupOptions: {
          input: path.resolve(__dirname, "src/server.ts"),
        },
        rolldownOptions: {
          input: path.resolve(__dirname, "src/server.ts"),
        },
      },
    },
  },
});
