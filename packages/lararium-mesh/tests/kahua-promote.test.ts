/**
 * kahua-promote — the pure law of a promotion: the code class, the digest, the device-local trust ledger, and who may commit.
 *
 * AI prepares, a hand commits: a seat's commit refuses `promote-needs-hand`. A digest mismatch voids a promotion. A later
 * stage edit never changes what a promoted row runs. A withdrawn promoted item reads orphaned and stays inert until the hand
 * keeps or drops it. Every red pairs with a CONTROL.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { describe, expect, test } from "vitest";
import type { LarDoc } from "../src/base-doc.js";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "../src/ed25519-door.js";
import { kahuaActCid, readKahuaStage, signKahuaLift, signKahuaWithdraw } from "../src/kahua-stage.js";
import {
  EMPTY_LEDGER, PromoteRefused, decodeLedger, encodeLedger, kahuaCodeClass, kahuaPreloadBytes, kahuaPromotionDigest,
  ledgerCommit, ledgerDecideOrphan, ledgerPrepare, ledgerUnpromote, promotedPreloads, reconcilePromotions, verifyPromotionRows,
} from "../src/kahua-promote.js";

const GROUP = "face-group";
const signer = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });
const item = (fields: Record<string, string>, text = "x", title = "rites/a") => ({ title, text, fields });
const HAND = { kind: "hand", id: "hand-1" } as const;
const SEAT = { kind: "seat", id: "seat-1" } as const;

describe("the code class", () => {
  test("RED: module-type, an executable type, a StartupAction tag, RawMarkup and the module-gate fields each name their class; CONTROL: a plain item, a stylesheet and a wikitext note name none", () => {
    expect(kahuaCodeClass(item({ "module-type": "startup" }))).toEqual(["module-type"]);
    expect(kahuaCodeClass(item({ type: "application/javascript; charset=utf-8" }))).toEqual(["executable-type"]);
    expect(kahuaCodeClass(item({ type: " Text/JavaScript " }))).toEqual(["executable-type"]);
    expect(kahuaCodeClass(item({ tags: "notes $:/tags/StartupAction/Browser" }))).toEqual(["startup-action"]);
    expect(kahuaCodeClass(item({ tags: "$:/tags/StartupAction" }))).toEqual(["startup-action"]);
    expect(kahuaCodeClass(item({ tags: "$:/tags/RawMarkup" }))).toEqual(["raw-markup"]);
    expect(kahuaCodeClass(item({ stack: "lar:///ha.ka.ba/lararium/tw5/tw5-module" }))).toEqual(["module-gate"]);
    expect(kahuaCodeClass(item({ "source-sha256": "sha256:00" }))).toEqual(["module-gate"]);
    expect(kahuaCodeClass(item({ "module-type": "startup", type: "application/javascript" })).sort()).toEqual(["executable-type", "module-type"]);
    for (const fields of [{}, { type: "text/vnd.tiddlywiki", tags: "notes" }, { type: "text/css", tags: "$:/tags/Stylesheet" }, { tags: "$:/tags/StartupActionless" }]) {
      expect(kahuaCodeClass(item(fields)), JSON.stringify(fields)).toEqual([]);
    }
  });
});

describe("the digest", () => {
  test("RED: the digest names the preload bytes, whatever order the fields came in; CONTROL: a changed body or field changes it", () => {
    const a = item({ type: "text/vnd.tiddlywiki", tags: "t" }, "body");
    const b = item({ tags: "t", type: "text/vnd.tiddlywiki" }, "body");
    expect(kahuaPromotionDigest(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(kahuaPromotionDigest(a)).toBe(kahuaPromotionDigest(b));
    expect(new TextDecoder().decode(kahuaPreloadBytes(a))).toBe(new TextDecoder().decode(kahuaPreloadBytes(b)));
    expect(JSON.parse(new TextDecoder().decode(kahuaPreloadBytes(a)))).toEqual({ type: "text/vnd.tiddlywiki", tags: "t", title: "rites/a", text: "body" });
    expect(kahuaPromotionDigest(item({ type: "text/vnd.tiddlywiki", tags: "t" }, "body2"))).not.toBe(kahuaPromotionDigest(a));
    expect(kahuaPromotionDigest(item({ type: "text/vnd.tiddlywiki", tags: "u" }, "body"))).not.toBe(kahuaPromotionDigest(a));
  });
});

describe("who commits", () => {
  const rite = item({ "module-type": "startup" }, "exports.startup = function(){}");
  const commit = (who: typeof HAND | typeof SEAT, l = EMPTY_LEDGER, digest = kahuaPromotionDigest(rite)) =>
    ledgerCommit(l, { digest, item: rite, revision: "a".repeat(64) }, who);

  test("RED: a seat's commit, unpromote and orphan decision refuse `promote-needs-hand`; CONTROL: the same acts by a hand land", () => {
    expect(() => commit(SEAT)).toThrowError(expect.objectContaining({ code: "promote-needs-hand" }));
    const l = commit(HAND);
    expect(l.rows).toHaveLength(1);
    expect(l.rows[0]).toMatchObject({ digest: kahuaPromotionDigest(rite), title: "rites/a", revision: "a".repeat(64), hand: "hand-1", seq: 1 });
    expect(() => ledgerUnpromote(l, l.rows[0]!.digest, SEAT)).toThrowError(expect.objectContaining({ code: "promote-needs-hand" }));
    expect(() => ledgerDecideOrphan(l, l.rows[0]!.digest, "keep", SEAT)).toThrowError(expect.objectContaining({ code: "promote-needs-hand" }));
    expect(ledgerUnpromote(l, l.rows[0]!.digest, HAND).rows).toEqual([]);
    expect(PromoteRefused.name).toBe("PromoteRefused");
  });

  test("RED: a seat PREPARES: the queue holds the item with its explanation and commits nothing; CONTROL: a hand's commit clears the queue entry", () => {
    const entry = { digest: kahuaPromotionDigest(rite), title: "rites/a", revision: "a".repeat(64), classes: kahuaCodeClass(rite), why: "starts the morning brief" };
    const q = ledgerPrepare(EMPTY_LEDGER, { ...entry, seat: "seat-1" });
    expect(q.rows).toEqual([]);
    expect(q.queue).toHaveLength(1);
    expect(q.queue[0]).toMatchObject({ ...entry, seat: "seat-1" });
    expect(() => ledgerPrepare(EMPTY_LEDGER, { ...entry, why: "", seat: "seat-1" })).toThrowError(expect.objectContaining({ code: "promote-why-missing" }));
    expect(ledgerPrepare(q, { ...entry, seat: "seat-1" }).queue).toHaveLength(1);
    const done = commit(HAND, q);
    expect(done.queue).toEqual([]);
    expect(done.rows).toHaveLength(1);
  });

  test("RED: a digest that differs from the item's bytes voids the commit `promote-digest-mismatch`; CONTROL: the true digest lands, and a second promote of one title replaces its row", () => {
    expect(() => commit(HAND, EMPTY_LEDGER, "0".repeat(64))).toThrowError(expect.objectContaining({ code: "promote-digest-mismatch" }));
    const v2 = item({ "module-type": "startup" }, "exports.startup = function(){ /*v2*/ }");
    const l = ledgerCommit(commit(HAND), { digest: kahuaPromotionDigest(v2), item: v2, revision: "b".repeat(64) }, HAND);
    expect(l.rows).toHaveLength(1);
    expect(l.rows[0]!.revision).toBe("b".repeat(64));
  });

  test("RED: the ledger encodes to bytes and back whole; a malformed ledger refuses `ledger-malformed`", () => {
    const l = commit(HAND);
    expect(decodeLedger(encodeLedger(l))).toEqual(l);
    expect(() => decodeLedger(new TextEncoder().encode("{\"rows\":[{\"digest\":1}]}"))).toThrowError(expect.objectContaining({ code: "ledger-malformed" }));
    expect(() => decodeLedger(new TextEncoder().encode("not json"))).toThrowError(expect.objectContaining({ code: "ledger-malformed" }));
  });
});

describe("what runs", () => {
  const rite = item({ "module-type": "startup" }, "exports.startup = function(){}");
  const promoted = () => ledgerCommit(EMPTY_LEDGER, { digest: kahuaPromotionDigest(rite), item: rite, revision: "a".repeat(64) }, HAND);

  test("RED: a row whose copied bytes no longer hash to its digest is voided and never preloads; CONTROL: its sound neighbour preloads", () => {
    const good = promoted();
    const other = item({}, "plain", "rites/b");
    const two = ledgerCommit(good, { digest: kahuaPromotionDigest(other), item: other, revision: "c".repeat(64) }, HAND);
    const tampered = { ...two, rows: two.rows.map((r) => (r.title === "rites/a" ? { ...r, bytes: r.bytes.replace("startup", "evil") } : r)) };
    const { verified, voided } = verifyPromotionRows(tampered.rows);
    expect(voided).toEqual([{ digest: kahuaPromotionDigest(rite), reason: "digest-mismatch" }]);
    expect(verified.map((r) => r.title)).toEqual(["rites/b"]);
    expect(promotedPreloads(verified)).toEqual([{ title: "rites/b", text: "plain" }]);
    expect(promotedPreloads(verifyPromotionRows(two.rows).verified).map((e) => e["title"]).sort()).toEqual(["rites/a", "rites/b"]);
  });

  test("RED: a stage edit never changes what a promoted row runs; the row reads `update-waits` and keeps its promoted bytes; CONTROL: an unedited head reads `standing`", async () => {
    const root = await signer(1), atom = await signer(2);
    const grant = (k: string) => k === root.key;
    const origin = { seat: atom.key, device: atom.key, session: "s" };
    const lift = (text: string, parent: string | null) => signKahuaLift({ group: GROUP, epoch: 0, title: "rites/a", text, fields: { "module-type": "startup" }, parent, origin, taint: [], sources: [{ title: "d", revision: "r" }] }, root);
    const v1 = await lift(rite.text, null);
    const c1 = kahuaActCid(v1);
    const ledger = ledgerCommit(EMPTY_LEDGER, { digest: kahuaPromotionDigest(rite), item: rite, revision: c1 }, HAND);
    expect(reconcilePromotions(ledger.rows, readKahuaStage([v1], { group: GROUP, grant }))[0]).toMatchObject({ state: "standing" });
    const v2 = await lift("exports.startup = function(){ evil() }", c1);
    const after = readKahuaStage([v1, v2], { group: GROUP, grant });
    expect(reconcilePromotions(ledger.rows, after)[0]).toMatchObject({ state: "update-waits", head: kahuaActCid(v2) });
    expect(promotedPreloads(verifyPromotionRows(ledger.rows).verified, reconcilePromotions(ledger.rows, after))[0]!["text"]).toBe(rite.text);
  });

  test("RED: a withdrawn promoted revision reads `orphaned` and stays inert until the hand keeps it (it runs again) or drops it (the row leaves); CONTROL: a seat decides nothing", async () => {
    const root = await signer(1), atom = await signer(2);
    const grant = (k: string) => k === root.key;
    const origin = { seat: atom.key, device: atom.key, session: "s" };
    const v1 = await signKahuaLift({ group: GROUP, epoch: 0, title: "rites/a", text: rite.text, fields: { "module-type": "startup" }, parent: null, origin, taint: [], sources: [{ title: "d", revision: "r" }] }, root);
    const c1 = kahuaActCid(v1);
    const ledger = ledgerCommit(EMPTY_LEDGER, { digest: kahuaPromotionDigest(rite), item: rite, revision: c1 }, HAND);
    const w = await signKahuaWithdraw({ group: GROUP, epoch: 0, target: c1 }, root);
    const reading = readKahuaStage([v1, w], { group: GROUP, grant });
    const states = reconcilePromotions(ledger.rows, reading);
    expect(states[0]).toMatchObject({ state: "orphaned" });
    expect(promotedPreloads(verifyPromotionRows(ledger.rows).verified, states)).toEqual([]);
    expect(() => ledgerDecideOrphan(ledger, ledger.rows[0]!.digest, "keep", SEAT)).toThrowError(expect.objectContaining({ code: "promote-needs-hand" }));
    const kept = ledgerDecideOrphan(ledger, ledger.rows[0]!.digest, "keep", HAND);
    const keptStates = reconcilePromotions(kept.rows, reading);
    expect(keptStates[0]).toMatchObject({ state: "kept" });
    expect(promotedPreloads(verifyPromotionRows(kept.rows).verified, keptStates)).toHaveLength(1);
    expect(ledgerDecideOrphan(ledger, ledger.rows[0]!.digest, "drop", HAND).rows).toEqual([]);
    expect(() => ledgerDecideOrphan(EMPTY_LEDGER, "f".repeat(64), "drop", HAND)).toThrowError(expect.objectContaining({ code: "promote-unknown" }));
  });
});
