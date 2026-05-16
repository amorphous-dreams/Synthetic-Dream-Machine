import { defineConfig } from "vitest/config";
import path from "path";

const root = new URL(".", import.meta.url).pathname;

export default defineConfig({
  resolve: {
    alias: [
      { find: "@lararium/core/meme-ast", replacement: path.resolve(root, "../lararium-core/src/meme-ast/index.ts") },
      { find: "@lararium/core", replacement: path.resolve(root, "../lararium-core/src/index.ts") },
    ],
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
