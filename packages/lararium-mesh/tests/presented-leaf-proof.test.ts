/**
 * presented-leaf-proof.test.ts — the LEAF binds what it presents to ONE socket, and the dialer derives the admit
 * it presents from a board it holds.
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
 *   · the one presenter (`presentationFromBoardDoc`) derives the admit head and a closed, tight lineage from a board with a
 *     re-admit after a revoke; CONTROL: with a concurrent revoke the presentation still derives and the
 *     verifier reads it `unsettled`; a board whose last act is a revoke presents nothing.
 */
import { describe, test, expect } from "vitest";
import {
  leafProofBytes, signLeafProof, verifyLeafProof, runPeerHandshake, buildAuthResponse, isLarAuthMsg,
  mkLarChallenge, mkLarAuthOk, authOkBytes, type Presented, type LarAuthMsg,
} from "../src/auth-wire.js";
import {
  carriageEntryActCid, verifyPresentedAdmit, type CarriageEntry,
} from "../src/carriage-registry.js";
import { presentationFromBoardDoc, writeCarriageEntry } from "../src/carriage-board.js";
import { emptyLarDoc } from "../src/base-doc.js";
import { makeMultiSigQuorumVerifier } from "../src/kapae-antigen.js";
import { PRESENTED_LEAF_PROOF_DOMAIN, AUTH_PROOF_DOMAIN } from "../src/domains.js";
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

async function proven(admit: CarriageEntry, over: { nonce?: string; gate?: Uint8Array; vessel?: Uint8Array; signer?: Uint8Array } = {}): Promise<Presented> {
  const leafProof = await signLeafProof({
    presented: { kind: "admit", admit, lineage: [] }, nonce: over.nonce ?? NONCE, gatePubKey: await pubOf(over.gate ?? SEEDS.gate),
    vesselKey: await pubOf(over.vessel ?? SEEDS.vessel), sign: signerOf(over.signer ?? SEEDS.leaf),
  });
  return { kind: "admit", admit, lineage: [], leafProof };
}

async function check(presented: Presented, over: { nonce?: string; gate?: Uint8Array; vessel?: Uint8Array } = {}) {
  return verifyLeafProof({
    presented, nonce: over.nonce ?? NONCE,
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
    expect(await check({ kind: "admit", admit, lineage: [] })).toBe(false);
    expect(await check({ kind: "admit", admit, lineage: [], leafProof: "zz" })).toBe(false);
  });

  test("the proof bytes open on their own domain, apart from the V3 proof", () => {
    expect(PRESENTED_LEAF_PROOF_DOMAIN).not.toBe(AUTH_PROOF_DOMAIN);
    const text = new TextDecoder().decode(leafProofBytes({ nonce: NONCE, gatePubKey: "a".repeat(64), vesselKey: "b".repeat(64), presentedCid: "c".repeat(64) }));
    expect(text).toContain(PRESENTED_LEAF_PROOF_DOMAIN);
    // No clock and no root ride the bytes.
    expect(Object.keys(JSON.parse(text)).sort()).toEqual(["domain", "gatePubKey", "nonce", "presentedCid", "vesselKey"]);
  });
});

describe("the handshake signs the leaf proof over the challenge it received", () => {
  test("runPeerHandshake attaches a proof the gate's own values verify", async () => {
    const admit = await act("admit");
    const gatePubKey = await pubOf(SEEDS.gate);
    const vesselKey  = await pubOf(SEEDS.vessel);
    let sent: LarAuthMsg | null = null;
    // The gate's verdict, signed by its own key over the leaf's own nonce — the only pass a leaf reads.
    const inbox: Array<() => Promise<unknown>> = [
      async () => mkLarChallenge(NONCE),
      async () => mkLarAuthOk(await signerOf(SEEDS.gate)(authOkBytes({
        nonce: NONCE, leafNonce: (sent as unknown as LarAuthMsg).leafNonce, gatePubKey, peerPubKey: vesselKey, aud: "lar:///x",
      }))),
    ];
    const verdict = await runPeerHandshake({
      recv: () => inbox.shift()!(), send: (m) => { sent = m; },
      contactCard: "{}", peerPubKey: vesselKey, gatePubKey, aud: "lar:///x",
      sign: signerOf(SEEDS.vessel), presented: { kind: "admit", admit, lineage: [] }, leafSign: signerOf(SEEDS.leaf),
    });
    expect(verdict.ok).toBe(true);
    const msg = sent as unknown as LarAuthMsg;
    expect(isLarAuthMsg(msg)).toBe(true);
    expect(msg.presented?.leafProof).toMatch(/^[0-9a-f]{128}$/);
    expect(await verifyLeafProof({ presented: msg.presented!, nonce: NONCE, gatePubKey, vesselKey })).toBe(true);
    // CONTROL: the same proof read against another nonce fails — the challenge is the freshness.
    expect(await verifyLeafProof({ presented: msg.presented!, nonce: "cd".repeat(32), gatePubKey, vesselKey })).toBe(false);
  });

  test("CONTROL: without a leaf signer nothing is presented — an unproven presentation binds to no socket", async () => {
    const admit = await act("admit");
    const inbox: unknown[] = [mkLarChallenge(NONCE), { type: "lar:auth-ok" }];
    let sent: LarAuthMsg | null = null;
    await runPeerHandshake({
      recv: async () => inbox.shift(), send: (m) => { sent = m; },
      contactCard: "{}", peerPubKey: await pubOf(SEEDS.vessel), gatePubKey: await pubOf(SEEDS.gate), aud: "lar:///x",
      sign: signerOf(SEEDS.vessel), presented: { kind: "admit", admit, lineage: [] },
    });
    expect((sent as unknown as LarAuthMsg).presented).toBeUndefined();
  });
});

describe("ONE SOCKET, ONE FACE — a presented admit never travels beside a root-signed edge", () => {
  const edge = { kind: "x" } as unknown as LarAuthMsg["edge"];

  test("the wire guard refuses a lar:auth carrying an admit beside the fleet edge", async () => {
    const presented = await proven(await act("admit"));
    const base = { type: "lar:auth", contactCard: "{}", nonce: NONCE, leafNonce: "ef".repeat(32), sig: "00" } as const;
    expect(isLarAuthMsg({ ...base, presented })).toBe(true);                            // control
    expect(isLarAuthMsg({ ...base, edge })).toBe(true);                                 // control
    expect(isLarAuthMsg({ ...base, presented, edge })).toBe(false);
  });

  test("the CONTRACT slot is retired — a lar:auth carrying `contractEdge` fails the guard, admit or no admit", async () => {
    const presented = await proven(await act("admit"));
    const base = { type: "lar:auth", contactCard: "{}", nonce: NONCE, leafNonce: "ef".repeat(32), sig: "00" } as const;
    expect(isLarAuthMsg(base)).toBe(true);                                              // control: the card alone
    expect(isLarAuthMsg({ ...base, contractEdge: edge })).toBe(false);
    expect(isLarAuthMsg({ ...base, presented, contractEdge: edge })).toBe(false);
  });

  test("buildAuthResponse refuses to build an admit beside the fleet edge, and never names a contract slot", async () => {
    const presented = await proven(await act("admit"));
    const parts = {
      contactCard: "{}", nonce: NONCE, gatePubKey: "a".repeat(64), peerPubKey: "b".repeat(64), aud: "lar:///x",
      leafNonce: "ef".repeat(32), sign: signerOf(SEEDS.vessel),
    };
    const built = await buildAuthResponse({ ...parts, presented });
    expect(built).toMatchObject({ presented });                                         // control
    expect("contractEdge" in built).toBe(false);
    await expect(buildAuthResponse({ ...parts, presented, edge })).rejects.toThrow(/one socket, one face/);
  });
});

describe("the one presenter — the dialer derives its presentation from a board it holds", () => {
  /** The presentation off a board doc carrying exactly these acts. */
  const presentOff = async (acts: readonly CarriageEntry[]) => {
    const doc = emptyLarDoc();
    for (const a of acts) writeCarriageEntry(doc, a);
    return (await presentationFromBoardDoc(doc, await pubOf(SEEDS.leaf), await roster())).presentation;
  };
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
    const p = await presentOff(board);
    expect(p).not.toBeNull();
    expect(cid(p!.admit)).toBe(cid(readmit));
    expect(p!.lineage.map(cid).sort()).toEqual([cid(first), cid(revoke)].sort());
    expect((await verify(p!, board)).state).toBe("held");
  });

  test("CONTROL: a revoke concurrent with the admit still presents, and the verifier reads it unsettled", async () => {
    const admit      = await act("admit");
    const concurrent = await act("revoke", []);   // cites nothing — neither ancestor nor descendant
    const board = [admit, concurrent];
    const p = await presentOff(board);
    expect(p).not.toBeNull();
    expect(cid(p!.admit)).toBe(cid(admit));
    expect((await verify(p!, board)).state).toBe("unsettled");
  });

  test("CONTROL: a board whose last act is a revoke presents nothing; an uncounted admit presents nothing", async () => {
    const admit  = await act("admit");
    const revoke = await act("revoke", [cid(admit)]);
    expect(await presentOff([admit, revoke])).toBeNull();
    // An admit at another epoch does not count against this roster.
    const foreign = await carriageAct(SEEDS.leaf, "admit", { kahu: KAHU, epoch: "another-epoch" });
    expect(await presentOff([foreign])).toBeNull();
    expect(await presentOff([])).toBeNull();
  });
});

describe("one relation across every arm — the grant and token arms prove under their own leaf", () => {
  const grantArm = async (): Promise<Presented> => ({
    kind: "grant",
    grant: { nexusAid: "epoch0-" + "a".repeat(64), leaf: await pubOf(SEEDS.leaf), epoch: "e".repeat(64), lineage: "d".repeat(64), survived: 0, from: "host", tag: "f".repeat(128) },
  });
  const tokenArm = async (): Promise<Presented> => ({
    kind: "token", nexusAid: "epoch0-" + "a".repeat(64),
    token: { purpose: "host-invite", n: "ab".repeat(32), y: "cd".repeat(64) }, claim: "12".repeat(32), leaf: await pubOf(SEEDS.leaf),
  });
  const sign = async (arm: Presented, signer: Uint8Array) => ({
    ...arm, leafProof: await signLeafProof({ presented: arm, nonce: NONCE, gatePubKey: await pubOf(SEEDS.gate), vesselKey: await pubOf(SEEDS.vessel), sign: signerOf(signer) }),
  }) as Presented;
  const holds = async (arm: Presented) => verifyLeafProof({ presented: arm, nonce: NONCE, gatePubKey: await pubOf(SEEDS.gate), vesselKey: await pubOf(SEEDS.vessel) });

  test("each arm's proof verifies under its own leaf, and under no other hand", async () => {
    for (const arm of [await grantArm(), await tokenArm()]) {
      expect(isLarAuthMsg({ type: "lar:auth", contactCard: "{}", nonce: NONCE, leafNonce: "ef".repeat(32), sig: "00", presented: await sign(arm, SEEDS.leaf) })).toBe(true);
      expect(await holds(await sign(arm, SEEDS.leaf))).toBe(true);
      expect(await holds(await sign(arm, SEEDS.root))).toBe(false);
    }
  });

  test("a proof lifted from one arm onto another never verifies — the arms' CIDs differ by kind", async () => {
    const grant = await sign(await grantArm(), SEEDS.leaf);
    const token = await tokenArm();
    expect(await holds({ ...token, leafProof: grant.leafProof } as Presented)).toBe(false);
  });

  test("a malformed grant or token arm fails the wire guard", async () => {
    const base = { type: "lar:auth", contactCard: "{}", nonce: NONCE, leafNonce: "ef".repeat(32), sig: "00" } as const;
    const g = await grantArm() as Extract<Presented, { kind: "grant" }>;
    const t = await tokenArm() as Extract<Presented, { kind: "token" }>;
    expect(isLarAuthMsg({ ...base, presented: { ...g, grant: { ...g.grant, survived: -1 } } })).toBe(false);
    expect(isLarAuthMsg({ ...base, presented: { ...t, token: { ...t.token, purpose: "anyone" } } })).toBe(false);
    expect(isLarAuthMsg({ ...base, presented: { ...t, claim: "zz" } })).toBe(false);
  });
});
