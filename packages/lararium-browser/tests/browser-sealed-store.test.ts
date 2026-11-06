/**
 * THE BROWSER SHORE OF THE SEALED STORE (sealed-store#/owed, step three; the browser shore): the browser's island rests the
 * store over IndexedDB, its caller seats the holder there, and the document store's values rest sealed in the browser too.
 * Each act runs on a worker's thread (`fixtures/sealed-store.worker.ts`), and the page reads back every byte that rested.
 */
import { afterEach, describe, expect, test } from "vitest";
import { readyWorker } from "./fixtures/ready-worker.js";

type Reply = Record<string, unknown> & { op: string };
let worker: Worker | null = null;
afterEach(() => { worker?.terminate(); worker = null; });

function ask(w: Worker, msg: Record<string, unknown> & { op: string }): Promise<Reply> {
  return new Promise((resolve) => {
    const onMessage = (event: MessageEvent) => {
      if ((event.data as Reply)?.op !== msg.op) return;
      w.removeEventListener("message", onMessage);
      resolve(event.data as Reply);
    };
    w.addEventListener("message", onMessage);
    w.postMessage(msg);
  });
}
function deleteIdb(name: string): Promise<void> {
  return new Promise((resolve) => { const r = indexedDB.deleteDatabase(name); r.onsuccess = r.onerror = r.onblocked = () => resolve(); });
}
/** Every value every object store of one database holds, as bytes (text and binary alike). */
async function everyByte(name: string): Promise<Uint8Array[]> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open(name); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
  const out: Uint8Array[] = [];
  const walk = (value: unknown): void => {
    if (value instanceof Uint8Array) out.push(value);
    else if (value instanceof ArrayBuffer) out.push(new Uint8Array(value));
    else if (typeof value === "string") out.push(new TextEncoder().encode(value));
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") Object.values(value).forEach(walk);
  };
  for (const store of [...db.objectStoreNames]) {
    const all = await new Promise<unknown[]>((resolve, reject) => { const r = db.transaction(store).objectStore(store).getAll(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    all.forEach(walk);
  }
  db.close();
  return out;
}
const holds = (hay: Uint8Array, needle: Uint8Array): boolean => {
  outer: for (let i = 0; i + needle.length <= hay.length; i++) { for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer; return true; }
  return false;
};

describe("the browser island's rest for the sealed store", () => {
  test("a holder over the IndexedDB rest seals on a worker's thread, a fresh holder reopens it, and no clear byte rests", async () => {
    worker = await readyWorker(new URL("./fixtures/sealed-store.worker.ts", import.meta.url));
    const dbName = `lares:test-sealed:${crypto.randomUUID()}`;
    const secret = `heron-${crypto.randomUUID()}`;
    try {
      const reply = await ask(worker, { op: "seal-and-reopen", dbName, secret });
      expect(reply["error"]).toBeUndefined();
      expect(reply["thread"], "the holder stands on a worker's thread").toBe("undefined");
      expect(reply["text"], "a restarted holder reopens the body").toBe(secret);
      const bytes = await everyByte(dbName);
      // THE SETUP TOOK: the rest holds lockboxes, records, rows and the sealed value.
      expect(bytes.length).toBeGreaterThan(3);
      expect(bytes.some((b) => holds(b, new TextEncoder().encode(secret)))).toBe(false);
    } finally { await deleteIdb(dbName); }
  });

  test("a document change written through the store rests sealed in IndexedDB; an unsealed bag's ordinary path rests Automerge's own bytes", async () => {
    worker = await readyWorker(new URL("./fixtures/sealed-store.worker.ts", import.meta.url));
    const dbName = `lares:test-sealed:${crypto.randomUUID()}`;
    const docDb = `lares:test-docs:${crypto.randomUUID()}`;
    const secret = `heron-${crypto.randomUUID()}`;
    try {
      const reply = await ask(worker, { op: "document", dbName, docDb, secret });
      expect(reply["error"]).toBeUndefined();
      expect(reply["note"], "a restarted Repo hydrates the sealed change").toBe(secret);
      const docBytes = await everyByte(docDb);
      const sealedBytes = await everyByte(dbName);
      const enc = (s: string) => new TextEncoder().encode(s);
      // CONTROL: the unsealed bag's text rests in the clear, so the instrument reads a known positive.
      expect(docBytes.some((b) => holds(b, enc(`${secret}-in-the-clear`)))).toBe(true);
      // The sealed bag's text rests nowhere, in the document database or the sealed one.
      expect(docBytes.filter((b) => holds(b, enc(secret)) && !holds(b, enc(`${secret}-in-the-clear`))).length).toBe(0);
      expect(sealedBytes.some((b) => holds(b, enc(secret)))).toBe(false);
    } finally { await deleteIdb(dbName); await deleteIdb(docDb); }
  });
});

// The caller that seats the holder: the browser's daemon island hands its behaviour the IndexedDB shore, so the holder stands
// beside that island's Keyhive identities (operator-daemon-behavior seats it where a shore names a sealed store).
const START = import.meta.glob<string>("../src/daemon-island-start.ts", { query: "?raw", import: "default", eager: true });
const strip = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");

describe("the caller that seats the browser island's holder", () => {
  test("the daemon island hands its behaviour the IndexedDB sealed-store shore", () => {
    const src = strip(START["../src/daemon-island-start.ts"] ?? "");
    expect(src.length, "the strip leaves the module standing").toBeGreaterThan(200);
    expect(src).toMatch(/makeOperatorDaemonBehavior\(manifest,\s*\{[\s\S]*\bsealedStore\s*:\s*idbSealedStoreShore\(/);
  });

  test("T6: the daemon island hands its seat the fresh base's cut, over the bag's live document it asks of the vessel worker", () => {
    const src = strip(START["../src/daemon-island-start.ts"] ?? "");
    expect(src.length, "the strip leaves the module standing").toBeGreaterThan(200);
    expect(src).toMatch(/islandLiveDocDoor\(/);
    expect(src).toMatch(/makeOperatorDaemonBehavior\(manifest,\s*\{[\s\S]*\bfreshBase\s*:\s*freshBasePort\(\s*liveOnVessel\s*\)/);
  });
});
