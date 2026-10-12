/* Probe bodies shared by the SharedWorker and the dedicated worker (classic scripts, loaded with importScripts).
 * Each function returns {detail, evidence} or throws; the caller maps a throw to a refusal carrying name + message. */
"use strict";
(function (g) {
  // (module (func (export "add") (param i32 i32) (result i32) local.get 0 local.get 1 i32.add))
  const ADD_WASM = new Uint8Array([
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
    0x01, 0x07, 0x01, 0x60, 0x02, 0x7f, 0x7f, 0x01, 0x7f,
    0x03, 0x02, 0x01, 0x00,
    0x07, 0x07, 0x01, 0x03, 0x61, 0x64, 0x64, 0x00, 0x00,
    0x0a, 0x09, 0x01, 0x07, 0x00, 0x20, 0x00, 0x20, 0x01, 0x6a, 0x0b,
  ]);

  const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
  const idbOpen = () => new Promise((resolve, reject) => {
    const r = indexedDB.open("probe-db", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(new Error("idb open blocked"));
  });
  const idbDo = (db, mode, fn) => new Promise((resolve, reject) => {
    const tx = db.transaction("kv", mode); const out = fn(tx.objectStore("kv"));
    tx.oncomplete = () => resolve(out && "result" in out ? out.result : undefined);
    tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
  });

  const C = {
    ping: async (nonce) => ({ detail: "pong", evidence: { nonce: nonce ?? null } }),
    bumpCounter: async (key) => {
      const db = await idbOpen();
      const cur = (await idbDo(db, "readonly", (s) => s.get(key))) ?? 0;
      await idbDo(db, "readwrite", (s) => { s.put(cur + 1, key); });
      db.close();
      return { detail: key + " = " + (cur + 1), evidence: { value: cur + 1 } };
    },
    holdMemory: async () => {
      // 64 MiB kept alive on the worker global for the length of the worker.
      self.__held = new WebAssembly.Memory({ initial: 1024, maximum: 1024 });
      return { detail: "holding 64 MiB wasm memory", evidence: { bytes: self.__held.buffer.byteLength } };
    },
    opfsContention: async () => {
      const proto = typeof FileSystemFileHandle !== "undefined" ? FileSystemFileHandle.prototype : null;
      const ev = { present: !!proto && typeof proto.createSyncAccessHandle === "function", first: null, second: null, reopen: null };
      if (!ev.present) return { refused: true, detail: "createSyncAccessHandle absent in this context", evidence: ev };
      const fh = await (await navigator.storage.getDirectory()).getFileHandle("probe-contend.bin", { create: true });
      const tryOpen = async () => { try { return { h: await fh.createSyncAccessHandle() }; } catch (e) { return { err: e.name + ": " + e.message }; } };
      const a = await tryOpen(); ev.first = a.err ?? "opened";
      if (!a.h) return { refused: true, detail: "first handle refused: " + a.err, evidence: ev };
      const b = await tryOpen(); ev.second = b.err ?? "opened (no exclusion)"; b.h?.close();
      a.h.close();
      const c = await tryOpen(); ev.reopen = c.err ?? "opened"; c.h?.close();
      const ok = !b.h && !c.err;
      return { detail: "first " + ev.first + "; competing " + ev.second + "; after close " + ev.reopen, evidence: ev, ...(ok ? {} : { refused: true }) };
    },
    wasmAdd: async () => {
      const { instance } = await WebAssembly.instantiate(ADD_WASM);
      const got = instance.exports.add(40, 2);
      if (got !== 42) throw Object.assign(new Error(`add(40,2) = ${got}`), { probeError: true });
      return { detail: "add(40,2) = 42", evidence: { sum: got } };
    },
    idbRoundTrip: async (scope) => {
      const db = await idbOpen();
      const bytes = crypto.getRandomValues(new Uint8Array(16)); const want = hex(bytes);
      await idbDo(db, "readwrite", (s) => { s.put(want, "rt-" + scope); });
      const back = await idbDo(db, "readonly", (s) => s.get("rt-" + scope));
      db.close();
      if (back !== want) throw Object.assign(new Error("read back differs"), { probeError: true });
      return { detail: "wrote and read back 16 random bytes", evidence: { scope } };
    },
    opfsSync: async () => {
      const root = await navigator.storage.getDirectory();
      const fh = await root.getFileHandle("probe-sync.bin", { create: true });
      if (typeof fh.createSyncAccessHandle !== "function") throw Object.assign(new Error("createSyncAccessHandle absent"), { name: "Absent" });
      const ah = await fh.createSyncAccessHandle();
      try {
        const data = crypto.getRandomValues(new Uint8Array(4096));
        ah.truncate(0); const w = ah.write(data, { at: 0 }); ah.flush();
        const back = new Uint8Array(4096); const r = ah.read(back, { at: 0 });
        const same = r === 4096 && back.every((b, i) => b === data[i]);
        if (!same) throw Object.assign(new Error(`read ${r} bytes, content ${same ? "same" : "differs"}`), { probeError: true });
        return { detail: "wrote, flushed, read back 4096 bytes through a sync access handle", evidence: { written: w, size: ah.getSize() } };
      } finally { ah.close(); }
    },
    opfsAsync: async () => {
      const root = await navigator.storage.getDirectory();
      const fh = await root.getFileHandle("probe-async.bin", { create: true });
      const hasSync = typeof fh.createSyncAccessHandle === "function";
      let syncOutcome = "absent";
      if (hasSync) { try { (await fh.createSyncAccessHandle()).close(); syncOutcome = "opened"; } catch (e) { syncOutcome = `${e.name}: ${e.message}`; } }
      return { detail: `getDirectory works; createSyncAccessHandle ${hasSync ? "present" : "absent"} (${syncOutcome})`, evidence: { hasSync, syncOutcome } };
    },
    lockHere: async () => {
      const got = await navigator.locks.request("probe-worker-lock", async (l) => l.name);
      return { detail: "lock granted and released", evidence: { name: got } };
    },
    lockIfAvailable: async (name) => {
      const out = await navigator.locks.request(name, { ifAvailable: true }, async (l) => (l === null ? "unavailable" : "acquired"));
      return { detail: `ifAvailable on a lock the page holds -> ${out}`, evidence: { outcome: out } };
    },
    memoryGrow: async () => {
      const PAGE = 65536, steps = [["256MiB", 4096], ["512MiB", 8192], ["1GiB", 16384]];
      const mem = new WebAssembly.Memory({ initial: 1, maximum: 16384 });
      const reached = []; let refusal = null;
      for (const [label, pages] of steps) {
        try { mem.grow(pages - mem.buffer.byteLength / PAGE); reached.push(label); }
        catch (e) { refusal = { at: label, name: e.name, message: e.message }; break; }
      }
      return { detail: `grew to ${reached.at(-1) ?? "nothing"}${refusal ? `, refused at ${refusal.at}` : ""}`, evidence: { reached, refusal, bytes: mem.buffer.byteLength } };
    },
    automerge: async () => {
      const probe = await fetch("/vendor/automerge-iife.js", { method: "HEAD" });
      if (!probe.ok) return { skipped: true, detail: `bundle not served (HTTP ${probe.status}); mount the automerge dist/iife directory` , evidence: {} };
      self.window = self; importScripts("/vendor/automerge-iife.js");
      const A = self.Automerge;
      let doc = A.from({ n: 0 });
      doc = A.change(doc, (d) => { d.n = 1; d.s = "x"; });
      const bin = A.save(doc); const back = A.load(bin);
      if (back.n !== 1 || back.s !== "x") throw Object.assign(new Error("loaded doc differs"), { probeError: true });
      return { detail: `change + save (${bin.length} bytes) + load round-trip`, evidence: { bytes: bin.length } };
    },
  };
  g.PC = C; g.PCHex = hex;

  /** Run name with args, shaped for the postMessage wire: {ok, ...} or {ok:false, name, message}. */
  g.PCRun = async (cmd, args) => {
    try { const f = C[cmd]; if (!f) throw Object.assign(new Error("no such command " + cmd), { probeError: true }); return { ok: true, ...(await f(...(args ?? []))) }; }
    catch (e) { return { ok: false, name: e?.name ?? "Error", message: String(e?.message ?? e), probeError: !!e?.probeError }; }
  };
})(self);
