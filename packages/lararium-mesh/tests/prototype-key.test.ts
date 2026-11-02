/**
 * prototype-key — a `__proto__` key never answers a phantom record, never lands, never stalls a write.
 *
 * Automerge materializes a map key spelled `__proto__` as the materialized object's PROTOTYPE: a doc that
 * holds `tiddlers.__proto__ = { "lar:///phantom": … }` answers `doc.tiddlers["lar:///phantom"]` with the
 * forged record and `"lar:///phantom" in doc.tiddlers` with true, while `Object.keys` stays empty. Such a
 * doc loads under automerge 3.4.1 and 3.5.0 alike (a 3.4.1 peer, a Rust peer or any raw-op author writes
 * one); 3.5.0 throws a bare `RangeError` only on a LOCAL write of the key. The fixture below holds the
 * bytes a 3.4.1 local write produced, so the probe reads the same on either engine.
 *
 * Three doors, one key set (`__proto__` · `constructor` · `prototype`):
 *   · THE READ DOOR (`ownEntry` · `hasOwnEntry`) answers own properties only, so no phantom reaches a reader.
 *   · THE INGEST SHORE (`syncMessagePrototypeKey` · `prototypeKeyFault`) refuses the bytes by name before
 *     the house's doc materializes them.
 *   · THE WRITE DOOR (`assertStorableTitle` · `storedRecord`) refuses a local write by name before any
 *     `change()` proxy sees it, so 3.5.0's RangeError never surfaces as a stall.
 */
import { describe, expect, test } from "vitest";
import { load, init, change, from, save, generateSyncMessage, initSyncState, receiveSyncMessage, getChanges, clone } from "@automerge/automerge";
import { EventEmitter } from "node:events";
import {
  PROTOTYPE_KEYS, hasOwnEntry, isPrototypeKey, ownEntry, plainEntries, prototypeKeyFault, type StoredTiddlers,
} from "../src/stored-value.js";
import { PROTOTYPE_KEY_TITLE_CODE, PrototypeKeyTitleRefusal, assertStorableTitle, storableTitleFault } from "../src/title-law.js";
import { storedRecord, storedValue } from "../src/stored-record.js";
import { PROTOTYPE_KEY_CODE, assertNoPrototypeKeys, chunkPrototypeKey, shoreInbound, syncMessagePrototypeKey } from "../src/prototype-key-shore.js";
import { isVerbRefusal } from "../src/verb-refusal.js";
import { carriesPrototypeKeyReason } from "../src/gated-sync-leg.js";

/** A doc a 3.4.1 local write produced: `tiddlers.real` (the control) and `tiddlers.__proto__.["lar:///phantom"]`. */
const POISONED_B64 =
  "hW9KgxtHT78AoQIBEJG2bhA4/3CkEdPXXPS2Z3IBz7Rh8PLy5jblA7EAQQEWi/18WNVB8pHwYPxn4LT79QIHAQIDAhMDIwdAA0MCVgIMAQQCEBEMExMVPiECIwo0BEIMVghXGIABAgIAAgF+Bxh+07Wg1wYAfgABfwACBwABHgAAAQIBfwIEA38IAgkGCg4LAAUDAAAEBQAAAQ0AAAR+AAQCAQADfnoMBAF+cBIMAXwIdGlkZGxlcnMJX19wcm90b19fBHJlYWwFdGl0bGUABH0ObGFyOi8vL3BoYW50b20EdGV4dAV0aXRsZQAUHwB9AQd6BQF/AhYBBAQDFAMAfwQEAX8AAgQUAQQABBYDABQWcmVhbGZvcmdlZGxhcjovLy9waGFudG9tHwAB";
const poisonedBytes = (): Uint8Array => new Uint8Array(Buffer.from(POISONED_B64, "base64"));
type Doc = { tiddlers: StoredTiddlers };
const PHANTOM = "lar:///phantom";

/** The sync message a poisoned doc sends an empty peer: the chunk a hostile far end would post. */
function poisonedSyncMessage(): Uint8Array {
  let doc = load<Doc>(poisonedBytes());
  let peer = init<Doc>();
  let sd = initSyncState(), sp = initSyncState();
  for (let i = 0; i < 4; i++) {
    let m: Uint8Array | null;
    [sd, m] = generateSyncMessage(doc, sd);
    if (m && m.byteLength > 0) {
      // The first message carrying changes is the one the shore must read.
      const probe = syncMessagePrototypeKey(m);
      if (probe !== null) return m;
      [peer, sp] = receiveSyncMessage(peer, sp, m);
    }
    let r: Uint8Array | null;
    [sp, r] = generateSyncMessage(peer, sp);
    if (r) [doc, sd] = receiveSyncMessage(doc, sd, r);
  }
  throw new Error("the poisoned doc never sent its chunk");
}

describe("the probe: what the engine materializes (the hole the doors close)", () => {
  test("a loaded doc carrying tiddlers.__proto__ answers a phantom through a bare lookup", () => {
    const doc = load<Doc>(poisonedBytes());
    expect(Object.keys(doc.tiddlers)).toEqual(["real"]);
    // The engine's own materialization: the reason a bare read is unsafe.
    expect((doc.tiddlers as Record<string, unknown>)[PHANTOM]).toBeDefined();
    expect(PHANTOM in doc.tiddlers).toBe(true);
  });
});

describe("the read door answers own properties only", () => {
  test("the phantom answers nothing; the control record answers itself", () => {
    const doc = load<Doc>(poisonedBytes());
    expect(ownEntry(doc.tiddlers, PHANTOM)).toBeUndefined();
    expect(hasOwnEntry(doc.tiddlers, PHANTOM)).toBe(false);
    expect(ownEntry(doc.tiddlers, "real")).toBeDefined();
    expect(hasOwnEntry(doc.tiddlers, "real")).toBe(true);
  });

  test("a prototype key never answers, even on a clean map (`constructor` is every object's inherited function)", () => {
    const clean = from<Doc>({ tiddlers: { real: { tiddler: { title: "real" } } as never } });
    for (const key of PROTOTYPE_KEYS) {
      expect(ownEntry(clean.tiddlers, key)).toBeUndefined();
      expect(hasOwnEntry(clean.tiddlers, key)).toBe(false);
    }
    expect(ownEntry(null, "real")).toBeUndefined();
    expect(hasOwnEntry(undefined, "real")).toBe(false);
  });

  test("plainEntries lists the control and never a prototype key, view or change proxy alike", () => {
    const doc = load<Doc>(poisonedBytes());
    expect(plainEntries(doc.tiddlers).map(([t]) => t)).toEqual(["real"]);
    // Inside a change the proxy lists `__proto__` as an own key; the door still skips it.
    change(clone(doc), (d) => { expect(plainEntries(d.tiddlers).map(([t]) => t)).toEqual(["real"]); });
  });
});

describe("the ingest shore refuses the bytes by name", () => {
  test("a materialized view carrying a __proto__ map names it; a clean doc reads null (control)", () => {
    expect(prototypeKeyFault(load(poisonedBytes()))).toMatch(/tiddlers/);
    expect(prototypeKeyFault(from({ tiddlers: { real: { tiddler: { title: "real", text: "x" } } } }))).toBeNull();
  });

  test("a view naming `constructor` or `prototype` as a title refuses; as a field it stands", () => {
    expect(prototypeKeyFault({ tiddlers: { constructor: { tiddler: { title: "constructor" } } } })).toMatch(/constructor/);
    expect(prototypeKeyFault({ tiddlers: { prototype: { tiddler: { title: "prototype" } } } })).toMatch(/prototype/);
    expect(prototypeKeyFault({ tiddlers: { real: { tiddler: { title: "real", constructor: "field" } } } })).toBeNull();
  });

  test("assertNoPrototypeKeys throws a named VerbRefusal", () => {
    let caught: unknown;
    try { assertNoPrototypeKeys(load(poisonedBytes()), "probe"); } catch (e) { caught = e; }
    expect(isVerbRefusal(caught)).toBe(true);
    expect((caught as { reason: string }).reason).toBe(PROTOTYPE_KEY_CODE);
    expect(() => assertNoPrototypeKeys(from({ tiddlers: {} }), "probe")).not.toThrow();
  });

  test("a sync message carrying the poisoned chunk names it; a clean doc's message reads null", () => {
    expect(syncMessagePrototypeKey(poisonedSyncMessage())).toMatch(/__proto__/);
    const clean = from<Doc>({ tiddlers: { real: { tiddler: { title: "real" } } as never } });
    const [, m] = generateSyncMessage(clean, initSyncState());
    expect(syncMessagePrototypeKey(m!)).toBeNull();
    expect(syncMessagePrototypeKey(new Uint8Array([1, 2, 3]))).toBeNull();   // undecodable: other doors judge it
  });

  test("a raw change chunk carrying a __proto__ key op names it", () => {
    const base = from<Doc>({ tiddlers: {} });
    const bytes = save(load(poisonedBytes()));
    expect(chunkPrototypeKey(bytes)).toMatch(/__proto__/);
    const after = change(clone(base), (d) => { (d.tiddlers as Record<string, unknown>)["ok"] = { tiddler: { title: "ok" } }; });
    expect(chunkPrototypeKey(getChanges(base, after)[0]!)).toBeNull();
  });

  test("the gated leg's universal check names the reason; a clean message passes", () => {
    expect(carriesPrototypeKeyReason({ type: "sync", senderId: "a", targetId: "b", data: poisonedSyncMessage() })).toBe(PROTOTYPE_KEY_CODE);
    expect(carriesPrototypeKeyReason({ type: "sync", senderId: "a", targetId: "b", data: new Uint8Array([1]) })).toBeNull();
    expect(carriesPrototypeKeyReason({ type: "arrive", senderId: "a", targetId: "b" })).toBeNull();
  });

  test("shoreInbound drops a poisoned message by name and passes every other event untouched", () => {
    const adapter = new EventEmitter();
    const refused: string[] = [];
    shoreInbound(adapter as never, (r) => refused.push(r.reason));
    const seen: string[] = [];
    adapter.on("message", (m: { type: string }) => seen.push(m.type));
    adapter.on("peer-candidate", () => seen.push("peer"));
    adapter.emit("message", { type: "sync", senderId: "x", targetId: "y", data: poisonedSyncMessage() });
    adapter.emit("message", { type: "sync", senderId: "x", targetId: "y", data: new Uint8Array([9]) });
    adapter.emit("peer-candidate", { peerId: "x" });
    expect(refused).toEqual([PROTOTYPE_KEY_CODE]);
    expect(seen).toEqual(["sync", "peer"]);
  });
});

describe("the write door refuses a local prototype key by name, before change()", () => {
  test.each([...PROTOTYPE_KEYS])("a %s title refuses as prototype-key-title", (title) => {
    expect(isPrototypeKey(title)).toBe(true);
    expect(storableTitleFault(title)).toMatch(new RegExp(`^${PROTOTYPE_KEY_TITLE_CODE}`));
    expect(() => assertStorableTitle(title)).toThrow(PrototypeKeyTitleRefusal);
    let caught: unknown;
    try { storedRecord({ tiddler: { title } }); } catch (e) { caught = e; }
    expect(isVerbRefusal(caught) && (caught as { reason: string }).reason).toBe(PROTOTYPE_KEY_TITLE_CODE);
  });

  test("inside a change the named refusal fires ahead of the engine's own key check", () => {
    const doc = from<Doc>({ tiddlers: {} });
    let caught: unknown;
    try {
      change(doc, (d) => { (d.tiddlers as Record<string, unknown>)["__proto__"] = storedRecord({ tiddler: { title: "__proto__" } }); });
    } catch (e) { caught = e; }
    expect(isVerbRefusal(caught)).toBe(true);
  });

  test("a __proto__ field key refuses by name (a JSON.parse'd own key), at any depth", () => {
    const fields = JSON.parse('{"title":"lar:///x","__proto__":{"text":"forged"}}') as Record<string, unknown>;
    let caught: unknown;
    try { storedRecord({ tiddler: fields as never }); } catch (e) { caught = e; }
    expect(isVerbRefusal(caught) && (caught as { reason: string }).reason).toBe(PROTOTYPE_KEY_CODE);
    expect(() => storedValue(JSON.parse('{"a":{"__proto__":1}}'))).toThrow(/__proto__/);
  });

  test("ordinary titles and fields stand (control), `constructor` as a field included", () => {
    expect(storableTitleFault("lar:///ha.ka.ba/ordinary")).toBeNull();
    expect(storableTitleFault("__proto__x")).toBeNull();
    expect(storableTitleFault("Constructor")).toBeNull();
    const doc = change(from<Doc>({ tiddlers: {} }), (d) => {
      (d.tiddlers as Record<string, unknown>)["lar:///ok"] = storedRecord({ tiddler: { title: "lar:///ok", constructor: "a field" } as never });
    });
    expect(hasOwnEntry(doc.tiddlers, "lar:///ok")).toBe(true);
  });
});
