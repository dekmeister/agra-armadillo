import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const r = (p: string) => resolve(__dirname, p);

export default defineConfig({
  resolve: {
    alias: {
      "@service-bus/core": r("packages/core/src/index.ts"),
    },
  },
  test: {
    include: ["packages/**/test/**/*.test.ts", "tools/**/*.test.ts"],
    environment: "node",
  },
});
