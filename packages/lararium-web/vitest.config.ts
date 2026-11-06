import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import { webkit } from "playwright";
import wasm from "vite-plugin-wasm";
import { refusalIsHostDependency } from "./engine-refusal.js";

// Web-surface tests run in real Chromium, Firefox and WebKit because this shore owns the DOM adapter and the engines
// differ on exactly the seams it owns (editing stacks, focus, the accessibility tree). Pure phone-seat tests remain
// pure functions inside that browser context; no test boots a vessel here.
//
// CI installs all three engines with their system libraries and runs all three: CI never narrows. A host that lacks
// WebKit's system libraries (`playwright install-deps` needs root) cannot launch it, and an unhandled launch error
// would also fail the other two engines' runs. Off CI the config launches WebKit once, and where that refuses it
// drops the WebKit instance and says so on the console with the engine's own words. The refusal names itself on
// every run; `tests/engine-probes.page.test.ts` reads each engine that does run.
async function engines(): Promise<Array<{ browser: "chromium" | "firefox" | "webkit" }>> {
  const all = [{ browser: "chromium" as const }, { browser: "firefox" as const }, { browser: "webkit" as const }];
  if (process.env["CI"]) return all;
  try {
    const probe = await webkit.launch();
    await probe.close();
    return all;
  } catch (err) {
    const text = String((err as Error).message);
    // Only the host-dependency refusal drops the instance (`engine-refusal.ts`); a missing executable or a broken install fails the run loud.
    if (!refusalIsHostDependency(text)) throw err;
    const libs = text.match(/lib[\w.-]+\.so[\d.]*/g) ?? [];
    const words = libs.length > 0
      ? `the host lacks ${libs.length} system libraries (${libs.slice(0, 3).join(", ")}, ...); a root run of "playwright install-deps webkit" cures it`
      : text.split("\n")[0]!;
    console.warn(`[web-engines] WebKit REFUSED on this host, so its instance stands out of this run (CI runs it): ${words}`);
    return all.slice(0, 2);
  }
}

export default defineConfig(async () => ({
  test: {
    globalSetup: ["../../tools/vitest-dist-guard.mjs"],
    projects: [
      {
        test: {
          name: "web-browser",
          include: ["tests/**/*.test.ts"],
          exclude: ["tests/e2e/**", "tests/vessel-host-*.test.ts"],
          // Three engines beside the node e2e project starve its 20 s page waits; the engines take their files one at a time.
          fileParallelism: false,
          browser: { enabled: true, headless: true, provider: playwright(), instances: await engines() },
        },
      },
      {
        // The vessel worker's host over the real `@lararium/browser` (its Keyhive and Automerge WASM ride the wasm plugin): a
        // scratch store per case, the vessel it lights standing in, the host's own wiring read.
        plugins: [wasm()],
        test: {
          name: "vessel-host",
          include: ["tests/vessel-host-*.test.ts"],
          fileParallelism: false,
          browser: { enabled: true, headless: true, provider: playwright(), instances: [{ browser: "chromium" as const }, { browser: "firefox" as const }] },
        },
      },
      {
        test: {
          name: "shore-writes-e2e",
          include: ["tests/e2e/shore-writes.e2e.test.ts", "tests/e2e/second-boot.e2e.test.ts", "tests/e2e/vessel-worker.e2e.test.ts"],
          environment: "node",
          browser: { enabled: false },
          testTimeout: 90_000,
        },
      },
      {
        // The browser vessel re-opens its daemon island in process (red 6): this walk BUILDS a walk bundle of the Pronaos
        // (`LAR_WALK_DOOR=1 vite build` into a scratch dir, the only build that carries the restart door), serves it and the
        // default dist on two loopback ports, and drives a real Chromium. The build and two previews make it slow, and it
        // owns the host for its run.
        test: {
          name: "daemon-island-reopen-e2e",
          include: ["tests/e2e/daemon-island-reopen.e2e.test.ts"],
          fileParallelism: false,
          environment: "node",
          browser: { enabled: false },
          testTimeout: 300_000,
          hookTimeout: 600_000,
        },
      },
      {
        // The unlock ceremony (slice 1b): a WALK BUILD of the Pronaos (the walk's ward act rides only that build) served on the
        // loopback, a real Chromium founding, unlocking and signing one ward act through the ceremony document.
        test: {
          name: "ceremony-e2e",
          include: ["tests/e2e/ceremony.e2e.test.ts"],
          fileParallelism: false,
          environment: "node",
          browser: { enabled: false },
          testTimeout: 300_000,
          hookTimeout: 600_000,
        },
      },
      {
        // Golden 01 on the whole road: a staged hearth (a scratch LAR_ROOT of its own) serves the page and a real
        // Chromium acts on it. It stands a daemon, so its waits are long and it owns the process for its run.
        test: {
          name: "golden-whole-road-e2e",
          // The seventh silent loss rides the same project: both files stand a daemon and a real Chromium, so they take
          // the host one file at a time.
          include: ["tests/e2e/golden-whole-road.e2e.test.ts", "tests/e2e/rest-before-reload.e2e.test.ts", "tests/e2e/glass-mirror.e2e.test.ts", "tests/e2e/glass-tabs.e2e.test.ts", "tests/e2e/mirror-boot-makes-no-request.e2e.test.ts", "tests/e2e/glass-edit-under-promotion.e2e.test.ts"],
          fileParallelism: false,
          environment: "node",
          browser: { enabled: false },
          testTimeout: 300_000,
          hookTimeout: 600_000,
          // Every staged vessel declares its origins: the hearth serves its page, its relay and its oracle on one origin.
          env: { LAR_SAME_ORIGIN: "true" },
        },
      },
    ],
  },
}));
