/**
 * e2e/vessel-worker — THE VESSEL RUNS ON ITS OWN WORKER'S THREAD, AND THE PAGE PAINTS (browser-vessel-lift#/the-slices, slice 2).
 *
 * The built page boots in a real Chromium on a fresh origin. The page builds one dedicated vessel worker and talks to it over
 * its port alone: the worker founds a fresh browser vessel (the custody form the vessel raises gets the published test
 * route), the vessel's frames cross to the page, the projection paints, and the mirror stands on the first frame that names
 * the surface.
 *
 *   V1 — the page's workers include the vessel worker (`vessel.worker`), the vessel founds through it (the did row names
 *        the vessel's key the worker reported), the phases reach `live`, the page's first paint reads, and the mirror shows: the far-side barrier for
 *        every claim is the page's own reading of what the worker sent (a phase, a frame, a status).
 *   V2 — the page's own thread loads no vessel module: the window's own resource timeline (a worker's fetches land in that
 *        worker's timeline, never the window's) names the page's entry chunk and none of the vessel's chunks: the vessel
 *        host, Keyhive's slim glue and its WASM base64.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { afterAll, beforeAll, test } from "vitest";
import { chromium } from "playwright";
// The published test route answers the custody form a fresh vessel raises (a harness door; never a person's passphrase).
import { armTestCustody } from "../../../lararium-node/probes/browser-test-custody.js";

const root = resolve(import.meta.dirname, "../../../..");
const port = Number(process.env.LAR_WEB_VESSEL_WORKER_PORT ?? 5423);
const baseUrl = `http://127.0.0.1:${port}`;
const WAIT = 90_000;
let preview: ReturnType<typeof spawn> | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>>;

beforeAll(async () => {
  preview = spawn(process.execPath, [
    resolve(root, "packages/lararium-web/node_modules/vite/bin/vite.js"), "preview", "--host", "127.0.0.1",
    "--port", String(port), "--strictPort",
  ], { cwd: resolve(root, "packages/lararium-web"), stdio: "ignore" });
  let last: unknown;
  for (let attempt = 0; attempt < 80; attempt++) {
    try { if ((await fetch(baseUrl)).ok) { last = undefined; break; } } catch (error) { last = error; }
    await new Promise((r) => setTimeout(r, 125));
  }
  assert.equal(last, undefined, `built Pronaos preview did not open on ${baseUrl}`);
  browser = await chromium.launch({ headless: true });
}, 60_000);
afterAll(async () => { await browser?.close(); preview?.kill("SIGTERM"); });

test("V1/V2 — the page builds the vessel worker, the vessel founds through it, the mirror paints its first frame, and the page's own thread loads no vessel module", { timeout: 180_000 }, async () => {
  const context = await browser.newContext();
  await armTestCustody(context, "vessel-worker");
  const page = await context.newPage();
  const faults: string[] = [];
  page.on("pageerror", (e) => faults.push(`[page] ${e.message}`));
  try {
    await page.goto(baseUrl);
    await page.waitForFunction(() => [...document.querySelectorAll("#phases .phase")].some((p) => p.textContent === "live"), undefined, { timeout: WAIT });

    const workers = page.workers().map((w) => w.url());
    assert.ok(workers.some((url) => /\/assets\/vessel\.worker-[\w-]+\.js/.test(url)), `the page builds the vessel worker (workers: ${workers.join(", ") || "none"})`);

    await page.waitForFunction(() => [...document.querySelectorAll("#vessel .row")].some((r) => r.querySelector(".k")?.textContent === "did" && /^0x[0-9a-f]{64}$/.test(r.querySelector(".v")?.textContent ?? "")), undefined, { timeout: WAIT });
    await page.waitForFunction(() => (window as Window & { __larVesselMetrics?: unknown }).__larVesselMetrics !== undefined, undefined, { timeout: WAIT });
    await page.waitForFunction(() => document.querySelector("#mirror")?.getAttribute("data-lar-shown") === "mirror", undefined, { timeout: WAIT });

    // The window's own timeline: what the page's main thread fetched. A worker's module loads land in its own timeline.
    const pageScripts = await page.evaluate(() => performance.getEntriesByType("resource").map((e) => e.name).filter((name) => name.endsWith(".js")));
    // CONTROL for V2: the page's own thread did load scripts (the entry chunk), so an empty list reads as a blind instrument.
    assert.ok(pageScripts.some((url) => /\/assets\/index-[\w-]+\.js/.test(url)), `the instrument reads the page's own entry chunk (scripts: ${pageScripts.join(", ")})`);
    // and a module the page's thread imports later (the mirror's glass chunk, a dynamic import), so a late load reads too.
    assert.ok(pageScripts.some((url) => /\/assets\/glass-[\w-]+\.js/.test(url)), `the instrument reads the page's own dynamic import (scripts: ${pageScripts.join(", ")})`);
    const vesselChunks = pageScripts.filter((url) => /\/assets\/(?:vessel-host|slim|wasm-base64)-[\w-]+\.js/.test(url));
    assert.deepEqual(vesselChunks, [], "the page's own thread requests no vessel chunk");
    assert.deepEqual(faults, [], "no page error while the vessel founds and the mirror paints");
  } finally { await context.close(); }
});
