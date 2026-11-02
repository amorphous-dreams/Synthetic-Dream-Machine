/**
 * kahua-promotions — a device's promotion door: the rites waiting, the seat's prepare, the hand's commit, the boot union, the
 * orphan that keeps running and is named, the kāpae that shadows and restarts the island.
 *
 * The door takes ports (ledger, local cache, stage reading, CAS, loaded set, restart); these reds stand it on memory ports.
 * Every red pairs with a CONTROL. Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { describe, expect, test } from "vitest";
import { createHash } from "node:crypto";
import {
  EMPTY_KAPAE_LOCAL, EMPTY_LEDGER, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, kahuaActCid, kahuaPromotionDigest,
  readKahuaStage, signKahuaKapae, signKahuaLift, signKahuaWithdraw,
  type KapaeLocal, type PromoteWho, type PromotionLedger,
} from "@lararium/mesh";
import { kahuaPromotions, type PromotionPorts } from "../src/kahua-promotions.js";

const GROUP = "face-group";
const HAND: PromoteWho = { kind: "hand", id: "hand-1" };
const SEAT: PromoteWho = { kind: "seat", id: "seat-1" };
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const RITE = { title: "rites/field-notes", text: "exports.startup = function(){}", fields: { "module-type": "startup" } };
const NOTE = { title: "notes/plain", text: "just words", fields: { type: "text/vnd.tiddlywiki" } };

async function world() {
  const root = await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(1));
  const sign = ed25519SignerFromSeed(new Uint8Array(32).fill(1));
  const rootSigner = { key: root, sign };
  const origin = { seat: root, device: root, session: "s-1" };
  const grant = (k: string) => k === root;
  const lift = (item: typeof RITE, parent: string | null) => signKahuaLift({ group: GROUP, epoch: 0, title: item.title, text: item.text, fields: { ...item.fields }, parent, origin, taint: [], sources: [{ title: "d", revision: "r" }] }, rootSigner);
  const acts: unknown[] = [];
  const state = {
    ledger: EMPTY_LEDGER as PromotionLedger, local: EMPTY_KAPAE_LOCAL as KapaeLocal,
    cas: new Map<string, Uint8Array>(), pinned: new Set<string>(), loaded: new Set<string>(), restarts: 0, stageReadable: true,
  };
  const ports = (who: PromoteWho): PromotionPorts => ({
    ledger: { read: async () => state.ledger, write: async (l) => { state.ledger = l; } },
    local: { read: async () => state.local, write: async (l) => { state.local = l; } },
    stage: async () => { if (!state.stageReadable) throw new Error("stage-unreadable"); return readKahuaStage(acts, { group: GROUP, grant }); },
    cas: { put: (d, b) => { state.cas.set(d, b); }, pin: (d) => { state.pinned.add(d); } },
    loaded: () => state.loaded,
    restart: async () => { state.restarts += 1; },
    who,
  });
  return {
    state, acts, ports, lift, signKapae: (digest: string, raised: boolean, parents: string[]) => signKahuaKapae({ group: GROUP, epoch: 0, digest, raised, parents }, rootSigner),
    withdraw: (target: string) => signKahuaWithdraw({ group: GROUP, epoch: 0, target }, rootSigner),
  };
}
const D = kahuaPromotionDigest(RITE);

describe("the rites waiting", () => {
  test("RED: a lifted rite shows waiting with its origin, digest and code class; CONTROL: a plain lifted item never shows", async () => {
    const w = await world();
    w.acts.push(await w.lift(RITE, null), await w.lift(NOTE, null));
    const { waiting } = await kahuaPromotions(w.ports(HAND)).list();
    expect(waiting.map((r) => r.title)).toEqual(["rites/field-notes"]);
    expect(waiting[0]).toMatchObject({ digest: D, classes: ["module-type"], origin: { session: "s-1" } });
  });

  test("RED: a seat PREPARES with a reason and the item shows prepared; a plain item refuses `promote-not-a-rite`; CONTROL: nothing commits", async () => {
    const w = await world();
    w.acts.push(await w.lift(RITE, null), await w.lift(NOTE, null));
    const seat = kahuaPromotions(w.ports(SEAT));
    await seat.prepare({ title: RITE.title, why: "opens the field-notes macro" });
    await expect(seat.prepare({ title: NOTE.title, why: "x" })).rejects.toMatchObject({ code: "promote-not-a-rite" });
    await expect(seat.prepare({ title: "absent", why: "x" })).rejects.toMatchObject({ code: "promote-unknown" });
    const listed = await seat.list();
    expect(listed.waiting[0]).toMatchObject({ digest: D, prepared: { why: "opens the field-notes macro", seat: "seat-1" } });
    expect(w.state.ledger.rows).toEqual([]);
    expect(w.state.cas.size).toBe(0);
  });
});

describe("the commit", () => {
  test("RED: a seat's promote refuses `promote-needs-hand` and writes no ledger, CAS or pin; CONTROL: the hand's promote writes the row, the bytes under their digest, and the pin", async () => {
    const w = await world();
    w.acts.push(await w.lift(RITE, null));
    await expect(kahuaPromotions(w.ports(SEAT)).promote({ digest: D })).rejects.toMatchObject({ code: "promote-needs-hand" });
    expect(w.state.ledger.rows).toEqual([]);
    expect(w.state.cas.size + w.state.pinned.size).toBe(0);
    const row = await kahuaPromotions(w.ports(HAND)).promote({ digest: D });
    expect(row).toMatchObject({ digest: D, title: "rites/field-notes", hand: "hand-1" });
    expect(w.state.ledger.rows).toHaveLength(1);
    expect([...w.state.cas.keys()]).toEqual([D]);
    expect(sha(w.state.cas.get(D)!)).toBe(D);
    expect(w.state.pinned.has(D)).toBe(true);
  });

  test("RED: a digest no standing stage item carries refuses `promote-unknown` (a mismatch voids); CONTROL: the true digest lands", async () => {
    const w = await world();
    w.acts.push(await w.lift(RITE, null));
    await expect(kahuaPromotions(w.ports(HAND)).promote({ digest: "0".repeat(64) })).rejects.toMatchObject({ code: "promote-unknown" });
    expect(w.state.ledger.rows).toEqual([]);
    await expect(kahuaPromotions(w.ports(HAND)).promote({ digest: D })).resolves.toBeTruthy();
  });

  test("RED: unpromote and the orphan decision are the hand's alone; CONTROL: the hand's unpromote removes the row", async () => {
    const w = await world();
    w.acts.push(await w.lift(RITE, null));
    await kahuaPromotions(w.ports(HAND)).promote({ digest: D });
    await expect(kahuaPromotions(w.ports(SEAT)).unpromote({ digest: D })).rejects.toMatchObject({ code: "promote-needs-hand" });
    await expect(kahuaPromotions(w.ports(SEAT)).decideOrphan({ digest: D, decision: "keep" })).rejects.toMatchObject({ code: "promote-needs-hand" });
    expect(w.state.ledger.rows).toHaveLength(1);
    await kahuaPromotions(w.ports(HAND)).unpromote({ digest: D });
    expect(w.state.ledger.rows).toEqual([]);
  });
});

describe("the boot union", () => {
  test("RED: boot answers the promoted digests as extra pluginCids and re-writes their verified bytes to the CAS; a tampered ledger row is voided and written nowhere; CONTROL: its sound neighbour stays", async () => {
    const w = await world();
    const OTHER = { title: "rites/other", text: "exports.other = 1", fields: { "module-type": "startup" } };
    w.acts.push(await w.lift(RITE, null), await w.lift(OTHER, null));
    await kahuaPromotions(w.ports(HAND)).promote({ digest: D });
    await kahuaPromotions(w.ports(HAND)).promote({ digest: kahuaPromotionDigest(OTHER) });
    w.state.cas.clear(); w.state.pinned.clear();
    w.state.ledger = { ...w.state.ledger, rows: w.state.ledger.rows.map((r) => (r.title === RITE.title ? { ...r, bytes: r.bytes.replace("startup", "evil") } : r)) };
    const boot = await kahuaPromotions(w.ports(HAND)).boot();
    expect(boot.pluginCids).toEqual([kahuaPromotionDigest(OTHER)]);
    expect(boot.voided).toEqual([{ digest: D, reason: "digest-mismatch" }]);
    expect([...w.state.cas.keys()]).toEqual([kahuaPromotionDigest(OTHER)]);
    expect(w.state.pinned.has(kahuaPromotionDigest(OTHER))).toBe(true);
  });

  test("RED: a later stage edit never changes what boots; the list reads `update-waits`; CONTROL: only the promoted digest ever reaches the CAS", async () => {
    const w = await world();
    const v1 = await w.lift(RITE, null);
    w.acts.push(v1);
    await kahuaPromotions(w.ports(HAND)).promote({ digest: D });
    w.acts.push(await w.lift({ ...RITE, text: "exports.startup = function(){ evil() }" }, kahuaActCid(v1)));
    const boot = await kahuaPromotions(w.ports(HAND)).boot();
    expect(boot.pluginCids).toEqual([D]);
    expect([...w.state.cas.keys()]).toEqual([D]);
    const listed = await kahuaPromotions(w.ports(HAND)).list();
    expect(listed.rows[0]).toMatchObject({ digest: D, state: "update-waits" });
    expect(listed.waiting.map((r) => r.digest)).not.toContain(D);
  });

  test("RED: a withdrawn promoted item reads orphaned, is NAMED at boot and KEEPS RUNNING; the hand's drop removes it, its keep ends the asking; CONTROL: a standing row is never named", async () => {
    const w = await world();
    const v1 = await w.lift(RITE, null);
    w.acts.push(v1);
    await kahuaPromotions(w.ports(HAND)).promote({ digest: D });
    expect((await kahuaPromotions(w.ports(HAND)).boot()).orphans).toEqual([]);
    w.acts.push(await w.withdraw(kahuaActCid(v1)));
    const boot = await kahuaPromotions(w.ports(HAND)).boot();
    expect(boot.pluginCids).toEqual([D]);
    expect(boot.orphans).toEqual([D]);
    await kahuaPromotions(w.ports(HAND)).decideOrphan({ digest: D, decision: "keep" });
    const kept = await kahuaPromotions(w.ports(HAND)).boot();
    expect(kept.pluginCids).toEqual([D]);
    expect(kept.orphans).toEqual([]);
    await kahuaPromotions(w.ports(HAND)).decideOrphan({ digest: D, decision: "drop" });
    expect((await kahuaPromotions(w.ports(HAND)).boot()).pluginCids).toEqual([]);
  });

  test("RED: an unreadable stage at boot honors the cached shadow and names no orphan; CONTROL: rows outside the cache still run", async () => {
    const w = await world();
    const OTHER = { title: "rites/other", text: "exports.other = 1", fields: { "module-type": "startup" } };
    w.acts.push(await w.lift(RITE, null), await w.lift(OTHER, null));
    await kahuaPromotions(w.ports(HAND)).promote({ digest: D });
    await kahuaPromotions(w.ports(HAND)).promote({ digest: kahuaPromotionDigest(OTHER) });
    w.state.local = { shadowed: [D], queue: [] };
    w.state.stageReadable = false;
    const boot = await kahuaPromotions(w.ports(HAND)).boot();
    expect(boot.pluginCids).toEqual([kahuaPromotionDigest(OTHER)]);
    expect(boot.orphans).toEqual([]);
    expect(boot.shadowed).toEqual([D]);
  });
});

describe("the kāpae on arrival", () => {
  test("RED: a raise read for a digest the running daemon loaded restarts the island once and the next boot excludes D; CONTROL: a digest never loaded restarts nothing", async () => {
    const w = await world();
    w.acts.push(await w.lift(RITE, null));
    await kahuaPromotions(w.ports(HAND)).promote({ digest: D });
    w.state.loaded = new Set([D]);
    const raise = await w.signKapae(D, true, []);
    w.acts.push(raise);
    expect(await kahuaPromotions(w.ports(HAND)).arrive()).toEqual({ restarted: true });
    expect(w.state.restarts).toBe(1);
    expect(await kahuaPromotions(w.ports(HAND)).arrive()).toEqual({ restarted: false });
    expect(w.state.restarts).toBe(1);
    expect(w.state.local.shadowed).toEqual([D]);
    expect((await kahuaPromotions(w.ports(HAND)).boot()).pluginCids).toEqual([]);
    w.acts.push(await w.signKapae(D, false, [kahuaActCid(raise)]));
    expect((await kahuaPromotions(w.ports(HAND)).boot()).pluginCids).toEqual([D]);
    expect(w.state.ledger.rows).toHaveLength(1);
    const w2 = await world();
    w2.acts.push(await w2.lift(RITE, null), await w2.signKapae(D, true, []));
    await kahuaPromotions(w2.ports(HAND)).promote({ digest: D });
    w2.state.loaded = new Set();
    expect(await kahuaPromotions(w2.ports(HAND)).arrive()).toEqual({ restarted: false });
    expect(w2.state.restarts).toBe(0);
  });
});
