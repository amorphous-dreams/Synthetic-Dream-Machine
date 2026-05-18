import { defineConfig } from "vitest/config";
import path from "path";

const root = new URL(".", import.meta.url).pathname;

export default defineConfig({
  resolve: {
    alias: [
      { find: "@lararium/types", replacement: path.resolve(root, "../lararium-types/src/index.ts") },
      { find: "@lararium/tw5", replacement: path.resolve(root, "../lararium-tw5/src/index.ts") },
    ],
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
