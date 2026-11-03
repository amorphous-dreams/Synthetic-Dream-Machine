/**
 * promote-door — a device's promotion door for ONE wiki: the rites waiting, the hand's commit, the boot union, the orphan that keeps
 * running and is named, the kāpae that shadows (wiki, digest) and restarts the island.
 *
 * The door takes ports (wiki, ledger, local cache, the wiki's items, the face board, CAS, loaded edges, restart); these reds stand it on
 * memory ports. A promotion in one wiki never runs in another. Every red pairs with a CONTROL.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { describe, expect, test } from "vitest";
import { createHash } from "node:crypto";
import {
  EMPTY_KAPAE_LOCAL, EMPTY_LEDGER, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, promoteActCid, promoteDigest, promoteEdgeKey,
  readPromoteBoard, signPromoteKapae, signPromotePrepare,
  type KapaeLocal, type PromoteWho, type PromotionLedger,
} from "../src/index.js";
import { promotions, type PromoteItem, type PromotionPorts } from "../src/promote-door.js";

const GROUP = "face-group", W1 = "lar:///ha.ka.ba/wikis/field-notes", W2 = "lar:///ha.ka.ba/wikis/garden";
const HAND: PromoteWho = { kind: "hand", id: "hand-1" };
const SEAT: PromoteWho = { kind: "seat", id: "seat-1" };
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const RITE = { title: "rites/field-notes", text: "exports.startup = function(){}", fields: { "module-type": "startup" } };
const NOTE = { title: "notes/plain", text: "just words", fields: { type: "text/vnd.tiddlywiki" } };
const D = promoteDigest(RITE);
const itemOf = (i: typeof RITE, revision = "r1"): PromoteItem => ({ ...i, revision, origin: { seat: "s", device: "d", session: "s-1" } });

async function world() {
  const root = { key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(1)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(1)) };
  const atom = { key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(2)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(2)) };
  const face = { group: GROUP, grant: (k: string) => k === root.key, device: (k: string) => k === atom.key };
  const state = {
    ledger: EMPTY_LEDGER as PromotionLedger, local: EMPTY_KAPAE_LOCAL as KapaeLocal, items: new Map<string, PromoteItem[]>(), acts: [] as unknown[],
    cas: new Map<string, Uint8Array>(), pinned: new Set<string>(), loaded: new Set<string>(), restarts: 0, failRestart: false, boardReadable: true,
  };
  const ports = (wiki: string, who: PromoteWho): PromotionPorts => ({
    wiki,
    ledger: { read: async () => state.ledger, write: async (l) => { state.ledger = l; } },
    local: { read: async () => state.local, write: async (l) => { state.local = l; } },
    items: async () => state.items.get(wiki) ?? [],
    board: async () => { if (!state.boardReadable) throw new Error("board-unreadable"); return readPromoteBoard(state.acts, face); },
    cas: { put: (d, b) => { state.cas.set(d, b); }, pin: (d) => { state.pinned.add(d); } },
    loaded: () => state.loaded,
    restart: async () => { if (state.failRestart) { state.failRestart = false; throw new Error("restart refused"); } state.restarts += 1; state.loaded = new Set(); },
    who,
  });
  return {
    state, ports,
    kapae: (wiki: string, digest: string, raised: boolean, parents: string[]) => signPromoteKapae({ group: GROUP, epoch: 0, wiki, digest, raised, parents }, root),
    prepare: (wiki: string, digest: string, why: string) => signPromotePrepare({ group: GROUP, epoch: 0, wiki, digest, title: RITE.title, classes: ["module-type"], why }, atom),
  };
}

describe("the rites waiting", () => {
  test("RED: a rite waits with its origin, digest and class, and the board's prepare shows beside it; CONTROL: a plain item never waits, and another wiki's rite stays out", async () => {
    const w = await world();
    w.state.items.set(W1, [itemOf(RITE), itemOf(NOTE)]);
    w.state.items.set(W2, [itemOf({ ...RITE, title: "rites/other", text: "exports.other = 1" })]);
    w.state.acts.push(await w.prepare(W1, D, "opens the field-notes macro"));
    const { waiting } = await promotions(w.ports(W1, HAND)).list();
    expect(waiting.map((r) => r.title)).toEqual(["rites/field-notes"]);
    expect(waiting[0]).toMatchObject({ digest: D, classes: ["module-type"], origin: { session: "s-1" }, prepared: { why: "opens the field-notes macro" } });
  });
});

describe("the commit", () => {
  test("RED: a seat's promote refuses `promote-needs-hand` and writes no ledger, CAS or pin; CONTROL: the hand's promote writes the (wiki, digest) row, the bytes under their digest, and the pin", async () => {
    const w = await world();
    w.state.items.set(W1, [itemOf(RITE)]);
    await expect(promotions(w.ports(W1, SEAT)).promote({ digest: D })).rejects.toMatchObject({ code: "promote-needs-hand" });
    expect(w.state.ledger.rows).toEqual([]);
    expect(w.state.cas.size + w.state.pinned.size).toBe(0);
    const row = await promotions(w.ports(W1, HAND)).promote({ digest: D });
    expect(row).toMatchObject({ wiki: W1, digest: D, title: "rites/field-notes", hand: "hand-1" });
    expect(sha(w.state.cas.get(D)!)).toBe(D);
    expect(w.state.pinned.has(D)).toBe(true);
  });

  test("RED: a digest no item of THIS wiki carries refuses `promote-unknown`, though another wiki holds it; CONTROL: the true digest lands in its own wiki", async () => {
    const w = await world();
    w.state.items.set(W1, [itemOf(RITE)]);
    await expect(promotions(w.ports(W2, HAND)).promote({ digest: D })).rejects.toMatchObject({ code: "promote-unknown" });
    await expect(promotions(w.ports(W1, HAND)).promote({ digest: "0".repeat(64) })).rejects.toMatchObject({ code: "promote-unknown" });
    expect(w.state.ledger.rows).toEqual([]);
    await expect(promotions(w.ports(W1, HAND)).promote({ digest: D })).resolves.toBeTruthy();
  });

  test("RED: unpromote and the orphan decision are the hand's alone; CONTROL: the hand's unpromote removes the row", async () => {
    const w = await world();
    w.state.items.set(W1, [itemOf(RITE)]);
    await promotions(w.ports(W1, HAND)).promote({ digest: D });
    await expect(promotions(w.ports(W1, SEAT)).unpromote({ digest: D })).rejects.toMatchObject({ code: "promote-needs-hand" });
    await expect(promotions(w.ports(W1, SEAT)).decideOrphan({ digest: D, decision: "keep" })).rejects.toMatchObject({ code: "promote-needs-hand" });
    expect(w.state.ledger.rows).toHaveLength(1);
    await promotions(w.ports(W1, HAND)).unpromote({ digest: D });
    expect(w.state.ledger.rows).toEqual([]);
  });
});

describe("the boot union, one wiki at a time", () => {
  test("RED: boot answers the wiki's own promoted digests; a pool wiki loads its own rite and none of W1's; CONTROL: the same digest promoted in both wikis loads in both", async () => {
    const w = await world();
    const OTHER = { title: "rites/garden", text: "exports.garden = 1", fields: { "module-type": "startup" } };
    w.state.items.set(W1, [itemOf(RITE)]);
    w.state.items.set(W2, [itemOf(OTHER)]);
    await promotions(w.ports(W1, HAND)).promote({ digest: D });
    await promotions(w.ports(W2, HAND)).promote({ digest: promoteDigest(OTHER) });
    expect((await promotions(w.ports(W1, HAND)).boot()).pluginCids).toEqual([D]);
    expect((await promotions(w.ports(W2, HAND)).boot()).pluginCids).toEqual([promoteDigest(OTHER)]);
    w.state.items.set(W2, [itemOf(OTHER), itemOf(RITE)]);
    await promotions(w.ports(W2, HAND)).promote({ digest: D });
    expect((await promotions(w.ports(W2, HAND)).boot()).pluginCids.sort()).toEqual([D, promoteDigest(OTHER)].sort());
  });

  test("RED: a tampered ledger row is voided and written to the CAS nowhere; CONTROL: its sound neighbour stays", async () => {
    const w = await world();
    const OTHER = { title: "rites/other", text: "exports.other = 1", fields: { "module-type": "startup" } };
    w.state.items.set(W1, [itemOf(RITE), itemOf(OTHER)]);
    await promotions(w.ports(W1, HAND)).promote({ digest: D });
    await promotions(w.ports(W1, HAND)).promote({ digest: promoteDigest(OTHER) });
    w.state.cas.clear(); w.state.pinned.clear();
    w.state.ledger = { ...w.state.ledger, rows: w.state.ledger.rows.map((r) => (r.title === RITE.title ? { ...r, bytes: r.bytes.replace("startup", "evil") } : r)) };
    const boot = await promotions(w.ports(W1, HAND)).boot();
    expect(boot.pluginCids).toEqual([promoteDigest(OTHER)]);
    expect(boot.voided).toEqual([{ digest: D, reason: "digest-mismatch" }]);
    expect([...w.state.cas.keys()]).toEqual([promoteDigest(OTHER)]);
  });

  test("RED: a later edit never changes what boots; the list reads `update-waits`; CONTROL: only the promoted digest ever reaches the CAS", async () => {
    const w = await world();
    w.state.items.set(W1, [itemOf(RITE)]);
    await promotions(w.ports(W1, HAND)).promote({ digest: D });
    w.state.items.set(W1, [itemOf({ ...RITE, text: "exports.startup = function(){ evil() }" }, "r2")]);
    expect((await promotions(w.ports(W1, HAND)).boot()).pluginCids).toEqual([D]);
    expect([...w.state.cas.keys()]).toEqual([D]);
    const listed = await promotions(w.ports(W1, HAND)).list();
    expect(listed.rows[0]).toMatchObject({ digest: D, state: "update-waits" });
    expect(listed.waiting.map((r) => r.digest)).not.toContain(D);
  });

  test("RED: a promoted item the wiki dropped reads orphaned, is NAMED at boot and KEEPS RUNNING; the hand's keep ends the asking and its drop removes it; CONTROL: a standing row is never named", async () => {
    const w = await world();
    w.state.items.set(W1, [itemOf(RITE)]);
    await promotions(w.ports(W1, HAND)).promote({ digest: D });
    expect((await promotions(w.ports(W1, HAND)).boot()).orphans).toEqual([]);
    w.state.items.set(W1, []);
    const boot = await promotions(w.ports(W1, HAND)).boot();
    expect(boot.pluginCids).toEqual([D]);
    expect(boot.orphans).toEqual([D]);
    await promotions(w.ports(W1, HAND)).decideOrphan({ digest: D, decision: "keep" });
    const kept = await promotions(w.ports(W1, HAND)).boot();
    expect(kept.pluginCids).toEqual([D]);
    expect(kept.orphans).toEqual([]);
    await promotions(w.ports(W1, HAND)).decideOrphan({ digest: D, decision: "drop" });
    expect((await promotions(w.ports(W1, HAND)).boot()).pluginCids).toEqual([]);
  });

  test("RED: an unreadable board at boot honors the cached shadow; CONTROL: rows outside the cache still run", async () => {
    const w = await world();
    const OTHER = { title: "rites/other", text: "exports.other = 1", fields: { "module-type": "startup" } };
    w.state.items.set(W1, [itemOf(RITE), itemOf(OTHER)]);
    await promotions(w.ports(W1, HAND)).promote({ digest: D });
    await promotions(w.ports(W1, HAND)).promote({ digest: promoteDigest(OTHER) });
    w.state.local = { shadowed: [promoteEdgeKey(W1, D)] };
    w.state.boardReadable = false;
    const boot = await promotions(w.ports(W1, HAND)).boot();
    expect(boot.pluginCids).toEqual([promoteDigest(OTHER)]);
    expect(boot.orphans).toEqual([]);
    expect(boot.shadowed).toEqual([promoteEdgeKey(W1, D)]);
  });
});

describe("the kāpae over (wiki, digest)", () => {
  test("RED: a shadow in W1 unloads W1's promotion and leaves W2's promotion of the same digest running; CONTROL: the lower restores W1's own row", async () => {
    const w = await world();
    w.state.items.set(W1, [itemOf(RITE)]);
    w.state.items.set(W2, [itemOf(RITE)]);
    await promotions(w.ports(W1, HAND)).promote({ digest: D });
    await promotions(w.ports(W2, HAND)).promote({ digest: D });
    const raise = await w.kapae(W1, D, true, []);
    w.state.acts.push(raise);
    expect((await promotions(w.ports(W1, HAND)).boot()).pluginCids).toEqual([]);
    expect((await promotions(w.ports(W2, HAND)).boot()).pluginCids).toEqual([D]);
    w.state.acts.push(await w.kapae(W1, D, false, [promoteActCid(raise)]));
    expect((await promotions(w.ports(W1, HAND)).boot()).pluginCids).toEqual([D]);
    expect(w.state.ledger.rows).toHaveLength(2);
  });

  test("RED: a raise read for an edge the running island loaded restarts it once; CONTROL: an edge in another wiki, or never loaded, restarts nothing", async () => {
    const w = await world();
    w.state.items.set(W1, [itemOf(RITE)]);
    await promotions(w.ports(W1, HAND)).promote({ digest: D });
    w.state.loaded = new Set([promoteEdgeKey(W1, D)]);
    w.state.acts.push(await w.kapae(W1, D, true, []));
    expect(await promotions(w.ports(W1, HAND)).arrive()).toEqual({ restarted: true });
    expect(w.state.restarts).toBe(1);
    expect(await promotions(w.ports(W1, HAND)).arrive()).toEqual({ restarted: false });
    const w2 = await world();
    w2.state.acts.push(await w2.kapae(W2, D, true, []));
    w2.state.loaded = new Set([promoteEdgeKey(W1, D)]);
    expect(await promotions(w2.ports(W1, HAND)).arrive()).toEqual({ restarted: false });
    expect(w2.state.restarts).toBe(0);
  });
});

describe("a restart that fails converges", () => {
  test("RED: a restart that throws leaves the edge loaded (the cache still records the shadow), and the next arrive restarts again; CONTROL: after the restart the island no longer holds the edge and a further arrive restarts nothing", async () => {
    const w = await world();
    w.state.items.set(W1, [itemOf(RITE)]);
    await promotions(w.ports(W1, HAND)).promote({ digest: D });
    w.state.loaded = new Set([promoteEdgeKey(W1, D)]);
    w.state.acts.push(await w.kapae(W1, D, true, []));
    w.state.failRestart = true;
    await expect(promotions(w.ports(W1, HAND)).arrive()).rejects.toThrow(/restart refused/);
    expect(w.state.local.shadowed).toEqual([promoteEdgeKey(W1, D)]);
    expect(await promotions(w.ports(W1, HAND)).arrive()).toEqual({ restarted: true });
    expect(await promotions(w.ports(W1, HAND)).arrive()).toEqual({ restarted: false });
  });
});
