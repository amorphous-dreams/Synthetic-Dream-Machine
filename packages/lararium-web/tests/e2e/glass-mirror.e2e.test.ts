/**
 * e2e/glass-mirror: a page with a founded vessel stands its mirror through `standMirror` with the vessel's real core
 * inputs. No URL value and no stored value selects the width: the page opens skinny, paints, and promotes to full.
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { chromium, type Browser } from "playwright";
import { foundStagedHearth, openStaged, stageDir, type LarInstance } from "../../../../tests/harness/instance.js";
import { armTestCustody } from "../../../lararium-node/dist/probes/browser-test-custody.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const WAIT = 120_000;
let hearth: LarInstance | null = null;
let browser: Browser | null = null;
let scratch = "";
let url = "";
const logs: string[] = [];

beforeAll(async () => {
  scratch = mkdtempSync(join(stageDir(), "glass-mirror-"));
  hearth = await openStaged({
    tag: "glass-mirror",
    found: async (cli, root) => { await foundStagedHearth(cli, root, "hearth"); },
    daemonEnv: { LAR_PRONAOS_WEB_ROOT: join(REPO, "packages/lararium-web/dist"), LAR_PRONAOS_ARTIFACT_RECORD: join(REPO, ".pronaos-build/pronaos-artifact.json") },
  });
  const deadline = performance.now() + WAIT;
  for (;;) {
    url = /^\[lararium\] {3}(https?:\/\/\S+) {3}\(/m.exec(hearth.bootLog())?.[1] ?? "";
    if (url || performance.now() > deadline) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  browser = await chromium.launch({ headless: true });
}, 600_000);

afterAll(async () => {
  if (scratch) { writeFileSync(join(scratch, "hearth.log"), hearth?.bootLog() ?? ""); writeFileSync(join(scratch, "page.log"), logs.join("\n")); }
  await browser?.close();
  await hearth?.stop();
});

describe("a founded vessel stands its mirror", () => {
  test("the page's mirror host paints the story and reads full once promoted", async () => {
    expect(url, "the hearth printed its URL").toMatch(/^https?:/);
    const context = await browser!.newContext();
    await armTestCustody(context, "glass-mirror-1");
    const page = await context.newPage();
    page.on("console", (m) => logs.push(m.text()));
    page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
    await page.goto(url);
    const verdict = await page.waitForFunction(() => {
      const host = document.querySelector("#mirror");
      const state = host?.getAttribute("data-lar-mirror") ?? "";
      return state === "full" || state.startsWith("none:") ? state : false;
    }, undefined, { timeout: WAIT }).then((h) => h.jsonValue()).catch(() => "never settled");
    expect(verdict, logs.slice(-40).join("\n")).toBe("full");
    // The shadow root holds TW5's own story river with at least one tiddler frame: the story the surface opened with.
    const frames = await page.evaluate(() => document.querySelector("#mirror")?.shadowRoot?.querySelectorAll(".tc-story-river .tc-tiddler-frame").length ?? 0);
    expect(frames).toBeGreaterThan(0);
    await context.close();
  });
});
