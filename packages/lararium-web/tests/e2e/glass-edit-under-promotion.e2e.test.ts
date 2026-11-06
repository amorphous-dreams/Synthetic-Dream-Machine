/**
 * e2e/glass-edit-under-promotion — the mirror opens skinny and promotes to full by one widen; the snapshot that answers
 * the widen lands while a person may already type into an open edit frame (`lar:///ha.ka.ba/lares/docs/pono/dreamdom#/prior-art`:
 * the focused control belongs to the human). The page holds the widen it sends until the test lets it go, so the
 * promotion lands at a named point in the typing and no clock picks it.
 *
 *   P1 — RED: open a new tiddler's editor while the mirror reads skinny, set its title, type into the body, let the
 *        promotion land, type on: every key sits in the body, the title stays as set, and focus stays in the body.
 *   P2 — CONTROL: the same held promotion with no editor open: it lands and the full mirror paints the story.
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { foundStagedHearth, openStaged, stageDir, type LarInstance } from "../../../../tests/harness/instance.js";
import { armTestCustody } from "../../../lararium-node/dist/probes/browser-test-custody.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const WAIT = 120_000;
const TITLE = `Typed under promotion ${Date.now()}`;
const BEFORE = "words typed while skinny";
const AFTER = " and words typed once full";

let hearth: LarInstance | null = null;
let browser: Browser | null = null;
let scratch = "";
let url = "";
const logs: string[] = [];
const wiki = (p: Page) => p.locator("#mirror");
const bodyEditor = (p: Page) => p.frameLocator("#mirror iframe").first().locator("textarea");

/** Before any page script runs: the page's `port:widen` waits in a held list until `__larLetWiden()` sends it on. */
function holdTheWiden(): void {
  const held: Array<() => void> = [];
  const w = window as unknown as { __larWidenHeld: () => number; __larLetWiden: () => void };
  w.__larWidenHeld = () => held.length;
  w.__larLetWiden = () => { for (const send of held.splice(0)) send(); };
  for (const proto of [Worker.prototype, MessagePort.prototype] as Array<{ postMessage: (...args: unknown[]) => void }>) {
    const post = proto.postMessage;
    proto.postMessage = function (this: unknown, ...args: unknown[]) {
      const msg = args[0] as { msg?: { type?: unknown } } | null;
      if (msg && typeof msg === "object" && msg.msg?.type === "port:widen") { held.push(() => post.apply(this, args)); return; }
      return post.apply(this, args);
    };
  }
}

/** The page stands its mirror at skinny and has sent the widen it holds. */
async function openSkinny(context: BrowserContext): Promise<Page> {
  await context.addInitScript(holdTheWiden);
  const p = await context.newPage();
  p.on("console", (m) => logs.push(m.text()));
  p.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
  await p.goto(url);
  const shown = await p.waitForFunction(() => {
    const host = document.querySelector("#mirror");
    const word = host?.getAttribute("data-lar-mirror") ?? "";
    const held = (window as unknown as { __larWidenHeld: () => number }).__larWidenHeld();
    return word.startsWith("none:") ? word : word === "skinny" && held > 0 && (host?.shadowRoot?.querySelector(".lar-mirror")?.childElementCount ?? 0) > 0 ? word : false;
  }, undefined, { timeout: WAIT }).then((h) => h.jsonValue()).catch(() => "never skinny");
  expect(shown, logs.slice(-60).join("\n")).toBe("skinny");
  return p;
}

/** Let the held widen go and wait for the full mirror plus two page frames over the refreshed tree. */
async function promote(p: Page): Promise<void> {
  await p.evaluate(() => (window as unknown as { __larLetWiden: () => void }).__larLetWiden());
  await p.waitForFunction(() => document.querySelector("#mirror")?.getAttribute("data-lar-mirror") === "full", undefined, { timeout: WAIT });
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

/** Where the page's focus sits inside the mirror: the title field, the framed body, or something else by tag. */
async function focusIn(p: Page): Promise<string> {
  return wiki(p).evaluate((host) => {
    const active = host.shadowRoot?.activeElement;
    if (!active) return "nothing";
    if (active.matches("input.tc-titlebar")) return "title";
    if (active instanceof HTMLIFrameElement) return active.contentDocument?.activeElement?.tagName === "TEXTAREA" ? "body" : "body-frame";
    return active.tagName.toLowerCase();
  });
}

beforeAll(async () => {
  scratch = mkdtempSync(join(stageDir(), "glass-edit-under-promotion-"));
  hearth = await openStaged({
    tag: "glass-edit-under-promotion",
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

describe("the mirror's promotion never takes a person's typing", () => {
  test("P1 — RED: the promotion lands mid-typing in an open editor: the keys stay in the body, the title keeps what was set, focus stays", async () => {
    expect(url, "the hearth printed its URL").toMatch(/^https?:/);
    const context = await browser!.newContext();
    await armTestCustody(context, "glass-edit-under-promotion-p1");
    const page = await openSkinny(context);
    await wiki(page).evaluate((h) => (h.shadowRoot!.querySelector('button[title="Create a new tiddler"]') as HTMLElement).click());
    await wiki(page).locator("input.tc-titlebar").fill(TITLE);
    await bodyEditor(page).pressSequentially(BEFORE, { delay: 5 });
    expect(await focusIn(page), "focus sits in the body before the promotion").toBe("body");
    expect(await page.locator("#mirror").getAttribute("data-lar-mirror"), "the editor stands under a skinny mirror").toBe("skinny");
    await promote(page);
    // barrier: the mirror reads data-lar-mirror="full", the promotion's landing promote() waits for, and two frames paint after it
    expect(await focusIn(page), "the promotion leaves focus in the body").toBe("body");
    // The keys go wherever the page's focus sits, as a person's would.
    await page.keyboard.type(AFTER, { delay: 5 });
    // barrier: the body editor's value reads every typed key, the page's own answer to the last keystroke
    await expect.poll(() => bodyEditor(page).inputValue(), { timeout: WAIT }).toBe(BEFORE + AFTER);
    expect(await focusIn(page), "focus stays in the body").toBe("body");
    expect(await wiki(page).locator("input.tc-titlebar").inputValue(), "the title stays as set").toBe(TITLE);
    expect(await bodyEditor(page).inputValue(), "every key sits in the body, in order").toBe(BEFORE + AFTER);
    await context.close();
  });

  test("P2 — CONTROL: the held promotion with no editor open lands and paints the full story", async () => {
    const context = await browser!.newContext();
    await armTestCustody(context, "glass-edit-under-promotion-p2");
    const page = await openSkinny(context);
    expect(await wiki(page).evaluate((h) => !!h.shadowRoot?.querySelector(".tc-tiddler-edit-frame")), "no editor stands open").toBe(false);
    await promote(page);
    const frames = await wiki(page).evaluate((h) => h.shadowRoot?.querySelectorAll(".tc-story-river .tc-tiddler-frame").length ?? 0);
    expect(frames, "the full mirror paints the story").toBeGreaterThan(0);
    const body = await wiki(page).evaluate((h) => h.shadowRoot?.querySelector(".tc-story-river .tc-tiddler-frame .tc-tiddler-body")?.textContent?.trim() ?? "");
    expect(body.length, "the full mirror paints a story body").toBeGreaterThan(0);
    await context.close();
  });
});
