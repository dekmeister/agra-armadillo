import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Mirror the workspace aliases used by vitest.config.ts so the game imports the
// core/levels TypeScript sources directly (no build step for the workspaces).
const r = (p: string) => resolve(__dirname, p);

export default defineConfig({
  base: "/games/brainswap/",
  plugins: [react()],
  resolve: {
    alias: {
      "@brain-swap/core": r("../core/src/index.ts"),
      "@brain-swap/levels": r("../levels/src/index.ts"),
    },
  },
  server: { port: 5173 },
});
