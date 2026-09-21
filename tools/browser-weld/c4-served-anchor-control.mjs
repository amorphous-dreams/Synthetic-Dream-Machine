/**
 * C4 served Worker graph anchor control.
 *
 * This is a source boundary witness, before the longer boot comparison: it proves that
 * the compiled Worker graph contains the kernel and browser-shore anchors and that the
 * trace route can inject the corresponding markers. It deliberately does not wait for
 * ea, retry boot, or change a readiness decision.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";

process.env.LEAF_BOOT_TRACE = "1";
const { instrumentBootSource } = await import("./leaf-continuity.mjs");

const WEB = process.env.WELD_WEB_URL ?? "http://localhost:5173";
const WAIT_MS = Number(process.env.C4_ANCHOR_CONTROL_MS ?? 12_000);

const ANCHORS = {
  kernel: /(?:export\s+)?function\s+runSovereignKernel\s*\(/,
  listen: /host\.listen\s*\(\s*\(raw(?:\s*:\s*unknown)?\s*\)\s*=>\s*\{/,
  ready: /host\.ready\s*\?\.\s*\(\)/,
  breathe: /const\s+breathe\s*=\s*\(\)\s*=>\s*\{/,
  sendEa: /handler\.sendEa\s*\(\s*msg\.wikiUri\s*\)\s*;/,
};
const MARKERS = ["worker:manifest-received", "worker:pre-first-breath", "worker:pre-ea"];
const SHORE_ANCHOR = /listen:\s*\(onMessage\)[\s\S]{0,180}onMessage\(e\.data\)/;
const SHORE_MARKER = "worker:shore-manifest-inbound";
const SHORE_REGISTER_MARKER = "worker:shore-listener-register";

function workerAnchorStatus(source) {
  return Object.fromEntries(Object.entries(ANCHORS).map(([name, pattern]) => [name, pattern.test(source)]));
}

function allAnchorsPresent(status) {
  return Object.values(status).every(Boolean);
}

function isJavaScript(response) {
  return /javascript|ecmascript/.test(response.headers()["content-type"] ?? "");
}

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const context = await browser.newContext();
const page = await context.newPage();
const workerSources = [];
const shoreSources = [];
const scriptErrors = [];

page.on("pageerror", (error) => scriptErrors.push(error.message));
context.on("requestfailed", (request) => {
  if (request.resourceType() === "script") scriptErrors.push(`${request.url()} — ${request.failure()?.errorText ?? "unknown"}`);
});

await context.route(/\.(?:[cm]?[jt]sx?)(?:\?.*)?$/, async (route) => {
  let response;
  try {
    response = await route.fetch();
  } catch {
    return;
  }
  if (!isJavaScript(response)) return route.fulfill({ response });
  let source;
  try {
    source = await response.text();
  } catch {
    return;
  }
  // Vite's inline source map can carry the original TypeScript text, so never
  // mistake a decoded-map mention for executable served graph code.
  const executableSource = source.replace(/\n\/\/# sourceMappingURL=.*$/s, "");
  const anchors = workerAnchorStatus(executableSource);
  const isKernel = executableSource.includes("runSovereignKernel");
  const isShore = SHORE_ANCHOR.test(executableSource);
  if (!isKernel && !isShore) return route.fulfill({ response });
  const transformed = instrumentBootSource(source);
  if (isKernel) workerSources.push({
      url: route.request().url(),
      source: executableSource,
      anchors,
      injectedMarkers: Object.fromEntries(MARKERS.map((marker) => [marker, transformed.includes(`\"${marker}\"`)])),
      transformed: transformed !== source,
    });
  if (isShore) shoreSources.push({
      url: route.request().url(),
      source: executableSource,
      anchor: true,
      injectedMarker: transformed.includes(`\"${SHORE_MARKER}\"`),
      injectedRegistrationMarker: transformed.includes(`\"${SHORE_REGISTER_MARKER}\"`),
      transformed: transformed !== source,
    });
  return route.fulfill({ response, body: transformed });
});

try {
  const target = new URL(WEB);
  target.searchParams.set("c4trace", "1");
  try {
    await page.goto(target.href, { waitUntil: "domcontentloaded" });
  } catch (error) {
    scriptErrors.push(`navigation: ${error instanceof Error ? error.message : String(error)}`);
  }
  const until = Date.now() + WAIT_MS;
  while ((workerSources.length === 0 || shoreSources.length === 0) && Date.now() < until) await new Promise((resolve) => setTimeout(resolve, 100));

  // Deliberate weakening: the same detector must reject a compiled graph with one
  // required worker anchor removed; otherwise absence and non-reach are conflated.
  const positive = workerSources.find((record) => allAnchorsPresent(record.anchors) && /\/sovereign-kernel\.js(?:\?.*)?$/.test(record.url));
  assert.ok(positive, JSON.stringify({ workerSources, scriptErrors }, null, 2));
  const positiveShore = shoreSources.find((record) => /\/browser-sovereign-island-model\.js(?:\?.*)?$/.test(record.url));
  assert.ok(positiveShore, JSON.stringify({ shoreSources, scriptErrors }, null, 2));
  const weakenedSource = positive.source.replace(/handler\.sendEa\s*\(\s*msg\.wikiUri\s*\)\s*;/, "");
  const weakened = workerAnchorStatus(weakenedSource);
  assert.equal(allAnchorsPresent(weakened), false, JSON.stringify({ weakened }));
  const weakenedTransformed = instrumentBootSource(weakenedSource);
  assert.equal(weakenedTransformed.includes('"worker:pre-ea"'), false, JSON.stringify({ weakened }));
  const weakenedShoreSource = positiveShore.source.replace(/onMessage\(e\.data\)/, "onMessage(e.other)");
  assert.equal(SHORE_ANCHOR.test(weakenedShoreSource), false, JSON.stringify({ shore: weakenedShoreSource.slice(0, 500) }));
  const weakenedShoreTransformed = instrumentBootSource(weakenedShoreSource);
  assert.equal(weakenedShoreTransformed.includes(`"${SHORE_MARKER}"`), false, JSON.stringify({ shore: weakenedShoreSource.slice(0, 500) }));
  assert.equal(weakenedShoreTransformed.includes(`"${SHORE_REGISTER_MARKER}"`), false, JSON.stringify({ shore: weakenedShoreSource.slice(0, 500) }));
  assert.equal(positive.transformed, true, JSON.stringify({ workerSources }));
  for (const marker of MARKERS) assert.equal(positive.injectedMarkers[marker], true, JSON.stringify({ workerSources }));
  assert.equal(positiveShore.injectedMarker, true, JSON.stringify({ shoreSources }));
  assert.equal(positiveShore.injectedRegistrationMarker, true, JSON.stringify({ shoreSources }));
  const { source: _source, ...positiveReceipt } = positive;
  const { source: _shoreSource, ...positiveShoreReceipt } = positiveShore;

  console.log(JSON.stringify({
    valid: true,
    positive: { ...positiveReceipt, workerGraphUrl: positive.url },
    shore: { ...positiveShoreReceipt, shoreGraphUrl: positiveShore.url },
    deliberateWeakening: { anchors: weakened, valid: allAnchorsPresent(weakened), preEaInjected: weakenedTransformed.includes('"worker:pre-ea"'), shoreAnchor: SHORE_ANCHOR.test(weakenedShoreSource), shoreMarkerInjected: weakenedShoreTransformed.includes(`"${SHORE_MARKER}"`), shoreRegistrationMarkerInjected: weakenedShoreTransformed.includes(`"${SHORE_REGISTER_MARKER}"`) },
    scriptErrors,
  }));
} finally {
  await page.close();
  await context.close();
  await browser.close();
}

export { allAnchorsPresent, workerAnchorStatus };
