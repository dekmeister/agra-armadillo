import { resolve } from "node:path";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

// Mirror the workspace alias used by vitest.config.ts so the game imports the
// core TypeScript source directly (no build step for the core workspace).
const r = (p: string) => resolve(__dirname, p);

export default defineConfig({
  base: "/games/servicebus/",
  plugins: [svelte()],
  resolve: {
    alias: {
      "@service-bus/core": r("../core/src/index.ts"),
    },
  },
  server: { port: 5174 },
});
