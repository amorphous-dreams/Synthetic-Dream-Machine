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
import { load } from "@automerge/automerge";
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
