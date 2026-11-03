/**
 * prototype-key-raw-ops — a hostile peer's raw ops carrying `__proto__` meet every door, with no phantom, no
 * pollution and a refusal by name.
 *
 * The engine refuses a LOCAL `__proto__` write (3.5.0 throws a RangeError), so the hostile bytes here are
 * what a raw-op author produces: a change built with a same-width placeholder key, whose key bytes are
 * rewritten to `__proto__` and whose chunk checksum is recomputed (the frame's first four bytes of the
 * SHA-256 over the rest). The engine accepts the result, which is the attack. Three positions carry the key:
 * a TITLE key (`tiddlers.__proto__`), a FIELD key (`tiddler.__proto__`) and a NESTED map key.
 *
 * LAW: the engine's load of the bytes materializes the phantom (the probe), the read doors answer own
 * properties only, the ingest shore names the key in each position, and `Object.prototype` stays clean.
 * CONTROLS: a clean change reads clean at every door, and the pollution detector catches a planted
 * `Object.prototype` write, so a zero stands as a measurement.
 */
import { afterEach, describe, expect, test } from "vitest";
import { applyChanges, change, getAllChanges, init, loadIncremental, save, load, generateSyncMessage, initSyncState, receiveSyncMessage, decodeSyncMessage } from "@automerge/automerge";
import { createHash } from "node:crypto";
import { hasOwnEntry, ownEntry, plainEntries, prototypeKeyFault, type StoredTiddlers } from "../src/stored-value.js";
import { PROTOTYPE_KEY_CODE, assertNoPrototypeKeys, chunkPrototypeKey, shoreInbound, syncMessagePrototypeKey } from "../src/prototype-key-shore.js";
import { EventEmitter } from "node:events";
import { isVerbRefusal } from "../src/verb-refusal.js";

type Doc = { tiddlers: StoredTiddlers };
const PHANTOM = "lar:///phantom";
type Position = "title" | "field" | "nested";
const PLACEHOLDER = { title: "ZZZZZZZZZ", field: "YYYYYYYYY", nested: "WWWWWWWWW" } as const;

/** One change whose placeholder at `position` reads `__proto__` after the rewrite (null position: a clean change). */
function hostileChange(position: Position | null): Uint8Array {
  const doc = change(init<Doc>(), (d) => {
    (d as unknown as { tiddlers: unknown }).tiddlers = {
      [PLACEHOLDER.title]: { [PHANTOM]: { tiddler: { title: "p" } } },
      real: { tiddler: { title: "real", [PLACEHOLDER.field]: { phantomField: "x" }, n: { [PLACEHOLDER.nested]: { a: 1, polluted: true } } } },
    };
  });
  let bytes = Buffer.from(getAllChanges(doc)[0]!);
  if (position !== null) {
    const text = bytes.toString("latin1").split(PLACEHOLDER[position]).join("__proto__");
    bytes = Buffer.from(text, "latin1");
    createHash("sha256").update(bytes.subarray(8)).digest().copy(bytes, 4, 0, 4);
  }
  return new Uint8Array(bytes);
}

const POLLUTION_PROBES = ["polluted", "a", "title", "toString"] as const;
const polluted = (): string[] => POLLUTION_PROBES.filter((k) => k !== "toString" && Object.hasOwn(Object.prototype, k));

afterEach(() => { for (const k of POLLUTION_PROBES) if (k !== "toString") delete (Object.prototype as Record<string, unknown>)[k]; });

describe("the pollution detector (control)", () => {
  test("a planted Object.prototype write reads as pollution; the clean state reads none", () => {
    expect(polluted()).toEqual([]);
    (Object.prototype as Record<string, unknown>)["polluted"] = true;
    expect(polluted()).toEqual(["polluted"]);
    expect(({} as Record<string, unknown>)["polluted"]).toBe(true);
  });
});

describe("a clean change reads clean at every door (control)", () => {
  test("no fault, no refusal, own entries answer", () => {
    const bytes = hostileChange(null);
    const [doc] = applyChanges(init<Doc>(), [bytes]);
    expect(prototypeKeyFault(doc)).toBeNull();
    expect(chunkPrototypeKey(bytes)).toBeNull();
    expect(() => assertNoPrototypeKeys(doc, "control")).not.toThrow();
    expect(hasOwnEntry(doc.tiddlers, PLACEHOLDER.title)).toBe(true);
    expect(polluted()).toEqual([]);
  });
});

for (const position of ["title", "field", "nested"] as const) {
  describe(`__proto__ as a ${position} key in raw ops`, () => {
    const bytes = hostileChange(position);

    test("the engine accepts the bytes (the attack is real) and no prototype pollution follows", () => {
      const [doc] = applyChanges(init<Doc>(), [bytes]);
      expect(doc.tiddlers).toBeDefined();
      expect(polluted()).toEqual([]);
      expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined();
      // The same bytes through the other load doors: saved-and-loaded, and loadIncremental.
      const viaLoad = load<Doc>(save(doc));
      const viaIncremental = loadIncremental(init<Doc>(), save(doc));
      for (const d of [viaLoad, viaIncremental]) expect(d.tiddlers).toBeDefined();
      expect(polluted()).toEqual([]);
    });

    if (position === "title") {
      test("the title position: a bare lookup answers a phantom; the read doors answer none", () => {
        const [doc] = applyChanges(init<Doc>(), [bytes]);
        expect((doc.tiddlers as Record<string, unknown>)[PHANTOM]).toBeDefined();
        expect(PHANTOM in doc.tiddlers).toBe(true);
        expect(ownEntry(doc.tiddlers, PHANTOM)).toBeUndefined();
        expect(hasOwnEntry(doc.tiddlers, PHANTOM)).toBe(false);
        expect(plainEntries(doc.tiddlers).map(([t]) => t)).toEqual(["real"]);
      });
    }

    test("the ingest shore names the key: the raw chunk, the view, the assert and a sync message", () => {
      expect(chunkPrototypeKey(bytes)).toMatch(/__proto__/);
      const [doc] = applyChanges(init<Doc>(), [bytes]);
      expect(prototypeKeyFault(doc)).toMatch(/__proto__/);
      let caught: unknown;
      try { assertNoPrototypeKeys(doc, "probe"); } catch (e) { caught = e; }
      expect(isVerbRefusal(caught)).toBe(true);
      // A sync message from a peer holding the hostile doc is refused by name at the shore.
      let sender = doc, peer = init<Doc>();
      let ss = initSyncState(), sp = initSyncState();
      let named: string | null = null;
      for (let i = 0; i < 4 && named === null; i++) {
        let m: Uint8Array | null;
        [ss, m] = generateSyncMessage(sender, ss);
        if (m && m.byteLength > 0) {
          named = syncMessagePrototypeKey(m);
          if (named === null) [peer, sp] = receiveSyncMessage(peer, sp, m);
        }
        let r: Uint8Array | null;
        [sp, r] = generateSyncMessage(peer, sp);
        if (r) [sender, ss] = receiveSyncMessage(sender, ss, r);
      }
      expect(named).toMatch(/__proto__/);
      expect(polluted()).toEqual([]);
    });
  });
}

/** The first sync message CARRYING CHANGES that a doc holding `bytes` sends a peer: the frame a far end would post. */
function messageFrom(bytes: Uint8Array): Uint8Array {
  let doc = applyChanges(init<Doc>(), [bytes])[0], peer = init<Doc>();
  let sd = initSyncState(), sp = initSyncState();
  for (let i = 0; i < 6; i++) {
    let m: Uint8Array | null;
    [sd, m] = generateSyncMessage(doc, sd);
    if (m && m.byteLength > 0) {
      if (decodeSyncMessage(m).changes.length > 0) return m;
      [peer, sp] = receiveSyncMessage(peer, sp, m);
    }
    let r: Uint8Array | null;
    [sp, r] = generateSyncMessage(peer, sp);
    if (r) [doc, sd] = receiveSyncMessage(doc, sd, r);
  }
  throw new Error("the doc never sent its changes");
}

/**
 * THE REAL INBOUND PATH: an adapter emits `message` the way a peer's frame arrives, the shore sits on `emit`, and the
 * receiving listener applies the bytes with `receiveSyncMessage`, as the Repo's synchronizer does. A refused message
 * never reaches the listener, so the receiving doc stays empty and Object.prototype stays clean.
 */
function receiver() {
  const adapter = new EventEmitter();
  const refused: Array<{ reason: string; detail: string }> = [];
  shoreInbound(adapter, (r) => refused.push({ reason: r.reason, detail: r.detail }));
  const state = { doc: init<Doc>(), sync: initSyncState(), reached: 0 };
  adapter.on("message", (m: { data: Uint8Array }) => { state.reached += 1; [state.doc, state.sync] = receiveSyncMessage(state.doc, state.sync, m.data); });
  const arrive = (data: Uint8Array) => adapter.emit("message", { type: "sync", senderId: "peer-hostile", documentId: "doc", targetId: "me", data });
  return { arrive, refused, state };
}

describe("a hostile sync message through shoreInbound and receiveSyncMessage", () => {
  for (const position of ["title", "field", "nested"] as const) {
    test(`${position}: refused by name before the listener, the receiving doc stays empty, no pollution`, () => {
      const { arrive, refused, state } = receiver();
      arrive(messageFrom(hostileChange(position)));
      expect(refused).toHaveLength(1);
      expect(refused[0]!.reason).toBe(PROTOTYPE_KEY_CODE);
      expect(refused[0]!.detail).toMatch(/__proto__/);
      expect(state.reached).toBe(0);
      expect(Object.keys(state.doc)).toEqual([]);
      expect(polluted()).toEqual([]);
    });
  }

  test("CONTROL: a clean message lands through the same path, with no refusal", () => {
    const { arrive, refused, state } = receiver();
    arrive(messageFrom(hostileChange(null)));
    expect(refused).toEqual([]);
    expect(state.reached).toBe(1);
    expect(hasOwnEntry(state.doc.tiddlers, "real")).toBe(true);
    expect(polluted()).toEqual([]);
  });

  test("CONTROL: the same hostile bytes WITHOUT the shore land and materialize the phantom, so the refusal above is the shore's doing", () => {
    const adapter = new EventEmitter();
    let doc = init<Doc>(); let sync = initSyncState();
    adapter.on("message", (m: { data: Uint8Array }) => { [doc, sync] = receiveSyncMessage(doc, sync, m.data); });
    adapter.emit("message", { type: "sync", senderId: "p", data: messageFrom(hostileChange("title")) });
    expect((doc.tiddlers as Record<string, unknown>)[PHANTOM]).toBeDefined();
  });
});
