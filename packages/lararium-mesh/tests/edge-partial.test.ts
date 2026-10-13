import { describe, expect, test } from "vitest";
import {
  countEdgeActs, edgeActPartial, memberEdgeId, vouchEdgeId, edgeIdOfSubject, readEdgeActPartial, judgeEdgeActPartial,
  cosignEdgeActPartial, signEdgeKapae, type EdgeCharter,
} from "../src/index.js";
import { seatedCharter, charterSeatSeeds } from "./charter-fixture.js";
import { kahuSigners, pubOf } from "./fixtures/carriage.js";

const FIX = 9271, SCOPE = "a1".repeat(32), MEMBER = "b2".repeat(32);
const seeds = charterSeatSeeds(FIX, 0, 3);

async function world(threshold = 2) {
  const genesis = await seatedCharter({ seats: 3, threshold, seed: FIX });
  const charter: EdgeCharter = { scope: SCOPE, head: genesis.roster, sealLineage: [...genesis.chain] };
  const edgeId = memberEdgeId(SCOPE, MEMBER);
  const act = async (raised = true, parents: string[] = [], signers = seeds.slice(0, 1), epochCid = genesis.head.epochCid) =>
    signEdgeKapae({ edgeId, raised, hand: "quorum", parents, epochCid }, await kahuSigners(signers));
  const read = async (acts: Awaited<ReturnType<typeof act>>[], c = charter) => countEdgeActs(acts, [], () => ({ quorum: true }), c);
  return { genesis, charter, edgeId, act, read };
}

describe("quorum edge partials", () => {
  test("a readable subject and its act survive a JSON round trip", async () => {
    const w = await world(); const a = await w.act();
    const member = edgeActPartial(a, SCOPE, { kind: "member", member: MEMBER });
    const round = readEdgeActPartial(JSON.parse(JSON.stringify(member)));
    expect(round?.act.actCid).toBe(a.actCid); expect(round?.subject).toEqual(member.subject);
    expect(memberEdgeId(SCOPE, MEMBER)).toBe(a.edgeId);
    const voucher = await pubOf(seeds[0]!);
    const vouchId = vouchEdgeId({ realmDocIdHex: SCOPE, voucherDid: voucher, joinerIdentityHex: MEMBER });
    const vouchAct = await signEdgeKapae({ edgeId: vouchId, raised: true, hand: "quorum", parents: [], epochCid: w.charter.head.sealEpochCid }, await kahuSigners(seeds.slice(0, 1)));
    const vouchPartial = edgeActPartial(vouchAct, SCOPE, { kind: "vouch", voucher, joiner: MEMBER });
    expect(edgeIdOfSubject(SCOPE, vouchPartial.subject)).toBe(vouchAct.edgeId);
    expect(readEdgeActPartial(JSON.parse(JSON.stringify(vouchPartial)))?.act.actCid).toBe(vouchAct.actCid);
    // CONTROL: a subject with the act's own member edge is the one that reads.
    expect(readEdgeActPartial(edgeActPartial(a, SCOPE, { kind: "member", member: MEMBER }))).not.toBeNull();
  });

  test("a partial refuses a torn act or a subject for another edge", async () => {
    const w = await world(); const a = await w.act(); const base = edgeActPartial(a, SCOPE, { kind: "member", member: MEMBER });
    const parse = (edit: (p: Record<string, unknown>) => void) => { const p = JSON.parse(JSON.stringify(base)) as Record<string, unknown>; edit(p); return readEdgeActPartial(p); };
    expect(parse((p) => { p["subject"] = { kind: "member", member: "c3".repeat(32) }; })).toBeNull();
    expect(parse((p) => { const act = p["act"] as Record<string, unknown>; act["hand"] = "holder"; })).toBeNull();
    expect(parse((p) => { const act = p["act"] as Record<string, unknown>; act["raised"] = false; })).toBeNull();
    expect(parse((p) => { const act = p["act"] as Record<string, unknown>; act["parents"] = ["not-a-cid"]; })).toBeNull();
    expect(parse((p) => { const act = p["act"] as Record<string, unknown>; act["signatures"] = []; })).toBeNull();
    expect(parse((p) => { p["kind"] = "wrong"; })).toBeNull();
    expect(parse((p) => { const s = p["subject"] as Record<string, unknown>; s["member"] = "c3".repeat(32); })).toBeNull();
    // CONTROL: its unmodified envelope is readable.
    expect(readEdgeActPartial(base)).not.toBeNull();
  });

  test("cosigning gathers seats without changing the act id", async () => {
    const w = await world(); const a = await w.act(); const p = edgeActPartial(a, SCOPE, { kind: "member", member: MEMBER });
    const initial = judgeEdgeActPartial(p, { charter: w.charter, counted: await w.read([]) });
    expect(initial.verdict).toBe("ready"); expect(initial.signed).toEqual([a.signatures[0]!.signer]);
    const full = await cosignEdgeActPartial(p, await kahuSigners([seeds[1]!]));
    expect(full.act.actCid).toBe(a.actCid);
    expect(judgeEdgeActPartial(full, { charter: w.charter, counted: await w.read([]) }).verdict).toBe("complete");
    expect((await w.read([full.act])).acts.map((x) => x.actCid)).toContain(a.actCid);
    // CONTROL: one seat alone does not count as a board act.
    expect((await w.read([a])).acts).toHaveLength(0);
  });

  test("the judge distinguishes replay, stale epoch, stale line and unavailable parents", async () => {
    const w = await world(); const a = await w.act(); const p = edgeActPartial(a, SCOPE, { kind: "member", member: MEMBER });
    const complete = await cosignEdgeActPartial(p, await kahuSigners([seeds[1]!]));
    expect(judgeEdgeActPartial(p, { charter: w.charter, counted: await w.read([complete.act]) }).verdict).toBe("replay");
    const rolled = await w.genesis.roll(); const rolledCharter: EdgeCharter = { scope: SCOPE, head: rolled.roster, sealLineage: [...rolled.chain] };
    expect(judgeEdgeActPartial(p, { charter: rolledCharter, counted: await w.read([]) }).verdict).toBe("stale");
    const moved = await w.act(false, [], seeds.slice(0, 2));
    const board = (await w.read([moved])).acts;
    expect(judgeEdgeActPartial(p, { charter: w.charter, counted: { acts: board } }).verdict).toBe("stale");
    const frontierAct = await w.act(true, [moved.actCid], seeds.slice(0, 1)); const frontier = edgeActPartial(frontierAct, SCOPE, { kind: "member", member: MEMBER });
    expect(judgeEdgeActPartial(frontier, { charter: w.charter, counted: { acts: board } }).verdict).toBe("ready");
    const missing = edgeActPartial(await w.act(true, ["d4".repeat(32)]), SCOPE, { kind: "member", member: MEMBER });
    expect(judgeEdgeActPartial(missing, { charter: w.charter, counted: await w.read([]) }).verdict).toBe("unavailable");
    // CONTROL: the partial at the reader's empty frontier is ready.
    expect(judgeEdgeActPartial(p, { charter: w.charter, counted: await w.read([]) }).verdict).toBe("ready");
  });

  test("the judge rejects unrostered, mis-scoped and byte-mismatched signatures", async () => {
    const w = await world(); const outsider = new Uint8Array(32).fill(99);
    const foreign = edgeActPartial(await w.act(true, [], [outsider]), SCOPE, { kind: "member", member: MEMBER });
    expect(judgeEdgeActPartial(foreign, { charter: w.charter, counted: await w.read([]) }).verdict).toBe("invalid");
    const good = edgeActPartial(await w.act(), SCOPE, { kind: "member", member: MEMBER });
    expect(judgeEdgeActPartial({ ...good, scope: "e5".repeat(32) }, { charter: w.charter, counted: await w.read([]) }).verdict).toBe("invalid");
    const other = await signEdgeKapae({ edgeId: w.edgeId, raised: false, hand: "quorum", parents: [], epochCid: w.charter.head.sealEpochCid }, await kahuSigners(seeds.slice(0, 1)));
    const forged = { ...good, act: { ...good.act, signatures: other.signatures } };
    expect(judgeEdgeActPartial(forged, { charter: w.charter, counted: await w.read([]) }).verdict).toBe("invalid");
    // CONTROL: the roster's signature over these bytes is ready.
    expect(judgeEdgeActPartial(good, { charter: w.charter, counted: await w.read([]) }).verdict).toBe("ready");
  });

  test("stranger signatures do not add seats and a repeated seat counts once", async () => {
    const w = await world(); const a = await w.act(); const p = edgeActPartial(a, SCOPE, { kind: "member", member: MEMBER });
    const stranger = await cosignEdgeActPartial(p, await kahuSigners([new Uint8Array(32).fill(98)]));
    expect(stranger.act.signatures).toHaveLength(2);
    expect(judgeEdgeActPartial(stranger, { charter: w.charter, counted: await w.read([]) }).verdict).toBe("ready");
    const twice = await cosignEdgeActPartial(p, await kahuSigners([seeds[0]!]));
    expect(judgeEdgeActPartial(twice, { charter: w.charter, counted: await w.read([]) }).signed).toHaveLength(1);
    // CONTROL: a distinct roster seat completes the same partial.
    expect(judgeEdgeActPartial(await cosignEdgeActPartial(p, await kahuSigners([seeds[1]!])), { charter: w.charter, counted: await w.read([]) }).verdict).toBe("complete");
  });
});
