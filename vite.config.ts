import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  base: "./",
  build: {
    emptyOutDir: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("node_modules") &&
            /recharts|d3-|victory-vendor|react-smooth|decimal.js/.test(id)
          )
            return "charts";
          if (id.includes("node_modules") && /dexie|zod/.test(id))
            return "storage";
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "StudyTrace",
        short_name: "StudyTrace",
        description: "日々の学びを、次の指導へ。",
        lang: "ja",
        id: "./",
        start_url: "./",
        scope: "./",
        display: "standalone",
        background_color: "#f7f8f4",
        theme_color: "#234f43",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          {
            src: "icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "index.html",
        cleanupOutdatedCaches: false,
      },
    }),
  ],
  test: {
    environment: "node",
    include: ["src/tests/**/*.test.ts"],
    setupFiles: ["src/tests/setup.ts"],
  },
});
