/**
 * presented-admit-leaf-proof.test.ts — the LEAF binds its presented admit to ONE socket, and the dialer derives
 * what it presents from a board it holds.
 *
 * Proven:
 *   · a leaf proof verifies for its own nonce, gate key, vessel key and admit CID;
 *   · CONTROLS: another nonce, gate key, vessel key or admit reads false; a signer other than `admit.nym`
 *     reads false, and so does a proof the persona ROOT signs;
 *   · `runPeerHandshake` signs the proof over the challenge it received, with the leaf signer alone;
 *   · ONE SOCKET, ONE FACE: a lar:auth carrying a presented admit beside the fleet edge fails the wire
 *     guard, and `buildAuthResponse` refuses to build one;
 *   · the CONTRACT slot is retired (Q1, strict): a lar:auth carrying `contractEdge` fails the guard whether or
 *     not it carries an admit — a vessel that presents a leaf to a Nexus presents no root-signed edge to it on
 *     any socket;
 *   · `presentedAdmitFromBoard` derives the admit head and a closed, tight lineage from a board with a
 *     re-admit after a revoke; CONTROL: with a concurrent revoke the presentation still derives and the
 *     verifier reads it `unsettled`; a board whose last act is a revoke presents nothing.
 */
import { describe, test, expect } from "vitest";
import {
  leafProofBytes, signLeafProof, verifyLeafProof, runPeerHandshake, buildAuthResponse, isLarAuthMsg,
  mkLarChallenge, type PresentedAdmit, type LarAuthMsg,
} from "../src/auth-wire.js";
import {
  carriageEntryActCid, presentedAdmitFromBoard, verifyPresentedAdmit, type CarriageEntry,
} from "../src/carriage-registry.js";
import { makeMultiSigQuorumVerifier } from "../src/kapae-antigen.js";
import { PRESENTED_ADMIT_LEAF_PROOF_DOMAIN, AUTH_PROOF_DOMAIN } from "../src/domains.js";
import { pubOf, signerOf, kahuRoster, carriageAct } from "./fixtures/carriage.js";

const EPOCH = "epoch-cid-genesis";
const SEEDS = {
  guru:     new Uint8Array(32).fill(1),
  telarus:  new Uint8Array(32).fill(2),
  lindwyrm: new Uint8Array(32).fill(3),
  leaf:     new Uint8Array(32).fill(5),
  root:     new Uint8Array(32).fill(6),
  vessel:   new Uint8Array(32).fill(8),
  other:    new Uint8Array(32).fill(9),
  gate:     new Uint8Array(32).fill(10),
};
const KAHU = [SEEDS.guru, SEEDS.telarus];
const NONCE = "ab".repeat(32);

const roster = () => kahuRoster([SEEDS.guru, SEEDS.telarus, SEEDS.lindwyrm], 2, EPOCH);
const act = (action: "admit" | "revoke", parents: readonly string[] = [], subject = SEEDS.leaf) =>
  carriageAct(subject, action, { kahu: KAHU, epoch: EPOCH, parents });
const cid = (e: CarriageEntry) => carriageEntryActCid(e);

async function proven(admit: CarriageEntry, over: { nonce?: string; gate?: Uint8Array; vessel?: Uint8Array; signer?: Uint8Array } = {}): Promise<PresentedAdmit> {
  const leafProof = await signLeafProof({
    admit, nonce: over.nonce ?? NONCE, gatePubKey: await pubOf(over.gate ?? SEEDS.gate),
    vesselKey: await pubOf(over.vessel ?? SEEDS.vessel), sign: signerOf(over.signer ?? SEEDS.leaf),
  });
  return { admit, lineage: [], leafProof };
}

async function check(presentedAdmit: PresentedAdmit, over: { nonce?: string; gate?: Uint8Array; vessel?: Uint8Array } = {}) {
  return verifyLeafProof({
    presentedAdmit, nonce: over.nonce ?? NONCE,
    gatePubKey: await pubOf(over.gate ?? SEEDS.gate), vesselKey: await pubOf(over.vessel ?? SEEDS.vessel),
  });
}

describe("the leaf proof binds a presented admit to one socket", () => {
  test("verifies for its own nonce, gate key, vessel key and admit CID", async () => {
    const admit = await act("admit");
    expect(await check(await proven(admit))).toBe(true);
  });

  test("CONTROL: another nonce, gate key or vessel key reads false", async () => {
    const p = await proven(await act("admit"));
    expect(await check(p)).toBe(true);
    expect(await check(p, { nonce: "cd".repeat(32) })).toBe(false);
    expect(await check(p, { gate: SEEDS.other })).toBe(false);
    expect(await check(p, { vessel: SEEDS.other })).toBe(false);
  });

  test("CONTROL: the proof lifted onto another admit reads false", async () => {
    const first  = await act("admit");
    const second = await act("admit", [cid(await act("revoke", [cid(first)]))]);
    expect(cid(first)).not.toBe(cid(second));
    const p = await proven(first);
    expect(await check({ ...p, admit: second })).toBe(false);
  });

  test("CONTROL: a signer other than admit.nym reads false — the persona ROOT included", async () => {
    const admit = await act("admit");
    expect(await check(await proven(admit, { signer: SEEDS.other }))).toBe(false);
    expect(await check(await proven(admit, { signer: SEEDS.root }))).toBe(false);
    expect(await check(await proven(admit, { signer: SEEDS.vessel }))).toBe(false);
  });

  test("CONTROL: an absent or malformed proof reads false", async () => {
    const admit = await act("admit");
    expect(await check({ admit, lineage: [] })).toBe(false);
    expect(await check({ admit, lineage: [], leafProof: "zz" })).toBe(false);
  });

  test("the proof bytes open on their own domain, apart from the V3 proof", () => {
    expect(PRESENTED_ADMIT_LEAF_PROOF_DOMAIN).not.toBe(AUTH_PROOF_DOMAIN);
    const text = new TextDecoder().decode(leafProofBytes({ nonce: NONCE, gatePubKey: "a".repeat(64), vesselKey: "b".repeat(64), admitCid: "c".repeat(64) }));
    expect(text).toContain(PRESENTED_ADMIT_LEAF_PROOF_DOMAIN);
    // No clock and no root ride the bytes.
    expect(Object.keys(JSON.parse(text)).sort()).toEqual(["admitCid", "domain", "gatePubKey", "nonce", "vesselKey"]);
  });
});

describe("the handshake signs the leaf proof over the challenge it received", () => {
  test("runPeerHandshake attaches a proof the gate's own values verify", async () => {
    const admit = await act("admit");
    const gatePubKey = await pubOf(SEEDS.gate);
    const vesselKey  = await pubOf(SEEDS.vessel);
    const inbox: unknown[] = [mkLarChallenge(NONCE, gatePubKey), { type: "lar:auth-ok" }];
    let sent: LarAuthMsg | null = null;
    const verdict = await runPeerHandshake({
      recv: async () => inbox.shift(), send: (m) => { sent = m; },
      contactCard: "{}", peerPubKey: vesselKey, gatePubKey, aud: "lar:///x",
      sign: signerOf(SEEDS.vessel), presentedAdmit: { admit, lineage: [] }, leafSign: signerOf(SEEDS.leaf),
      now: () => "2026-10-06T00:00:00.000Z",
    });
    expect(verdict.ok).toBe(true);
    const msg = sent as unknown as LarAuthMsg;
    expect(isLarAuthMsg(msg)).toBe(true);
    expect(msg.presentedAdmit?.leafProof).toMatch(/^[0-9a-f]{128}$/);
    expect(await verifyLeafProof({ presentedAdmit: msg.presentedAdmit!, nonce: NONCE, gatePubKey, vesselKey })).toBe(true);
    // CONTROL: the same proof read against another nonce fails — the challenge is the freshness.
    expect(await verifyLeafProof({ presentedAdmit: msg.presentedAdmit!, nonce: "cd".repeat(32), gatePubKey, vesselKey })).toBe(false);
  });

  test("CONTROL: without a leaf signer the admit travels unproven", async () => {
    const admit = await act("admit");
    const inbox: unknown[] = [mkLarChallenge(NONCE), { type: "lar:auth-ok" }];
    let sent: LarAuthMsg | null = null;
    await runPeerHandshake({
      recv: async () => inbox.shift(), send: (m) => { sent = m; },
      contactCard: "{}", peerPubKey: await pubOf(SEEDS.vessel), gatePubKey: await pubOf(SEEDS.gate), aud: "lar:///x",
      sign: signerOf(SEEDS.vessel), presentedAdmit: { admit, lineage: [] },
    });
    expect((sent as unknown as LarAuthMsg).presentedAdmit?.leafProof).toBeUndefined();
  });
});

describe("ONE SOCKET, ONE FACE — a presented admit never travels beside a root-signed edge", () => {
  const edge = { kind: "x" } as unknown as LarAuthMsg["edge"];

  test("the wire guard refuses a lar:auth carrying an admit beside the fleet edge", async () => {
    const presentedAdmit = await proven(await act("admit"));
    const base = { type: "lar:auth", contactCard: "{}", nonce: NONCE, sig: "00" } as const;
    expect(isLarAuthMsg({ ...base, presentedAdmit })).toBe(true);                       // control
    expect(isLarAuthMsg({ ...base, edge })).toBe(true);                                 // control
    expect(isLarAuthMsg({ ...base, presentedAdmit, edge })).toBe(false);
  });

  test("the CONTRACT slot is retired — a lar:auth carrying `contractEdge` fails the guard, admit or no admit", async () => {
    const presentedAdmit = await proven(await act("admit"));
    const base = { type: "lar:auth", contactCard: "{}", nonce: NONCE, sig: "00" } as const;
    expect(isLarAuthMsg(base)).toBe(true);                                              // control: the card alone
    expect(isLarAuthMsg({ ...base, contractEdge: edge })).toBe(false);
    expect(isLarAuthMsg({ ...base, presentedAdmit, contractEdge: edge })).toBe(false);
  });

  test("buildAuthResponse refuses to build an admit beside the fleet edge, and never names a contract slot", async () => {
    const presentedAdmit = await proven(await act("admit"));
    const parts = {
      contactCard: "{}", nonce: NONCE, gatePubKey: "a".repeat(64), peerPubKey: "b".repeat(64), aud: "lar:///x",
      ts: "2026-10-06T00:00:00.000Z", sign: signerOf(SEEDS.vessel),
    };
    const built = await buildAuthResponse({ ...parts, presentedAdmit });
    expect(built).toMatchObject({ presentedAdmit });                                    // control
    expect("contractEdge" in built).toBe(false);
    await expect(buildAuthResponse({ ...parts, presentedAdmit, edge })).rejects.toThrow(/one socket, one face/);
  });
});

describe("presentedAdmitFromBoard — the dialer derives its presentation from a board it holds", () => {
  const verify = async (p: { admit: CarriageEntry; lineage: readonly CarriageEntry[] }, denyBoard: CarriageEntry[]) =>
    verifyPresentedAdmit({
      admit: p.admit, lineage: p.lineage, roster: await roster(), denyBoard, antigen: [],
      antigenRoster: await kahuRoster([SEEDS.other], 1, EPOCH), antigenVerifier: makeMultiSigQuorumVerifier(),
    });

  test("a re-admit after a revoke presents the head and its closed, tight lineage", async () => {
    const first   = await act("admit");
    const revoke  = await act("revoke", [cid(first)]);
    const readmit = await act("admit", [cid(revoke)]);
    const stranger = await act("admit", [], SEEDS.other);   // another nym's act never joins the lineage
    const board = [stranger, readmit, first, revoke];
    const p = await presentedAdmitFromBoard(board, await pubOf(SEEDS.leaf), await roster());
    expect(p).not.toBeNull();
    expect(cid(p!.admit)).toBe(cid(readmit));
    expect(p!.lineage.map(cid).sort()).toEqual([cid(first), cid(revoke)].sort());
    expect((await verify(p!, board)).state).toBe("held");
  });

  test("CONTROL: a revoke concurrent with the admit still presents, and the verifier reads it unsettled", async () => {
    const admit      = await act("admit");
    const concurrent = await act("revoke", []);   // cites nothing — neither ancestor nor descendant
    const board = [admit, concurrent];
    const p = await presentedAdmitFromBoard(board, await pubOf(SEEDS.leaf), await roster());
    expect(p).not.toBeNull();
    expect(cid(p!.admit)).toBe(cid(admit));
    expect((await verify(p!, board)).state).toBe("unsettled");
  });

  test("CONTROL: a board whose last act is a revoke presents nothing; an uncounted admit presents nothing", async () => {
    const admit  = await act("admit");
    const revoke = await act("revoke", [cid(admit)]);
    expect(await presentedAdmitFromBoard([admit, revoke], await pubOf(SEEDS.leaf), await roster())).toBeNull();
    // An admit at another epoch does not count against this roster.
    const foreign = await carriageAct(SEEDS.leaf, "admit", { kahu: KAHU, epoch: "another-epoch" });
    expect(await presentedAdmitFromBoard([foreign], await pubOf(SEEDS.leaf), await roster())).toBeNull();
    expect(await presentedAdmitFromBoard([], await pubOf(SEEDS.leaf), await roster())).toBeNull();
  });
});
