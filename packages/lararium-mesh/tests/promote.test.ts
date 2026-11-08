/**
 * promote — the pure law of a promotion, house-wide: the code class a loader would run, the digest, the device-local trust ledger keyed
 * by (wiki, digest), and who may commit.
 *
 * AI prepares, a hand commits: a seat's commit refuses `promote-needs-hand`. A digest mismatch voids a promotion. A later wiki edit never
 * changes what a promoted row runs. A promoted item the wiki dropped reads orphaned, keeps running and is named until the hand keeps or
 * drops it. A promotion in one wiki never runs in another. Every red pairs with a CONTROL.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { describe, expect, test } from "vitest";
import {
  EMPTY_LEDGER, PromoteRefused, decodeLedger, encodeLedger, ledgerCommit, ledgerDecideOrphan, ledgerUnpromote, promoteClass, promoteDigest,
  promotePreloadBytes, promotedPreloads, reconcilePromotions, verifyPromotionRows, type PromotionLedger,
} from "../src/promote.js";

const W1 = "lar:///ha.ka.ba/wikis/field-notes", W2 = "lar:///ha.ka.ba/wikis/garden";
const item = (fields: Record<string, string>, text = "x", title = "rites/a") => ({ title, text, fields });
const HAND = { kind: "hand", id: "hand-1" } as const;
const SEAT = { kind: "seat", id: "seat-1" } as const;
const rite = item({ "module-type": "startup" }, "exports.startup = function(){}");
const R = "a".repeat(64);
/** A board read that names no drop. */
const NO_DROPS = { dropped: () => new Set<string>() };
const commit = (who: typeof HAND | typeof SEAT, l: PromotionLedger = EMPTY_LEDGER, wiki = W1, it = rite, digest = promoteDigest(it)) =>
  ledgerCommit(l, { wiki, digest, item: it, revision: R }, who);

describe("the code class a loader would run", () => {
  test("RED: module-type, an executable type, a StartupAction tag, RawMarkup, the module-gate fields, a plugin bundle and wasm each name their class; CONTROL: a plain item, a stylesheet and a wikitext note name none", () => {
    expect(promoteClass(item({ "module-type": "startup" }))).toEqual(["module-type"]);
    expect(promoteClass(item({ type: "application/javascript; charset=utf-8" }))).toEqual(["executable-type"]);
    expect(promoteClass(item({ type: " Text/JavaScript " }))).toEqual(["executable-type"]);
    expect(promoteClass(item({ tags: "notes $:/tags/StartupAction/Browser" }))).toEqual(["startup-action"]);
    expect(promoteClass(item({ tags: "$:/tags/RawMarkup" }))).toEqual(["raw-markup"]);
    expect(promoteClass(item({ stack: "lar:///ha.ka.ba/lararium/tw5/tw5-module" }))).toEqual(["module-gate"]);
    expect(promoteClass(item({ "source-sha256": "sha256:00" }))).toEqual(["module-gate"]);
    expect(promoteClass(item({ "plugin-type": "plugin" }))).toEqual(["plugin"]);
    expect(promoteClass(item({ type: "application/wasm" }))).toEqual(["wasm"]);
    expect(promoteClass(item({ "module-type": "startup", type: "application/javascript" })).sort()).toEqual(["executable-type", "module-type"]);
    for (const fields of [{}, { type: "text/vnd.tiddlywiki", tags: "notes" }, { type: "text/css", tags: "$:/tags/Stylesheet" }, { tags: "$:/tags/StartupActionless" }]) {
      expect(promoteClass(item(fields)), JSON.stringify(fields)).toEqual([]);
    }
  });
});

describe("the digest", () => {
  test("RED: the digest names the preload bytes whatever order the fields came in; CONTROL: a changed body or field changes it", () => {
    const a = item({ type: "text/vnd.tiddlywiki", tags: "t" }, "body"), b = item({ tags: "t", type: "text/vnd.tiddlywiki" }, "body");
    expect(promoteDigest(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(promoteDigest(a)).toBe(promoteDigest(b));
    expect(JSON.parse(new TextDecoder().decode(promotePreloadBytes(a)))).toEqual({ type: "text/vnd.tiddlywiki", tags: "t", title: "rites/a", text: "body" });
    expect(promoteDigest(item({ type: "text/vnd.tiddlywiki", tags: "t" }, "body2"))).not.toBe(promoteDigest(a));
  });
});

describe("who commits", () => {
  test("RED: a seat's commit, unpromote and orphan decision refuse `promote-needs-hand`; CONTROL: the same acts by a hand land", () => {
    expect(() => commit(SEAT)).toThrowError(expect.objectContaining({ code: "promote-needs-hand" }));
    const l = commit(HAND), edge = { wiki: W1, digest: promoteDigest(rite) };
    expect(l.rows[0]).toMatchObject({ wiki: W1, digest: edge.digest, title: "rites/a", revision: R, hand: "hand-1", seq: 1 });
    expect(() => ledgerUnpromote(l, edge, SEAT)).toThrowError(expect.objectContaining({ code: "promote-needs-hand" }));
    expect(() => ledgerDecideOrphan(l, edge, "keep", SEAT)).toThrowError(expect.objectContaining({ code: "promote-needs-hand" }));
    expect(ledgerUnpromote(l, edge, HAND).rows).toEqual([]);
    expect(PromoteRefused.name).toBe("PromoteRefused");
  });

  test("RED: a digest that differs from the item's bytes voids the commit `promote-digest-mismatch`; CONTROL: the true digest lands and a second promote of one (wiki, title) replaces its row", () => {
    expect(() => commit(HAND, EMPTY_LEDGER, W1, rite, "0".repeat(64))).toThrowError(expect.objectContaining({ code: "promote-digest-mismatch" }));
    const v2 = item({ "module-type": "startup" }, "exports.startup = function(){ /*v2*/ }");
    const l = ledgerCommit(commit(HAND), { wiki: W1, digest: promoteDigest(v2), item: v2, revision: "b".repeat(64) }, HAND);
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

describe("the edge is (wiki, digest)", () => {
  test("RED: a promotion in W1 never preloads in W2 though W2 holds the same bytes; CONTROL: W1 preloads it, and promoting the same digest in W2 adds a row of its own", () => {
    const l1 = commit(HAND);
    const verified = verifyPromotionRows(l1.rows).verified;
    expect(promotedPreloads(verified, W2)).toEqual([]);
    expect(promotedPreloads(verified, W1)).toHaveLength(1);
    const both = commit(HAND, l1, W2);
    expect(both.rows.map((r) => r.wiki).sort()).toEqual([W1, W2]);
    expect(promotedPreloads(verifyPromotionRows(both.rows).verified, W2)).toHaveLength(1);
    expect(ledgerUnpromote(both, { wiki: W1, digest: promoteDigest(rite) }, HAND).rows.map((r) => r.wiki)).toEqual([W2]);
  });

  test("RED: a shadowed edge (wiki, digest) is skipped in that wiki alone; CONTROL: the other wiki's row of the same digest still preloads", () => {
    const both = commit(HAND, commit(HAND), W2);
    const verified = verifyPromotionRows(both.rows).verified;
    const shadow = new Set([`${W1}\n${promoteDigest(rite)}`]);
    expect(promotedPreloads(verified, W1, shadow)).toEqual([]);
    expect(promotedPreloads(verified, W2, shadow)).toHaveLength(1);
  });
});

describe("what runs", () => {
  test("RED: a row whose copied bytes no longer hash to its digest is voided and never preloads; CONTROL: its sound neighbour preloads", () => {
    const other = item({}, "plain", "rites/b");
    const two = commit(HAND, commit(HAND), W1, other);
    const tampered = two.rows.map((r) => (r.title === "rites/a" ? { ...r, bytes: r.bytes.replace("startup", "evil") } : r));
    const { verified, voided } = verifyPromotionRows(tampered);
    expect(voided).toEqual([{ digest: promoteDigest(rite), reason: "digest-mismatch" }]);
    expect(promotedPreloads(verified, W1)).toEqual([{ title: "rites/b", text: "plain" }]);
    expect(promotedPreloads(verifyPromotionRows(two.rows).verified, W1).map((e) => e["title"]).sort()).toEqual(["rites/a", "rites/b"]);
  });

  test("RED: reconcile reads the wiki's current digest per (wiki, title): same -> standing, different -> update-waits (the promoted bytes keep running), absent -> orphaned (still running), kept after the hand keeps it", () => {
    const l = commit(HAND), d = promoteDigest(rite), rows = l.rows;
    expect(reconcilePromotions(rows, () => d)[0]).toMatchObject({ state: "standing" });
    expect(reconcilePromotions(rows, () => "f".repeat(64))[0]).toMatchObject({ state: "update-waits", head: "f".repeat(64) });
    expect(reconcilePromotions(rows, () => null)[0]).toMatchObject({ state: "orphaned" });
    const asked: string[] = [];
    reconcilePromotions(rows, (wiki, title) => { asked.push(`${wiki}|${title}`); return d; });
    expect(asked).toEqual([`${W1}|rites/a`]);
    expect(promotedPreloads(verifyPromotionRows(rows).verified, W1)).toHaveLength(1);
    const kept = ledgerDecideOrphan(l, { wiki: W1, digest: d }, "keep", HAND);
    expect(reconcilePromotions(kept.rows, () => null)[0]).toMatchObject({ state: "kept" });
    expect(promotedPreloads(verifyPromotionRows(kept.rows).verified, W1)).toHaveLength(1);
    expect(ledgerDecideOrphan(l, { wiki: W1, digest: d }, "drop", HAND).rows).toEqual([]);
    expect(() => ledgerDecideOrphan(EMPTY_LEDGER, { wiki: W1, digest: "f".repeat(64) }, "drop", HAND)).toThrowError(expect.objectContaining({ code: "promote-unknown" }));
  });
});

describe("the ward binds a daemon or kahua promotion (row 7, S2)", () => {
  test("RED: a daemon or kahua row with no ward signature, a forged one, or one under a key the face never granted voids at boot; CONTROL: a user-wiki row with none stands, and a grant-signed bound row stands", async () => {
    const { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } = await import("../src/ed25519-door.js");
    const { signPromotionWard } = await import("../src/promote.js");
    const root = { key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(7)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(7)) };
    const other = { key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(8)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(8)) };
    const face = { grant: (k: string) => k === root.key };
    for (const wiki of ["daemon", "kahua", "kahua-garden"]) {
      const bare = commit(HAND, EMPTY_LEDGER, wiki).rows[0]!;
      expect(verifyPromotionRows([bare], face).voided, wiki).toEqual([{ digest: bare.digest, reason: "ward-unsigned" }]);
      const byOther = { ...bare, wardSig: await signPromotionWard(bare, other) };
      expect(verifyPromotionRows([byOther], face).voided.map((v) => v.reason)).toEqual(["ward-unsigned"]);
      const forged = { ...bare, wardSig: { key: root.key, sig: (await signPromotionWard(bare, other)).sig } };
      expect(verifyPromotionRows([forged], face).voided.map((v) => v.reason)).toEqual(["ward-unsigned"]);
      const moved = { ...bare, seq: bare.seq + 1, wardSig: await signPromotionWard(bare, root) };
      expect(verifyPromotionRows([moved], face).voided.map((v) => v.reason)).toEqual(["ward-unsigned"]);
      const signed = { ...bare, wardSig: await signPromotionWard(bare, root) };
      expect(verifyPromotionRows([signed], face, undefined, NO_DROPS).verified).toEqual([signed]);
      // The board unread: no floor proves the row was never dropped, so it voids by name.
      expect(verifyPromotionRows([signed], face).voided.map((v) => v.reason)).toEqual(["ward-floor-unread"]);
      // With no face to read grants against, a bound row voids: the read fails closed.
      expect(verifyPromotionRows([signed]).voided.map((v) => v.reason)).toEqual(["ward-unsigned"]);
      // The signature rides the ledger's bytes and back.
      expect(decodeLedger(encodeLedger({ seq: 1, rows: [signed] })).rows[0]).toEqual(signed);
    }
    const user = commit(HAND, EMPTY_LEDGER, W1).rows[0]!;
    expect(verifyPromotionRows([user], face).verified).toEqual([user]);
    expect(verifyPromotionRows([user]).verified).toEqual([user]);
  });
});

describe("a dropped bound row stays dropped (S2 cold read, P2-2)", () => {
  test("RED: a ward-signed daemon row, dropped and re-inserted with its old signature, voids at boot; CONTROL: a fresh commit of the same bytes, signed anew, stands", async () => {
    const { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } = await import("../src/ed25519-door.js");
    const { signPromotionWard } = await import("../src/promote.js");
    const root = { key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(7)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(7)) };
    const face = { grant: (k: string) => k === root.key };
    const digest = promoteDigest(rite);
    const unsigned = commit(HAND, EMPTY_LEDGER, "daemon").rows[0]!;
    const wardSig = await signPromotionWard(unsigned, root);
    const committed = ledgerCommit(EMPTY_LEDGER, { wiki: "daemon", digest, item: rite, revision: R, wardSig }, HAND);
    const signed = committed.rows[0]!;
    expect(verifyPromotionRows(committed.rows, face, committed, NO_DROPS).verified).toEqual([signed]);
    const dropped = ledgerUnpromote(committed, { wiki: "daemon", digest }, HAND);
    // A writer of the face's custody puts the old signed row back.
    const replayed = { ...dropped, rows: [...dropped.rows, signed] };
    const back = decodeLedger(encodeLedger(replayed));
    expect(verifyPromotionRows(back.rows, face, back, NO_DROPS).voided).toEqual([{ digest, reason: "ward-dropped" }]);
    // CONTROL: the hand commits the same bytes again under a fresh ward signature; the new row stands.
    const again = ledgerCommit(dropped, { wiki: "daemon", digest, item: rite, revision: R, wardSig: await signPromotionWard({ wiki: "daemon", digest, seq: dropped.seq + 1 }, root) }, HAND);
    expect(verifyPromotionRows(again.rows, face, again, NO_DROPS).verified.map((r) => r.seq)).toEqual([again.seq]);
  });
});
