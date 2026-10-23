/**
 * signed-act — the one image, the one fold. Sync carries; verification decides.
 * Reds: two signed acts at one sequence surface as a fork (never a winner); a forged, mis-domained, mis-grouped
 * or unauthorized act folds to nothing. Controls: the honest chain folds whole, and arrival order moves nothing.
 */
import { describe, expect, test } from "vitest";
import { PERSONA_ACT_DOMAIN, EDGE_FRONTIER_DOMAIN } from "../src/domains.js";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "../src/ed25519-door.js";
import { actCid, foldActs, signAct, type SignedAct } from "../src/signed-act.js";

const seed = (n: number): Uint8Array => new Uint8Array(32).fill(n);
async function who(n: number) { return { key: await ed25519VerifyingKeyFromSeed(seed(n)), sign: ed25519SignerFromSeed(seed(n)) }; }
const GROUP = "group-a";
const body = (seq: number, prior: string | null, extra: Record<string, unknown> = {}) =>
  ({ kind: PERSONA_ACT_DOMAIN, group: GROUP, seq, prior, act: "admission", ...extra });

describe("signed-act", () => {
  test("CONTROL: an honest chain folds whole, in any arrival order", async () => {
    const a = await who(1);
    const a0 = await signAct(body(0, null, { planeUrl: "automerge:x" }), a);
    const a1 = await signAct(body(1, actCid(a0.body)), a);
    const a2 = await signAct(body(2, actCid(a1.body)), a);
    const opts = { domain: PERSONA_ACT_DOMAIN, group: GROUP, authorize: (s: string) => s === a.key };
    for (const order of [[a0, a1, a2], [a2, a0, a1], [a1, a2, a0]]) {
      const fold = foldActs(order, opts);
      expect(fold.chain.map((e) => e.act.body.seq)).toEqual([0, 1, 2]);
      expect(fold.fork).toBeNull();
      expect(fold.refused).toEqual([]);
    }
  });

  test("RED: two signed acts at one sequence surface as a fork, never a CRDT winner", async () => {
    const a = await who(1);
    const a0 = await signAct(body(0, null), a);
    const left = await signAct(body(1, actCid(a0.body), { planeUrl: "automerge:left" }), a);
    const right = await signAct(body(1, actCid(a0.body), { planeUrl: "automerge:right" }), a);
    const opts = { domain: PERSONA_ACT_DOMAIN, group: GROUP, authorize: () => true };
    for (const order of [[a0, left, right], [right, left, a0]]) {
      const fold = foldActs(order, opts);
      expect(fold.chain.map((e) => e.act.body.seq)).toEqual([0]);
      expect(fold.fork?.seq).toBe(1);
      expect(fold.fork?.cids).toEqual([actCid(left.body), actCid(right.body)].sort());
    }
  });

  test("RED: a tampered body, another domain, another group and an unauthorized signer each fold to nothing", async () => {
    const a = await who(1), mallory = await who(2);
    const good = await signAct(body(0, null, { planeUrl: "automerge:x" }), a);
    const tampered: SignedAct = { ...good, body: { ...good.body, planeUrl: "automerge:evil" } };
    const wrongDomain = await signAct({ ...body(0, null), kind: EDGE_FRONTIER_DOMAIN }, a);
    const wrongGroup = await signAct({ ...body(0, null), group: "group-b" }, a);
    const foreign = await signAct(body(0, null), mallory);
    const opts = { domain: PERSONA_ACT_DOMAIN, group: GROUP, authorize: (s: string) => s === a.key };
    const fold = foldActs([tampered, wrongDomain, wrongGroup, foreign], opts);
    expect(fold.chain).toEqual([]);
    expect(fold.refused.map((r) => r.refusal).sort()).toEqual(["domain", "group", "signature", "unauthorized"]);
    expect(foldActs([good], opts).chain).toHaveLength(1);   // the control: the honest act stands
  });

  test("RED: a replayed act under a forged prior links to nothing", async () => {
    const a = await who(1);
    const a0 = await signAct(body(0, null), a);
    const orphan = await signAct(body(1, "ff".repeat(32)), a);
    const fold = foldActs([a0, orphan], { domain: PERSONA_ACT_DOMAIN, group: GROUP, authorize: () => true });
    expect(fold.chain).toHaveLength(1);
    expect(fold.fork).toBeNull();
  });

  test("the signer refuses a seq/prior pair that cannot link", async () => {
    const a = await who(1);
    await expect(signAct(body(0, "ab"), a)).rejects.toThrow(/prior/);
    await expect(signAct(body(1, null), a)).rejects.toThrow(/prior/);
  });
});
