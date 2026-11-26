import { defineConfig, type TestProjectConfiguration } from "vitest/config";
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

/**
 * THE BROWSER LAMPS STAND DIM (operator, 2026-11-20: "disable all browser tests for now, while we move quickly to settle the
 * road"; the browser side gets a deep Mu from scratch later, lar:///ha.ka.ba/kahua/memory/project/browser-mu-from-scratch).
 * The default run is `browser-node` alone: the files below run green in Node (isomorphic-by-intent code needs no real
 * browser). Every other test file here stays in the tree, untouched, and goes unrun until the browser Mu relights it. The
 * account of what went dark and how to relight stands in tools/ci-cells.mjs (BROWSER_LAMPS_DIM).
 *
 * TO RELIGHT: `projects: [browserNode, ...browserProjects]` below.
 */
const browserNode = {
  extends: true as const,
  test: {
    name: "browser-node",
    environment: "node" as const,
    include: [
      "tests/admit-carriage.test.ts",
      "tests/alert-drop-diagnostics.test.ts",
      "tests/browser-veil-archive-route.test.ts",
      "tests/browser-connection-state.test.ts",
      "tests/browser-device-daemon-seal.test.ts",
      "tests/browser-docstore-crash.test.ts",
      "tests/browser-dyad-refusal.test.ts",
      "tests/browser-face-join.test.ts",
      "tests/browser-floor-pin.test.ts",
      "tests/browser-floor-read.test.ts",
      "tests/browser-flow-nexus.test.ts",
      "tests/browser-gate-pins.test.ts",
      "tests/browser-island-caps.test.ts",
      "tests/browser-island-receipt.test.ts",
      "tests/browser-own-hearth-pins.test.ts",
      "tests/browser-share-config.test.ts",
      "tests/daemon-island-down.test.ts",
      "tests/face-daemon-canon.test.ts",
      "tests/gated-peer.test.ts",
      "tests/guarded-boot.test.ts",
      "tests/hearth-canon.test.ts",
      "tests/hearth-daemon-crossing.test.ts",
      "tests/holder-skip-census.test.ts",
      "tests/in-page-island-teardown.test.ts",
      "tests/intent-agent-verify.test.ts",
      "tests/kahua-joined-mount.test.ts",
      "tests/mirror-rest-verdict.test.ts",
      "tests/nexus-board-climb-at-leaf.test.ts",
      "tests/page-port-grant.test.ts",
      "tests/place-claim-storm.test.ts",
      "tests/secure-context-gate.test.ts",
      "tests/seed-wrap-prf.test.ts",
      "tests/shared-holder-admission-replies.test.ts",
      "tests/shared-holder-core-imports.test.ts",
      "tests/shared-holder-faces.test.ts",
      "tests/shared-holder-hardening.test.ts",
      "tests/shared-holder-liveness.test.ts",
      "tests/shared-holder-routes.test.ts",
      "tests/shared-holder-runtime.test.ts",
      "tests/surface-return-leg.test.ts",
      "tests/vessel-lock.test.ts",
      "tests/vessel-lock-names.test.ts",
      "tests/ward-attempts-five.test.ts",
      "tests/ask-routes-five.test.ts",
      "tests/ward-cosign-refold-browser.test.ts",
      "tests/wiki-sensorium-cap.test.ts",
      "tests/wiki-sensorium-consistency.test.ts",
      "tests/working-mount-island-stood.test.ts",
    ],
  },
};

/** The browser-run projects (Chromium for every file, Firefox for the shared holder's lifecycle), dark by default. */
export const browserProjects: TestProjectConfiguration[] = [
      {
        extends: true,
        test: {
          name: "chromium",
          include: ["tests/**/*.test.ts"],
          browser: { enabled: true, headless: true, provider: playwright(), instances: [{ browser: "chromium" }] },
        },
      },
      {
        extends: true,
        test: {
          name: "firefox",
          include: ["tests/shared-holder-production.test.ts"],
          browser: { enabled: true, headless: true, provider: playwright(), instances: [{ browser: "firefox" }] },
        },
      },
];

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
    // Chromium runs every test; Firefox runs the production holder's lifecycle alone, since only its SharedWorker scope
    // can spawn the island Worker (the engine where the real peer path stands).
    projects: [browserNode],
    testTimeout: 30_000,
  },
});
