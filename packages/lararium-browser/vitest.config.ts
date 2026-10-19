import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import wasm from "vite-plugin-wasm";
import path from "path";

const root = new URL(".", import.meta.url).pathname;
const tools = path.resolve(root, "../../tools") + path.sep;

/**
 * Stub Node's `crypto` for the code under test (tw5-host-bridge reaches for createHash), and for nothing the runner
 * loads from `tools/`. The dist guard runs as a global setup through this same resolver; a global alias handed it the
 * stub's FNV digest, so every stamp read stale and the suite refused a fresh tree.
 */
const cryptoStubForCodeUnderTest = {
  name: "lararium-browser:crypto-stub",
  enforce: "pre" as const,
  resolveId(id: string, importer?: string) {
    if (!/^(node:)?crypto$/.test(id)) return null;
    if (importer && path.resolve(importer).startsWith(tools)) return null;
    return path.resolve(root, "src/__stubs__/crypto-stub.ts");
  },
};

export default defineConfig({
  plugins: [cryptoStubForCodeUnderTest, wasm()],
  resolve: {
    alias: [
      // NO `fs`/`path` stub rides here, and none may. The isomorphic `@lararium/mesh` barrel carries no
      // host code — its four transcript adapters sit behind `@lararium/mesh/node` — so the browser hull
      // needs no patch to stay whole. A stub added back here would let a `node:fs` import cross into the
      // hull and pass the suite, which is the leak this configuration exists to keep out.
      { find: "@lararium/keyhive",               replacement: path.resolve(root, "../lararium-keyhive/src/index.ts") },
      // Every mesh subpath rides ONE regex → src/<sub>.ts (the bare "@lararium/mesh" below would
      // otherwise swallow subpaths into "src/index.ts/<sub>").
      { find: /^@lararium\/mesh\/(.+)$/, replacement: path.resolve(root, "../lararium-mesh/src") + "/$1.ts" },
      { find: "@lararium/mesh",                  replacement: path.resolve(root, "../lararium-mesh/src/index.ts") },
      { find: "@lararium/tw5",                   replacement: path.resolve(root, "../lararium-tw5/src/index.ts") },
    ],
  },
  test: {
    globalSetup: ["../../tools/vitest-dist-guard.mjs"],
    // STATED, not inherited. `isolate: true` is vitest's default, and suites here depend on it:
    // several modules hold process-global registries (a Map of holders, memo caches) that no reset
    // clears, so a fresh module registry per file is the only thing returning them to zero. Left
    // implicit, the property disappears the day someone reaches for `isolate: false` for speed —
    // a change that reads as a tuning knob and lands as a correctness change. Written down, it has
    // to be turned off on purpose.
    isolate: true,
    browser: {
      enabled: true,
      // The provider rides as a FACTORY, never a name: the runner imports the driver it will actually
      // use, so a missing provider fails at config load with the package that is absent — never mid-run
      // with a string nothing resolved.
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
  },
});
