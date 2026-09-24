import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Huddle",
        short_name: "Huddle",
        description: "Notion + Trello + Slack, in one workspace",
        theme_color: "#4338ca",
        icons: [],
      },
      workbox: {
        // App-shell caching only — no attempt at full offline data sync
        // (see the spec's Tier 3 scope). Outbound chat messages sent while
        // offline are queued separately, see src/app/offlineQueue.ts.
        globPatterns: ["**/*.{js,css,html,svg}"],
      },
    }),
  ],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
  },
});
