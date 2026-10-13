/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  define: {
    global: "globalThis",
  },
  plugins: [react()],
  server: {
    watch: { usePolling: true, interval: 300 },
  },
  test: {
    environment: "jsdom",
  },
});
