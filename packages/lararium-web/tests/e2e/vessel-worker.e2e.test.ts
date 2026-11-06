/**
 * e2e/vessel-worker — THE VESSEL RUNS ON ITS OWN WORKER'S THREAD, AND THE PAGE PAINTS (browser-vessel-lift#/the-slices, slice 2).
 *
 * The built page boots in a real Chromium on a fresh origin. The page builds one dedicated vessel worker and talks to it over
 * its port alone: the worker founds a fresh browser vessel (the custody form the vessel raises gets the published test
 * route), the vessel's frames cross to the page, the projection paints, and the mirror stands on the first frame that names
 * the surface.
 *
 *   V1 — the page's workers include the vessel worker (`vessel.worker`), the vessel founds through it (the did row names a
 *        `did:`), the phases reach `live`, the page's first paint reads, and the mirror shows: the far-side barrier for
 *        every claim is the page's own reading of what the worker sent (a phase, a frame, a status).
 *   V2 — the page's own thread loads no vessel module: every script the page's main frame requested reads clear of the
 *        vessel chunks the build names (`automerge-repo`'s Repo and the keyhive glue load only as worker requests).
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
  const pageScripts: string[] = [];
  page.on("pageerror", (e) => faults.push(`[page] ${e.message}`));
  // A request the page's main frame makes for a script: the page's own thread loads it. A worker's requests carry no frame.
  page.on("request", (request) => {
    if (request.resourceType() !== "script") return;
    let frame: unknown = null;
    try { frame = request.frame(); } catch { frame = null; }
    if (frame === page.mainFrame()) pageScripts.push(request.url());
  });
  try {
    await page.goto(baseUrl);
    await page.waitForFunction(() => [...document.querySelectorAll("#phases .phase")].some((p) => p.textContent === "live"), undefined, { timeout: WAIT });

    const workers = page.workers().map((w) => w.url());
    assert.ok(workers.some((url) => /\/assets\/vessel\.worker-[\w-]+\.js/.test(url)), `the page builds the vessel worker (workers: ${workers.join(", ") || "none"})`);

    await page.waitForFunction(() => [...document.querySelectorAll("#vessel .row")].some((r) => r.querySelector(".k")?.textContent === "did" && (r.querySelector(".v")?.textContent ?? "").startsWith("did:")), undefined, { timeout: WAIT });
    await page.waitForFunction(() => (window as Window & { __larVesselMetrics?: unknown }).__larVesselMetrics !== undefined, undefined, { timeout: WAIT });
    await page.waitForFunction(() => document.querySelector("#mirror")?.getAttribute("data-lar-shown") === "mirror", undefined, { timeout: WAIT });

    // CONTROL for V2: the page's own thread did load scripts (the entry chunk), so an empty list reads as a blind instrument.
    assert.ok(pageScripts.some((url) => /\/assets\/index-[\w-]+\.js/.test(url)), `the instrument reads the page's own entry chunk (scripts: ${pageScripts.join(", ")})`);
    const vesselChunks = pageScripts.filter((url) => /\/assets\/(?:open-browser-vessel|browser-custody|browser-vessel-identity|seed-wrap-prf|ward-core|slim|wasm-base64)[-.]/.test(url));
    assert.deepEqual(vesselChunks, [], "the page's own thread requests no vessel chunk");
    assert.deepEqual(faults, [], "no page error while the vessel founds and the mirror paints");
  } finally { await context.close(); }
});
