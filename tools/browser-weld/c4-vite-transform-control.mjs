/**
 * C4 served-worker transform control.
 *
 * The isolated control proves that the trace transform can preserve a small
 * Worker. This witness carries the unchanged and transformed source through
 * Vite's actual web graph. It names only what the browser reports: Worker
 * spawn, trace markers, browser errors, and the bounded terminal surface.
 *
 * No readiness branch, manifest order, or Worker behavior changes here. The
 * route belongs to this browser island and disappears with its context.
 *
 * Direct run: stand Vite on an owned port, then set WELD_WEB_URL to that URL.
 * The JSON result keeps host/Worker receipts and script responses together;
 * this witness does not write the runner's vite.log/weld.log/c4.log artifacts.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";

process.env.LEAF_BOOT_TRACE = "1";
const { instrumentBootSource } = await import("./leaf-continuity.mjs");

const WEB = process.env.WELD_WEB_URL ?? "http://localhost:5173";
const CONTROL_TIMEOUT_MS = Number(process.env.C4_VITE_CONTROL_MS ?? 8_000);

function isJavaScript(response) {
  return /javascript|ecmascript/.test(response.headers()["content-type"] ?? "");
}

function isDaemonWorkerUrl(url) {
  return url.includes("daemon.worker.ts") || url.includes("daemon.worker-");
}

function initiatorOf(request) {
  try {
    return request.frame()?.url() ?? null;
  } catch {
    return null;
  }
}

function addEarliestWorkerMarker(source) {
  return `self.postMessage({ __laresC4BootTrace: "worker:early" });\n${source}`;
}

async function installWorkerReceipt(page) {
  await page.addInitScript(() => {
    const NativeWorker = globalThis.Worker;
    const store = [];
    globalThis.__laresC4WorkerReceipts = store;
    function receipt(kind, detail = {}) {
      store.push({ kind, ...detail });
    }
    function WrappedWorker(...args) {
      const worker = new NativeWorker(...args);
      const url = String(args[0] ?? "");
      receipt("constructed", { url });
      worker.addEventListener("message", (event) => {
        const data = event.data;
        const phase = data && typeof data === "object" ? data.__laresC4BootTrace : undefined;
        if (phase) receipt("marker", { phase, detail: data.detail ?? null });
        if (data && typeof data === "object" && data.type === "ready") receipt("raw-ready", { type: data.type });
        receipt("message", { type: data?.type ?? null, phase: phase ?? null });
      });
      worker.addEventListener("error", (event) => receipt("worker-error", {
        message: event.message ?? "",
        filename: event.filename ?? "",
        lineno: event.lineno ?? null,
        colno: event.colno ?? null,
      }));
      worker.addEventListener("messageerror", () => receipt("messageerror"));
      const postMessage = worker.postMessage.bind(worker);
      worker.postMessage = (message, transfer) => {
        const transferCount = Array.isArray(transfer) ? transfer.length : 0;
        const manifest = Boolean(message && typeof message === "object" && (
          message.type === "manifest" || message.manifest || message.syncPort
        ));
        receipt("host-post", { manifest, transferCount, type: message?.type ?? null });
        return postMessage(message, transfer);
      };
      return worker;
    }
    WrappedWorker.prototype = NativeWorker.prototype;
    Object.setPrototypeOf(WrappedWorker, NativeWorker);
    globalThis.Worker = WrappedWorker;
  });
}

async function runCase(browser, mode) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const receipts = [];
  const servedScripts = [];
  const transformedScripts = [];
  const awaitIslandMsgSources = [];
  const workerHandleSources = [];
  const workerHandleManifestMarkerSources = [];
  const daemonWorkerEaSources = [];
  const consoleErrors = [];
  const scriptReceipts = [];
  const workerResponseReceipts = [];
  const consoleReceipts = [];

  page.on("console", (message) => {
    const text = message.text();
    const location = message.location();
    consoleReceipts.push({ type: message.type(), text, location });
    if (message.type() === "error") consoleErrors.push(text);
    if (text.startsWith("[C4 boot]")) receipts.push(text);
  });
  page.on("pageerror", (error) => receipts.push(`pageerror: ${error.message}`));
  page.on("worker", (worker) => receipts.push(`worker:spawn ${worker.url()}`));
  await installWorkerReceipt(page);
  context.on("request", (request) => {
    if (request.resourceType() === "script") {
      scriptReceipts.push({
        event: "request",
        url: request.url(),
        resourceType: request.resourceType(),
        initiator: initiatorOf(request),
      });
    }
  });
  context.on("requestfailed", (request) => {
    if (request.resourceType() === "script") {
      scriptReceipts.push({
        event: "failed",
        url: request.url(),
        status: null,
        resourceType: request.resourceType(),
        initiator: initiatorOf(request),
        error: request.failure()?.errorText ?? "unknown",
      });
      receipts.push(`script-failed ${request.url()} — ${request.failure()?.errorText ?? "unknown"}`);
    }
  });
  context.on("response", (response) => {
    if (response.request().resourceType() === "script") {
      const receipt = {
        event: "response",
        url: response.url(),
        status: response.status(),
        resourceType: response.request().resourceType(),
        initiator: initiatorOf(response.request()),
      };
      scriptReceipts.push(receipt);
      if (isDaemonWorkerUrl(response.url())) workerResponseReceipts.push(receipt);
      if (response.status() >= 400) {
        receipts.push(`script-response ${response.status()} ${response.url()}`);
      }
    }
  });

  await context.route(/\.(?:[cm]?[jt]sx?)(?:\?.*)?$/, async (route) => {
    let response;
    try {
      response = await route.fetch();
    } catch (error) {
      receipts.push(`script-route-failed ${route.request().url()} — ${error instanceof Error ? error.message : String(error)}`);
      await route.continue();
      return;
    }
    if (!isJavaScript(response)) return route.fulfill({ response });
    const url = route.request().url();
    servedScripts.push(url);
    if (mode === "unchanged") return route.fulfill({ response });
    const source = await response.text();
    let transformed = instrumentBootSource(source);
    if (mode === "instrumented" && source.includes("awaitIslandMsg") && source.includes("isIslandToVesselMsg(raw)")) awaitIslandMsgSources.push(url);
    if (mode === "instrumented" && source.includes("browserWorkerHandle") && source.includes("w.addEventListener(\"message\", fn)")) workerHandleSources.push(url);
    if (mode === "instrumented" && source.includes("const workerEa") && source.includes("worker.listen(h)")) daemonWorkerEaSources.push(url);
    if (mode === "instrumented" && isDaemonWorkerUrl(url)) transformed = addEarliestWorkerMarker(transformed);
    if (mode === "instrumented" && transformed.includes("host:worker-handle-manifest-dispatch")) workerHandleManifestMarkerSources.push(url);
    if (transformed !== source) transformedScripts.push(url);
    return route.fulfill({ response, body: transformed });
  });

  const target = new URL(WEB);
  target.searchParams.set("c4trace", "1");
  try {
    await page.goto(target.href, { waitUntil: "domcontentloaded" });
  } catch (error) {
    receipts.push(`navigation-error: ${error instanceof Error ? error.message : String(error)}`);
  }
  let terminal = "timeout";
  try {
    await page.waitForFunction(() => {
      const status = document.getElementById("status")?.textContent ?? "";
      return status.includes("live — sovereign local island") || status.includes("boot failed:");
    }, null, { timeout: CONTROL_TIMEOUT_MS });
    const status = await page.locator("#status").textContent();
    terminal = status?.includes("live — sovereign local island") ? "live" : "failed";
  } catch {
    terminal = "timeout";
  }
  const surface = await page.evaluate(() => ({
    status: document.getElementById("status")?.textContent ?? "",
    vessel: document.getElementById("vessel")?.textContent?.slice(0, 240) ?? "",
  }));
  const workerReceipts = await page.evaluate(() => globalThis.__laresC4WorkerReceipts ?? []);
  const outcome = (kind) => workerReceipts.filter((receipt) => receipt.kind === kind);
  const hostTrace = receipts.filter((receipt) => receipt.startsWith("[C4 boot] host:"));
  const hostOutcome = (phase) => hostTrace.filter((receipt) => receipt === `[C4 boot] host:${phase}` || receipt.startsWith(`[C4 boot] host:${phase} `));
  const hostVisibleReady = surface.status.includes("live — sovereign local island");
  const result = {
    mode,
    terminal,
    worker: receipts.filter((receipt) => receipt.startsWith("worker:spawn")),
    workerTrace: receipts.filter((receipt) => receipt.includes("worker:")),
    errors: [...consoleErrors, ...receipts.filter((receipt) => receipt.startsWith("pageerror:") || receipt.startsWith("script-") || receipt.startsWith("navigation-error:"))],
    surface,
    servedScripts: servedScripts.length,
    transformedScripts: transformedScripts.length,
    awaitIslandMsgSources,
    workerHandleSources,
    workerHandleManifestMarkerSources,
    daemonWorkerEaSources,
    workerOutcomes: {
      constructed: outcome("constructed"),
      workerResponse: workerResponseReceipts,
      earlyMarker: outcome("marker").filter((receipt) => receipt.phase === "worker:early"),
      workerEntry: outcome("marker").filter((receipt) => receipt.phase === "worker:entry"),
      manifestReceived: outcome("marker").filter((receipt) => receipt.phase === "worker:manifest-received"),
      manifestRejected: outcome("marker").filter((receipt) => receipt.phase === "worker:manifest-rejected"),
      manifestAccepted: outcome("marker").filter((receipt) => receipt.phase === "worker:manifest-accepted"),
      shoreManifestInbound: outcome("marker").filter((receipt) => receipt.phase === "worker:shore-manifest-inbound"),
      preFirstBreath: outcome("marker").filter((receipt) => receipt.phase === "worker:pre-first-breath"),
      breath: outcome("message").filter((receipt) => receipt.type === "breath"),
      preEa: outcome("marker").filter((receipt) => receipt.phase === "worker:pre-ea"),
      ea: outcome("message").filter((receipt) => receipt.type === "ea"),
      startupError: outcome("marker").filter((receipt) => receipt.phase === "worker:startup-error"),
      rawReady: outcome("raw-ready"),
      hostManifestPost: outcome("host-post").filter((receipt) => receipt.manifest),
      hostVisibleReady,
      workerError: outcome("worker-error"),
      messageerror: outcome("messageerror"),
      timeout: terminal === "timeout",
      hostChain: {
        workerEaResolved: hostOutcome("workerEa-resolved"),
        workerEaRejected: hostOutcome("workerEa-rejected"),
        wikiWorkerEaPre: hostOutcome("wiki-workerEa-pre"),
        wikiWorkerEaPost: hostOutcome("wiki-workerEa-post"),
        wikiMountPre: hostOutcome("wiki-mount-pre"),
        wikiMountPost: hostOutcome("wiki-mount-post"),
        mountWorkerEaPre: hostOutcome("mount-workerEa-pre"),
        mountWorkerEaPost: hostOutcome("mount-workerEa-post"),
        primaryMountPre: hostOutcome("primary-mount-pre"),
        primaryMountPost: hostOutcome("primary-mount-post"),
        phases: hostTrace.filter((receipt) => receipt.startsWith("[C4 boot] host:phase ")),
        openBrowserVesselStart: hostOutcome("open-browser-vessel-start"),
        openBrowserVesselSettled: hostOutcome("open-browser-vessel-settled"),
        paintLive: hostOutcome("paint-live"),
        awaitIslandMsgRaw: hostOutcome("awaitIslandMsg-raw"),
        awaitIslandMsgGuardRejected: hostOutcome("awaitIslandMsg-guard-rejected"),
        awaitIslandMsgGuardAccepted: hostOutcome("awaitIslandMsg-guard-accepted"),
        awaitIslandMsgRejectBranch: hostOutcome("awaitIslandMsg-reject-branch"),
        awaitIslandMsgBreathReset: hostOutcome("awaitIslandMsg-breath-reset"),
        awaitIslandMsgExpectedMatch: hostOutcome("awaitIslandMsg-expected-match"),
        awaitIslandMsgResolve: hostOutcome("awaitIslandMsg-resolve"),
        workerHandleListen: hostOutcome("worker-handle-listen"),
        workerHandleDispatch: hostOutcome("worker-handle-dispatch"),
        workerHandleManifestDispatch: hostOutcome("worker-handle-manifest-dispatch"),
        daemonWorkerEaCallback: hostOutcome("daemon-workerEa-callback"),
      },
    },
    workerReceipts,
    scriptReceipts,
    console: consoleReceipts,
    oracleRefusals: consoleReceipts.filter((receipt) => /ERR_CONNECTION_REFUSED/.test(receipt.text)),
  };
  await page.close();
  await context.close();
  return result;
}

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
try {
  const unchanged = await runCase(browser, "unchanged");
  const instrumented = await runCase(browser, "instrumented");
  assert.ok(unchanged.worker.length > 0, JSON.stringify({ unchanged, instrumented }));
  assert.ok(instrumented.worker.length > 0, JSON.stringify({ unchanged, instrumented }));
  assert.ok(instrumented.transformedScripts > 0, JSON.stringify({ unchanged, instrumented }));
  assert.ok(instrumented.workerHandleSources.length > 0, JSON.stringify({ unchanged, instrumented }));
  assert.ok(instrumented.workerHandleManifestMarkerSources.length > 0, JSON.stringify({ unchanged, instrumented }));
  assert.equal(unchanged.workerOutcomes.constructed.length > 0, true, JSON.stringify({ unchanged, instrumented }));
  assert.equal(instrumented.workerOutcomes.constructed.length > 0, true, JSON.stringify({ unchanged, instrumented }));
  assert.equal(unchanged.workerOutcomes.rawReady.length > 0, true, JSON.stringify({ unchanged, instrumented }));
  assert.equal(instrumented.workerOutcomes.rawReady.length > 0, true, JSON.stringify({ unchanged, instrumented }));
  assert.equal(unchanged.workerOutcomes.hostManifestPost.length > 0, true, JSON.stringify({ unchanged, instrumented }));
  assert.equal(instrumented.workerOutcomes.hostManifestPost.length > 0, true, JSON.stringify({ unchanged, instrumented }));
  assert.equal(unchanged.workerOutcomes.hostManifestPost[0].transferCount > 0, true, JSON.stringify({ unchanged, instrumented }));
  assert.equal(instrumented.workerOutcomes.hostManifestPost[0].transferCount > 0, true, JSON.stringify({ unchanged, instrumented }));
  assert.equal(unchanged.workerOutcomes.earlyMarker.length, 0, JSON.stringify({ unchanged, instrumented }));
  assert.equal(instrumented.workerOutcomes.earlyMarker.length > 0, true, JSON.stringify({ unchanged, instrumented }));
  assert.equal(unchanged.workerOutcomes.shoreManifestInbound.length, 0, JSON.stringify({ unchanged, instrumented }));
  assert.equal(unchanged.workerOutcomes.hostChain.workerHandleManifestDispatch.length, 0, JSON.stringify({ unchanged, instrumented }));
  assert.ok(instrumented.workerOutcomes.hostChain.workerHandleManifestDispatch.length > 0, JSON.stringify({ unchanged, instrumented }));
  assert.equal(unchanged.terminal, instrumented.terminal, JSON.stringify({ unchanged, instrumented }));
  const namedOutcomes = (result) => Object.fromEntries(Object.entries(result.workerOutcomes).map(([name, value]) => [name, Array.isArray(value) ? value.length : value]));
  console.log(JSON.stringify({
    comparison: { unchanged: namedOutcomes(unchanged), instrumented: namedOutcomes(instrumented) },
    note: "unchanged means source-unchanged; both routes carry production c4trace=1",
  }));
  console.log(JSON.stringify({ unchanged, instrumented }));
} finally {
  await browser.close();
}
