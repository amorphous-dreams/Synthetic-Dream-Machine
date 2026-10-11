/**
 * verb-tiddler — task/receipt ontology SEED (2026-06-07).
 *
 * Covers the new content-addressed surface (taskUri / receiptUri / taskContentId)
 * and the provisional `aud` (audience/executor) field round-trip. The live
 * verb/signal/outcome path migrates onto this surface per
 * packages/EPIC-TASK-ONTOLOGY.md.
 */

import { describe, test, expect } from "vitest";
import {
  taskUri, receiptUri, taskContentId, TASK_KIND, RECEIPT_KIND,
  buildVerb, summon, parseVerb, concludeVerb,
  buildReceiptFact, parseReceiptFact, verbInputDigest,
  RECEIPT_RING_DEFAULT, ratedReceiptRing, RECEIPT_FACT_URI_PREFIX,
} from "../src/verb-tiddler.js";
import { larRoot, isStableLarUri } from "../src/lar-uris.js";
import { mkDaemonPlaceVerb, isVesselToIslandMsg } from "../src/island-protocol.js";

const BAG = "lar:///ha.ka.ba/bags/daemon";

describe("task/receipt URI ontology (seed)", () => {
  test("taskUri / receiptUri compose bag + kind + id", () => {
    expect(taskUri(BAG, "abc")).toBe("lar:///ha.ka.ba/bags/daemon/task/abc");
    expect(receiptUri(BAG, "abc")).toBe("lar:///ha.ka.ba/bags/daemon/receipt/abc");
    expect(TASK_KIND).toBe("task");
    expect(RECEIPT_KIND).toBe("receipt");
  });

  test("taskContentId is deterministic over {subject,command,args,nonce}", async () => {
    const a = await taskContentId({ subject: BAG, command: "MOVE", args: { x: 1 } });
    const b = await taskContentId({ subject: BAG, command: "MOVE", args: { x: 1 } });
    expect(a).toBe(b);
    expect(a).toMatch(/^sha256:[0-9a-f]{64}$/); // canonical algorithm-tagged sha256
  });

  test("a tagged taskContentId rides SAFELY inside the receipt URI (colon stays deep)", async () => {
    // The tag lives within the final path segment (`…/receipt/sha256:<hex>`). `larRoot`
    // reads only the three-term root, so the deep colon never touches the arity law:
    // the URI stays a stable ha.ka.ba address with the id as ONE segment (not a 5th).
    const id  = await taskContentId({ subject: BAG, command: "MOVE", args: { x: 1 } });
    const uri = receiptUri(BAG, id);
    expect(uri).toBe(`lar:///ha.ka.ba/bags/daemon/receipt/${id}`);
    expect(larRoot(uri)).toBe("ha.ka.ba");
    expect(isStableLarUri(uri)).toBe(true);
    expect(uri.split("/").length).toBe(taskUri(BAG, "abc").split("/").length); // id = one segment, colon and all
  });

  test("a fresh nonce yields a distinct task id (idempotent vs fresh dial)", async () => {
    const idem  = await taskContentId({ subject: BAG, command: "MOVE", args: {} });
    const fresh = await taskContentId({ subject: BAG, command: "MOVE", args: {}, nonce: "n1" });
    expect(fresh).not.toBe(idem);
  });

  test("aud round-trips through invocation build → parse", () => {
    const fields = buildVerb({ verb: "mint-invite", args: {}, requestedBy: "did:key:zOp", aud: "did:key:zVesselA" });
    expect(parseVerb(fields)?.aud).toBe("did:key:zVesselA");
  });

  test("aud round-trips through signal; absent stays undefined", () => {
    const sig = summon({ verb: "where", args: {}, requestedBy: "did:key:zOp", aud: "did:key:zVesselB" });
    expect(parseVerb(sig.tiddler as Record<string, unknown>)?.aud).toBe("did:key:zVesselB");
    const noAud = buildVerb({ verb: "where", args: {}, requestedBy: "did:key:zOp" });
    expect(parseVerb(noAud)?.aud).toBeUndefined();
  });

  test("effectKey round-trips through invocation build → parse", () => {
    const fields = buildVerb({ verb: "load", args: { a: 1 }, requestedBy: "did:key:zOp", effectKey: "sha256:abc" });
    expect(parseVerb(fields)?.effectKey).toBe("sha256:abc");
    const noEffect = buildVerb({ verb: "load", args: {}, requestedBy: "did:key:zOp" });
    expect(parseVerb(noEffect)?.effectKey).toBeUndefined();
  });

  test("effectKey round-trips through signal build → parse", () => {
    const sig = summon({ verb: "load", args: {}, requestedBy: "did:key:zOp", effectKey: "sha256:def" });
    expect(parseVerb(sig.tiddler as Record<string, unknown>)?.effectKey).toBe("sha256:def");
  });
});

describe("receipt facts — single-writer ledger codec (D1)", () => {
  test("buildReceiptFact / parseReceiptFact round-trip every field", () => {
    const fact = { requestId: "r1", inputDigest: "sha256:aa", effectKey: "sha256:bb", state: "done" as const, terminal: "done" as const, seq: 7 };
    const record = buildReceiptFact(fact);
    expect(record.tiddler.title).toBe(`${RECEIPT_FACT_URI_PREFIX}r1`);
    const parsed = parseReceiptFact(record.tiddler as Record<string, unknown>);
    expect(parsed).toEqual(fact);
  });

  test("a minimal fact (no effectKey/terminal) round-trips with those absent", () => {
    const fact = { requestId: "r2", inputDigest: "sha256:cc", state: "committed" as const, seq: 1 };
    const parsed = parseReceiptFact(buildReceiptFact(fact).tiddler as Record<string, unknown>);
    expect(parsed).toEqual(fact);
  });

  test("a torn fact (bad state, missing digest, non-numeric seq) parses to null, never throws", () => {
    expect(parseReceiptFact({ title: `${RECEIPT_FACT_URI_PREFIX}r3`, "request-id": "r3", state: "bogus", seq: "1" })).toBeNull();
    expect(parseReceiptFact({ title: `${RECEIPT_FACT_URI_PREFIX}r3`, "request-id": "r3", "input-digest": "x", state: "done", seq: "nope" })).toBeNull();
    expect(parseReceiptFact({ title: "lar:///not-a-receipt" })).toBeNull();
  });

  test("verbInputDigest is deterministic over {verb,args,requestedBy,effectKey} and sensitive to each", async () => {
    const a = await verbInputDigest({ verb: "load", args: { x: 1 }, requestedBy: "did:key:zOp" });
    const b = await verbInputDigest({ verb: "load", args: { x: 1 }, requestedBy: "did:key:zOp" });
    expect(a).toBe(b);
    expect(a).toMatch(/^sha256:[0-9a-f]{64}$/);
    const changedArgs = await verbInputDigest({ verb: "load", args: { x: 2 }, requestedBy: "did:key:zOp" });
    expect(changedArgs).not.toBe(a);
    const withEffect = await verbInputDigest({ verb: "load", args: { x: 1 }, requestedBy: "did:key:zOp", effectKey: "sha256:ee" });
    expect(withEffect).not.toBe(a);
  });

  test("RECEIPT_RING_DEFAULT is derived (1/min × 60 × 24 × 30 days + 256 burst = 43,456)", () => {
    expect(RECEIPT_RING_DEFAULT).toBe(43_456);
    expect(ratedReceiptRing()).toBe(43_456);
    expect(ratedReceiptRing({ ratePerMin: 2, horizonDays: 1, burst: 0 })).toBe(2 * 60 * 24);
  });
});

describe("concludeVerb — digest-on-outcome + effect index fields (D1)", () => {
  test("inputDigest / effectKey / effectOf are additive and absent by default", () => {
    const plain = concludeVerb({ requestId: "r1", verb: "load", status: "done", requestedBy: "did:key:zOp", cause: "c", batchMode: "best-effort" });
    expect(plain.tiddler["input-digest"]).toBeUndefined();
    expect(plain.tiddler["effect-key"]).toBeUndefined();
    expect(plain.tiddler["effect-of"]).toBeUndefined();

    const stamped = concludeVerb({
      requestId: "r2", verb: "load", status: "done", requestedBy: "did:key:zOp", cause: "c", batchMode: "best-effort",
      inputDigest: "sha256:aa", effectKey: "sha256:bb", effectOf: "r1",
    });
    expect(stamped.tiddler["input-digest"]).toBe("sha256:aa");
    expect(stamped.tiddler["effect-key"]).toBe("sha256:bb");
    expect(stamped.tiddler["effect-of"]).toBe("r1");
  });
});

describe("DaemonMsg_PlaceVerb — effectKey rides the wire, whitelist unchanged (D1)", () => {
  test("mkDaemonPlaceVerb carries effectKey when given, omits it otherwise", () => {
    const withEffect = mkDaemonPlaceVerb({ verb: "load", args: {}, requestedBy: "did:key:zOp", effectKey: "sha256:ee" });
    expect(withEffect.effectKey).toBe("sha256:ee");
    expect(isVesselToIslandMsg(withEffect)).toBe(true);

    const noEffect = mkDaemonPlaceVerb({ verb: "load", args: {}, requestedBy: "did:key:zOp" });
    expect(noEffect.effectKey).toBeUndefined();
    expect(isVesselToIslandMsg(noEffect)).toBe(true);
  });
});
