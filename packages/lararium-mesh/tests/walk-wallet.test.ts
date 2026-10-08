/**
 * walk-wallet.test.ts — the walker's wallet never hands out a dead invite.
 *
 * A hearth holds two epochs live — the current act and the one it rolled from — so a token minted two rolls back
 * can only meet silence. The wallet is pruned to those two epochs at every fill, and a hand-out takes the newest.
 *
 * Proven, the platform-blind walk client over an in-memory transport whose hearth answers the blind mint:
 *   · RED: a wallet holding tokens from e₀, e₁ and a grant at e₂ drops e₀ at the fill, mints e₂'s batch, and the
 *     invite it hands out verifies at the hearth's current epoch;
 *   · CONTROL: a wallet holding only live tokens loses none at the fill; RED: it hands out newest first.
 */
import { describe, test, expect } from "vitest";
import {
  mintHostingAct, mintHostToken, issueGrant, evaluateWalkerBatch, tokenVerifiesAt, decodeInvite, hostingActCid,
  type HostingEpoch, type HostingAct,
} from "../src/hosting.js";
import { walkOver, popInvite, HOSTING_MINT_SESSION_KIND, HOSTING_MINTED_SESSION_KIND, type WalkRecord, type WalkStore } from "../src/walk-client.js";
import type { LarSessionMsg, LeafIdentity } from "../src/auth-wire.js";

const AID = "epoch0-" + "a".repeat(64);
const GATE = "ee".repeat(32);
const HEARTH = new Uint8Array(32).fill(51);
const LEAF = { verifyingKey: "c".repeat(64), seed: new Uint8Array(32).fill(52) };
const BASE: LeafIdentity = { contactCard: "d".repeat(64), peerPubKey: "d".repeat(64), sign: async () => "00".repeat(64) };

function memoryStore(): WalkStore & { map: Map<string, WalkRecord> } {
  const map = new Map<string, WalkRecord>();
  return { map, async read(g) { return map.get(g) ?? null; }, async write(g, r) { map.set(g, structuredClone(r)); } };
}

/** Three hosting epochs, each rolling from the one before. */
async function chain(): Promise<[HostingEpoch, HostingEpoch, HostingEpoch]> {
  const e0 = await mintHostingAct({ leafSeed: HEARTH, nexusAid: AID, prev: null, cap: 3 });
  const e1 = await mintHostingAct({ leafSeed: HEARTH, nexusAid: AID, prev: e0.cid, cap: 3 });
  const e2 = await mintHostingAct({ leafSeed: HEARTH, nexusAid: AID, prev: e1.cid, cap: 3 });
  return [e0, e1, e2];
}

/** Ride a transport whose hearth evaluates every blind batch at `current`; fire one grant-bearing dial. */
async function fillAt(store: WalkStore, current: HostingEpoch, acts: readonly HostingAct[]): Promise<void> {
  const sessionListeners: Array<(m: LarSessionMsg) => void> = [];
  const candidates: Array<(e: { peerId: unknown }) => void> = [];
  const grant = (await store.read(GATE))!.grant!;
  const transport = {
    onSession: (l: (m: LarSessionMsg) => void) => { sessionListeners.push(l); return () => {}; },
    sendSession: (kind: string, body: unknown) => {
      if (kind === HOSTING_MINT_SESSION_KIND) {
        const answer = evaluateWalkerBatch(current, (body as { blinded: string[] }).blinded);
        queueMicrotask(() => { for (const l of sessionListeners) l({ type: "lar:session", kind: HOSTING_MINTED_SESSION_KIND, body: answer }); });
      }
      return true;
    },
    represent: () => {},
    on: (_e: "peer-candidate", l: (e: { peerId: unknown }) => void) => { candidates.push(l); },
    identity: { ...BASE, presented: { kind: "grant" as const, grant } },
  };
  walkOver({
    transport, store, gatePubKey: GATE, leaf: LEAF, base: BASE,
    actFor: async (cid) => acts.find((a) => hostingActCid(a) === cid) ?? null,
  });
  for (const l of candidates) l({ peerId: "hearth" });
  for (let i = 0; i < 100 && !(await store.read(GATE))?.wallet?.some((w) => w.epoch === current.cid); i++) {
    await new Promise((r) => setTimeout(r, 5));
  }
}

describe("the wallet never hands out a dead invite", () => {
  test("RED: a fill drops the token two rolls back, and the invite handed out verifies at the current epoch", async () => {
    const [e0, e1, e2] = await chain();
    const store = memoryStore();
    const grant = issueGrant(e2, { leaf: LEAF.verifyingKey, lineage: "1".repeat(64), survived: 0, from: "host" });
    await store.write(GATE, {
      nexusAid: AID, grant,
      wallet: [{ epoch: e0.cid, token: mintHostToken(e0) }, { epoch: e1.cid, token: mintHostToken(e1) }],
    });
    await fillAt(store, e2, [e0.act, e1.act, e2.act]);
    const wallet = (await store.read(GATE))!.wallet!;
    expect(wallet.map((w) => w.epoch)).not.toContain(e0.cid);
    expect(wallet.map((w) => w.epoch)).toContain(e1.cid);
    const handed = decodeInvite((await popInvite(store, GATE))!)!;
    expect(tokenVerifiesAt(e2, handed.token)).toBe(true);
  });

  test("CONTROL: a wallet of live tokens loses none at the fill; RED: it hands out newest first", async () => {
    const [e0, e1, e2] = await chain();
    const store = memoryStore();
    const grant = issueGrant(e2, { leaf: LEAF.verifyingKey, lineage: "2".repeat(64), survived: 0, from: "host" });
    const liveOld = mintHostToken(e1);
    await store.write(GATE, { nexusAid: AID, grant, wallet: [{ epoch: e1.cid, token: liveOld }] });
    await fillAt(store, e2, [e0.act, e1.act, e2.act]);
    const wallet = (await store.read(GATE))!.wallet!;
    expect(wallet[0]).toEqual({ epoch: e1.cid, token: liveOld });
    expect(wallet.at(-1)!.epoch).toBe(e2.cid);
    expect(tokenVerifiesAt(e2, decodeInvite((await popInvite(store, GATE))!)!.token)).toBe(true);
    expect(decodeInvite((await popInvite(store, GATE))!)!.token).toEqual(liveOld);
  });
});
