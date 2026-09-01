/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // `pnpm dev:worker` runs the Worker and its Durable Objects on 8787.
    proxy: { "/ws": { target: "ws://localhost:8787", ws: true } },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/setup-tests.ts",
    // React ships the production build (no `React.act`) when NODE_ENV is production.
    env: { NODE_ENV: "development" },
  },
});
