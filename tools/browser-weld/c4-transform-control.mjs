/**
 * C4 transform control.
 *
 * The same module Worker crosses the same context route twice. The first route
 * returns the worker source unchanged. The second applies the C4 boot trace
 * transform. Receipts belong to the worker island and name entry, WASM, kernel
 * import, ready, and error boundaries; a timeout remains a measured absence.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";

process.env.LEAF_BOOT_TRACE = "1";
const { instrumentBootSource } = await import("./leaf-continuity.mjs");

const WORKER_PATH = "http://c4-transform-control.test/c4-worker.js";
const KERNEL_PATH = "http://c4-transform-control.test/kernel.js";
const CONTROL_TIMEOUT_MS = 2_000;

const workerSource = `
  function registerWorkerErrorRelay(name) {
    self.addEventListener("error", (event) => {
      self.postMessage({ type: "worker-error", detail: event.message || name });
    });
  }
  registerWorkerErrorRelay("daemon-worker");
  self.postMessage({ type: "worker-entry" });
  async function initKeyhiveWasm() {}
  await initKeyhiveWasm();
  await import("@lararium/browser/browser-daemon-island");
  self.postMessage({ type: "ready" });
`;

function runnable(source) {
  // Keep the transform's exact production import anchor while making the
  // isolated fixture's kernel import resolvable in this browser context.
  return source.replace(
    'await import("@lararium/browser/browser-daemon-island");',
    `await import("${KERNEL_PATH}");`,
  );
}

async function runCase(browser, mode) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const receipts = [];
  await context.route("**/*", async (route) => {
    const url = route.request().url();
    if (url === WORKER_PATH) {
      const transformed = mode === "instrumented" ? instrumentBootSource(workerSource) : workerSource;
      return route.fulfill({
        status: 200,
        contentType: "text/javascript",
        body: runnable(transformed),
      });
    }
    if (url === KERNEL_PATH) {
      return route.fulfill({ status: 200, contentType: "text/javascript", body: "export {};" });
    }
    if (url === "http://c4-transform-control.test/") {
      return route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<main>C4 transform control</main>",
      });
    }
    return route.continue();
  });
  await page.goto("http://c4-transform-control.test/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => { globalThis.__c4Receipts = []; });
  // The page's inline script starts before the receipt array assignment. The
  // worker is intentionally created by a queued task so the array is ready.
  await page.evaluate((url) => {
    globalThis.__c4Receipts = [];
    const worker = new Worker(url, { type: "module" });
    worker.onmessage = (event) => {
      globalThis.__c4Receipts.push(event.data);
      if (event.data.type === "ready" || event.data.type === "worker-error") worker.terminate();
    };
    worker.onerror = (event) => globalThis.__c4Receipts.push({ type: "worker-error", detail: event.message || "worker.onerror" });
  }, WORKER_PATH);
  try {
    await page.waitForFunction(() => globalThis.__c4Receipts.some((receipt) => ["ready", "worker-error"].includes(receipt.type)), null, { timeout: CONTROL_TIMEOUT_MS });
  } catch {
    receipts.push(...await page.evaluate(() => globalThis.__c4Receipts));
    await page.close();
    await context.close();
    return { mode, receipts, terminal: "timeout" };
  }
  receipts.push(...await page.evaluate(() => globalThis.__c4Receipts));
  await page.close();
  await context.close();
  return { mode, receipts, terminal: receipts.some((receipt) => receipt.type === "ready") ? "ready" : "error" };
}

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
try {
  const unchanged = await runCase(browser, "unchanged");
  const instrumented = await runCase(browser, "instrumented");
  assert.equal(unchanged.terminal, "ready", JSON.stringify(unchanged));
  assert.equal(instrumented.terminal, "ready", JSON.stringify(instrumented));
  assert.deepEqual(
    unchanged.receipts.filter(({ type }) => ["worker-entry", "ready", "worker-error"].includes(type)).map(({ type }) => type),
    ["worker-entry", "ready"],
  );
  assert.deepEqual(
    instrumented.receipts
      .map(({ type, __laresC4BootTrace }) => type ?? __laresC4BootTrace)
      .filter((type) => typeof type === "string" && type.startsWith("worker:")),
    ["worker:entry", "worker:wasm-start", "worker:wasm-ready", "worker:kernel-import-start", "worker:kernel-imported"],
  );
  console.log(JSON.stringify({ unchanged, instrumented }));
} finally {
  await browser.close();
}
