/**
 * e2e/glass-tabs: two tabs on one origin. The first holds the vessel and leads; the second finds the leader lock held and
 * follows it over the bus, standing its own mirror from the leader's lend and promoting to full through the leader's port
 * doors. When the first tab closes, the second leads: it opens the vessel itself and its mirror never tears down.
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
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
  scratch = mkdtempSync(join(stageDir(), "glass-tabs-"));
  hearth = await openStaged({
    tag: "glass-tabs",
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

/** The mirror host's two words: the tab's role and the mirror's width, once the width settles. */
const settled = (page: Page) => page.waitForFunction(() => {
  const host = document.querySelector("#mirror");
  const state = host?.getAttribute("data-lar-mirror") ?? "";
  return state === "full" || state.startsWith("none:") ? `${host?.getAttribute("data-lar-tab") ?? "?"}/${state}` : false;
}, undefined, { timeout: WAIT }).then((h) => h.jsonValue()).catch(() => "never settled");
const frames = (page: Page) => page.evaluate(() => document.querySelector("#mirror")?.shadowRoot?.querySelectorAll(".tc-story-river .tc-tiddler-frame").length ?? 0);
const watch = (page: Page, tag: string) => { page.on("console", (m) => logs.push(`[${tag}] ${m.text()}`)); page.on("pageerror", (e) => logs.push(`[${tag}][pageerror] ${e.message}`)); };

describe("two tabs on one origin", () => {
  test("the second tab follows the first with its own mirror at full; the follower leads once the first tab closes, and a third tab follows it", async () => {
    expect(url, "the hearth printed its URL").toMatch(/^https?:/);
    const context = await browser!.newContext();
    await armTestCustody(context, "glass-tabs-1");
    const first = await context.newPage();
    watch(first, "first");
    await first.goto(url);
    expect(await settled(first), logs.slice(-40).join("\n")).toBe("leader/full");
    const second = await context.newPage();
    watch(second, "second");
    await second.goto(url);
    expect(await settled(second), logs.slice(-40).join("\n")).toBe("follower/full");
    expect(await second.locator("#mirror").isVisible()).toBe(true);
    expect(await frames(second)).toBeGreaterThan(0);
    // The first tab goes: the second leads, opens the vessel itself, and its mirror stands on through the hand-off.
    await first.close();
    const led = await second.waitForFunction(() => document.querySelector("#mirror")?.getAttribute("data-lar-tab") === "leader", undefined, { timeout: WAIT })
      .then(() => "led").catch(() => "never led");
    expect(led, logs.slice(-40).join("\n")).toBe("led");
    expect(await second.evaluate(() => document.querySelector("#mirror")?.getAttribute("data-lar-mirror"))).toBe("full");
    expect(await frames(second)).toBeGreaterThan(0);
    // CONTROL: the new leader serves the vessel: a third tab follows it.
    const third = await context.newPage();
    watch(third, "third");
    await third.goto(url);
    expect(await settled(third), logs.slice(-40).join("\n")).toBe("follower/full");
    await context.close();
  });
});
