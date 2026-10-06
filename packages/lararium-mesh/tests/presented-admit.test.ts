/**
 * presented-admit.test.ts — the PRESENTED-ADMIT verifier: a subject carries its own quorum-signed admit plus
 * that admit's causal lineage, and the verifier checks it against a DENY-only board (revokes) and the Kapae
 * antigen. No allow roster is ever folded.
 *
 * Proven:
 *   · a counted admit with a chaining lineage and no closing evidence reads HELD,
 *   · a counted revoke descending from the admit reads DENIED,
 *   · a revoke the admit's lineage covers (re-admit after revoke) does not close it — HELD,
 *   · a revoke concurrent with the admit reads UNSETTLED (a contradiction never grants),
 *   · an admit rooted on a non-head charter epoch reads WRONG-EPOCH,
 *   · a held kapae on the nym reads DENIED; an un_kapae head lifts it,
 *   · a tampered quorum signature, and a lineage that does not chain, read REJECTED,
 *   · a board admit grants nothing (the anti-roster pin), and a place `carry` never satisfies an admit,
 *   · the verifier region of the source names no clock.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hexToBytes } from "../src/crypto.js";
import {
  signCarriageQuorum, carriageEntryActCid, carriageEntryCounts,
  verifyPresentedAdmit, type CarriageEntry, type QuorumSignature,
} from "../src/carriage-registry.js";
import {
  signAntigenEntry, makeMultiSigQuorumVerifier, type KahuRoster, type KapaeAntigenEntry,
} from "../src/kapae-antigen.js";
import { pubOf, kahuRoster, kahuSigners as signersOf, carriageAct } from "./fixtures/carriage.js";

const EPOCH      = "epoch-cid-genesis";
const NEXT_EPOCH = "epoch-cid-after-roll";

const SEEDS = {
  guru:      new Uint8Array(32).fill(1),
  telarus:   new Uint8Array(32).fill(2),
  lindwyrm:  new Uint8Array(32).fill(3),
  joiner:    new Uint8Array(32).fill(5),
  stranger:  new Uint8Array(32).fill(7),
  place:     new Uint8Array(32).fill(9),
  // The antigen quorum stands apart from the membership quorum: its own keys, its own roster.
  warden1:   new Uint8Array(32).fill(11),
  warden2:   new Uint8Array(32).fill(12),
};
function roster(sealEpochCid = EPOCH): Promise<KahuRoster> {
  return kahuRoster([SEEDS.guru, SEEDS.telarus, SEEDS.lindwyrm], 2, sealEpochCid);
}

/** The antigen roster stands on the wardens' own keys, never the membership quorum's. */
function antigenRoster(): Promise<KahuRoster> {
  return kahuRoster([SEEDS.warden1, SEEDS.warden2], 2, EPOCH);
}

function kahuSigners(seeds: Uint8Array[] = [SEEDS.guru, SEEDS.telarus]) {
  return signersOf(seeds);
}

async function act(
  action: "admit" | "revoke",
  parents: readonly string[] = [],
  opts: { subject?: Uint8Array; epoch?: string; contract?: QuorumSignature } = {},
): Promise<CarriageEntry> {
  return carriageAct(opts.subject ?? SEEDS.joiner, action, {
    kahu: [SEEDS.guru, SEEDS.telarus], epoch: opts.epoch ?? EPOCH, parents,
    ...(action === "admit" && opts.contract ? { seal: opts.contract } : {}),
  });
}

async function kapae(action: "kapae" | "un_kapae", parents: readonly string[] = [],
                     wardens: Uint8Array[] = [SEEDS.warden1, SEEDS.warden2]): Promise<KapaeAntigenEntry> {
  return signAntigenEntry(
    { nym: await pubOf(SEEDS.joiner), action, parents, sealEpochCid: EPOCH },
    await kahuSigners(wardens),
  );
}

const cid = (e: CarriageEntry) => carriageEntryActCid(e);

/** Flip one hex nibble of a signature, returning the tampered hex. */
function flipSig(sig: string): string {
  return (sig[0] === "0" ? "1" : "0") + sig.slice(1);
}

async function verify(over: Partial<Parameters<typeof verifyPresentedAdmit>[0]> & { admit: CarriageEntry }) {
  return verifyPresentedAdmit({
    lineage:         [],
    roster:          await roster(),
    denyBoard:       [],
    antigen:         [],
    antigenRoster:   await antigenRoster(),
    antigenVerifier: makeMultiSigQuorumVerifier(),
    ...over,
  });
}

describe("verifyPresentedAdmit — the subject presents, the gate reads only denials", () => {
  test("a counted genesis admit with no closing evidence reads HELD", async () => {
    const admit = await act("admit");
    const v = await verify({ admit });
    expect(v.state).toBe("held");
    expect(v.nym).toBe(await pubOf(SEEDS.joiner));
  });

  test("a counted revoke that descends from the admit reads DENIED", async () => {
    const admit  = await act("admit");
    const revoke = await act("revoke", [cid(admit)]);
    expect(await verify({ admit })).toMatchObject({ state: "held" });   // control: the board decides it
    expect(await verify({ admit, denyBoard: [revoke] })).toMatchObject({ state: "denied" });
  });

  test("a revoke the admit's lineage covers (re-admit after revoke) does not close it — HELD", async () => {
    const first   = await act("admit");
    const revoke  = await act("revoke", [cid(first)]);
    const readmit = await act("admit", [cid(revoke)]);
    const v = await verify({ admit: readmit, lineage: [first, revoke], denyBoard: [revoke] });
    expect(v.state).toBe("held");
    // CONTROL: the same board closes the stale first admit.
    expect(await verify({ admit: first, denyBoard: [revoke] })).toMatchObject({ state: "denied" });
  });

  test("a revoke concurrent with the admit reads UNSETTLED and refuses", async () => {
    const root   = await act("admit");
    const admit  = await act("admit", [cid(root)]);
    const revoke = await act("revoke", [cid(root)]);   // neither ancestor of the other
    expect(await verify({ admit, lineage: [root], denyBoard: [revoke] })).toMatchObject({ state: "unsettled" });
    // A genesis revoke sharing no history with the admit is concurrent too.
    const orphanRevoke = await act("revoke", []);
    expect(await verify({ admit: root, denyBoard: [orphanRevoke] })).toMatchObject({ state: "unsettled" });
  });

  test("a revoke whose ancestry the gate cannot resolve reads UNSETTLED, never held", async () => {
    const admit  = await act("admit");
    const revoke = await act("revoke", ["ab".repeat(32)]);
    expect(await verify({ admit, denyBoard: [revoke] })).toMatchObject({ state: "unsettled" });
  });

  test("an admit rooted on a non-head charter epoch reads WRONG-EPOCH", async () => {
    const admit = await act("admit");
    expect(await verify({ admit })).toMatchObject({ state: "held" });   // control: at the head it holds
    expect(await verify({ admit, roster: await roster(NEXT_EPOCH) })).toMatchObject({ state: "wrong-epoch" });
  });

  test("a lineage entry rooted on a non-head charter epoch reads WRONG-EPOCH (no ancestry across a roll)", async () => {
    const old   = await act("admit", [], { epoch: NEXT_EPOCH });
    const admit = await act("admit", [cid(old)]);
    expect(await verify({ admit, lineage: [old] })).toMatchObject({ state: "wrong-epoch" });
  });

  test("a held kapae on the admit's nym reads DENIED", async () => {
    const admit = await act("admit");
    const ban   = await kapae("kapae");
    expect(await verify({ admit, antigen: [ban] })).toMatchObject({ state: "denied" });
  });

  test("CONTROL — an un_kapae head lifts the kapae", async () => {
    const admit = await act("admit");
    const ban   = await kapae("kapae");
    const lift  = await kapae("un_kapae", [ban.actCid]);
    expect(await verify({ admit, antigen: [ban, lift] })).toMatchObject({ state: "held" });
  });

  test("a concurrent kapae / un_kapae pair reads UNSETTLED (an unsettled deny refuses)", async () => {
    const admit = await act("admit");
    const ban   = await kapae("kapae");
    const lift  = await kapae("un_kapae", []);
    expect(await verify({ admit, antigen: [ban, lift] })).toMatchObject({ state: "unsettled" });
  });

  test("CONTROL — a kapae signed by the MEMBERSHIP quorum does not count under the antigen roster", async () => {
    const admit = await act("admit");
    const crossQuorum = await kapae("kapae", [], [SEEDS.guru, SEEDS.telarus]);
    expect(await verify({ admit, antigen: [crossQuorum] })).toMatchObject({ state: "held" });
  });

  test("a tampered quorum signature on the admit reads REJECTED", async () => {
    const admit = await act("admit");
    const tamperedSig = flipSig(admit.signatures[0]!.sig);
    expect(hexToBytes(tamperedSig)).not.toEqual(hexToBytes(admit.signatures[0]!.sig));   // bytes moved
    const tampered: CarriageEntry = {
      ...admit,
      signatures: [{ ...admit.signatures[0]!, sig: tamperedSig }, admit.signatures[1]!],
    };
    expect(await verify({ admit })).toMatchObject({ state: "held" });
    expect(await verify({ admit: tampered })).toMatchObject({ state: "rejected" });
  });

  test("a tampered quorum signature on a lineage entry reads REJECTED", async () => {
    const first   = await act("admit");
    const revoke  = await act("revoke", [cid(first)]);
    const readmit = await act("admit", [cid(revoke)]);
    const tamperedSig = flipSig(revoke.signatures[1]!.sig);
    expect(hexToBytes(tamperedSig)).not.toEqual(hexToBytes(revoke.signatures[1]!.sig));   // bytes moved
    const badRevoke: CarriageEntry = { ...revoke, signatures: [revoke.signatures[0]!, { ...revoke.signatures[1]!, sig: tamperedSig }] };
    expect(await verify({ admit: readmit, lineage: [first, badRevoke] })).toMatchObject({ state: "rejected" });
  });

  test("a lineage CID that does not chain reads REJECTED", async () => {
    const root  = await act("admit");
    const admit = await act("admit", [cid(root)]);
    const swapped = await act("revoke", []);   // validly signed, but not the act the admit cites
    expect(cid(swapped)).not.toBe(admit.parents[0]);   // the chained CID moved
    expect(await verify({ admit, lineage: [root] })).toMatchObject({ state: "held" });   // control
    expect(await verify({ admit, lineage: [swapped] })).toMatchObject({ state: "rejected" });
    // A missing link and an unrelated padding entry both break the chain.
    expect(await verify({ admit, lineage: [] })).toMatchObject({ state: "rejected" });
    expect(await verify({ admit, lineage: [root, swapped] })).toMatchObject({ state: "rejected" });
  });

  test("a lineage entry naming another nym reads REJECTED", async () => {
    const foreign = await act("admit", [], { subject: SEEDS.stranger });
    const admit   = await act("admit", [cid(foreign)]);
    expect(await verify({ admit, lineage: [foreign] })).toMatchObject({ state: "rejected" });
  });
});

describe("verifyPresentedAdmit — controls", () => {
  test("★ ANTI-ROSTER — an admit written only on the board, with nothing presented, grants nothing ★", async () => {
    const boardAdmit = await act("admit", [], { subject: SEEDS.stranger });
    expect(await carriageEntryCounts(boardAdmit, await roster())).toBe(true);   // the board admit is genuine
    // Nothing presented: the call refuses rather than consulting the board.
    const none = await verifyPresentedAdmit({
      admit: undefined as unknown as CarriageEntry, lineage: [], roster: await roster(), denyBoard: [boardAdmit],
      antigen: [], antigenRoster: await antigenRoster(), antigenVerifier: makeMultiSigQuorumVerifier(),
    });
    expect(none.state).toBe("rejected");
    // The stranger presents an admit missing its contract-in; the genuine board admit never rescues it.
    const unsigned = await signCarriageQuorum(
      { nym: boardAdmit.nym, action: "admit", parents: [], sealEpochCid: EPOCH }, await kahuSigners());
    expect(await verify({ admit: unsigned, denyBoard: [boardAdmit] })).toMatchObject({ state: "rejected" });
  });

  test("CONTROL — a board admit descending from a revoke never reopens a closed admit", async () => {
    const admit   = await act("admit");
    const revoke  = await act("revoke", [cid(admit)]);
    const readmit = await act("admit", [cid(revoke)]);   // sits on the board, never presented
    expect(await verify({ admit, denyBoard: [revoke, readmit] })).toMatchObject({ state: "denied" });
  });

  test("CONTROL — a place `carry` entry never satisfies an admit", async () => {
    const carry = await carriageAct(SEEDS.place, "carry", { kahu: [SEEDS.guru, SEEDS.telarus], epoch: EPOCH });
    expect(await carriageEntryCounts(carry, await roster())).toBe(true);   // it counts on its own fold
    expect(await verify({ admit: carry })).toMatchObject({ state: "rejected" });
  });

  test("CONTROL — a presented revoke never satisfies an admit", async () => {
    const revoke = await act("revoke");
    expect(await verify({ admit: revoke })).toMatchObject({ state: "rejected" });
  });

  test("★ THE TYPE PROMISES ONLY WHAT THE CODE RETURNS — declared states ≡ returned states ★", () => {
    const src = readFileSync(join(import.meta.dirname, "..", "src", "carriage-registry.ts"), "utf8");
    const decl = /export type PresentedAdmitState\s*=\s*([^;]+);/.exec(src);
    expect(decl, "the state union moved — re-aim this pin").not.toBeNull();
    const declared = new Set([...decl![1]!.matchAll(/"([a-z-]+)"/g)].map((m) => m[1]!));
    const region = src.slice(src.indexOf("// ── presented-admit verifier"));
    const returned = new Set([...region.matchAll(/presentedVerdict\("([a-z-]+)"/g)].map((m) => m[1]!));
    // CONTROL: both readers found states, so the equality below is not two empty sets.
    expect(declared.size).toBeGreaterThan(0);
    expect(returned.size).toBeGreaterThan(0);
    expect([...declared].sort()).toEqual([...returned].sort());
    expect([...returned].sort()).toEqual(["denied", "held", "rejected", "unsettled", "wrong-epoch"]);
  });

  test("★ NO CLOCK — the verifier region names no Date, now, performance or setTimeout ★", () => {
    const src = readFileSync(join(import.meta.dirname, "..", "src", "carriage-registry.ts"), "utf8");
    const marker = "// ── presented-admit verifier";
    const at = src.indexOf(marker);
    expect(at, "the region marker moved — re-aim this pin").toBeGreaterThan(0);
    const region = src.slice(at);
    expect(region).toContain("verifyPresentedAdmit");   // the region is the verifier, not an empty tail
    expect(region).not.toMatch(/\bDate\b|\bnow\b|performance|setTimeout/);
    expect(verifyPresentedAdmit.toString()).not.toMatch(/\bDate\b|\bnow\b|performance|setTimeout/);
    // CONTROL: the pattern catches a clock when one is present.
    expect("const t = Date.now();").toMatch(/\bDate\b|\bnow\b|performance|setTimeout/);
  });
});
