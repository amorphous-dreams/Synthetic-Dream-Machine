/**
 * prototype-key-maps — every by-key map the house reads off a document answers own entries only.
 *
 * `prototype-key.test.ts` closes the hole on `tiddlers`. The same engine law holds for EVERY map a
 * document carries: a `__proto__` key materializes as that map's prototype, so a bare lookup answers a
 * forged entry while `Object.keys` stays empty. The ingest shore refuses such bytes from a peer, but a
 * LOCAL storage load (IndexedDB, the node store) passes no shore, so the read door must hold by itself.
 * One probe per map class, each on bytes a 3.4.1 local write produced (3.5.0 refuses that write):
 *
 *   · `blobs`              — the doc's binary store (`blobs.__proto__.tiddlywikicore` forges the engine).
 *   · a record's own maps  — `tiddler` (its fields) and `meta` (`tiddler.__proto__.text` forges a field).
 *   · floor rows           — a rows map handed to the floor read face (`rows.__proto__` forges a row).
 *
 * And the scan: no source file reads `blobs` by key but through the one door (`ownEntry` · `hasOwnEntry`).
 * A record's maps need no scan of their own: a raw record exposes no field to the type, the stored-value
 * census reads every cast past it red, and the door's readers (`plainField` · `plainMeta` · `plainRecord`)
 * copy own entries into a fresh object, so a plain record downstream holds no prototype to forge.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "vitest";
import { load, init, change, getChanges, encodeSyncMessage, save } from "@automerge/automerge";
import { Repo } from "@automerge/automerge-repo";
import { EventEmitter } from "node:events";
import { AutomergeDocStore } from "../src/automerge-doc-store.js";
import { shoreInbound, shoreStorage, syncMessagePrototypeKey, chunkPrototypeKey } from "../src/prototype-key-shore.js";
import { carriesPrototypeKeyReason } from "../src/gated-sync-leg.js";
import { isVerbRefusal } from "../src/verb-refusal.js";
import { storedValue } from "../src/stored-record.js";
import type { LarDoc } from "../src/base-doc.js";
import { ownEntry, hasOwnEntry, plainField, plainMeta, plainRecord, type StoredTiddlers } from "../src/stored-value.js";
import { floorReadFace } from "../src/floor-manifest.js";
import type { LarBlobEntry } from "../src/base-doc.js";

const bytes = (b64: string): Uint8Array => new Uint8Array(Buffer.from(b64, "base64"));
/** `blobs.real` (control) and `blobs.__proto__.tiddlywikicore` (the forged engine). */
const BLOBS_B64 = "hW9Kg8qT87QAwQMBEFrAD+ZiLSA+Tf80S1I1lxMBeHMgyBuZ4mintUf4GGdw43cqLOiYu6FMT0lzNKe4cgIHAQIDAhMDIwdAA0MCVgIMAQUCGxEcEyoVeiEDIws0BkIRVgxXO4ABAwIAAgF+EzZ+idWg1wYAfgABfwACBwADxgAAAAMCAQMCBAQECH8JAgp+CxQEFQ4WFhcGGAYZAAYCAAAFAwAAAn8AAAcNAAABFQAAAQUAAAEFAAAFfQAFAQAEfnoMAgF8cgARbwAFfgAaDAF+WigUAX5EPgQBfr5/xAAEAXsFYmxvYnMNc2NoZW1hVmVyc2lvbgh0aWRkbGVycwlfX3Byb3RvX18EcmVhbAADfAJpZAhtaW1lVHlwZQZzaGEyNTYHdmVyc2lvbgAIew50aWRkbHl3aWtpY29yZQJpZAhtaW1lVHlwZQZzaGEyNTYHdmVyc2lvbgAwyQAAAwF+EXAPAX8CNAEFAwQIBTB+AAQDAAMBBAQIAX8ABAQwAQUAAxYEAAgWBQAwFjAuMXJlYWx4YWExdGlkZGx5d2lraWNvcmVhcHBsaWNhdGlvbi9qYXZhc2NyaXB0Zm9yZ2VkZm9yZ2VkyQAAAQ==";
/** `tiddlers.real` whose `tiddler.__proto__` forges `text` and whose `meta.__proto__` forges `owner`. */
const FIELDS_B64 = "hW9Kg1kAOcMA7gIBEMchHeCIrDK+Ma0QcIEuNxMBSI2bjEPtCRlHP1f30VE+SPIxh5jfNvjgfzqV4lwiQWwHAQIDAhMDIwdAA0MCVgIMAQQCGBEQExwVXiECIxE0CEIVVhBXFIABAgIAAgF+DxB+idWg1wYAfgABfwACBwACHQAAAgMBfwICBgIHAgh/CQQKfxAGEX8YBhkAAwIAAAkDAAACBQAAAgUAAAJ9AAMBAAd9fAAMAgEAAX5yEgQBAAF+ahoEAX4Nc2NoZW1hVmVyc2lvbgh0aWRkbGVycwADeQRyZWFsBG1ldGEHdGlkZGxlcglfX3Byb3RvX18DYmFnCV9fcHJvdG9fXwV0aXRsZQAFfwR0ZXh0AAZ/BW93bmVyAAYfAAgBfBBxB3oFAX8CBgF/AgYBAgMHBQEGAQZ+BAADAQQAfQQABAUBfwQGAX8EBgECAAMWBwAFFn8ABhZ/AAYWMC4xYnJlYWxmb3JnZWRmb3JnZWQfAAE=";
/** `rows.real` (control) and `rows.__proto__["lar:///phantom"]` (a forged floor row). */
const ROWS_B64 = "hW9Kg0U0j/YArwIBED+2sHc1lS8Nax6bowlL9mwBVPQHc03CUMI0oQ3wVRLVUm0ETqCFORziaq8nRQqs7wUHAQIDAhMDIwdAA0MCVgIMAQQCEhEMExMVSiECIwo0BEIMVghXGIABAgIAAgF+CBl+idWg1wYAfgABfwACBwABIAAAAQIBfgIDBAR+CQoCCwYMDg0ABgMAAAUFAAABDQAABX4ABQIBAAR+eQ4EAX5uFAwBewRyb3dzCV9fcHJvdG9fXwRyZWFsB3RpZGRsZXIFdGl0bGUABHwObGFyOi8vL3BoYW50b20HdGlkZGxlcgR0ZXh0BXRpdGxlABQhAH0BCHkGAX8CFwEFBAQUBAB/BAQBAgACBBQBBQAEFgQAFBZyZWFsZm9yZ2VkbGFyOi8vL3BoYW50b20hAAE=";

describe("blobs: the doc's binary store", () => {
  const doc = load<{ blobs: Record<string, LarBlobEntry> }>(bytes(BLOBS_B64));
  test("PROBE: the engine answers the forged engine blob through a bare lookup", () => {
    expect(Object.keys(doc.blobs)).toEqual(["real"]);
    expect(doc.blobs["tiddlywikicore"]?.version).toBe("forged");
  });
  test("the door answers no forged blob, and the control blob answers itself", () => {
    expect(ownEntry(doc.blobs, "tiddlywikicore")).toBeUndefined();
    expect(hasOwnEntry(doc.blobs, "tiddlywikicore")).toBe(false);
    expect(ownEntry(doc.blobs, "real")?.sha256).toBe("aa");
  });
});

describe("a record's own maps: its fields and its meta", () => {
  const doc = load<{ tiddlers: StoredTiddlers }>(bytes(FIELDS_B64));
  const record = ownEntry(doc.tiddlers, "real")!;
  test("PROBE: the engine answers a forged field through a bare lookup", () => {
    const raw = record as unknown as { tiddler: Record<string, unknown>; meta: Record<string, unknown> };
    expect(Object.keys(raw.tiddler)).toEqual(["title"]);
    expect(String(raw.tiddler["text"])).toBe("forged");
    expect(String(raw.meta["owner"])).toBe("forged");
  });
  test("RED: plainField and plainMeta answer no forged field; the control field answers itself", () => {
    expect(plainField(record, "text")).toBeUndefined();
    expect(plainMeta(record, "owner")).toBeUndefined();
    expect(plainField(record, "title")).toBe("real");
    expect(plainMeta(record, "bag")).toBe("b");
  });
  test("plainRecord copies own fields only", () => {
    const plain = plainRecord(record);
    expect((plain.tiddler as Record<string, unknown>)["text"]).toBeUndefined();
    expect(plain.tiddler.title).toBe("real");
  });
  test("CONTROL: a field a person names `constructor` reads as its own value; an inherited one answers nothing", () => {
    const own = { tiddler: { title: "x", constructor: "mine" } } as never;
    expect(plainField(own, "constructor")).toBe("mine");
    expect(plainField({ tiddler: { title: "x" } } as never, "constructor")).toBeUndefined();
  });
});

describe("floor rows: the rows map the floor read face answers from", () => {
  const doc = load<{ rows: Record<string, never> }>(bytes(ROWS_B64));
  test("PROBE: the engine answers a forged row through a bare lookup", () => {
    expect(Object.keys(doc.rows)).toEqual(["real"]);
    expect(doc.rows["lar:///phantom"]).toBeDefined();
  });
  test("the floor face answers no forged row (it read own keys before this lane: a control, green from the start)", async () => {
    const face = floorReadFace({ rows: [doc.rows] });
    expect(await face.get("lar:///phantom")).toBeNull();
    expect(await face.get("real")).not.toBeNull();
  });
});

// ── THE BLIND READER'S B PROBES (2026-11-01) ───────────────────────────────────────────────────

/** `tiddlers.real` and `tiddlers.__proto__.["lar:///phantom"]` (prototype-key.test.ts's fixture). */
const POISONED_B64 = "hW9KgxtHT78AoQIBEJG2bhA4/3CkEdPXXPS2Z3IBz7Rh8PLy5jblA7EAQQEWi/18WNVB8pHwYPxn4LT79QIHAQIDAhMDIwdAA0MCVgIMAQQCEBEMExMVPiECIwo0BEIMVghXGIABAgIAAgF+Bxh+07Wg1wYAfgABfwACBwABHgAAAQIBfwIEA38IAgkGCg4LAAUDAAAEBQAAAQ0AAAR+AAQCAQADfnoMBAF+cBIMAXwIdGlkZGxlcnMJX19wcm90b19fBHJlYWwFdGl0bGUABH0ObGFyOi8vL3BoYW50b20EdGV4dAV0aXRsZQAUHwB9AQd6BQF/AhYBBAQDFAMAfwQEAX8AAgQUAQQABBYDABQWcmVhbGZvcmdlZGxhcjovLy9waGFudG9tHwAB";

describe("B1: one key set on every inbound path", () => {
  /** A HAND-BUILT sync message whose raw change writes `tiddlers["constructor"]` — the reader's probe. */
  const handBuilt = (key: string): Uint8Array => {
    const doc = change(change(init<{ tiddlers: Record<string, unknown> }>(), (d) => { d.tiddlers = {}; }), (d) => { d.tiddlers[key] = { tiddler: { title: key } }; });
    return encodeSyncMessage({ heads: [], need: [], have: [], changes: getChanges(init(), doc) } as never);
  };
  test.each(["constructor", "prototype"])("RED: a raw change writing tiddlers[%s] names it, at the shore and the gated leg", (key) => {
    const msg = handBuilt(key);
    expect(syncMessagePrototypeKey(msg)).toMatch(new RegExp(key));
    expect(carriesPrototypeKeyReason({ type: "sync", senderId: "p", targetId: "q", documentId: "d", data: msg } as never)).toBe("prototype-key");
    const adapter = new EventEmitter();
    const seen: unknown[] = [];
    shoreInbound(adapter);
    adapter.on("message", (m) => seen.push(m));
    adapter.emit("message", { type: "sync", senderId: "p", targetId: "q", documentId: "d", data: msg });
    expect(seen).toEqual([]);
  });
  test("CONTROL: a raw change writing an ordinary title passes", () => {
    expect(syncMessagePrototypeKey(handBuilt("lar:///ordinary"))).toBeNull();
  });
  test("the write door refuses the same three keys as a field, at any depth", () => {
    for (const key of ["__proto__", "constructor", "prototype"]) {
      let thrown: unknown;
      try { storedValue(JSON.parse(`{"${key}": "v"}`)); } catch (e) { thrown = e; }
      expect(isVerbRefusal(thrown) && (thrown as { reason: string }).reason).toBe("prototype-key");
    }
  });
});

describe("B2: a merge over an existing record refuses a prototype key by name, never a bare RangeError", () => {
  test.each([
    ["a field", '{"tiddler":{"title":"lar:///t/b2","text":"x","__proto__":"v"}}'],
    ["a meta key", '{"tiddler":{"title":"lar:///t/b2","text":"x"},"meta":{"__proto__":"v"}}'],
    ["a constructor field", '{"tiddler":{"title":"lar:///t/b2","text":"x","constructor":"v"}}'],
  ])("RED: %s on a put over an existing record", async (_n, json) => {
    const repo = new Repo();
    const store = new AutomergeDocStore(repo.create<LarDoc>({ schemaVersion: "0.1", tiddlers: {} }));
    await store.put({ tiddler: { title: "lar:///t/b2", text: "first" } });
    let thrown: unknown;
    try { await store.put(JSON.parse(json)); } catch (e) { thrown = e; }
    expect(thrown).not.toBeInstanceOf(RangeError);
    expect(isVerbRefusal(thrown) && (thrown as { reason: string }).reason).toBe("prototype-key");
  });
});

describe("B3: a document that never crossed a shore", () => {
  test("RED: a put of the phantom title over a loaded poisoned doc lands as its own record, never a TypeError", async () => {
    const repo = new Repo();
    const store = new AutomergeDocStore(repo.import<LarDoc>(bytes(POISONED_B64)));
    expect(await store.get("lar:///phantom")).toBeNull();
    await store.put({ tiddler: { title: "lar:///phantom", text: "mine" } });
    expect((await store.get("lar:///phantom"))?.tiddler.text).toBe("mine");
  });
  test("RED: the local storage shore refuses a stored chunk carrying a prototype key, by name", async () => {
    const chunks = new Map<string, Uint8Array>([["doc/snapshot/x", bytes(POISONED_B64)], ["doc/sync-state/peer", new Uint8Array([1, 2, 3])]]);
    const adapter = shoreStorage({
      async load(key: string[]) { return chunks.get(key.join("/")); },
      async loadRange(prefix: string[]) { return [...chunks].filter(([k]) => k.startsWith(prefix.join("/"))).map(([k, data]) => ({ key: k.split("/"), data })); },
    });
    await expect(adapter.load(["doc", "snapshot", "x"])).rejects.toMatchObject({ reason: "prototype-key" });
    await expect(adapter.loadRange(["doc"])).rejects.toMatchObject({ reason: "prototype-key" });
    expect(await adapter.load(["doc", "sync-state", "peer"])).toEqual(new Uint8Array([1, 2, 3]));
  });
  test("CONTROL: a clean stored doc passes the storage shore", async () => {
    const clean = save(change(init<{ tiddlers: Record<string, unknown> }>(), (d) => { d.tiddlers = { real: { tiddler: { title: "real" } } }; }));
    expect(chunkPrototypeKey(clean)).toBeNull();
    const adapter = shoreStorage({ async load() { return clean; }, async loadRange() { return [{ key: ["d", "snapshot", "c"], data: clean }]; } });
    expect(await adapter.load(["d", "snapshot", "c"])).toBe(clean);
  });
});

// ── THE SCAN ────────────────────────────────────────────────────────────────────────────────────

const REPO = join(import.meta.dirname, "..", "..", "..");
/** The door itself reads raw; every other file asks it. */
const DOOR = "packages/lararium-mesh/src/stored-value.ts";

/** Raw by-key reads of a document's `blobs` map. */
export function findRawMapReads(path: string, source: string): string[] {
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ""))
    .replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
  const found: string[] = [];
  code.split("\n").forEach((line, i) => {
    const at = `${path}:${i + 1}`;
    // A read, never a write: `blobs[k] = …` builds a plain seed object.
    for (const m of line.matchAll(/\bblobs\??\.?\[[^\]]+\](?!\s*=(?!=))/g)) found.push(`${at}: reads blobs by key (${m[0]})`);
  });
  return found;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name.startsWith(".")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(?:ts|tsx|mts|js|mjs)$/.test(name) && !/\.test\./.test(name) && !name.endsWith(".d.ts") && !name.includes(".generated.")) out.push(path);
  }
  return out;
}

describe("the scan: no by-key read of blobs but through the door", () => {
  const ground = readdirSync(join(REPO, "packages")).flatMap((pkg) => {
    try { return walk(join(REPO, "packages", pkg, "src")); } catch { return []; }
  }).map((f) => relative(REPO, f)).sort();

  test("the ground reads wide", () => {
    expect(ground).toContain(DOOR);
    expect(ground.length).toBeGreaterThan(500);
  });

  test("★ every by-key read of blobs rides the door ★", () => {
    const found = ground.filter((f) => f !== DOOR).flatMap((f) => findRawMapReads(f, readFileSync(join(REPO, f), "utf8")));
    expect(found).toEqual([]);
  });

  test("CONTROL: the scanner names a planted raw read, and passes the door's spelling and a seed write", () => {
    expect(findRawMapReads("x.ts", "const c = doc.blobs?.[ENGINE_CORE_ID];")).toHaveLength(1);
    expect(findRawMapReads("x.ts", "const c = doc.blobs[id].sha256;")).toHaveLength(1);
    expect(findRawMapReads("x.ts", "const c = ownEntry(doc.blobs, ENGINE_CORE_ID);\nblobs[k] = v;")).toEqual([]);
  });
});
