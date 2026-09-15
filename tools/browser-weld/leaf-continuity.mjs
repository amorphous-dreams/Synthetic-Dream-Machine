/**
 * browser leaf continuity — C4's held-out live walk.
 *
 * A real Chromium profile runs the app, first without an anchor and then with a
 * valid gate key. The browser's IndexedDB survives document replacement, which
 * makes this the ordinary field walk rather than a synthetic Repo exercise.
 *
 * It then repeats the walk with the exact runtime carry call replaced in the
 * fetched module. That fault must make the Binding Gate refuse the anchored
 * reload; otherwise a green normal walk could be reading a path that never
 * reached the carry.
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const APP = process.env.WELD_APP_URL ?? "http://localhost:5173";
const ANCHOR = "4a".repeat(32);
const BOOT_MS = Number(process.env.LEAF_BOOT_MS ?? 90_000);
const pageDiagnostics = new WeakMap();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const say = (kind, text) => console.log(`  ${kind.padEnd(8)} ${text}`);

function appUrl(gate) {
  const url = new URL(APP);
  if (gate) url.searchParams.set("gate", gate);
  return url.href;
}

async function waitFor(page, predicate, what) {
  const until = Date.now() + BOOT_MS;
  while (Date.now() < until) {
    const value = await page.evaluate(predicate);
    if (value) return value;
    await sleep(100);
  }
  throw new Error(`${what} did not arrive within ${BOOT_MS}ms`);
}

async function liveReading(page) {
  let state;
  try {
    state = await waitFor(page, () => {
      const status = document.getElementById("status")?.textContent ?? "";
      if (status.includes("boot failed:")) return { kind: "failed", status };
      if (document.getElementById("vessel")?.textContent?.includes("live — sovereign local island")) return { kind: "live" };
      return null;
    }, "live vessel");
  } catch (error) {
    const surface = await page.evaluate(() => ({
      status: document.getElementById("status")?.textContent ?? "",
      vessel: document.getElementById("vessel")?.textContent ?? "",
      body: document.body?.textContent?.trim().slice(0, 500) ?? "",
    })).catch(() => ({ status: "<unreadable>", vessel: "", body: "" }));
    const diagnosticTail = (pageDiagnostics.get(page) ?? []).slice(-12);
    throw new Error(`${error.message}; last rendered surface: ${JSON.stringify(surface)}; browser tail: ${JSON.stringify(diagnosticTail)}`);
  }
  if (state.kind === "failed") throw new Error(`browser vessel boot refused: ${state.status}`);
  return await page.evaluate(() => {
    const rows = [...document.querySelectorAll("#vessel .row")];
    const did = rows.find((row) => row.querySelector(".k")?.textContent === "did")?.querySelector(".v")?.textContent ?? "";
    const kel = globalThis.__laresC4PersonaKel;
    return { did, vessel: document.getElementById("vessel")?.textContent ?? "", kel };
  });
}

/** Keep a small terminal tail: a boot timeout must expose a concrete browser cause. */
function watchPage(page) {
  const diagnostics = [];
  pageDiagnostics.set(page, diagnostics);
  page.on("console", (message) => diagnostics.push(`console/${message.type()}: ${message.text()}`));
  page.on("pageerror", (error) => diagnostics.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (request) => diagnostics.push(`requestfailed: ${request.url()} — ${request.failure()?.errorText ?? "unknown"}`));
}

async function refusedReading(page) {
  return await waitFor(page, () => {
    const status = document.getElementById("status")?.textContent ?? "";
    return status.includes("boot failed:") ? status : null;
  }, "Binding Gate refusal");
}

async function withProfile(run) {
  const profile = await mkdtemp(join(tmpdir(), "lares-c4-leaf-"));
  let context;
  try {
    context = await chromium.launchPersistentContext(profile, { headless: true, args: ["--no-sandbox"] });
    return await run(context);
  } finally {
    await context?.close();
    await rm(profile, { recursive: true, force: true });
  }
}

/**
 * The application deliberately keeps its Repo private. This test-only response
 * transform observes the chain at the same line the Binding Gate reads it: no
 * production debug hook and no synthetic replacement Repo. The record is the
 * prefix plus event CIDs, so a green reload proves the exact copied events,
 * rather than merely a carry-shaped console receipt.
 */
async function observeKelRead(page) {
  let observations = 0;
  await page.route("**/*.js*", async (route) => {
    const response = await route.fetch();
    const type = response.headers()["content-type"] ?? "";
    if (!/javascript/.test(type)) return route.fulfill({ response });
    const source = await response.text();
    const read = /const personaKelChain = personaKelChainForPrefix\(kelBoard\.doc\(\), personaKelPrefix\);/;
    if (!read.test(source)) return route.fulfill({ response, body: source });
    observations += 1;
    const body = source.replace(read, `$&\n      globalThis.__laresC4PersonaKel = { prefix: personaKelPrefix, eventCids: personaKelChain?.map((event) => event.eventCid) ?? [] };`);
    return route.fulfill({ response, body });
  });
  return () => {
    if (observations < 1) throw new Error("C4 observation route never reached the Binding Gate KEL read");
  };
}

function assertKel(label, reading, expected) {
  const kel = reading.kel;
  if (!kel || typeof kel.prefix !== "string" || !Array.isArray(kel.eventCids) || kel.eventCids.length === 0) {
    throw new Error(`${label} did not expose a non-empty KEL chain at the Binding Gate`);
  }
  if (kel.eventCids.some((cid) => typeof cid !== "string" || cid.length === 0)) {
    throw new Error(`${label} exposed a malformed KEL event CID`);
  }
  if (expected && (kel.prefix !== expected.prefix || JSON.stringify(kel.eventCids) !== JSON.stringify(expected.eventCids))) {
    throw new Error(`${label} changed the Binding Gate KEL continuity record`);
  }
  return { prefix: kel.prefix, eventCids: [...kel.eventCids] };
}

async function ordinaryWalk() {
  return withProfile(async (context) => {
    const page = await context.newPage();
    watchPage(page);
    const logs = [];
    page.on("console", (message) => logs.push(message.text()));
    page.on("pageerror", (error) => logs.push(`pageerror: ${error.message}`));
    const finishObservation = await observeKelRead(page);

    await page.goto(appUrl(), { waitUntil: "domcontentloaded" });
    const offline = await liveReading(page);
    if (!/^0x[0-9a-f]{64}$/i.test(offline.did)) throw new Error(`offline boot reported no vessel key: ${offline.did || "empty"}`);
    const offlineKel = assertKel("offline founding", offline);
    say("ok", "C4.1 offline leaf founded with a persistent browser identity");

    const anchoredAt = logs.length;
    await page.goto(appUrl(ANCHOR), { waitUntil: "domcontentloaded" });
    const anchored = await liveReading(page);
    const anchorLogs = logs.slice(anchoredAt).join("\n");
    if (anchored.did !== offline.did) throw new Error("anchor configuration changed the browser vessel identity");
    assertKel("configured anchor", anchored, offlineKel);
    if (!anchorLogs.includes("[persona-kel] carried 1 event(s)")) {
      throw new Error(`anchor reload reached live without the KEL carry receipt: ${anchorLogs.slice(-500)}`);
    }
    say("ok", "C4.2 configured anchor carried the founding KEL before the Binding Gate");

    const reloadAt = logs.length;
    await page.reload({ waitUntil: "domcontentloaded" });
    const reloaded = await liveReading(page);
    const reloadLogs = logs.slice(reloadAt).join("\n");
    if (reloaded.did !== offline.did) throw new Error("anchored reload changed the browser vessel identity");
    assertKel("anchored reload", reloaded, offlineKel);
    if (reloadLogs.includes("[persona-kel] carried")) throw new Error("anchored reload carried the KEL a second time");
    finishObservation();
    say("ok", "C4.3 anchored reload preserved identity and added no second carry");
  });
}

async function faultWalk() {
  return withProfile(async (context) => {
    const page = await context.newPage();
    watchPage(page);
    let replacements = 0;
    await page.goto(appUrl(), { waitUntil: "domcontentloaded" });
    await liveReading(page);

    await page.route("**/*.js*", async (route) => {
      const response = await route.fetch();
      const type = response.headers()["content-type"] ?? "";
      if (!/javascript/.test(type)) return route.fulfill({ response });
      const source = await response.text();
      const call = /await carryPersonaKelUpTheGradient\(\{\s*repo, nexusPubkey, prefix: personaKelPrefix,\s*priorIslands: nexusIslandsBelow\(nexusStandsAt\),\s*\}\);/;
      const matches = source.match(new RegExp(call.source, "g")) ?? [];
      if (matches.length === 0) return route.fulfill({ response, body: source });
      if (matches.length !== 1) throw new Error(`C4 fault route found ${matches.length} carry calls in one fetched module`);
      replacements += 1;
      if (replacements > 1) throw new Error("C4 fault route found more than one carry call");
      return route.fulfill({ response, body: source.replace(call, "await Promise.resolve({ carried: 0, from: null });") });
    });

    await page.goto(appUrl(ANCHOR), { waitUntil: "domcontentloaded" });
    const refusal = await refusedReading(page);
    if (replacements !== 1) throw new Error(`C4 fault route replaced ${replacements} carry calls, expected one`);
    if (!/persona-KEL chain.*absent.*Binding Gate/i.test(refusal)) {
      throw new Error(`disabled carry did not produce the expected Binding Gate refusal: ${refusal}`);
    }
    say("ok", "C4.4 disabling the one carry call makes the Binding Gate refuse the anchored boot");
  });
}

async function malformedAnchorWalk() {
  return withProfile(async (context) => {
    const page = await context.newPage();
    watchPage(page);
    const finishObservation = await observeKelRead(page);
    await page.goto(appUrl(), { waitUntil: "domcontentloaded" });
    const offline = await liveReading(page);
    const offlineKel = assertKel("malformed-anchor offline founding", offline);
    await page.goto(appUrl("not-a-hex-gate"), { waitUntil: "domcontentloaded" });
    const refusal = await refusedReading(page);
    if (!/\[nexus\] the island reads TORN, so no board may be addressed — an admission RECORD stands at this vessel and the anchor key it names reads as no key at all/i.test(refusal)) {
      throw new Error(`malformed anchor did not stop at nexusScopeOrThrow: ${refusal}`);
    }
    await page.goto(appUrl(ANCHOR), { waitUntil: "domcontentloaded" });
    const recovered = await liveReading(page);
    if (recovered.did !== offline.did) throw new Error("valid anchor retry after malformed input changed the browser vessel identity");
    assertKel("valid anchor retry after malformed input", recovered, offlineKel);
    finishObservation();
    say("ok", "C4.5 malformed anchor stops at the scope door; a valid retry recovers the same identity and KEL");
  });
}

await ordinaryWalk();
await faultWalk();
await malformedAnchorWalk();
