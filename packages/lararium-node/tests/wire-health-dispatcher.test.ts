/**
 * The readiness wire (WEAK FORM, labelled). `main.ts` runs its daemon at module load and exports nothing, so
 * the boot paths cannot run in a unit test. The behaviour half runs the readiness helper both boot paths call:
 * the state stays starting until the dispatcher event resolves. The wire half is a source-shape assertion over
 * both boot paths, which fails when readiness turns ready ahead of the dispatcher event.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { createReadinessState, markReadyOnceStanding } from "../src/readiness-face.js";

const source = readFileSync(join(__dirname, "..", "src", "main.ts"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/[^\n]*/g, "");

describe("the node readiness wire", () => {
  test("CONTROL: readiness stays starting until the dispatcher event resolves", async () => {
    const state = createReadinessState();
    let stand!: () => void;
    const event = new Promise<void>((resolve) => { stand = resolve; });
    const ready = markReadyOnceStanding(state, event);
    expect(state.status()).toBe("starting");
    stand();
    await ready;
    expect(state.status()).toBe("ready");
  });

  test("both boot paths await the daemon island event before marking readiness", () => {
    expect(source).toMatch(/await\s+markReadyOnceStanding\(readinessState,\s*herm\.daemon\.workerEa\)/);
    expect(source).toMatch(/await\s+markReadyOnceStanding\(readinessState,\s*result\.daemon\.workerEa\)/);
    expect(source).not.toMatch(/readinessState\.markReady\(\)/);
  });
});
