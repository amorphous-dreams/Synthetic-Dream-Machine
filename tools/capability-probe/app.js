/* capability probe page. Every verdict comes from performing the call; the user-agent string is reported as data only.
 * A probe is {id, verdict: granted|refused|error|skipped, detail, evidence}. A thrown platform exception is a REFUSAL
 * (name + message kept); a harness-side mismatch is an ERROR. Each group carries one NEGATIVE CONTROL, a call that
 * must fail on every browser: `control-negative: held` means it failed as it must, `broken` means it did not. A held
 * control row carries verdict "refused" (the call was refused) beside its `control-negative` field. */
"use strict";
(() => {
  const $ = (id) => document.getElementById(id);
  const hex = (b) => PCHex(b);
  const rand = (n) => { const a = new Uint8Array(n); for (let i = 0; i < n; i += 65536) crypto.getRandomValues(a.subarray(i, Math.min(n, i + 65536))); return a; };
  const b64u = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const sha = async (data) => hex(await crypto.subtle.digest("SHA-256", data));
  const utf8 = (s) => new TextEncoder().encode(s);
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage may be withheld */ } };
  const bad = (msg) => Object.assign(new Error(msg), { probeError: true });
  const tab = hex(rand(6));
  const t0 = performance.now();
  // (module (func (export "add") (param i32 i32) (result i32) local.get 0 local.get 1 i32.add))
  const ADD = new Uint8Array([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0, 1, 7, 1, 0x60, 2, 0x7f, 0x7f, 1, 0x7f, 3, 2, 1, 0, 7, 7, 1, 3, 0x61, 0x64, 0x64, 0, 0, 0x0a, 9, 1, 7, 0, 0x20, 0, 0x20, 1, 0x6a, 0x0b]);

  // ---- probe plumbing ----
  const withTimeout = (p, ms, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(bad(`Timeout after ${ms} ms: ${what}`)), ms))]);
  async function probe(id, fn, ms = 20000) {
    const s = performance.now();
    const out = { id, verdict: "granted", detail: "", evidence: {} };
    try {
      const r = (await withTimeout(Promise.resolve().then(fn), ms, id)) ?? {};
      out.detail = r.detail ?? ""; out.evidence = r.evidence ?? {};
      if (r.skipped) out.verdict = "skipped";
      else if (r.refused) out.verdict = "refused";
    } catch (e) {
      out.verdict = e?.probeError ? "error" : "refused";
      out.detail = `${e?.name ?? "Error"}: ${e?.message ?? e}`; out.evidence = { name: e?.name ?? "Error", message: String(e?.message ?? e) };
    }
    out.ms = Math.round((performance.now() - s) * 10) / 10;
    return out;
  }
  async function control(group, fn) {
    const s = performance.now();
    let held = false, why = "the call succeeded";
    try { await fn(); } catch (e) { held = true; why = `${e?.name}: ${e?.message}`; }
    return { id: `${group}.control-negative`, verdict: held ? "refused" : "granted", "control-negative": held ? "held" : "broken", detail: why, evidence: {}, ms: Math.round((performance.now() - s) * 10) / 10 };
  }
  const unwrap = (r) => { if (!r.ok) { const e = new Error(r.message); e.name = r.name; e.probeError = r.probeError; throw e; } return r; };

  function endpoint(target, dead) {
    const pending = new Map(); let n = 0;
    target.onmessage = (e) => { const p = pending.get(e.data?.id); if (p) { pending.delete(e.data.id); p(e.data); } };
    target.start?.();
    return (msg, transfer = []) => Promise.race([
      new Promise((res) => { const id = ++n; pending.set(id, res); target.postMessage({ ...msg, id }, transfer); }),
      dead,
    ]);
  }
  function deadOn(worker, label) {
    const p = new Promise((_, rej) => { worker.addEventListener("error", (e) => rej(Object.assign(new Error(`${label} failed to load or run${e.message ? ": " + e.message : ""}`), { name: "WorkerError" }))); });
    p.catch(() => {});
    return p;
  }

  // ---- shared worker connection (opened at load so lifecycle events log from the start) ----
  const OWNER_TAB = new URLSearchParams(location.search).get("owner") === "tab";
  let swCall = null, swInit = OWNER_TAB ? new Error("SharedWorker deliberately not used (?owner=tab)") : null;
  const connectSW = () => { const sw = new SharedWorker("sw.js", { name: "probe-shared" }); swCall = endpoint(sw.port, deadOn(sw, "SharedWorker")); };
  if (!OWNER_TAB) { try { connectSW(); } catch (e) { swInit = e; } }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let knownInstanceId = null;
  if (swCall) swCall({ cmd: "ping" }).then((r) => { knownInstanceId = r.instanceId ?? null; }).catch(() => {});
  const ownerChanges = [];
  const needSW = () => { if (!swCall) throw swInit ?? new Error("SharedWorker unavailable"); return swCall; };

  // ---- environment, reported as DATA only ----
  let env = {};
  const envReady = (async () => {
    const e = { origin: location.origin, hardwareConcurrency: navigator.hardwareConcurrency ?? null, deviceMemory: navigator.deviceMemory ?? null,
      displayMode: ["standalone", "fullscreen", "minimal-ui", "browser"].find((m) => matchMedia(`(display-mode: ${m})`).matches) ?? null, wasDiscarded: document.wasDiscarded ?? null };
    try { e.highEntropy = await withTimeout(navigator.userAgentData.getHighEntropyValues(["model", "platformVersion", "fullVersionList"]), 3000, "getHighEntropyValues"); }
    catch (err) { e.highEntropy = { unavailable: `${err?.name}: ${err?.message}` }; }
    env = e;
  })();

  // ---- IndexedDB connection held by every tab, to observe version-upgrade contention ----
  let holdVer = null;
  try {
    const r = indexedDB.open("probe-ver-db");
    r.onsuccess = () => { holdVer = r.result; holdVer.onversionchange = (e) => { logEvent("idb-versionchange", { oldVersion: e.oldVersion, newVersion: e.newVersion }); setTimeout(() => { holdVer?.close(); holdVer = null; logEvent("idb-holder-closed"); }, 300); }; };
  } catch { /* IndexedDB may be withheld; its probes say so */ }

  // ---- lifecycle capture ----
  const localEvents = []; let localSeq = 0;
  function logEvent(name, detail) {
    localEvents.push({ seq: ++localSeq, name, vis: document.visibilityState, detail: detail ?? null });
    if (swCall) swCall({ cmd: "event", tab, name, detail: { vis: document.visibilityState, ...(detail ?? {}) } }).catch(() => {});
  }
  for (const n of ["visibilitychange", "freeze", "resume"]) document.addEventListener(n, () => logEvent(n));
  window.addEventListener("pagehide", (e) => { logEvent("pagehide", { persisted: e.persisted }); if (swCall) swCall({ cmd: "bye" }).catch(() => {}); });
  window.addEventListener("pageshow", (e) => { logEvent("pageshow", { persisted: e.persisted }); if (e.persisted && swCall) swCall({ cmd: "back" }).catch(() => {}); });
  logEvent("load");

  // ---- dedicated worker, one per tab ----
  let dwCall = null;
  const needDW = () => {
    if (!dwCall) { const dw = new Worker("dw.js"); dwCall = endpoint(dw, deadOn(dw, "dedicated Worker")); }
    return dwCall;
  };
  const via = (get, cmd, args) => async () => unwrap(await get()({ cmd, args }));
  const viaSW = (cmd, args) => via(needSW, cmd, args);
  const viaDW = (cmd, args) => via(needDW, cmd, args);

  // ---- groups ----
  async function groupSession() {
    const g = [];
    g.push(await probe("session.secure-context", () => (isSecureContext ? { detail: "isSecureContext is true", evidence: { origin: location.origin } } : { refused: true, detail: "isSecureContext is false", evidence: { origin: location.origin } })));
    g.push(await probe("session.sharedworker", async () => {
      const r = unwrap(await needSW()({ cmd: "ping" }));
      return { detail: `instance ${r.instanceId}, connectedPorts ${r.connectedPorts}`, evidence: { instanceId: r.instanceId, ownerEpoch: r.ownerEpoch, connectedPorts: r.connectedPorts, connects: r.connects, ticks: r.ticks } };
    }));
    g.push(await probe("session.sharedworker-module", async () => {
      const sw = new SharedWorker("sw-module.js", { type: "module", name: "probe-module" });
      const r = unwrap(await endpoint(sw.port, deadOn(sw, "module SharedWorker"))({ cmd: "ping" }));
      if (r.dep !== "module-dep-loaded") throw bad("static import did not run");
      return { detail: "type:module SharedWorker ran a static import", evidence: { dep: r.dep } };
    }));
    g.push(await probe("session.dedicated-worker", viaDW("ping")));
    g.push(await probe("session.port-chain", async () => {
      // tab -> SharedWorker -> dedicated worker: the page keeps one end (A1); A2 travels through the SharedWorker.
      const A = new MessageChannel(), B = new MessageChannel();
      unwrap(await needDW()({ cmd: "hold", port: B.port1 }, [B.port1]));
      const got = new Promise((res) => { A.port1.onmessage = (e) => res(e.data); });
      unwrap(await needSW()({ cmd: "chain", toD: B.port2, pagePort: A.port2 }, [B.port2, A.port2]));
      const m = await got;
      if (m.from !== "dedicated-worker") throw bad("unexpected reply " + JSON.stringify(m));
      return { detail: "dedicated worker answered on a port the SharedWorker forwarded", evidence: m };
    }));
    g.push(await probe("session.broadcastchannel", async () => {
      const a = new BroadcastChannel("probe-bc"), b = new BroadcastChannel("probe-bc");
      const token = hex(rand(6));
      const local = new Promise((res) => { b.onmessage = (e) => res(e.data); });
      a.postMessage(token);
      const l = await local;
      let seen = null;
      for (let i = 0; i < 20 && seen !== token; i++) { seen = unwrap(await needSW()({ cmd: "broadcastSeen" })).last; if (seen !== token) await new Promise((r) => setTimeout(r, 50)); }
      a.close(); b.close();
      if (l !== token) throw bad("same-page delivery failed");
      if (seen !== token) throw bad(`SharedWorker saw ${JSON.stringify(seen)}`);
      return { detail: "delivered page->page and page->SharedWorker", evidence: {} };
    }));
    g.push(await probe("session.locks-page", async () => {
      const name = await navigator.locks.request("probe-page-lock", async (l) => l.name);
      const q = await navigator.locks.query();
      return { detail: "lock granted and released", evidence: { name, held: q.held.length, pending: q.pending.length } };
    }));
    g.push(await probe("session.locks-sharedworker", viaSW("lockHere")));
    g.push(await probe("session.locks-cross-context", async () => {
      const out = await navigator.locks.request("probe-xlock", async () => unwrap(await needSW()({ cmd: "lockIfAvailable", args: ["probe-xlock"] })));
      if (out.evidence.outcome !== "unavailable") throw bad(`SharedWorker ${out.evidence.outcome} a lock the page holds`);
      return { detail: "a lock held by the page is unavailable to the SharedWorker", evidence: out.evidence };
    }));
    g.push(await control("session", () => navigator.locks.request("probe-x", { ifAvailable: true, steal: true }, () => {})));
    return g;
  }

  async function groupEngine() {
    const g = [];
    g.push(await probe("engine.wasm-sharedworker", viaSW("wasmAdd")));
    g.push(await probe("engine.wasm-dedicated-worker", viaDW("wasmAdd")));
    g.push(await probe("engine.wasm-instantiatestreaming", async () => {
      const { instance } = await WebAssembly.instantiateStreaming(new Response(ADD, { headers: { "Content-Type": "application/wasm" } }));
      const got = instance.exports.add(20, 22);
      if (got !== 42) throw bad("add(20,22) = " + got);
      return { detail: "instantiateStreaming ran add(20,22) = 42", evidence: {} };
    }));
    g.push(await probe("engine.automerge-wasm", viaDW("automerge"), 60000));
    g.push(await control("engine", () => new WebAssembly.Module(new Uint8Array([0, 1, 2, 3]))));
    return g;
  }

  async function groupPersistence() {
    const g = [];
    g.push(await probe("persistence.opfs-page", async () => {
      const root = await navigator.storage.getDirectory();
      const fh = await root.getFileHandle("probe-page.txt", { create: true });
      const w = await fh.createWritable(); const want = hex(rand(8)); await w.write(want); await w.close();
      const back = await (await fh.getFile()).text();
      if (back !== want) throw bad("read back differs");
      return { detail: "createWritable write and getFile read back", evidence: {} };
    }));
    g.push(await probe("persistence.opfs-dedicated-worker-sync-handle", viaDW("opfsSync")));
    g.push(await probe("persistence.opfs-sharedworker", viaSW("opfsAsync")));
    g.push(await probe("persistence.idb-page", () => PC.idbRoundTrip("page")));
    g.push(await probe("persistence.idb-dedicated-worker", viaDW("idbRoundTrip", ["dedicated"])));
    g.push(await probe("persistence.idb-sharedworker", viaSW("idbRoundTrip", ["shared"])));
    g.push(await probe("persistence.storage-estimate", async () => { const e = await navigator.storage.estimate(); return { detail: `usage ${e.usage} of quota ${e.quota}`, evidence: { usage: e.usage, quota: e.quota } }; }));
    g.push(await probe("persistence.persist", async () => {
      const before = await navigator.storage.persisted(); const granted = await navigator.storage.persist(); const after = await navigator.storage.persisted();
      const r = { detail: `persisted() ${before} -> persist() ${granted} -> persisted() ${after}`, evidence: { before, granted, after } };
      if (!granted) r.refused = true;
      return r;
    }));
    const visit = { idbBefore: null, idbAfter: null, opfsBefore: null, opfsAfter: null };
    g.push(await probe("persistence.visit-marker", async () => {
      const db = await new Promise((res, rej) => { const r = indexedDB.open("probe-db", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      const req = (fn, mode) => new Promise((res, rej) => { const tx = db.transaction("kv", mode); const r = fn(tx.objectStore("kv")); tx.oncomplete = () => res(r?.result); tx.onerror = () => rej(tx.error); });
      visit.idbBefore = (await req((s) => s.get("visit"), "readonly")) ?? null;
      visit.idbAfter = (visit.idbBefore ?? 0) + 1; await req((s) => s.put(visit.idbAfter, "visit"), "readwrite"); db.close();
      const root = await navigator.storage.getDirectory();
      const fh = await root.getFileHandle("visit-marker.txt", { create: true });
      const text = await (await fh.getFile()).text();
      visit.opfsBefore = text === "" ? null : Number(text);
      visit.opfsAfter = (visit.opfsBefore ?? 0) + 1;
      const w = await fh.createWritable(); await w.write(String(visit.opfsAfter)); await w.close();
      return { detail: `idb ${visit.idbBefore} -> ${visit.idbAfter}; opfs ${visit.opfsBefore} -> ${visit.opfsAfter}`, evidence: { ...visit } };
    }));
    const opfsContention = async (name, get) => g.push(await probe(`persistence.opfs-contention-${name}`, get));
    await opfsContention("page", () => PC.opfsContention());
    await opfsContention("dedicated-worker", viaDW("opfsContention"));
    await opfsContention("sharedworker", viaSW("opfsContention"));
    g.push(await probe("persistence.sentinels", async () => {
      // A sentinel is {seq, payload, digest = sha256(payload)}. Each run verifies what the last run wrote, then writes seq+1.
      const mk = async (seq) => { const payload = hex(rand(64)); return { seq, payload, digest: await sha(utf8(payload)) }; };
      const check = async (rec) => (rec === null || rec === undefined ? { state: "absent", seq: null }
        : rec && typeof rec.seq === "number" && typeof rec.payload === "string" && (await sha(utf8(rec.payload))) === rec.digest ? { state: "verified", seq: rec.seq } : { state: "torn", seq: rec?.seq ?? null });
      const db = await new Promise((res, rej) => { const r = indexedDB.open("probe-db", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      const req = (fn, mode) => new Promise((res, rej) => { const tx = db.transaction("kv", mode); const r = fn(tx.objectStore("kv")); tx.oncomplete = () => res(r?.result); tx.onerror = () => rej(tx.error); });
      const idbPrev = await check(await req((s) => s.get("sentinel"), "readonly"));
      const idbNext = await mk((idbPrev.seq ?? 0) + 1); await req((s) => s.put(idbNext, "sentinel"), "readwrite"); db.close();
      const fh = await (await navigator.storage.getDirectory()).getFileHandle("sentinel.json", { create: true });
      const text = await (await fh.getFile()).text();
      let parsed = null, parseFailed = false; if (text !== "") { try { parsed = JSON.parse(text); } catch { parseFailed = true; } }
      const opfsPrev = parseFailed ? { state: "torn", seq: null } : await check(parsed);
      const opfsNext = await mk((opfsPrev.seq ?? 0) + 1);
      const w = await fh.createWritable(); await w.write(JSON.stringify(opfsNext)); await w.close();
      const evidence = { idb: { previous: idbPrev, wroteSeq: idbNext.seq }, opfs: { previous: opfsPrev, wroteSeq: opfsNext.seq } };
      const torn = idbPrev.state === "torn" || opfsPrev.state === "torn";
      return { detail: `idb ${idbPrev.state}@${idbPrev.seq} -> ${idbNext.seq}; opfs ${opfsPrev.state}@${opfsPrev.seq} -> ${opfsNext.seq}`, evidence, ...(torn ? { refused: true } : {}) };
    }));
    g.push(await probe("persistence.idb-version-upgrade", async () => {
      const log = [];
      const hold = await new Promise((res, rej) => { const r = indexedDB.open("probe-ver-db"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      const next = hold.version + 1;
      hold.onversionchange = (e) => { log.push(`this tab versionchange old=${e.oldVersion} new=${e.newVersion}`); setTimeout(() => { hold.close(); log.push("this tab closed"); }, 300); };
      await new Promise((res, rej) => {
        const r = indexedDB.open("probe-ver-db", next);
        r.onblocked = () => log.push("requester blocked"); r.onupgradeneeded = () => log.push("requester upgradeneeded");
        r.onsuccess = () => { log.push("requester open"); r.result.close(); res(); }; r.onerror = () => rej(r.error);
      });
      return { detail: log.join(" > "), evidence: { toVersion: next, order: log, sawBlocked: log.includes("requester blocked") } };
    }));
    g.push(await control("persistence", () => indexedDB.open("probe-x", 0)));
    return { g, visit };
  }

  async function groupCustody() {
    const g = [], S = crypto.subtle;
    g.push(await probe("custody.ed25519", async () => {
      const k = await S.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
      const sig = await S.sign("Ed25519", k.privateKey, utf8("probe"));
      const ok = await S.verify("Ed25519", k.publicKey, sig, utf8("probe"));
      const tampered = await S.verify("Ed25519", k.publicKey, sig, utf8("probe!"));
      if (!ok || tampered) throw bad(`verify ok=${ok} tampered=${tampered}`);
      return { detail: "generate, sign, verify; tampered message rejected", evidence: { sigBytes: sig.byteLength } };
    }));
    g.push(await probe("custody.x25519", async () => {
      const a = await S.generateKey({ name: "X25519" }, true, ["deriveBits"]), b = await S.generateKey({ name: "X25519" }, true, ["deriveBits"]);
      const ab = await S.deriveBits({ name: "X25519", public: b.publicKey }, a.privateKey, 256), ba = await S.deriveBits({ name: "X25519", public: a.publicKey }, b.privateKey, 256);
      if (hex(ab) !== hex(ba)) throw bad("shared secrets differ");
      return { detail: "both sides derive the same 256 bits", evidence: {} };
    }));
    g.push(await probe("custody.aes-gcm", async () => {
      const k = await S.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]); const iv = rand(12);
      const ct = await S.encrypt({ name: "AES-GCM", iv }, k, utf8("probe"));
      const pt = new TextDecoder().decode(await S.decrypt({ name: "AES-GCM", iv }, k, ct));
      if (pt !== "probe") throw bad("decrypt differs");
      return { detail: "encrypt/decrypt round trip", evidence: {} };
    }));
    g.push(await probe("custody.hkdf", async () => {
      const base = await S.importKey("raw", rand(32), "HKDF", false, ["deriveBits"]);
      const bits = await S.deriveBits({ name: "HKDF", hash: "SHA-256", salt: rand(16), info: utf8("probe") }, base, 256);
      return { detail: "derived 256 bits", evidence: { bytes: bits.byteLength } };
    }));
    g.push(await probe("custody.nonextractable-key-in-idb", async () => {
      const key = await S.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
      const db = await new Promise((res, rej) => { const r = indexedDB.open("probe-key-db", 1); r.onupgradeneeded = () => r.result.createObjectStore("keys"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      const tx = (mode, fn) => new Promise((res, rej) => { const t = db.transaction("keys", mode); const r = fn(t.objectStore("keys")); t.oncomplete = () => res(r?.result); t.onerror = () => rej(t.error); });
      await tx("readwrite", (s) => s.put(key, "k")); const back = await tx("readonly", (s) => s.get("k")); db.close();
      const iv = rand(12); const ct = await S.encrypt({ name: "AES-GCM", iv }, back, utf8("probe"));
      const pt = new TextDecoder().decode(await S.decrypt({ name: "AES-GCM", iv }, key, ct));
      let exportRefusal = null; try { await S.exportKey("raw", back); } catch (e) { exportRefusal = e.name; }
      if (pt !== "probe") throw bad("decrypt with the original key differs");
      if (exportRefusal === null) throw bad("the re-read key exported");
      return { detail: "stored a non-extractable CryptoKey, re-read it, used it; export refused", evidence: { exportRefusal, extractable: back.extractable } };
    }));
    g.push(await probe("custody.webauthn-availability", async () => {
      if (typeof PublicKeyCredential === "undefined") return { refused: true, detail: "PublicKeyCredential absent", evidence: {} };
      const uvpaa = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      let caps = null, capsNote = "getClientCapabilities absent";
      if (typeof PublicKeyCredential.getClientCapabilities === "function") { caps = await PublicKeyCredential.getClientCapabilities(); capsNote = "getClientCapabilities present"; }
      return { detail: `isUserVerifyingPlatformAuthenticatorAvailable ${uvpaa}; ${capsNote}`, evidence: { uvpaa, capabilities: caps } };
    }));
    g.push({ id: "custody.passkey-prf", verdict: "skipped", detail: "press the Passkey PRF probe button", evidence: {}, ms: 0 });
    g.push(await control("custody", () => crypto.subtle.importKey("raw", new Uint8Array(3), "AES-GCM", false, ["encrypt"])));
    return g;
  }

  async function groupWire() {
    const g = [], base = `ws://${location.host}/echo`, TOKEN = "lares.probe";
    const openWs = (protos) => new Promise((resolve) => {
      let ws; try { ws = protos ? new WebSocket(base, protos) : new WebSocket(base); } catch (e) { return resolve({ ok: false, how: `${e.name}: ${e.message}` }); }
      ws.binaryType = "arraybuffer";
      ws.onmessage = (e) => { if (typeof e.data === "string") { ws.onmessage = null; resolve({ ok: true, ws, hello: JSON.parse(e.data) }); } };
      ws.onclose = (e) => resolve({ ok: false, how: `closed code=${e.code} clean=${e.wasClean} reason=${JSON.stringify(e.reason)}` });
    });
    const roundTrip = (ws, data) => new Promise((res, rej) => { ws.onmessage = (e) => res(e.data); ws.onclose = (e) => rej(bad(`closed during echo code=${e.code}`)); ws.send(data); });
    g.push(await probe("wire.websocket-echo", async () => {
      const o = await openWs(); if (!o.ok) throw bad(o.how);
      const t = await roundTrip(o.ws, "ping"); o.ws.close();
      if (t !== "ping") throw bad("echo returned " + t);
      return { detail: "same-origin text echo", evidence: {} };
    }));
    g.push(await probe("wire.subprotocol-carriage", async () => {
      const results = [];
      for (const bytes of [64, 256, 1024, 2048, 4096, 8192]) {
        const payload = b64u(rand(bytes)); const want = await sha(utf8(payload));
        const o = await openWs([TOKEN, payload]);
        if (!o.ok) { results.push({ bytes, encodedLength: payload.length, ok: false, how: o.how }); continue; }
        const ok = o.ws.protocol === TOKEN && o.hello.payloadDigest === want;
        results.push({ bytes, encodedLength: payload.length, ok, selected: o.ws.protocol, requestHeaderBytes: o.hello.requestHeaderBytes, ...(ok ? {} : { how: `connected; selected=${JSON.stringify(o.ws.protocol)} digestMatch=${o.hello.payloadDigest === want}` }) });
        o.ws.close();
      }
      const okSizes = results.filter((r) => r.ok), failed = results.find((r) => !r.ok);
      const evidence = { results, largestOk: okSizes.at(-1)?.bytes ?? null, firstFailure: failed ? { bytes: failed.bytes, how: failed.how } : null };
      return { detail: `largest ok ${evidence.largestOk} bytes; first failure ${failed ? `${failed.bytes} bytes (${failed.how})` : "none"}`, evidence, ...(okSizes.length ? {} : { refused: true }) };
    }, 60000));
    g.push(await probe("wire.subprotocol-grammar", async () => {
      const cases = [["slash-and-equals", [TOKEN, "ab/cd=="], false], ["padded-equals", [TOKEN, "abcd=="], false], ["unpadded-base64url", [TOKEN, b64u(rand(48))], true]];
      const out = [];
      for (const [name, protos, expectAccept] of cases) {
        const o = await openWs(protos);
        out.push({ name, accepted: o.ok, expected: expectAccept ? "accept" : "refuse", asExpected: o.ok === expectAccept, ...(o.ok ? { requestHeaderBytes: o.hello.requestHeaderBytes } : { how: o.how }) });
        o.ws?.close();
      }
      return { detail: out.map((c) => `${c.name}: ${c.accepted ? "accepted" : "refused"}`).join("; "), evidence: { cases: out } };
    }));
    for (const [label, size] of [["1MiB", 1 << 20], ["16MiB", 16 << 20]]) {
      g.push(await probe(`wire.binary-${label}`, async () => {
        const o = await openWs(); if (!o.ok) throw bad(o.how);
        const data = rand(size); const back = new Uint8Array(await roundTrip(o.ws, data)); o.ws.close();
        if (back.length !== size || (await sha(back)) !== (await sha(data))) throw bad(`echo differs (${back.length} bytes)`);
        return { detail: `${label} binary frame round-tripped`, evidence: { size } };
      }, 60000));
    }
    g.push(await control("wire", () => new WebSocket("ws://localhost/#fragment")));
    return g;
  }

  async function groupPage() {
    const g = [];
    g.push(await probe("page.custom-elements", async () => {
      const host = document.createElement("div"); host.innerHTML = "<probe-upgrade>light</probe-upgrade>";
      const el = host.firstChild;
      if (!customElements.get("probe-upgrade")) customElements.define("probe-upgrade", class extends HTMLElement { connectedCallback() { this.dataset.up = "1"; } });
      customElements.upgrade(host); $("stage").append(host);
      if (el.dataset.up !== "1" || el.textContent !== "light") throw bad("element not upgraded in light DOM");
      return { detail: "defined after parse, upgraded, light DOM kept", evidence: {} };
    }));
    g.push(await probe("page.popover", () => {
      const d = document.createElement("div"); d.popover = "manual"; d.textContent = "p"; document.body.append(d);
      d.showPopover(); const open = d.matches(":popover-open"); d.hidePopover(); d.remove();
      if (!open) throw bad(":popover-open did not match");
      return { detail: "showPopover matched :popover-open", evidence: {} };
    }));
    g.push(await probe("page.dialog-showmodal", () => {
      const d = document.createElement("dialog"); document.body.append(d); d.showModal();
      const modal = d.open && d.matches(":modal"); d.close(); d.remove();
      if (!modal) throw bad("dialog not modal");
      return { detail: "showModal opened a :modal dialog", evidence: {} };
    }));
    g.push(await probe("page.file-picker", () => {
      const input = document.createElement("input"); input.type = "file";
      const api = typeof window.showOpenFilePicker === "function", fb = input.type === "file" && "files" in input;
      return { detail: `showOpenFilePicker ${api ? "present" : "absent"}; input[type=file] ${fb ? "present" : "absent"}`, evidence: { showOpenFilePicker: api, inputFile: fb }, ...(fb ? {} : { refused: true }) };
    }));
    g.push(await probe("page.compressionstream", async () => {
      const src = rand(50000); const z = new Blob([src]).stream().pipeThrough(new CompressionStream("gzip"));
      const out = new Uint8Array(await new Response(z.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer());
      if (out.length !== src.length || (await sha(out)) !== (await sha(src))) throw bad("gzip round trip differs");
      return { detail: "gzip compress and decompress round trip", evidence: {} };
    }));
    g.push(await probe("page.structuredclone-transfer", () => {
      const ab = new ArrayBuffer(1024); const c = structuredClone(ab, { transfer: [ab] });
      if (ab.byteLength !== 0 || c.byteLength !== 1024) throw bad(`source ${ab.byteLength}, clone ${c.byteLength}`);
      return { detail: "source detached, clone kept 1024 bytes", evidence: {} };
    }));
    g.push(await control("page", () => customElements.define("nodash", class extends HTMLElement {})));
    return g;
  }

  async function groupLifecycle() {
    const g = [];
    g.push(await probe("lifecycle.sharedworker-event-log", async () => {
      logEvent("run");
      await new Promise((r) => setTimeout(r, 100));
      const r = unwrap(await needSW()({ cmd: "lifecycle" }));
      return { detail: `${r.events.length} events logged, ${r.ticks} ticks`, evidence: { events: r.events.length, ticks: r.ticks } };
    }));
    g.push(await probe("lifecycle.page-hooks", () => ({ detail: "listeners installed", evidence: { onfreeze: "onfreeze" in document, onresume: "onresume" in document, visibility: document.visibilityState } })));
    g.push(await control("lifecycle", () => structuredClone(() => {})));
    return g;
  }

  // ---- report ----
  let lastReport = null;
  function summarize(groups) {
    const counts = { granted: 0, refused: 0, error: 0, skipped: 0 }, controls = {};
    for (const [name, list] of Object.entries(groups)) for (const p of list) { if (p["control-negative"]) controls[name] = p["control-negative"]; else counts[p.verdict]++; }
    return { ...counts, controls };
  }
  function render(report) {
    const rows = $("rows"); rows.textContent = "";
    for (const [name, list] of Object.entries(report.groups ?? {})) {
      const h = document.createElement("h2"); h.textContent = name; rows.append(h);
      for (const p of list) {
        const d = document.createElement("div"); d.className = "row"; d.dataset.probe = p.id;
        const id = document.createElement("span"); id.className = "id"; id.textContent = p.id;
        const v = document.createElement("span");
        v.className = "v-" + (p["control-negative"] ?? p.verdict); v.textContent = p["control-negative"] ? `control-negative: ${p["control-negative"]}` : p.verdict;
        const dt = document.createElement("span"); dt.className = "detail"; dt.textContent = p.detail;
        d.append(id, v, dt); rows.append(d);
      }
    }
    $("json").value = JSON.stringify(report, null, 2);
  }
  async function post(report) {
    try {
      const r = await fetch("/report", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(report) });
      const j = await r.json().catch(() => ({})); return r.ok ? `posted as ${j.file}` : `POST refused: HTTP ${r.status}`;
    } catch (e) { return `POST failed: ${e.name}: ${e.message}`; }
  }
  const baseReport = (kind) => ({ schema: 1, kind, tab, ua: navigator.userAgent, uaData: navigator.userAgentData?.toJSON?.() ?? null, origin: location.origin, isSecureContext, env, ownerMode: OWNER_TAB ? "tab" : "sharedworker", ownerChanges, idbVersionchangesSeen: localEvents.filter((e) => e.name === "idb-versionchange").length });

  async function run() {
    $("run").disabled = true; $("status").textContent = "running..."; await envReady;
    const groups = {}; let visit = null, swInfo = null;
    const report = { ...baseReport("probe"), partial: true, groups };
    const publish = () => { report.sharedWorker = swInfo; report.summary = summarize(groups); report.visit = visit; report.totalMs = Math.round(performance.now() - t0); lastReport = report; render(report); };
    const runners = { session: groupSession, engine: groupEngine, custody: groupCustody, wire: groupWire, page: groupPage, lifecycle: groupLifecycle };
    for (const name of ["session", "engine", "persistence", "custody", "wire", "page", "lifecycle"]) {
      $("status").textContent = `running ${name}...`;
      if (name === "persistence") { const r = await groupPersistence(); groups[name] = r.g; visit = r.visit; }
      else groups[name] = await runners[name]();
      if (name === "session") swInfo = groups.session.find((x) => x.id === "session.sharedworker")?.evidence ?? null;
      publish();
    }
    if (swInfo?.instanceId && !lsGet("probe.firstInstanceId")) lsSet("probe.firstInstanceId", swInfo.instanceId);
    // The interim report lands BEFORE the memory probe: a tab that dies growing memory still leaves everything else.
    $("status").textContent = "posting interim report..."; const interim = await post(report);
    $("status").textContent = "growing memory (a refused or killed tab ends the run here)...";
    groups.engine.push(await probe("engine.memory-growth", viaDW("memoryGrow"), 60000));
    publish(); await post(report);
    $("status").textContent = "growing memory under load (two workers hold 64 MiB each)...";
    groups.engine.push(await probe("engine.memory-growth-under-load", async () => {
      const loaders = [0, 1].map(() => { const w = new Worker("dw.js"); return { w, call: endpoint(w, deadOn(w, "load worker")) }; });
      try {
        for (const l of loaders) unwrap(await l.call({ cmd: "holdMemory" }));
        const ladder = unwrap(await needDW()({ cmd: "memoryGrow" }));
        const answers = {};
        const ask = async (name, f) => { const nonce = hex(rand(6)); try { const r = await withTimeout(f(nonce), 5000, name); answers[name] = (r.nonce ?? r.evidence?.nonce) === nonce ? "replied" : "wrong-nonce"; } catch (e) { answers[name] = `no reply (${e.name})`; } };
        await ask("page-sharedworker", (n) => needSW()({ cmd: "echo", nonce: n }));
        await ask("dedicated-worker", (n) => needDW()({ cmd: "ping", args: [n] }));
        await ask("load-worker-0", (n) => loaders[0].call({ cmd: "ping", args: [n] }));
        await ask("load-worker-1", (n) => loaders[1].call({ cmd: "ping", args: [n] }));
        return { detail: ladder.detail + "; " + JSON.stringify(answers), evidence: { ladder: ladder.evidence, answers, held: "2 x 64MiB" }, ...(ladder.evidence.refusal ? { refused: true } : {}) };
      } finally { loaders.forEach((l) => l.w.terminate()); }
    }, 90000));
    report.partial = false; publish();
    $("status").textContent = `done; interim ${interim}; final ${await post(report)}`;
    $("run").disabled = false;
  }

  const nonces = [];
  async function lifecycleCheck() {
    await envReady;
    // A nonce that went unanswered before the tester's NEXT tap reads "no-reply-before-next-check"; ticks never decide.
    for (const n of nonces) if (n.final === null) n.final = n.reply ? (n.reply.instanceId !== n.baseInstanceId ? "replied-changed-instance-after-check" : "replied-after-check") : "no-reply-before-next-check";
    const fresh = { nonce: hex(rand(8)), baseInstanceId: lsGet("probe.firstInstanceId") ?? knownInstanceId, reply: null, final: null };
    nonces.push(fresh);
    if (swCall) swCall({ cmd: "echo", nonce: fresh.nonce }).then((r) => { if (r.nonce === fresh.nonce) fresh.reply = { instanceId: r.instanceId, ownerEpoch: r.ownerEpoch, ticks: r.ticks }; }).catch(() => {});
    await Promise.race([sleep(3000), new Promise((res) => { const t = setInterval(() => { if (fresh.reply) { clearInterval(t); res(); } }, 50); })]);
    if (fresh.reply) fresh.final = fresh.reply.instanceId !== fresh.baseInstanceId ? "replied-changed-instance" : "replied";
    const report = { ...baseReport("lifecycle"), pageEvents: localEvents.slice(), wasDiscarded: document.wasDiscarded ?? null, nonces: nonces.map((n) => ({ ...n })) };
    try {
      const r = unwrap(await needSW()({ cmd: "lifecycle" }));
      const first = lsGet("probe.firstInstanceId");
      Object.assign(report, { instanceId: r.instanceId, firstInstanceId: first, instanceChanged: first === null ? null : first !== r.instanceId, ownerEpoch: r.ownerEpoch, ticks: r.ticks, connectedPorts: r.connectedPorts, connects: r.connects, workerEvents: r.events });
    } catch (e) { report.sharedWorkerError = `${e.name}: ${e.message}`; }
    report.visibility = document.visibilityState; report.totalMs = Math.round(performance.now() - t0);
    lastReport = report; render(report);
    $("status").textContent = `lifecycle: ${await post(report)}`;
  }

  async function passkey() {
    const sa = rand(32), sb = rand(32);
    const dig = async (r) => (r ? sha(r) : null);
    const list = [await probe("custody.passkey-prf", async () => {
      if (typeof PublicKeyCredential === "undefined") return { refused: true, detail: "PublicKeyCredential absent", evidence: {} };
      const cred = await navigator.credentials.create({ publicKey: {
        rp: { name: "capability-probe" }, user: { id: rand(16), name: "ci-face", displayName: "ci-face" }, challenge: rand(32),
        pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }, { type: "public-key", alg: -8 }],
        authenticatorSelection: { authenticatorAttachment: "platform", residentKey: "preferred", userVerification: "required" },
        extensions: { prf: {} },
      } });
      const createdPrf = cred.getClientExtensionResults().prf;
      const prfEnabled = createdPrf?.enabled === true;
      // Provider evidence is limited to these structural fields; no PRF output is ever shown.
      const provider = { authenticatorAttachment: cred.authenticatorAttachment ?? null, transports: cred.response.getTransports?.() ?? null, createReturnedResults: createdPrf?.results !== undefined };
      if (!prfEnabled) return { refused: true, detail: "credential created; prf extension not enabled", evidence: { prfEnabled, ...provider } };
      const get = async (evalArg) => (await navigator.credentials.get({ publicKey: {
        challenge: rand(32), allowCredentials: [{ type: "public-key", id: cred.rawId }], userVerification: "required", extensions: { prf: { eval: evalArg } },
      } })).getClientExtensionResults().prf?.results;
      const a1 = await get({ first: sa }), a2 = await get({ first: sa }), b = await get({ first: sb });
      const d = { a1: await dig(a1?.first), a2: await dig(a2?.first), b: await dig(b?.first) };
      let pair; try { const p = await get({ first: sa, second: sb }); pair = { firstEqualsA: (await dig(p?.first)) === d.a1, secondEqualsB: (await dig(p?.second)) === d.b }; } catch (e) { pair = { refused: `${e.name}: ${e.message}` }; }
      const sameSaltEqual = d.a1 !== null && d.a1 === d.a2, differentSaltDiffers = d.b !== null && d.b !== d.a1;
      const evidence = { prfEnabled, ...provider, sameSaltEqual, differentSaltDiffers, firstPlusSecond: pair };
      if (!sameSaltEqual || !differentSaltDiffers) return { refused: true, detail: `prf outputs: sameSaltEqual=${sameSaltEqual} differentSaltDiffers=${differentSaltDiffers}`, evidence };
      return { detail: "prf enabled; same salt twice equal; different salt differs", evidence };
    }, 180000)];
    const report = { ...baseReport("passkey"), groups: { custody: list } };
    report.summary = summarize(report.groups); lastReport = report; render(report);
    $("status").textContent = `passkey: ${await post(report)}`;
  }

  // ---- owner death ----
  async function reconnect(oldId) {
    let last = null;
    for (let i = 0; i < 15; i++) {
      try { connectSW(); last = unwrap(await withTimeout(swCall({ cmd: "ping" }), 3000, "reconnect ping")); if (last.instanceId !== oldId) return { replaced: true, instanceId: last.instanceId, ownerEpoch: last.ownerEpoch, connectedPorts: last.connectedPorts }; } catch (e) { last = { error: `${e.name}: ${e.message}` }; }
      await sleep(250);
    }
    return { replaced: false, last };
  }
  const ownerBc = new BroadcastChannel("probe-owner");
  ownerBc.onmessage = async (e) => {
    if (e.data?.type !== "owner-killed" || e.data.from === tab || OWNER_TAB) return;
    const after = await reconnect(e.data.oldId);
    ownerChanges.push({ oldInstanceId: e.data.oldId, oldEpoch: e.data.oldEpoch, ...after });
    logEvent("owner-reconnected", after);
  };
  async function killOwner() {
    await envReady;
    const before = unwrap(await needSW()({ cmd: "ping" }));
    await needSW()({ cmd: "kill" }).catch(() => {});
    ownerBc.postMessage({ type: "owner-killed", from: tab, oldId: before.instanceId, oldEpoch: before.ownerEpoch });
    const after = await reconnect(before.instanceId);
    ownerChanges.push({ oldInstanceId: before.instanceId, oldEpoch: before.ownerEpoch, ...after });
    const report = { ...baseReport("owner-death"), before: { instanceId: before.instanceId, ownerEpoch: before.ownerEpoch, connectedPorts: before.connectedPorts }, after,
      instanceChanged: after.replaced, epochAdvanced: after.replaced ? after.ownerEpoch > before.ownerEpoch : null };
    lastReport = report; render(report); $("status").textContent = `owner-death: ${await post(report)}`;
  }

  // ---- one-tab fallback: an exclusive Web Lock stands in for the owner ----
  let releaseTabLock = null, tabLockSeq = 0;
  const tabLockReport = async (stage, p) => {
    const q = await navigator.locks.query();
    const report = { ...baseReport("tab-lock"), stage, order: ++tabLockSeq, groups: { "tab-lock": [{ id: `tablock.${stage}`, ...p, evidence: { ...(p.evidence ?? {}), held: q.held.map((h) => h.name), pending: q.pending.map((h) => h.name) } }] } };
    lastReport = report; render(report); $("status").textContent = `tab-lock ${stage}: ${await post(report)}`;
  };
  const LOCK = "probe-tab-owner";
  const lockTake = () => new Promise((resolve) => {
    navigator.locks.request(LOCK, { ifAvailable: true }, (lock) => {
      if (!lock) { resolve({ verdict: "refused", detail: "exclusive lock unavailable: another context holds it" }); return undefined; }
      resolve({ verdict: "granted", detail: "took the exclusive lock and holds it until released or closed" });
      return new Promise((rel) => { releaseTabLock = rel; });
    }).catch((e) => resolve({ verdict: "refused", detail: `${e.name}: ${e.message}` }));
  });
  $("lock-take").addEventListener("click", async () => tabLockReport("take", await lockTake()));
  $("lock-try").addEventListener("click", async () => tabLockReport("try", await lockTake()));
  $("lock-wait").addEventListener("click", () => {
    tabLockReport("wait-pending", { verdict: "skipped", detail: "waiting for the lock; keep this tab open" });
    navigator.locks.request(LOCK, (lock) => { tabLockReport("wait-acquired", { verdict: "granted", detail: "the lock became available and this tab acquired it" }); return new Promise((rel) => { releaseTabLock = rel; }); });
  });
  $("lock-release").addEventListener("click", () => { releaseTabLock?.(); releaseTabLock = null; tabLockReport("release", { verdict: "granted", detail: "released" }); });
  $("kill").addEventListener("click", () => { killOwner().catch((e) => { $("status").textContent = `kill failed: ${e.name}: ${e.message}`; }); });

  $("run").addEventListener("click", () => { run().catch((e) => { $("status").textContent = `run failed: ${e.name}: ${e.message}`; $("run").disabled = false; }); });
  $("lifecycle").addEventListener("click", () => { lifecycleCheck(); });
  $("passkey").addEventListener("click", () => { passkey(); });
  $("copy").addEventListener("click", async () => { try { await navigator.clipboard.writeText($("json").value); } catch { $("json").select(); document.execCommand("copy"); } });
  window.__probe = { get report() { return lastReport; }, tab };
})();
