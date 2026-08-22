/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/setup-tests.ts",
    // React ships the production build (no `React.act`) when NODE_ENV is production.
    env: { NODE_ENV: "development" },
  },
});
