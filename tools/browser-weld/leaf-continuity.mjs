/**
 * browser leaf continuity — C4's held-out live walk.
 *
 * A real Chromium profile runs the web surface, first without an anchor and then with a
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
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const WEB = process.env.WELD_WEB_URL ?? "http://localhost:5173";
const ANCHOR = "4a".repeat(32);
const BOOT_MS = Number(process.env.LEAF_BOOT_MS ?? 90_000);
const BOOT_TRACE = process.env.LEAF_BOOT_TRACE === "1";
const pageDiagnostics = new WeakMap();
const pageBootTrace = new WeakMap();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const say = (kind, text) => console.log(`  ${kind.padEnd(8)} ${text}`);

function webUrl(gate) {
  const url = new URL(WEB);
  if (gate) url.searchParams.set("gate", gate);
  if (BOOT_TRACE) url.searchParams.set("c4trace", "1");
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
    const trace = pageBootTrace.get(page) ?? [];
    const traceSummary = trace.length <= 24
      ? trace
      : [...trace.slice(0, 12), `[C4 boot] … ${trace.length - 24} marker(s) omitted …`, ...trace.slice(-12)];
    throw new Error(`${error.message}; last rendered surface: ${JSON.stringify(surface)}; browser tail: ${JSON.stringify(diagnosticTail)}` +
      (BOOT_TRACE ? `; C4 boot trace: ${JSON.stringify(traceSummary)}` : ""));
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
function watchPage(context, page) {
  const diagnostics = [];
  const bootTrace = [];
  pageDiagnostics.set(page, diagnostics);
  pageBootTrace.set(page, bootTrace);
  page.on("console", (message) => {
    const text = message.text();
    diagnostics.push(`console/${message.type()}: ${text}`);
    if (BOOT_TRACE && text.startsWith("[C4 boot]")) bootTrace.push(text);
  });
  page.on("pageerror", (error) => diagnostics.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (request) => diagnostics.push(`requestfailed: ${request.url()} — ${request.failure()?.errorText ?? "unknown"}`));
  // Worker module fetches belong to the context rather than the document page.
  // Keep failed and non-success script receipts beside the page's terminal tail.
  context.on("requestfailed", (request) => {
    if (request.resourceType() === "script") diagnostics.push(`context-script-failed: ${request.url()} — ${request.failure()?.errorText ?? "unknown"}`);
  });
  context.on("response", (response) => {
    if (response.request().resourceType() === "script" && response.status() >= 400) {
      diagnostics.push(`context-script-response: ${response.status()} ${response.url()}`);
    }
  });
  if (BOOT_TRACE) {
    page.on("worker", (worker) => {
      const marker = `worker:spawn ${worker.url()}`;
      diagnostics.push(marker);
      bootTrace.push(`[C4 boot] ${marker}`);
    });
  }
}

/**
 * Test-only boot trace. It instruments fetched development JavaScript only when LEAF_BOOT_TRACE=1;
 * the default path returns every response byte-for-byte unchanged. Markers observe ordering across
 * the host/worker boundary; they do not retry, gate, or alter any readiness decision.
 */
function instrumentBootSource(source) {
  if (!BOOT_TRACE || source.includes("__laresC4BootTrace")) return source;
  let body = source;

  // Worker-side manifest boundary. This source transform stays inside the test route: it reports only
  // the protocol type/version summary, never the manifest body or its transferred port.
  if (body.includes("function runSovereignKernel") && body.includes("host.ready")) {
    body = body.replace(
      /host\.listen\(\(raw(?:\s*:\s*unknown)?\) => \{/,
      (match) => `${match}\n    if (raw?.type === "manifest") { try { self.postMessage({ __laresC4BootTrace: "worker:manifest-received", detail: JSON.stringify({ type: raw?.type ?? null, schema_version: raw?.schema_version ?? null }) }); } catch {} }`,
    );
    body = body.replace(
      /if \(!isVesselToIslandMsg\(raw\)\) return;/,
      `const __laresC4Accepted = isVesselToIslandMsg(raw);
    if (!__laresC4Accepted) { if (raw?.type === "manifest") { try { self.postMessage({ __laresC4BootTrace: "worker:manifest-rejected", detail: JSON.stringify({ type: raw?.type ?? null, schema_version: raw?.schema_version ?? null }) }); } catch {} } return; }
    if (raw.type === "manifest") { try { self.postMessage({ __laresC4BootTrace: "worker:manifest-accepted", detail: JSON.stringify({ type: raw.type, schema_version: raw.schema_version ?? null }) }); } catch {} }`,
    );
    body = body.replace(
      /const breathe = \(\) => \{/,
      `let __laresC4FirstBreath = true;
    const breathe = () => {
      if (__laresC4FirstBreath) { __laresC4FirstBreath = false; try { self.postMessage({ __laresC4BootTrace: "worker:pre-first-breath" }); } catch {} }`,
    );
    body = body.replace(
      /handler\.sendEa\(msg\.wikiUri\);/,
      `try { self.postMessage({ __laresC4BootTrace: "worker:pre-ea" }); } catch {}
    handler.sendEa(msg.wikiUri);`,
    );
  }

  // Host-side waits before the worker exists. The exact call text also anchors the trace to the
  // production await chain rather than a DOM phase inferred by the witness.
  body = body.replace(
    /emit\("corpus-ready"\);/,
    `emit("corpus-ready"); console.log("[C4 boot] host:corpus-ready");`,
  );
  body = body.replace(
    /await carryPersonaKelUpTheGradient\(\{\s*repo,\s*nexusPubkey,\s*prefix: personaKelPrefix,\s*priorIslands: nexusIslandsBelow\(nexusStandsAt\),\s*\}\);/,
    (match) => `console.log("[C4 boot] host:kel-carry:start");\n      ${match}\n      console.log("[C4 boot] host:kel-carry:done");`,
  );
  body = body.replace(
    /const kelBoard = await materializeSharedLarDoc\(repo, personaKelBoardDocUrl\(nexusPubkey\), "board:persona-kel"\);/,
    (match) => `console.log("[C4 boot] host:kel-board:start");\n    ${match}\n    console.log("[C4 boot] host:kel-board:done");`,
  );
  body = body.replace(
    /daemon = await openBrowserDaemonVm\(\{/,
    (match) => `console.log("[C4 boot] host:daemon-vm:start");\n      ${match}`,
  );

  // Core-side worker and manifest boundaries. These markers remain observational; the original
  // expressions stay in place and keep their original ordering/arguments.
  body = body.replace(
    /const worker = host\.spawnWorker\(workerScriptUrl\);/,
    (match) => `console.log("[C4 boot] host:worker-spawn");\n  ${match}`,
  );
  body = body.replace(
    /if \(isIslandToVesselMsg\(raw\) && raw\.type === "ready"\) finish\(\);/,
    `if (isIslandToVesselMsg(raw) && raw.type === "ready") { console.log("[C4 boot] worker:ready"); finish(); }`,
  );
  body = body.replace(
    /setTimeout\(finish, 1500\);/,
    `setTimeout(() => { if (!settled) console.log("[C4 boot] host:ready-fallback"); finish(); }, 1500);`,
  );
  body = body.replace(
    /\}\)\.then\(\(\) => \{ worker\.post\(manifestMsg, \[syncPort\]\); \}\);/,
    `}).then(() => { console.log("[C4 boot] host:manifest-post"); worker.post(manifestMsg, [syncPort]); });`,
  );

  // Post-ea host-chain receipts. These replacements are test-route observations only: they leave
  // the production promises, capability order, phase names and error paths intact.
  body = body.replace(
    /workerEa\.catch\(\(\) => \{\}\);/,
    `workerEa.then(() => console.log("[C4 boot] host:workerEa-resolved"), () => console.log("[C4 boot] host:workerEa-rejected"));\n  workerEa.catch(() => {});`,
  );
  let workerEaGate = 0;
  body = body.replace(/await daemon\.workerEa;/g, () => {
    workerEaGate++;
    const stem = workerEaGate === 1 ? "wiki" : "mount";
    return `console.log("[C4 boot] host:${stem}-workerEa-pre");\n      await daemon.workerEa;\n      console.log("[C4 boot] host:${stem}-workerEa-post");`;
  });
  body = body.replace(
    /const \{ wikiHandle, draftHandle \} = await mountWikiSlot\(/,
    `console.log("[C4 boot] host:wiki-mount-pre");\n      const { wikiHandle, draftHandle } = await mountWikiSlot(`,
  );
  body = body.replace(
    /emit\("wiki-ready"\);/,
    `console.log("[C4 boot] host:wiki-mount-post");\n      emit("wiki-ready");`,
  );
  body = body.replace(
    /await mountPrimaryWiki\(pool, daemon\.resolveBinding, \{/,
    `console.log("[C4 boot] host:primary-mount-pre");\n      await mountPrimaryWiki(pool, daemon.resolveBinding, {`,
  );
  body = body.replace(
    /\n      \}\);\n      emit\("tw5-booted"\);/,
    `\n      });\n      console.log("[C4 boot] host:primary-mount-post");\n      emit("tw5-booted");`,
  );
  body = body.replace(
    /const emit = \(p: LarOpenPhase\) => onPhase\?\.\(p\);/g,
    `const emit = (p: LarOpenPhase) => { console.log("[C4 boot] host:phase " + String(p)); onPhase?.(p); };`,
  );
  body = body.replace(
    /const result = await openBrowserVessel\(\{/,
    `console.log("[C4 boot] host:open-browser-vessel-start");\n    const result = await openBrowserVessel({`,
  );
  body = body.replace(
    /\n    _sendDomEvent = result\.sendDomEvent;/,
    `\n    console.log("[C4 boot] host:open-browser-vessel-settled");\n    _sendDomEvent = result.sendDomEvent;`,
  );
  body = body.replace(
    /row\(vesselEl, "status", "live — sovereign local island", "ok"\);/,
    `console.log("[C4 boot] host:paint-live");\n    row(vesselEl, "status", "live — sovereign local island", "ok");`,
  );

  // The generic daemon listener receives protocol breaths/ea/fault and the test-only worker markers.
  // The guard stays intact; the trace simply makes otherwise private worker progress visible in the
  // page's existing diagnostic tail.
  if (!body.includes("function awaitIslandMsg")) body = body.replace(
    /if \(!isIslandToVesselMsg\(raw\)\) return;/,
    `if (raw && typeof raw === "object" && raw.__laresC4BootTrace) {\n` +
      `      console.log("[C4 boot] " + String(raw.__laresC4BootTrace) + (raw.detail ? " " + String(raw.detail).slice(0, 240) : ""));\n` +
      `    }\n` +
      `    if (isIslandToVesselMsg(raw) && (raw.type === "ready" || raw.type === "breath" || raw.type === "ea" || raw.type === "fault")) {\n` +
      `      console.log("[C4 boot] worker:" + raw.type);\n` +
      `    }\n` +
      `    if (!isIslandToVesselMsg(raw)) return;`,
  );

  // The workerEa subscriber lives in the separately served mesh module. Keep this anchor explicit:
  // a host-side cap receipt cannot prove that awaitIslandMsg saw or accepted the same message.
  if (/function\s+awaitIslandMsg\s*\(/.test(body) && body.includes("isIslandToVesselMsg(raw)")) {
    body = body.replace(
      /if\s*\(!isIslandToVesselMsg\(raw\)\)\s*return;/,
      `const __laresC4Watched = raw && (raw.type === "ea" || raw.type === "breath" || raw.type === "fault");
      const __laresC4Guard = isIslandToVesselMsg(raw);
      if (__laresC4Watched) console.log("[C4 boot] host:awaitIslandMsg-raw " + JSON.stringify({ type: raw.type, schema_version: raw.schema_version ?? null, guard: __laresC4Guard, expected: opts.expectedType }));
      if (!__laresC4Guard) { if (__laresC4Watched) console.log("[C4 boot] host:awaitIslandMsg-guard-rejected"); return; }
      if (__laresC4Watched) console.log("[C4 boot] host:awaitIslandMsg-guard-accepted");`,
    );
    body = body.replace(
      /if \(opts\.rejectOnTypes\?\.includes\(raw\.type\)\) \{/,
      `if (opts.rejectOnTypes?.includes(raw.type)) { if (__laresC4Watched) console.log("[C4 boot] host:awaitIslandMsg-reject-branch");`,
    );
    body = body.replace(
      /if \(opts\.resetOnTypes\?\.includes\(raw\.type\)\) \{/,
      `if (opts.resetOnTypes?.includes(raw.type)) { if (__laresC4Watched) console.log("[C4 boot] host:awaitIslandMsg-breath-reset");`,
    );
    body = body.replace(
      /if\s*\(raw\.type !== opts\.expectedType\)\s*return;/,
      `if (raw.type !== opts.expectedType) return;
      if (__laresC4Watched) console.log("[C4 boot] host:awaitIslandMsg-expected-match");`,
    );
    body = body.replace(
      /cleanup\(\);\s*resolve\(raw(?: as T)?\);/,
      `cleanup();
      if (__laresC4Watched) console.log("[C4 boot] host:awaitIslandMsg-resolve");
      resolve(raw);`,
    );
  }

  // Fan-out witness: browserWorkerHandle owns the native Worker listener registrations. Number each
  // registration and report only protocol type/version at dispatch; the callback remains unchanged.
  if (body.includes("function browserWorkerHandle") && body.includes("w.addEventListener(\"message\", fn)")) {
    body = body.replace(
      /listen: \(cb\) => \{/,
      `listen: (cb) => {
      const __laresC4ListenId = ((globalThis.__laresC4ListenId ??= 0) + 1);
      console.log("[C4 boot] host:worker-handle-listen " + __laresC4ListenId);`,
    );
    body = body.replace(
      /const fn = \(e(?:: MessageEvent)?\)(?:: void)? => cb\(e\.data\);/,
      `const fn = (e) => {
        const raw = e.data;
        if (raw && (raw.type === "ea" || raw.type === "breath" || raw.type === "fault" || raw.type === "ready")) console.log("[C4 boot] host:worker-handle-dispatch " + JSON.stringify({ listen: __laresC4ListenId, type: raw.type, schema_version: raw.schema_version ?? null }));
        cb(raw);
      };`,
    );
  }

  // Name the daemon-core workerEa subscriber before it hands the raw value into awaitIslandMsg.
  if ((body.includes("const workerEa: Promise<void>") || body.includes("const workerEa = awaitIslandMsg")) && body.includes("subscribe: (h) => worker.listen(h)")) {
    body = body.replace(
      /subscribe:\s*\(h\) => worker\.listen\(h\),/,
      `subscribe:       (h) => worker.listen((raw) => {
        if (raw && (raw.type === "ea" || raw.type === "breath" || raw.type === "fault")) console.log("[C4 boot] host:daemon-workerEa-callback " + JSON.stringify({ type: raw.type, schema_version: raw.schema_version ?? null }));
        h(raw);
      }),`,
    );
  }

  // The worker's caught startup rejection normally stays in the worker console. A test-only marker
  // crosses the same worker message boundary, so the host can distinguish it from pre-worker silence.
  if (body.includes('registerWorkerErrorRelay("daemon-worker");')) {
    body = body.replace(
      'registerWorkerErrorRelay("daemon-worker");',
      'registerWorkerErrorRelay("daemon-worker");\n' +
      'const __laresC4Trace = (phase, detail = "") => { try { self.postMessage({ __laresC4BootTrace: phase, ...(detail ? { detail } : {}) }); } catch {} };\n' +
      '__laresC4Trace("worker:entry");\n' +
      'const __laresC4ConsoleError = console.error;\n' +
      'console.error = (...args) => { if (String(args[0] ?? "").includes("[daemon-worker] run-threw")) __laresC4Trace("worker:startup-error", String(args[1] ?? "")); __laresC4ConsoleError(...args); };',
    );
    body = body.replace("await initKeyhiveWasm();", '__laresC4Trace("worker:wasm-start");\n  await initKeyhiveWasm();\n  __laresC4Trace("worker:wasm-ready");');
    body = body.replace('await import("@lararium/browser/browser-daemon-island");', '__laresC4Trace("worker:kernel-import-start");\n  await import("@lararium/browser/browser-daemon-island");\n  __laresC4Trace("worker:kernel-imported");');
  }
  return body;
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
async function observeKelRead(context, page) {
  let observations = 0;
  // The daemon starts in a Worker. Context routing reaches its module requests;
  // page routing observes the document graph but can leave that island opaque.
  await context.route(/\.(?:[cm]?[jt]sx?)(?:\?.*)?$/, async (route) => {
    const response = await route.fetch();
    const type = response.headers()["content-type"] ?? "";
    if (!/javascript/.test(type)) return route.fulfill({ response });
    const source = await response.text();
    const read = /const personaKelChain = personaKelChainForPrefix\(kelBoard\.doc\(\), personaKelPrefix\);/;
    const traced = instrumentBootSource(source);
    if (!read.test(source)) return route.fulfill({ response, body: traced });
    observations += 1;
    const body = traced.replace(read, `$&\n      globalThis.__laresC4PersonaKel = { prefix: personaKelPrefix, eventCids: personaKelChain?.map((event) => event.eventCid) ?? [] };`);
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
    watchPage(context, page);
    const logs = [];
    page.on("console", (message) => logs.push(message.text()));
    page.on("pageerror", (error) => logs.push(`pageerror: ${error.message}`));
    const finishObservation = await observeKelRead(context, page);

    await page.goto(webUrl(), { waitUntil: "domcontentloaded" });
    const offline = await liveReading(page);
    if (!/^0x[0-9a-f]{64}$/i.test(offline.did)) throw new Error(`offline boot reported no vessel key: ${offline.did || "empty"}`);
    const offlineKel = assertKel("offline founding", offline);
    say("ok", "C4.1 offline leaf founded with a persistent browser identity");

    const anchoredAt = logs.length;
    await page.goto(webUrl(ANCHOR), { waitUntil: "domcontentloaded" });
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
    watchPage(context, page);
    let replacements = 0;
    await page.goto(webUrl(), { waitUntil: "domcontentloaded" });
    await liveReading(page);

    await page.route("**/*.js*", async (route) => {
      const response = await route.fetch();
      const type = response.headers()["content-type"] ?? "";
      if (!/javascript/.test(type)) return route.fulfill({ response });
      const source = instrumentBootSource(await response.text());
      const call = /await carryPersonaKelUpTheGradient\(\{\s*repo, nexusPubkey, prefix: personaKelPrefix,\s*priorIslands: nexusIslandsBelow\(nexusStandsAt\),\s*\}\);/;
      const matches = source.match(new RegExp(call.source, "g")) ?? [];
      if (matches.length === 0) return route.fulfill({ response, body: source });
      if (matches.length !== 1) throw new Error(`C4 fault route found ${matches.length} carry calls in one fetched module`);
      replacements += 1;
      if (replacements > 1) throw new Error("C4 fault route found more than one carry call");
      return route.fulfill({ response, body: source.replace(call, "await Promise.resolve({ carried: 0, from: null });") });
    });

    await page.goto(webUrl(ANCHOR), { waitUntil: "domcontentloaded" });
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
    watchPage(context, page);
    const finishObservation = await observeKelRead(context, page);
    await page.goto(webUrl(), { waitUntil: "domcontentloaded" });
    const offline = await liveReading(page);
    const offlineKel = assertKel("malformed-anchor offline founding", offline);
    await page.goto(webUrl("not-a-hex-gate"), { waitUntil: "domcontentloaded" });
    const refusal = await refusedReading(page);
    if (!/\[nexus\] the island reads TORN, so no board may be addressed — an admission RECORD stands at this vessel and the anchor key it names reads as no key at all/i.test(refusal)) {
      throw new Error(`malformed anchor did not stop at nexusScopeOrThrow: ${refusal}`);
    }
    await page.goto(webUrl(ANCHOR), { waitUntil: "domcontentloaded" });
    const recovered = await liveReading(page);
    if (recovered.did !== offline.did) throw new Error("valid anchor retry after malformed input changed the browser vessel identity");
    assertKel("valid anchor retry after malformed input", recovered, offlineKel);
    finishObservation();
    say("ok", "C4.5 malformed anchor stops at the scope door; a valid retry recovers the same identity and KEL");
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await ordinaryWalk();
  await faultWalk();
  await malformedAnchorWalk();
}

export { instrumentBootSource };
