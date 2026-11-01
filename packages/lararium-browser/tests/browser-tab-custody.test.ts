/**
 * browser-tab-custody — an unlock belongs to ONE tab, and no key rests where another tab or the shared holder can read it.
 *
 *   The fixture's `ask` refuses when the tab worker faults (KNOWN POSITIVE: a planted worker that throws at load).
 *   TC1  RED: a face unlocked in one tab reads LOCKED in a second tab of the same origin (a second realm over the same
 *        IndexedDB); the second tab's sealed-row read refuses `sealed-locked`.
 *        CONTROL: the first tab still reads unlocked, and the second tab's own unlock opens its own session.
 *   TC2  RED: after an unlock, no byte of the opened key rests in any IndexedDB store, any web-storage area or the Cache API.
 *        KNOWN POSITIVE FIRST: the same scan finds the key where the test planted it, so a clean scan cannot be a blind one.
 *
 *   TC2b RED: every payload a tab posts to the shared holder across a seal, an unlock and a session of verbs carries no byte of
 *        the opened key, in its raw, hex or base64 form. The channel is the one the product builds (`attachSharedHolder` takes
 *        its SharedWorker constructor as `host`), wrapped to record `postMessage`; no product hook stands for it.
 *        KNOWN POSITIVE FIRST: one message carrying the key through the same recording port reads found in each form.
 *
 * THE COST. A passphrase pin derives its key with scrypt at N=2^17, r=8, p=1 (`keyslot.ts` SCRYPT, about half a second alone
 * and several times that in a browser worker on a loaded box). Each derivation in a test counts against its bound, so TC1
 * stands as two tests: the first derives once (the seal), the second twice (the seal and the second tab's own unlock).
 *
 * Meme: lar:///ha.ka.ba/lararium/browser/browser-custody
 */
import { readyWorker } from "./fixtures/ready-worker.js";
import { describe, expect, test } from "vitest";
import { decodeSlotTree, nobleKdf, openTreeKey } from "@lararium/mesh";
import { attachSharedHolder, holderWorkerHandle, type SharedWorkerHost } from "../src/shared-holder.js";
import { vesselLockName } from "../src/vessel-lock.js";
import { faceFixture } from "./holder-session-fixture.js";
import { generateOrLoadBrowserVesselIdentity, openVesselIdb } from "../src/browser-vessel-identity.js";
import { CUSTODY_TREE_ROW, browserKeystoreCustodyIo, readBrowserCustody, sealBrowserKeystore } from "../src/browser-custody.js";

const SLOW = 60_000;
const hex = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const PASS = { kind: "passphrase", passphrase: "the hearth keeps its fire" } as const;

function tab(): Promise<Worker> { return readyWorker(new URL("./fixtures/custody-tab.worker.ts", import.meta.url)); }
/** A worker that dies at load or posts an unreadable reply refuses by name; listening for `message` alone left it a silent hang. */
function ask<T>(worker: Worker, msg: Record<string, unknown>): Promise<T> {
  return new Promise((resolve, reject) => {
    const settle = (): void => { worker.removeEventListener("message", onMessage); worker.removeEventListener("error", onError); worker.removeEventListener("messageerror", onError); };
    const onMessage = (e: MessageEvent): void => { settle(); if (e.data?.error) reject(new Error(`${String(msg.op)}: ${e.data.error}`)); else resolve(e.data as T); };
    const onError = (e: Event): void => { settle(); reject(new Error(`${String(msg.op)}: the tab worker faulted (${(e as ErrorEvent).message ?? e.type})`)); };
    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);
    worker.addEventListener("messageerror", onError);
    worker.postMessage(msg);
  });
}

async function sealedVessel(tag: string): Promise<string> {
  const idbName = `tab-custody-${tag}-${crypto.randomUUID()}`;
  await generateOrLoadBrowserVesselIdentity(idbName);
  await sealBrowserKeystore(idbName, PASS);     // leaves THIS realm unlocked
  return idbName;
}

describe("an unlock belongs to one tab", () => {
  test("KNOWN POSITIVE: a tab worker that faults at load refuses its ask by name, never hangs", async () => {
    await expect(readyWorker(new URL("./fixtures/faulting-tab.worker.ts", import.meta.url))).rejects.toThrow(/the tab worker faulted/);
  }, SLOW);

  test("TC1 a face unlocked in one tab reads locked in a second tab of the same origin — CONTROL: the first tab still holds it", async () => {
    const idbName = await sealedVessel("two-tabs");   // one derivation: the seal
    const second = await tab();
    try {
      expect(await readBrowserCustody(idbName)).toMatchObject({ reading: "sealed", unlocked: true });   // CONTROL: the first tab holds its unlock
      expect(await ask(second, { op: "status", idbName })).toMatchObject({ reading: "sealed", unlocked: false });
      expect(await ask(second, { op: "read-row", idbName, row: "vessel-key" })).toMatchObject({ refused: "sealed-locked" });
    } finally { second.terminate(); }
  }, SLOW);

  test("TC1b CONTROL: the second tab unlocks on its own and opens its own session", async () => {
    const idbName = await sealedVessel("two-tabs-own-unlock");   // two derivations in all: the seal, then this unlock
    const second = await tab();
    try {
      expect(await ask(second, { op: "unlock", idbName, passphrase: PASS.passphrase })).toMatchObject({ reading: "opens" });
      expect(await ask(second, { op: "status", idbName })).toMatchObject({ unlocked: true });
    } finally { second.terminate(); }
  }, SLOW);
});

/** Every byte string the origin keeps that another tab or the holder could read: all IndexedDB stores, web storage, the Cache API. */
async function everythingTheOriginKeeps(idbName: string): Promise<string[]> {
  const out: string[] = [];
  const db = await openVesselIdb(idbName);
  try {
    for (const store of Array.from(db.objectStoreNames)) {
      const rows = await new Promise<unknown[]>((resolve, reject) => {
        const req = db.transaction(store, "readonly").objectStore(store).getAll();
        req.onsuccess = () => resolve(req.result as unknown[]);
        req.onerror = () => reject(req.error);
      });
      for (const row of rows) out.push(row instanceof Uint8Array ? hex(row) : JSON.stringify(row, (_k, v) => (v instanceof Uint8Array ? hex(v) : v)));
    }
  } finally { db.close(); }
  for (const area of [globalThis.localStorage, globalThis.sessionStorage]) {
    for (let i = 0; i < area.length; i++) out.push(`${area.key(i)}=${area.getItem(area.key(i)!)}`);
  }
  for (const name of await caches.keys()) {
    const cache = await caches.open(name);
    for (const req of await cache.keys()) out.push(await (await cache.match(req))!.text());
  }
  return out;
}

describe("no key rests where another tab or the shared holder can read it", () => {
  test("TC2 an unlock leaves no byte of the opened key in any store the origin keeps — KNOWN POSITIVE first: a planted key reads found", async () => {
    const idbName = await sealedVessel("no-key-at-rest");
    const tree = decodeSlotTree(await browserKeystoreCustodyIo(idbName).read(CUSTODY_TREE_ROW));
    if (tree.reading !== "readable") throw new Error("the sealed vessel's tree does not read");
    const opened = await openTreeKey(tree.tree, [PASS], nobleKdf);
    if (opened.reading !== "opens") throw new Error("the test route does not open the tree");
    const keyHex = hex(opened.treeKey);

    // KNOWN POSITIVE: plant the key where the scan looks and the scan must see it.
    localStorage.setItem(`planted-${idbName}`, keyHex);
    try {
      expect((await everythingTheOriginKeeps(idbName)).some((s) => s.includes(keyHex))).toBe(true);
    } finally { localStorage.removeItem(`planted-${idbName}`); }

    // The real claim: after the unlock, nothing the origin keeps carries the opened key.
    expect((await readBrowserCustody(idbName)).reading).toBe("sealed");
    expect((await everythingTheOriginKeeps(idbName)).filter((s) => s.includes(keyHex))).toEqual([]);
  }, SLOW);
});

/** The payload as every form a key could travel in: raw bytes, hex, base64, and the JSON of the whole message. */
function formsOf(key: Uint8Array): { raw: Uint8Array; hex: string; b64: string } {
  return { raw: key, hex: hex(key), b64: btoa(String.fromCharCode(...key)) };
}

function carries(payload: unknown, key: Uint8Array): boolean {
  const forms = formsOf(key);
  const seen = new Set<unknown>();
  const walk = (v: unknown): boolean => {
    if (v === null || typeof v !== "object") return typeof v === "string" && (v.includes(forms.hex) || v.includes(forms.b64));
    if (seen.has(v)) return false;
    seen.add(v);
    const bytes = v instanceof ArrayBuffer ? new Uint8Array(v) : ArrayBuffer.isView(v) ? new Uint8Array(v.buffer, v.byteOffset, v.byteLength) : null;
    if (bytes) return hex(bytes).includes(forms.hex);
    return Object.values(v as Record<string, unknown>).some(walk);
  };
  return walk(payload);
}

describe("nothing a tab posts to the shared holder carries the key", () => {
  test("TC2b the holder channel carries no byte of the opened key across a seal, an unlock and a session of verbs — KNOWN POSITIVE first", async () => {
    const idbName = await sealedVessel("holder-channel");
    const tree = decodeSlotTree(await browserKeystoreCustodyIo(idbName).read(CUSTODY_TREE_ROW));
    if (tree.reading !== "readable") throw new Error("the sealed vessel's tree does not read");
    const opened = await openTreeKey(tree.tree, [PASS], nobleKdf);
    if (opened.reading !== "opens") throw new Error("the test route does not open the tree");
    const key = opened.treeKey;

    const sent: unknown[] = [];
    class RecordingSharedWorker {
      readonly port: MessagePort;
      constructor(url: URL | string, options?: string | WorkerOptions) {
        this.port = new SharedWorker(url, options as never).port;
        const real = this.port.postMessage.bind(this.port) as (m: unknown, t?: unknown) => void;
        (this.port as unknown as { postMessage: (m: unknown, t?: unknown) => void }).postMessage = (m, t) => { sent.push(m); real(m, t); };
      }
    }
    const lockName = vesselLockName(`lares:test:holder-channel:${crypto.randomUUID()}`);
    const holderUrl = new URL("./fixtures/shared-holder-live.worker.ts", import.meta.url);
    holderUrl.searchParams.set("lock", lockName);
    const host: SharedWorkerHost = { SharedWorker: RecordingSharedWorker as unknown as SharedWorkerHost["SharedWorker"] };
    const attached = await attachSharedHolder({ houseName: "lares:house:holder-channel", holderUrl, host });
    expect(attached.kind).toBe("attached");
    if (attached.kind !== "attached") return;
    try {
      // KNOWN POSITIVE: one message carrying the key through the SAME recording port, in each form.
      const probe = [
        { type: "probe", key },
        { type: "probe", key: hex(key) },
        { type: "probe", key: btoa(String.fromCharCode(...key)) },
      ];
      for (const message of probe) attached.port.postMessage(message);
      expect(probe.map((message) => sent.some((m) => m === message) && carries(message, key))).toEqual([true, true, true]);
      sent.length = 0;

      // The real traffic: a session of verbs through the tab's own handle, with this tab's keystore sealed and unlocked.
      const face = await faceFixture("face:holder-channel");
      const handle = holderWorkerHandle(attached.port, { personaGroup: face.group, edge: face.edge, atom: face.atom });
      let n = 0;
      const ask = (verb: "read" | "change", level?: string) => new Promise<unknown>((resolve) => {
        const requestId = `c-${++n}`;
        const stop = handle.listen((message) => {
          const m = message as { type?: unknown; requestId?: unknown; output?: unknown };
          if (m.type === "wiki:verb-result" && m.requestId === requestId) { stop(); resolve(m.output); }
        });
        handle.post({ type: "wiki:place-verb", requestId, verb, args: level ? { level } : {} });
      });
      await ask("read");
      await ask("change", "3");
      expect((await readBrowserCustody(idbName)).reading).toBe("sealed");      // the keystore stays unlocked in this tab throughout
      expect(sent.length).toBeGreaterThan(0);                                  // the scan saw traffic: a silent channel proves nothing
      expect(sent.filter((m) => carries(m, key))).toEqual([]);
    } finally { attached.port.close(); }
  }, SLOW);
});
