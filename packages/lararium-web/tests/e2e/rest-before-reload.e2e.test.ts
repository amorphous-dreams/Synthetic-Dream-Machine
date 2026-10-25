/**
 * e2e/rest-before-reload — the seventh silent loss (`lar:///ha.ka.ba/lares/docs/pono/dreamdom#/what-a-sink-keeps`):
 * a person confirms an edit, the page paints it, and a reload that follows at once reads the body from before the
 * edit. The edit rested in the page's storage some seconds after the frame left edit mode (measured: the IndexedDB
 * commit queue of the vessel's Repo, ~3.7 s behind the confirm on a staged hearth in headless Chromium), and a page
 * that unloads inside that window loses it for good.
 *
 *   R1 — RED: make a tiddler through the page editor and wait for the vessel to rest it, edit it, confirm, then
 *        ask for a reload at once: the page HOLDS the leave while the confirmed act waits for its result (the
 *        `beforeunload` prompt fires and the person stays), and once the vessel rests the edit the reload goes through
 *        and the page reads the EDITED body. A confirmed edit survives an immediate reload.
 *   R2 — CONTROL: the same steps, but the reload waits until the vessel itself answers the edit's rest ask (its Repo
 *        held the island's heads and flushed them: `data-lar-rest` on the document root, the vessel's own word, no
 *        byte search and no sleep): the edit survives. The control proves a rested edit reads back, so R1's failure
 *        names the window and nothing else.
 *
 * Each read is the page's own reading; a timeout only bounds a wait.
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { foundStagedHearth, openStaged, stageDir, type LarInstance } from "../../../../tests/harness/instance.js";
import { armTestCustody } from "../../../lararium-node/dist/probes/browser-test-custody.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const WAIT = 120_000;
const FIRST = "first words from a keyboard";
const SECOND = "second words, an edit of a standing tiddler";

let hearth: LarInstance | null = null;
let browser: Browser | null = null;
let scratch = "";
let url = "";
const logs: string[] = [];
const wiki = (p: Page) => p.locator("#projection");

async function awaitLive(p: Page): Promise<void> {
  const row = await p.waitForFunction(() => {
    const rows = [...document.querySelectorAll("#vessel .row")];
    const t = rows.find((r) => r.querySelector(".k")?.textContent === "status")?.querySelector(".v")?.textContent ?? "";
    return t.startsWith("live") || t.startsWith("boot failed") ? t : false;
  }, undefined, { timeout: WAIT }).then((h) => h.jsonValue()).catch(() => "never live");
  expect(row, `${logs.slice(-60).join("\n")}\n--- hearth ---\n${hearth?.bootLog().slice(-2000)}`).toMatch(/^live/);
  await p.waitForFunction(() => (document.querySelector("#projection")?.shadowRoot?.querySelector(".lar-projection")?.childElementCount ?? 0) > 0, undefined, { timeout: WAIT });
}

async function openPage(context: BrowserContext): Promise<Page> {
  const p = await context.newPage();
  p.on("console", (m) => logs.push(m.text()));
  p.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
  await p.goto(url);
  await awaitLive(p);
  return p;
}

const frameOf = (title: string, edit: boolean) =>
  `.tc-story-river .tc-tiddler-frame[data-tiddler-title="${title}"]${edit ? "" : ":not(.tc-tiddler-edit-frame)"}`;

async function confirmSettled(p: Page, title: string): Promise<boolean> {
  // The confirm and the leave are asked in one synchronous turn, so the act is still pending when the page answers
  // whether it holds the leave: the hold reads the act's own pending count, never a race with its result.
  const asksHold = await wiki(p).evaluate((host) => {
    (host.shadowRoot!.querySelector('button[title="Confirm changes to this tiddler"]') as HTMLElement).click();
    const leave = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(leave);
    return leave.defaultPrevented;
  });
  await p.waitForFunction((sel) => !!document.querySelector("#projection")?.shadowRoot?.querySelector(sel), frameOf(title, false), { timeout: WAIT });
  return asksHold;
}

/** The body the page paints for a title, or null when the title stands in no frame. */
async function paintedBody(p: Page, title: string): Promise<string | null> {
  return wiki(p).evaluate((host, t) => host.shadowRoot?.querySelector(`.tc-tiddler-frame[data-tiddler-title="${t}"] .tc-tiddler-body`)?.textContent ?? null, title);
}

/** Open a tiddler through the page's search box, the page's own road to a title the story no longer holds. */
async function openByTitle(p: Page, title: string): Promise<boolean> {
  if (await paintedBody(p, title) !== null) return true;
  const search = wiki(p).locator('input[type="search"]').first();
  if (await search.count() === 0) return false;
  await search.fill(title);
  const link = wiki(p).locator(`a.tc-tiddlylink:text-is("${title}")`).first();
  await link.waitFor({ timeout: 30_000 }).catch(() => undefined);
  if (await link.count() === 0) return false;
  await link.click();
  await p.waitForFunction((sel) => !!document.querySelector("#projection")?.shadowRoot?.querySelector(sel), frameOf(title, true), { timeout: 30_000 }).catch(() => undefined);
  return await paintedBody(p, title) !== null;
}

/** What the vessel read of its own rest asks (`asked/rested/stalled`, shown on the document root): its Repo held the island's heads and flushed them. */
async function restState(p: Page): Promise<{ asked: number; rested: number; stalled: number }> {
  const raw = await p.evaluate(() => document.documentElement.dataset["larRest"] ?? "0/0/0");
  const [asked, rested, stalled] = raw.split("/").map(Number);
  return { asked: asked ?? 0, rested: rested ?? 0, stalled: stalled ?? 0 };
}

/** Wait on the vessel's own word: more rests answered than `before`, and no ask still unanswered. A stall fails the wait by name. */
async function awaitRested(p: Page, before: number): Promise<void> {
  const deadline = Date.now() + WAIT;
  for (;;) {
    const state = await restState(p);
    if (state.stalled > 0) throw new Error(`the vessel named a stalled rest: ${JSON.stringify(state)}`);
    if (state.rested > before && state.asked === state.rested) return;
    if (Date.now() > deadline) throw new Error(`the vessel never answered the rest ask: ${JSON.stringify(state)}`);
    await new Promise((r) => setImmediate(r));
  }
}

/** Make a tiddler through the page editor, confirm it and let its first body rest; returns the page and the title. */
async function madeAndRested(context: BrowserContext, tag: string): Promise<{ page: Page; title: string }> {
  const page = await openPage(context);
  const before = (await restState(page)).rested;
  const title = `Rest ${tag} ${Date.now()}`;
  await wiki(page).evaluate((h) => (h.shadowRoot!.querySelector('button[title="Create a new tiddler"]') as HTMLElement).click());
  await wiki(page).locator("input.tc-titlebar").fill(title);
  await wiki(page).locator("textarea.tc-edit-texteditor-body").pressSequentially(FIRST, { delay: 5 });
  await confirmSettled(page, title);
  await awaitRested(page, before);
  return { page, title };
}

/** Edit the standing tiddler and confirm: the frame leaves edit mode and the page paints the second body. */
async function editAndConfirm(page: Page, title: string): Promise<boolean> {
  await wiki(page).evaluate((h, t) => (h.shadowRoot!.querySelector(`.tc-tiddler-frame[data-tiddler-title="${t}"] button[title="Edit this tiddler"]`) as HTMLElement).click(), title);
  const area = wiki(page).locator("textarea.tc-edit-texteditor-body");
  await area.waitFor({ timeout: 30_000 });
  await area.fill("");
  await area.pressSequentially(SECOND, { delay: 5 });
  const asksHold = await confirmSettled(page, title);
  expect(await paintedBody(page, title)).toContain(SECOND);
  return asksHold;
}

/** Reload the way a person does: each leave the page holds is a prompt the person answers by staying, then asks again. */
async function reloadHonouringHolds(page: Page): Promise<{ holds: number }> {
  let holds = 0;
  page.on("dialog", (dialog) => {
    if (dialog.type() === "beforeunload") { holds++; void dialog.dismiss(); } else void dialog.accept();
  });
  await page.evaluate(() => { (window as unknown as { __stayed?: boolean }).__stayed = true; });
  const deadline = Date.now() + WAIT;
  for (;;) {
    await page.reload().catch(() => undefined);
    const stayed = await page.evaluate(() => (window as unknown as { __stayed?: boolean }).__stayed === true).catch(() => false);
    if (!stayed) return { holds };
    if (Date.now() > deadline) throw new Error("the page held its leave past the wait");
    await new Promise((r) => setImmediate(r));
  }
}

async function bodyAfterReload(page: Page, title: string, heldBy?: { holds: number }): Promise<string | null> {
  const { holds } = await reloadHonouringHolds(page);
  if (heldBy) heldBy.holds = holds;
  await awaitLive(page);
  // The page's search finds a title as the wiki indexes it; a slow host indexes late, so ask until the page names it.
  const deadline = Date.now() + WAIT;
  while (!(await openByTitle(page, title))) {
    if (Date.now() > deadline) return null;
    await new Promise((r) => setImmediate(r));
  }
  return paintedBody(page, title);
}

beforeAll(async () => {
  scratch = mkdtempSync(join(stageDir(), "rest-before-reload-"));
  hearth = await openStaged({
    tag: "rest-before-reload",
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

describe("a confirmed edit survives a reload that follows at once", () => {
  test("R1 — RED: edit, confirm, reload at once: the page reads the edited body", async () => {
    expect(url, "the hearth printed its URL").toMatch(/^https?:/);
    const context = await browser!.newContext();
    await armTestCustody(context, "rest-before-reload-r1");
    const { page, title } = await madeAndRested(context, "R1");
    const asksHold = await editAndConfirm(page, title);
    expect(asksHold, "the page holds the leave while the confirmed act waits for its result").toBe(true);
    const held = { holds: 0 };
    const body = await bodyAfterReload(page, title, held);
    expect(body, "the reloaded page reads the title back").not.toBeNull();
    expect(body, "the reloaded page reads the edited body, not the body from before the edit").toContain(SECOND);
    await context.close();
  });

  test("R2 — CONTROL: the same steps with the reload held until the edit rests in storage: the page reads the edited body", async () => {
    const context = await browser!.newContext();
    await armTestCustody(context, "rest-before-reload-r2");
    const { page, title } = await madeAndRested(context, "R2");
    const before = (await restState(page)).rested;
    await editAndConfirm(page, title);
    await awaitRested(page, before);
    const held = { holds: 0 };
    const body = await bodyAfterReload(page, title, held);
    expect(body, "the reloaded page reads the title back").not.toBeNull();
    expect(body, "a rested edit reads back after a reload").toContain(SECOND);
    await context.close();
  });
});
