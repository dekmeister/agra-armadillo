import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const r = (p: string) => resolve(__dirname, p);

// Base path is overridable for deploy under a sub-path (sibling convention).
export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@normal-form/core": r("../core/src/index.ts"),
      "@normal-form/levels": r("../levels/src/index.ts"),
    },
  },
});
