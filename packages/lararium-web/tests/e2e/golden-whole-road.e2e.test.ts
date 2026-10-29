/**
 * e2e/golden-whole-road — interaction golden 01 (`lar:///ha.ka.ba/lares/docs/pono/dreamdom#/conformance/interaction/1`,
 * `tests/goldens/interaction/01-link-ordinary-modified-middle-external.json`) over a STAGED VESSEL, end to end.
 *
 * The two harnesses stand in for the whole road (the engine half over the fake document, the page half over the real
 * sink with a stand-in island). This file runs the same claims on the road itself: a staged hearth (a scratch
 * `LAR_ROOT` of its own, founded and unlocked by the harness) serves the page; a real Chromium opens it; the page's
 * own island renders the wiki through the keyed frames; a real mouse acts on the real links. Nothing here stands in
 * for the island, the sink or the browser.
 *
 *   W1 — the world: two tiddlers, `alpha` carrying an internal link, an external link and a bare span, `beta`; the
 *        story holds `alpha` alone
 *   W2 — the rendered link carries its declared cancellation (`data-lar-on="click"`, `data-lar-cancel="click:ordinary"`);
 *        the external link and the bare span carry none
 *   W3 — an ordinary click navigates: `beta` opens above `alpha`, and the page cancelled the browser default
 *   W4 — a modified click and a middle click leave the browser default standing: each opens the link in a new tab, and
 *        the story holds
 *   W5 — an external href never relays: the browser default stands, the story holds
 *   W6 — an unbound span raises no act: the default stands, the story holds
 *
 * The page's reading of each click decides each step (`defaultPrevented` read at the document, after the sink's handler
 * ran; the story river read off the DOM); a timeout only bounds a wait.
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { foundStagedHearth, openStaged, stageDir, type LarInstance } from "../../../../tests/harness/instance.js";
// The published test route answers the custody form a fresh vessel raises (a harness door; never a person's passphrase).
import { armTestCustody } from "../../../lararium-node/dist/probes/browser-test-custody.js";
import golden from "../goldens/interaction/01-link-ordinary-modified-middle-external.json" with { type: "json" };

const REPO = resolve(import.meta.dirname, "../../../..");
const WEB_ROOT = join(REPO, "packages/lararium-web/dist");
const RECORD = join(REPO, ".pronaos-build/pronaos-artifact.json");
const WAIT = 120_000;

const ALPHA = golden.world.tiddlers[0]!.title;
const BETA = golden.world.tiddlers[1]!.title;
let sentinelCount = 0;

let hearth: LarInstance | null = null;
let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;
let scratch = "";
let bannerUrl = "";
const consoleLines: string[] = [];
const opened: Page[] = [];

const wiki = () => page!.locator("#projection");

/** The story river's titles, top to bottom, as the page paints them. */
async function story(): Promise<string[]> {
  return wiki().evaluate((host) => [...(host.shadowRoot?.querySelectorAll(".tc-story-river .tc-tiddler-frame") ?? [])]
    .map((frame) => frame.getAttribute("data-tiddler-title") ?? ""));
}

async function awaitLive(p: Page): Promise<void> {
  const row = await p.waitForFunction(() => {
    const rows = [...document.querySelectorAll("#vessel .row")];
    const t = rows.find((r) => r.querySelector(".k")?.textContent === "status")?.querySelector(".v")?.textContent ?? "";
    return t.startsWith("live") || t.startsWith("boot failed") ? t : false;
  }, undefined, { timeout: WAIT }).then((h) => h.jsonValue()).catch(() => "never live");
  expect(row, `${consoleLines.slice(-80).join("\n")}\n--- hearth ---\n${hearth?.bootLog().slice(-3000)}`).toMatch(/^live/);
  await p.waitForFunction(() => {
    const pane = document.querySelector("#projection")?.shadowRoot?.querySelector(".lar-projection");
    return pane !== null && pane !== undefined && pane.childElementCount > 0;
  }, undefined, { timeout: WAIT });
}

/** Make one tiddler through the page's own editor: the new-tiddler button, a title, a body, the confirm button. */
async function makeTiddler(title: string, text: string): Promise<void> {
  await wiki().evaluate((host) => (host.shadowRoot!.querySelector('button[title="Create a new tiddler"]') as HTMLElement).click());
  await wiki().locator("input.tc-titlebar").fill(title);
  await wiki().locator("textarea.tc-edit-texteditor-body").fill(text);
  await wiki().locator('button[title="Confirm changes to this tiddler"]').click();
  await page!.waitForFunction((t) => !!document.querySelector("#projection")?.shadowRoot
    ?.querySelector(`.tc-story-river .tc-tiddler-frame[data-tiddler-title="${t}"]:not(.tc-tiddler-edit-frame)`), title, { timeout: WAIT });
}

/**
 * A barrier behind every act relayed so far. The island answers acts in the order they left the page, so a throwaway
 * tiddler made through the page's editor paints only after each earlier act ran; an absence read after it has waited
 * on the island's side of the wire, never on the page's alone.
 */
async function raiseSentinel(): Promise<void> {
  const title = `lar:///t/link/sentinel-${++sentinelCount}`;
  await makeTiddler(title, "a barrier behind the relayed clicks");
  await closeTiddler(title);
}

async function closeTiddler(title: string): Promise<void> {
  await wiki().evaluate((host, t) => (host.shadowRoot!.querySelector(`.tc-tiddler-frame[data-tiddler-title="${t}"] button[title="Close this tiddler"]`) as HTMLElement).click(), title);
  await page!.waitForFunction((t) => !document.querySelector("#projection")?.shadowRoot
    ?.querySelector(`.tc-story-river .tc-tiddler-frame[data-tiddler-title="${t}"]`), title, { timeout: WAIT });
}

/** Record `defaultPrevented` of each click as it reaches the document, after the sink's handler ran. */
async function armDefaultProbe(): Promise<void> {
  await page!.evaluate(() => {
    const w = globalThis as unknown as { __clicks: Array<{ prevented: boolean; button: number; ctrl: boolean }> };
    w.__clicks = [];
    const note = (e: MouseEvent): void => { w.__clicks.push({ prevented: e.defaultPrevented, button: e.button, ctrl: e.ctrlKey }); };
    document.addEventListener("click", note);
    document.addEventListener("auxclick", note);
  });
}
async function lastClick(): Promise<{ prevented: boolean; button: number; ctrl: boolean }> {
  return page!.evaluate(() => (globalThis as unknown as { __clicks: Array<{ prevented: boolean; button: number; ctrl: boolean }> }).__clicks.at(-1)!);
}

beforeAll(async () => {
  scratch = mkdtempSync(join(stageDir(), "golden-whole-road-"));
  hearth = await openStaged({
    tag: "golden-whole-road",
    found: async (cli, root) => { await foundStagedHearth(cli, root, "hearth"); },
    daemonEnv: { LAR_PRONAOS_WEB_ROOT: WEB_ROOT, LAR_PRONAOS_ARTIFACT_RECORD: RECORD },
  });
  const deadline = performance.now() + WAIT;
  for (;;) {
    bannerUrl = /^\[lararium\] {3}(https?:\/\/\S+) {3}\(/m.exec(hearth.bootLog())?.[1] ?? "";
    if (bannerUrl || performance.now() > deadline) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  browser = await chromium.launch({ headless: true, ...(process.env["LAR_CHROMIUM"] ? { executablePath: process.env["LAR_CHROMIUM"] } : {}) });
  context = await browser.newContext();
  await armTestCustody(context, "golden-whole-road");
  // These goldens walk the worker-rendered view, the named floor beneath the mirror: the page shows the mirror, so every page here shows the floor.
  await context.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = "#mirror{display:none !important} #projection{display:block !important}";
      document.head.append(style);
    });
  });
  // The external href reaches no network: the click's browser default opens a tab, and the tab loads nothing.
  await context.route(/^https?:\/\/example\.test\//, (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<title>outside</title>" }));
  context.on("page", (p) => { opened.push(p); });
  page = await context.newPage();
  page.on("console", (m) => { consoleLines.push(m.text()); });
  page.on("pageerror", (e) => { consoleLines.push(`[pageerror] ${e.message}`); });
}, 600_000);

afterAll(async () => {
  if (scratch) {
    writeFileSync(join(scratch, "hearth.log"), hearth?.bootLog() ?? "");
    writeFileSync(join(scratch, "page.log"), consoleLines.join("\n"));
  }
  await context?.close().catch(() => undefined);
  await browser?.close();
  await hearth?.stop();
});

describe("golden 01 on the whole road: a staged hearth, the page it serves, a real mouse", () => {
  test("W1 — the world stands: alpha carries the three targets, beta waits closed, the story holds alpha alone", async () => {
    await page!.goto(bannerUrl);
    await awaitLive(page!);
    await closeTiddler("GettingStarted");
    await makeTiddler(BETA, golden.world.tiddlers[1]!.text);
    await closeTiddler(BETA);
    await makeTiddler(ALPHA, golden.world.tiddlers[0]!.text.replace("[ext[outside|https://example.test/]]", "[[outside|https://example.test/]]"));
    // barrier: makeTiddler and closeTiddler each wait for the frame to stand or leave in the river, so the island has answered every act before the story read
    expect(await story()).toEqual([ALPHA]);
    await armDefaultProbe();
  });

  test("W2 — the internal link declares its cancellation; the external link and the bare span declare none", async () => {
    const stamps = await wiki().evaluate((host) => {
      const read = (sel: string) => {
        const node = host.shadowRoot!.querySelector(`.tc-story-river ${sel}`);
        return node === null ? null : { on: node.getAttribute("data-lar-on"), cancel: node.getAttribute("data-lar-cancel") };
      };
      return { internal: read("a.tc-tiddlylink-resolves"), external: read("a.tc-tiddlylink-external"), plain: read("span.plain") };
    });
    expect(stamps.internal?.on?.split(" ")).toContain("click");
    expect(stamps.internal?.cancel).toBe("click:ordinary");
    expect(stamps.external, "CONTROL: the external link stands in the river").not.toBeNull();
    expect(stamps.external!.cancel).not.toBe("click:ordinary");
    expect(stamps.plain, "CONTROL: the bare span stands in the river").not.toBeNull();
    expect(stamps.plain!.on).toBeNull();
  });

  test("W3 — an ordinary click navigates: beta opens in the river and the page cancels the browser default", async () => {
    const before = opened.length;
    await wiki().locator(".tc-story-river a.tc-tiddlylink-resolves").first().click();
    // The page's template opens a followed link below its source (`tiddlywiki.openLinkFromInsideRiver`), where the
    // golden's bare navigator world has no source frame; the claim is that beta joins the story.
    await page!.waitForFunction((t) => !!document.querySelector("#projection")?.shadowRoot
      ?.querySelector(`.tc-story-river .tc-tiddler-frame[data-tiddler-title="${t}"]`), BETA, { timeout: 20_000 })
      .catch(async (e) => { throw new Error(`${e}\nstory=${JSON.stringify(await story())}\n${consoleLines.filter((l) => !l.startsWith("Warning: Global assignment")).slice(-40).join("\n")}`); });
    expect(await story()).toEqual([ALPHA, BETA]);
    expect((await lastClick()).prevented).toBe(true);
    expect(opened.length, "no tab opened").toBe(before);
    await closeTiddler(BETA);
    expect(await story()).toEqual([ALPHA]);
  });

  test("W4 — a modified click and a middle click leave the browser default standing and the story holds", async () => {
    const link = wiki().locator(".tc-story-river a.tc-tiddlylink-resolves").first();
    const before = opened.length;
    await link.click({ modifiers: ["Control"] });
    await expect.poll(() => opened.length, { timeout: 20_000 }).toBe(before + 1);
    expect(await lastClick()).toMatchObject({ prevented: false, ctrl: true });
    await link.click({ button: "middle" });
    await expect.poll(() => opened.length, { timeout: 20_000 }).toBe(before + 2);
    expect(await lastClick()).toMatchObject({ prevented: false, button: 1 });
    await raiseSentinel();
    expect(await story()).toEqual([ALPHA]);
  });

  test("W5 — an external href never relays: the default stands and the story holds", async () => {
    const before = opened.length;
    await wiki().locator(".tc-story-river a.tc-tiddlylink-external").first().click();
    await expect.poll(() => opened.length, { timeout: 20_000 }).toBe(before + 1);
    expect((await lastClick()).prevented).toBe(false);
    await raiseSentinel();
    expect(await story()).toEqual([ALPHA]);
  });

  test("W6 — an unbound span raises no act: the default stands and the story holds", async () => {
    const before = opened.length;
    await wiki().locator(".tc-story-river span.plain").first().click();
    const clicked = await lastClick();   // the sentinel's own clicks come after: read this one's verdict first
    await raiseSentinel();
    expect(clicked.prevented).toBe(false);
    expect(opened.length).toBe(before);
    expect(await story()).toEqual([ALPHA]);
  });
});
