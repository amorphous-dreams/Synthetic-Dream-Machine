/**
 * nexus-partial — admit, revoke, kapae and roll-anchor partials cross between two vaults as files; a judge
 * runs before every signature, and each grown act counts on the real fold of its own family.
 */
import { describe, expect, test } from "vitest";
import * as ed from "@noble/ed25519";
import { hex } from "../src/crypto.js";
import {
  carriageEntryActCid, carriageEntryCounts, rollAnchorCounts, signCarriageContract, signCarriageQuorum, signRollAnchor,
  type CarriageEntry, type RollAnchor,
} from "../src/carriage-registry.js";
import { makeMultiSigQuorumVerifier, signAntigenEntry, type KapaeAntigenEntry } from "../src/kapae-antigen.js";
import {
  NexusPartialRefusal, cosignNexusActPartial, judgeNexusActPartial, nexusActPartial, readNexusActPartial,
  type NexusActPartial, type NexusPartialReader,
} from "../src/nexus-partial.js";
import { seatedCharter, type SeatedCharter } from "./charter-fixture.js";

const courier = <T>(v: T): unknown => JSON.parse(JSON.stringify(v));
const seedOf = (n: number): Uint8Array => new Uint8Array(32).fill(n);
const keyOf = async (n: number): Promise<string> => hex(await ed.getPublicKeyAsync(seedOf(n)));
const handOf = async (n: number) => ({ signer: await keyOf(n), sign: async (b: Uint8Array) => hex(await ed.signAsync(b, seedOf(n))) });
type Hand = Awaited<ReturnType<typeof handOf>>;

/** A hand that counts its calls, so a test proves no signature ran. */
function counting(hand: Hand, calls: { n: number }): Hand {
  return { signer: hand.signer, sign: async (b) => { calls.n++; return hand.sign(b); } };
}
const empty = { carriage: [] as CarriageEntry[], anchors: [] as RollAnchor[], antigen: [] as KapaeAntigenEntry[] };

async function nexus(): Promise<{ charter: SeatedCharter; reader: NexusPartialReader; seats: readonly Hand[] }> {
  const charter = await seatedCharter({ seats: 2, threshold: 2, seed: 41 });
  return { charter, seats: await charter.signers(), reader: { aid: charter.aid, head: charter.roster, board: empty } };
}

async function admitPartial(charter: SeatedCharter, seat: Hand, parents: string[] = [], nymSeed = 50): Promise<NexusActPartial> {
  const operator = await handOf(nymSeed);
  const contractSig = await signCarriageContract(operator.signer, charter.head.epochCid, operator.sign);
  const entry = await signCarriageQuorum({ nym: operator.signer, action: "admit", parents, sealEpochCid: charter.head.epochCid }, [seat], contractSig);
  return nexusActPartial(charter.aid, { family: "admit", entry });
}

describe("admit", () => {
  test("A signs, the file crosses, B judges ready and cosigns; the grown admit counts on the carriage fold", async () => {
    const { charter, reader, seats } = await nexus();
    const partial = courier(await admitPartial(charter, seats[0]!));
    expect(await judgeNexusActPartial(partial, reader)).toMatchObject({ verdict: "ready", signed: [seats[0]!.signer] });
    const grown = courier(await cosignNexusActPartial(partial, reader, [seats[1]!]));
    expect((await judgeNexusActPartial(grown, reader)).verdict).toBe("complete");
    const entry = (readNexusActPartial(grown)!.act as { entry: CarriageEntry }).entry;
    expect(await carriageEntryCounts(entry, charter.roster)).toBe(true);
  });

  test("no second signature lands on a replay, a stale epoch, a missing parent, a moved line, another Nexus, a misread subject or an unconsented admit", async () => {
    const { charter, reader, seats } = await nexus();
    const calls = { n: 0 };
    const b = counting(seats[1]!, calls);
    const partial = await admitPartial(charter, seats[0]!);
    const done = (readNexusActPartial(courier(await cosignNexusActPartial(courier(partial), reader, [seats[1]!])))!.act as { entry: CarriageEntry }).entry;
    const cases: Array<[string, unknown, NexusPartialReader]> = [
      ["replay", courier(partial), { ...reader, board: { ...empty, carriage: [done] } }],
      ["stale", courier(partial), { ...reader, head: (await charter.roll()).roster }],
      ["unavailable", courier(await admitPartial(charter, seats[0]!, ["ab".repeat(32)])), reader],
      ["stale", courier(nexusActPartial(charter.aid, { family: "revoke", entry: await signCarriageQuorum(
        { nym: done.nym, action: "revoke", parents: [], sealEpochCid: charter.head.epochCid }, [seats[0]!]) })), { ...reader, board: { ...empty, carriage: [done] } }],
      ["invalid", courier(partial), { ...reader, aid: `nexus-${"00".repeat(32)}` }],
    ];
    for (const [verdict, file, at] of cases) {
      expect((await judgeNexusActPartial(file, at)).verdict, verdict).toBe(verdict);
      await expect(cosignNexusActPartial(file, at, [b])).rejects.toBeInstanceOf(NexusPartialRefusal);
    }
    // An uncounted copy of the same act on the board (one seat's signature) blocks nothing: the partial reads ready.
    expect((await judgeNexusActPartial(courier(partial), { ...reader, board: { ...empty, carriage: [(partial.act as { entry: CarriageEntry }).entry] } })).verdict).toBe("ready");
    // The moved-line case: a revoke citing no parent while the board holds the admit head for that nym.
    const p = courier(partial) as Record<string, any>;
    const misread = { ...p, subject: { kind: "nym", nym: "cd".repeat(32) } };
    expect(readNexusActPartial(misread)).toBeNull();
    await expect(cosignNexusActPartial(misread, reader, [b])).rejects.toMatchObject({ code: "invalid" });
    const operator = await handOf(50);
    const foreignEpoch = await signCarriageContract(operator.signer, `epoch-${"11".repeat(32)}`, operator.sign);
    const unconsented = { ...p, act: { ...p.act, entry: { ...p.act.entry, contractSig: foreignEpoch } } };
    expect((await judgeNexusActPartial(unconsented, reader)).verdict).toBe("invalid");
    // An act no seat of the head roster signed reads invalid, whoever signed it.
    expect((await judgeNexusActPartial(courier(await admitPartial(charter, await handOf(78))), reader)).verdict).toBe("invalid");
    expect(calls.n).toBe(0);
  });

  test("only an unsigned seat of the head roster may add, and it refuses before any hand signs", async () => {
    const { charter, reader, seats } = await nexus();
    const calls = { n: 0 };
    const partial = courier(await admitPartial(charter, seats[0]!));
    await expect(cosignNexusActPartial(partial, reader, [counting(seats[1]!, calls), counting(await handOf(77), calls)])).rejects.toMatchObject({ code: "hand-not-seated" });
    await expect(cosignNexusActPartial(partial, reader, [counting(seats[0]!, calls)])).rejects.toMatchObject({ code: "hand-already-signed" });
    expect(calls.n).toBe(0);
  });

  test("an act never casts into another family: an admit read as a revoke or a kapae, or a revoke carrying a contract, reads nowhere", async () => {
    const { charter, seats } = await nexus();
    const p = courier(await admitPartial(charter, seats[0]!)) as Record<string, any>;
    expect(readNexusActPartial(p)).not.toBeNull();
    expect(readNexusActPartial({ ...p, act: { ...p.act, family: "revoke" } })).toBeNull();
    expect(readNexusActPartial({ ...p, act: { ...p.act, family: "kapae" } })).toBeNull();
    expect(readNexusActPartial({ ...p, act: { family: "roll-anchor", anchor: p.act.entry } })).toBeNull();
    expect(readNexusActPartial({ ...p, act: { ...p.act, entry: { ...p.act.entry, parents: ["bb".repeat(32), "aa".repeat(32)] } } })).toBeNull();
    expect(readNexusActPartial({ ...p, extra: 1 })).toBeNull();
    const edge = { kind: "edge-act-partial", scope: "ab".repeat(32), subject: { kind: "member", member: "cd".repeat(32) }, act: p.act.entry };
    expect(readNexusActPartial(edge)).toBeNull();
    const revoke = await signCarriageQuorum({ nym: p.act.entry.nym, action: "revoke", parents: [], sealEpochCid: charter.head.epochCid }, [seats[0]!]);
    const r = courier(nexusActPartial(charter.aid, { family: "revoke", entry: revoke })) as Record<string, any>;
    expect(readNexusActPartial(r)).not.toBeNull();
    expect(readNexusActPartial({ ...r, act: { ...r.act, entry: { ...r.act.entry, contractSig: p.act.entry.contractSig } } })).toBeNull();
    expect(readNexusActPartial({ ...r, act: { family: "admit", entry: { ...r.act.entry, contractSig: p.act.entry.contractSig } } })).toBeNull();
  });
});

describe("revoke", () => {
  test("a revoke crosses and completes with the quorum alone, citing the admit it removes", async () => {
    const { charter, reader, seats } = await nexus();
    const admitted = (readNexusActPartial(courier(await cosignNexusActPartial(courier(await admitPartial(charter, seats[0]!)), reader, [seats[1]!])))!.act as { entry: CarriageEntry }).entry;
    const at = { ...reader, board: { ...empty, carriage: [admitted] } };
    const revoke = await signCarriageQuorum({ nym: admitted.nym, action: "revoke", parents: [carriageEntryActCid(admitted)], sealEpochCid: charter.head.epochCid }, [seats[1]!]);
    const partial = courier(nexusActPartial(charter.aid, { family: "revoke", entry: revoke }));
    expect((await judgeNexusActPartial(partial, at)).verdict).toBe("ready");
    const grown = await cosignNexusActPartial(partial, at, [seats[0]!]);
    expect((await judgeNexusActPartial(courier(grown), at)).verdict).toBe("complete");
    expect(await carriageEntryCounts((grown.act as { entry: CarriageEntry }).entry, charter.roster)).toBe(true);
  });
});

describe("kapae", () => {
  async function kapae(charter: SeatedCharter, seat: Hand, parents: string[] = []) {
    const entry = await signAntigenEntry({ nym: await keyOf(60), action: "kapae", parents, sealEpochCid: charter.head.epochCid }, [seat]);
    return nexusActPartial(charter.aid, { family: "kapae", entry });
  }

  test("a kapae crosses and completes; the grown entry verifies under the antigen's own quorum verifier", async () => {
    const { charter, reader, seats } = await nexus();
    const partial = courier(await kapae(charter, seats[0]!));
    expect((await judgeNexusActPartial(partial, reader)).verdict).toBe("ready");
    const grown = await cosignNexusActPartial(partial, reader, [seats[1]!]);
    expect((await judgeNexusActPartial(courier(grown), reader)).verdict).toBe("complete");
    expect(await makeMultiSigQuorumVerifier().verifyQuorum((grown.act as { entry: KapaeAntigenEntry }).entry, charter.roster)).toBe(true);
  });

  test("a relabelled act id reads nowhere, and a kapae that ignores a standing head reads stale", async () => {
    const { charter, reader, seats } = await nexus();
    const p = courier(await kapae(charter, seats[0]!)) as Record<string, any>;
    expect(readNexusActPartial({ ...p, act: { ...p.act, entry: { ...p.act.entry, actCid: `sha256:${"00".repeat(32)}` } } })).toBeNull();
    const head = (await cosignNexusActPartial(courier(await kapae(charter, seats[1]!, [])), reader, [seats[0]!])).act as { entry: KapaeAntigenEntry };
    const lift = await signAntigenEntry({ nym: head.entry.nym, action: "un_kapae", parents: [], sealEpochCid: charter.head.epochCid }, [seats[0]!]);
    const at = { ...reader, board: { ...empty, antigen: [head.entry] } };
    expect((await judgeNexusActPartial(courier(nexusActPartial(charter.aid, { family: "kapae", entry: lift })), at)).verdict).toBe("stale");
    const cited = await signAntigenEntry({ nym: head.entry.nym, action: "un_kapae", parents: [head.entry.actCid], sealEpochCid: charter.head.epochCid }, [seats[0]!]);
    expect((await judgeNexusActPartial(courier(nexusActPartial(charter.aid, { family: "kapae", entry: cited })), at)).verdict).toBe("ready");
    // A board entry no quorum of the head signed never stands as a head: the fresh lift still reads ready beside it.
    const forged = await signAntigenEntry({ nym: head.entry.nym, action: "kapae", parents: [], sealEpochCid: charter.head.epochCid }, [await handOf(79)]);
    expect((await judgeNexusActPartial(courier(nexusActPartial(charter.aid, { family: "kapae", entry: lift })), { ...reader, board: { ...empty, antigen: [forged] } })).verdict).toBe("ready");
    // An entry whose ancestry this vessel cannot count never stands as a head, as the live writer reads the line.
    const orphan = await signAntigenEntry({ nym: head.entry.nym, action: "kapae", parents: [`sha256:${"ab".repeat(32)}`], sealEpochCid: charter.head.epochCid }, seats);
    expect((await judgeNexusActPartial(courier(nexusActPartial(charter.aid, { family: "kapae", entry: lift })), { ...reader, board: { ...empty, antigen: [orphan] } })).verdict).toBe("ready");
    // A present parent that cites an absent grandparent falls with it.
    const child = await signAntigenEntry({ nym: head.entry.nym, action: "un_kapae", parents: [orphan.actCid], sealEpochCid: charter.head.epochCid }, seats);
    expect((await judgeNexusActPartial(courier(nexusActPartial(charter.aid, { family: "kapae", entry: lift })), { ...reader, board: { ...empty, antigen: [orphan, child] } })).verdict).toBe("ready");
    // An uncounted copy of the same kapae on the board blocks nothing; a counted one reads replay.
    const once = nexusActPartial(charter.aid, { family: "kapae", entry: lift });
    expect((await judgeNexusActPartial(courier(once), { ...reader, board: { ...empty, antigen: [lift] } })).verdict).toBe("ready");
    const twice = (await cosignNexusActPartial(courier(once), reader, [seats[1]!])).act as { entry: KapaeAntigenEntry };
    expect((await judgeNexusActPartial(courier(once), { ...reader, board: { ...empty, antigen: [twice.entry] } })).verdict).toBe("replay");
  });
});

describe("roll anchor", () => {
  async function rolled() {
    const g0 = await seatedCharter({ seats: 2, threshold: 2, seed: 43 });
    const g1 = await g0.roll();
    const seats = await g1.signers();
    const reader: NexusPartialReader = { aid: g1.aid, head: g1.roster, closing: g0.roster, board: empty };
    const anchor = await signRollAnchor({ prevEpochCid: g0.head.epochCid, sealEpochCid: g1.head.epochCid,
      prevKeys: g0.keys, prevThreshold: g0.threshold, parents: [] }, [seats[0]!]);
    return { g0, g1, seats, reader, anchor, partial: courier(nexusActPartial(g1.aid, { family: "roll-anchor", anchor })) };
  }

  test("the opened epoch's seats sign across vaults, and the grown anchor counts under the opened roster", async () => {
    const { g1, seats, reader, partial } = await rolled();
    expect((await judgeNexusActPartial(partial, reader)).verdict).toBe("ready");
    const grown = await cosignNexusActPartial(partial, reader, [seats[1]!]);
    expect((await judgeNexusActPartial(courier(grown), reader)).verdict).toBe("complete");
    expect(await rollAnchorCounts((grown.act as { anchor: RollAnchor }).anchor, g1.roster)).toBe(true);
  });

  test("no closed roster, another closed seat-set, another opened epoch, or moved heads refuse before a hand signs", async () => {
    const { g0, g1, seats, reader, anchor, partial } = await rolled();
    const calls = { n: 0 };
    const b = counting(seats[1]!, calls);
    const { closing: _c, ...noClosing } = reader;
    expect((await judgeNexusActPartial(partial, noClosing)).verdict).toBe("unavailable");
    const landed = (await cosignNexusActPartial(partial, reader, [seats[1]!])).act as { anchor: RollAnchor };
    expect((await judgeNexusActPartial(partial, { ...reader, board: { ...empty, anchors: [landed.anchor] } })).verdict).toBe("replay");
    expect((await judgeNexusActPartial(partial, { ...reader, board: { ...empty, anchors: [anchor] } })).verdict).toBe("ready");
    const others = await signRollAnchor({ ...anchor, prevKeys: [await keyOf(91), await keyOf(92)] }, [seats[0]!]);
    expect((await judgeNexusActPartial(courier(nexusActPartial(g1.aid, { family: "roll-anchor", anchor: others })), reader)).verdict).toBe("invalid");
    expect((await judgeNexusActPartial(partial, { ...reader, head: (await g1.roll()).roster })).verdict).toBe("stale");
    const g0Seats = await g0.signers();
    const operator = await handOf(52);
    const admit = await signCarriageQuorum({ nym: operator.signer, action: "admit", parents: [], sealEpochCid: g0.head.epochCid }, g0Seats,
      await signCarriageContract(operator.signer, g0.head.epochCid, operator.sign));
    const moved = { ...reader, board: { ...empty, carriage: [admit] } };
    expect((await judgeNexusActPartial(partial, moved)).verdict).toBe("stale");
    for (const at of [noClosing, moved]) await expect(cosignNexusActPartial(partial, at, [b])).rejects.toBeInstanceOf(NexusPartialRefusal);
    expect(calls.n).toBe(0);
    // CONTROL: the anchor that cites the moved head reads ready.
    const cites = await signRollAnchor({ ...anchor, parents: [carriageEntryActCid(admit)] }, [seats[0]!]);
    expect((await judgeNexusActPartial(courier(nexusActPartial(g1.aid, { family: "roll-anchor", anchor: cites })), moved)).verdict).toBe("ready");
  });
});
