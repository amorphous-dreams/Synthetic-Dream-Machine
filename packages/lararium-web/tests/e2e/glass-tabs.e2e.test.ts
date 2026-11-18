/**
 * e2e/glass-tabs: two tabs on one origin, EACH ITS OWN SESSION (the 2026-11-06 ruling: every tab carries a live session). The
 * first takes the owner lock and stands the vessel worker; the second finds the lock held, claims a port through the service
 * worker's broker and opens its own session over it, with its own unlock through its own ceremony, and its mirror stands full.
 * FLOOR-TAB SUCCESSION: when the first tab closes, the survivor takes the lock and stands as owner (its own vessel worker, its
 * own unlock again). CONTROL: a third tab follows the new owner through the broker.
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
const navigate = (page: Page) => page.goto(url);

describe("two tabs on one origin", () => {
  test("the second tab opens its own session through the broker with its mirror at full; it stands as owner once the first tab closes, and a third tab follows it", async () => {
    expect(url, "the hearth printed its URL").toMatch(/^https?:/);
    const context = await browser!.newContext();
    await armTestCustody(context, "glass-tabs-1");
    const first = await context.newPage();
    watch(first, "first");
    await first.goto(url);
    const firstMirror = await settled(first);
    // barrier: settled(first) waits for the first tab's mirror word to reach full or none
    expect(firstMirror, logs.slice(-40).join("\n")).toBe("owner/full");
    const second = await context.newPage();
    watch(second, "second");
    await navigate(second);
    const secondMirror = await settled(second);
    // barrier: settled(second) waits for the second tab's mirror word to reach full or none
    expect(secondMirror, logs.slice(-40).join("\n")).toBe("follower/full");
    expect(await second.locator("#mirror").isVisible()).toBe(true);
    expect(await frames(second)).toBeGreaterThan(0);
    // The first tab goes: the survivor takes the owner lock, stands its own vessel worker and its own unlock, and its mirror
    // stands full again over its own session.
    await first.close();
    const owned = await second.waitForFunction(() => document.querySelector("#mirror")?.getAttribute("data-lar-tab") === "owner", undefined, { timeout: WAIT })
      .then(() => "owner").catch(() => "never owner");
    // barrier: the survivor's mirror reports the owner role through the page
    expect(owned, logs.slice(-40).join("\n")).toBe("owner");
    const ownerMirror = await settled(second);
    // barrier: settled(second) waits for the survivor's mirror word to reach full or none
    expect(ownerMirror, logs.slice(-40).join("\n")).toBe("owner/full");
    expect(await frames(second)).toBeGreaterThan(0);
    // CONTROL: the new owner serves the vessel: a third tab claims through the broker and follows it.
    const third = await context.newPage();
    watch(third, "third");
    await navigate(third);
    const thirdMirror = await settled(third);
    // barrier: settled(third) waits for the third tab's mirror word to reach full or none
    expect(thirdMirror, logs.slice(-40).join("\n")).toBe("follower/full");
    await context.close();
  });
});
