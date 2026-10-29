import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { afterAll, beforeAll, test } from "vitest";
import { resolve } from "node:path";
import { chromium } from "playwright";
// The published test route answers the custody form a fresh vessel raises (a harness door; never a person's passphrase).
import { armTestCustody } from "../../../lararium-node/dist/probes/browser-test-custody.js";

const root = resolve(import.meta.dirname, "../../../..");
const port = Number(process.env.LAR_WEB_E2E_PORT ?? 5418);
const baseUrl = process.env.LAR_WEB_E2E_URL ?? `http://127.0.0.1:${port}`;
let preview;
let browser;
let context;
let page;
let previewExitCode = null;
const wikiWorkerErrors = [];
const browserConsole = [];

beforeAll(async () => {
  if (!process.env.LAR_WEB_E2E_URL) {
    preview = spawn(process.execPath, [
      resolve(root, "packages/lararium-web/node_modules/vite/bin/vite.js"), "preview", "--host", "127.0.0.1",
      "--port", String(port), "--strictPort",
    ], { cwd: resolve(root, "packages/lararium-web"), stdio: "ignore" });
    preview.on("exit", (code) => { previewExitCode = code; });
    await waitForPreview();
  }
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext();
  await armTestCustody(context, "shore-writes");
  page = await context.newPage();
  page.on("console", (message) => {
    browserConsole.push(message.text());
    if (message.text().includes("[wiki-worker] error")) wikiWorkerErrors.push(message.text());
  });
  page.on("pageerror", (error) => wikiWorkerErrors.push(`[page] ${error.message}`));
});

afterAll(async () => {
  await context?.close();
  await browser?.close();
  if (preview && preview.exitCode === null) preview.kill("SIGTERM");
});

async function waitForPreview(): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 80; attempt++) {
    if (preview?.exitCode !== null || previewExitCode !== null) break;
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch (error) { lastError = error; }
    await new Promise((resolve) => setTimeout(resolve, 125));
  }
  assert.fail(`built Pronaos preview did not open on ${baseUrl}: ${String(lastError ?? previewExitCode)}`);
}

test("served wiki saves a draft tiddler without worker errors", async () => {
  wikiWorkerErrors.length = 0;
  browserConsole.length = 0;
  await page.goto(baseUrl);
  await waitForLivePage();

  const wiki = page.locator("#mirror");
  await wiki.evaluate((host) => host.shadowRoot.querySelector('button[title="Create a new tiddler"]').click());
  await wiki.locator("input.tc-titlebar").fill("Shore Write Probe");
  // The mirror's editor is TW5's own framed editor: the person types in its iframe.
  const bodyEditor = page.frameLocator("#mirror iframe").first().locator("textarea");
  await bodyEditor.fill("newer local composition — 漢字");
  // A title edit writes the draft again; the returned echo must not replace the newer text the person typed.
  await wiki.locator("input.tc-titlebar").fill("Shore Write Probe Updated");
  await page.waitForTimeout(80);
  assert.equal(await bodyEditor.inputValue(), "newer local composition — 漢字");

  // The editor's TW5 save action receives a worker-local view contract, never a global window.
  await wiki.locator('button[title="Confirm changes to this tiddler"]').click();
  await page.waitForFunction(() => document.querySelector("#mirror")?.shadowRoot
    ?.querySelector(".lar-mirror")?.innerText.includes("newer local composition — 漢字") ?? false,
    undefined, { timeout: 20_000 });

  assert.deepEqual(wikiWorkerErrors, [], "the served save walk emits zero [wiki-worker] error lines");

  // Only an admitted writable node fixture stands as a reload durability witness. Local preview
  // proves the browser input/save/projection leg and does not claim node persistence.
  if (process.env.LAR_WEB_E2E_RELOAD_PROOF === "1") {
    await page.reload();
    await page.waitForFunction(() => [...document.querySelectorAll("#phases .phase")]
      .some((phase) => phase.textContent === "live"), undefined, { timeout: 60_000 });
    const reloadedWiki = page.locator("#mirror");
    await reloadedWiki.locator('input[type="search"]').fill("Shore Write Probe");
    await reloadedWiki.locator("button").filter({ hasText: "matches" }).first().click();
    await reloadedWiki.locator(".tc-search-drop-down").waitFor({ state: "visible", timeout: 20_000 });
    await page.waitForFunction(() => document.querySelector("#mirror")?.shadowRoot
      ?.querySelector(".tc-search-drop-down")?.innerText.includes("Shore Write Probe") ?? false,
      undefined, { timeout: 20_000 });
  }

});

test("the vessel page reports its instruments: long animation frames and heap after first paint, or names each absent", async () => {
  wikiWorkerErrors.length = 0;
  const bootContext = await browser.newContext();
  await armTestCustody(bootContext, "page-instruments");
  const bootPage = await bootContext.newPage();
  try {
    await bootPage.goto(baseUrl);
    await waitForLivePage(bootPage);
    const instruments = await bootPage.waitForFunction(() =>
      (window as Window & { __larVesselMetrics?: unknown }).__larVesselMetrics ?? false)
      .then((handle) => handle.jsonValue() as Promise<{
        longAnimationFrames: { supported: boolean; entries?: unknown[]; reading?: string };
        heapAfterFirstPaint: { bytes?: number; reading?: string };
      }>);
    assert.ok(instruments.longAnimationFrames.supported
      ? Array.isArray(instruments.longAnimationFrames.entries)
      : instruments.longAnimationFrames.reading === "absent", "LoAF reports entries or names absence");
    assert.ok(typeof instruments.heapAfterFirstPaint.bytes === "number"
      || instruments.heapAfterFirstPaint.reading === "absent", "heap after first paint reports bytes or names absence");
    // Chromium carries both instruments, so here each reads a number, never the absence.
    assert.equal(instruments.longAnimationFrames.supported, true, "Chromium carries the long-animation-frames observer");
    assert.equal(typeof instruments.heapAfterFirstPaint.bytes, "number", "Chromium reports heap bytes after first paint");
  } finally {
    await bootContext.close();
  }
});

test("a stale render target answers on its originating projected surface", async () => {
  wikiWorkerErrors.length = 0;
  await page.goto(baseUrl);
  await waitForLivePage();
  // The stale-target walk drives the named floor, the worker-rendered view; the page shows the mirror, so the probe shows the floor.
  await page.addStyleTag({ content: "#mirror{display:none !important} #projection{display:block !important}" });
  const wiki = page.locator("#projection");
  // The page relays a click only to a node whose `data-lar-on` stamp binds it, and names a node by its render id
  // where no template control id stands on it, so the probe takes such a node.
  const link = wiki.locator('[data-lar-rid][data-lar-on~="click"]:not([data-control-id])').first();
  const staleRid = `stale-${crypto.randomUUID()}`;
  await link.evaluate((element, rid) => element.setAttribute("data-lar-rid", rid), staleRid);
  await link.click();
  // The worker answers stale-target and runs nothing; the page paints the words beside the control it named.
  const result = wiki.locator(`.lar-refusals > output[data-lar-for="${staleRid}"]`);
  await result.waitFor({ state: "visible", timeout: 20_000 });
  assert.equal(await result.getAttribute("data-lar-reason"), "stale-target");
  assert.equal(await result.getAttribute("role"), "status");
  assert.match((await result.textContent()) ?? "", /changed before your action arrived/);
  assert.deepEqual(wikiWorkerErrors, [], "stale target is an answer, not a worker error");
});

test("served wiki opens the TW5 search dropdown without worker errors", async () => {
  wikiWorkerErrors.length = 0;
  browserConsole.length = 0;
  await page.goto(baseUrl);
  await waitForLivePage();
  const wiki = page.locator("#mirror");
  await wiki.locator('input[type="search"]').fill("no-such-shore-result");
  await wiki.locator("button").filter({ hasText: "matches" }).first().click();
  const dropdown = wiki.locator(".tc-search-drop-down");
  await dropdown.waitFor({ state: "visible", timeout: 20_000 });
  // TW5 lays the popup out itself (in flow, beneath the search box): it stands open with a real extent.
  const placement = await dropdown.evaluate((element) => ({ position: getComputedStyle(element).position, rect: element.getBoundingClientRect().toJSON() }));
  assert.ok(placement.rect.width > 0 && placement.rect.height > 0, "the open popup has an extent");
  assert.deepEqual(wikiWorkerErrors, [], "the served popup walk emits zero [wiki-worker] error lines");
});

async function waitForLivePage(target = page): Promise<void> {
  try {
    await target.waitForFunction(() => [...document.querySelectorAll("#phases .phase")]
      .some((phase) => phase.textContent === "live"), undefined, { timeout: 20_000 });
    await target.waitForFunction(() => {
      const host = document.querySelector("#mirror");
      const pane = host?.shadowRoot?.querySelector(".lar-mirror");
      return host?.getAttribute("data-lar-shown") === "mirror" && pane !== null && pane !== undefined && pane.childElementCount > 0;
    }, undefined, { timeout: 20_000 });
  } catch (error) {
    const faults = browserConsole.filter((line) => line.includes("[daemon-island:fault]"));
    assert.fail(`${String(error)}\nphases=${await target.locator("#phases").innerText()}\nfaults=${faults.join("\n")}`);
  }
}
