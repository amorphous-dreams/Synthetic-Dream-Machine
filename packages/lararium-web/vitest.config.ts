import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import { webkit } from "playwright";

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
    // Only the host-dependency refusal drops the instance; a missing executable or a broken install fails the run loud.
    if (!/missing dependencies/i.test(text)) throw err;
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
          exclude: ["tests/e2e/**"],
          // Three engines beside the node e2e project starve its 20 s page waits; the engines take their files one at a time.
          fileParallelism: false,
          browser: { enabled: true, provider: playwright(), instances: await engines() },
        },
      },
      {
        test: {
          name: "shore-writes-e2e",
          include: ["tests/e2e/shore-writes.e2e.test.ts", "tests/e2e/second-boot.e2e.test.ts"],
          environment: "node",
          browser: { enabled: false },
          testTimeout: 90_000,
        },
      },
      {
        // Golden 01 on the whole road: a staged hearth (a scratch LAR_ROOT of its own) serves the page and a real
        // Chromium acts on it. It stands a daemon, so its waits are long and it owns the process for its run.
        test: {
          name: "golden-whole-road-e2e",
          include: ["tests/e2e/golden-whole-road.e2e.test.ts"],
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
