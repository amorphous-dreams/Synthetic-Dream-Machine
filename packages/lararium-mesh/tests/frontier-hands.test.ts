import { describe, expect, test } from "vitest";
import * as ed from "@noble/ed25519";
import { emptyLarDoc } from "../src/base-doc.js";
import { hex } from "../src/crypto.js";
import { charterHandLineage } from "../src/charter-hand-lineage.js";
import { signGenesisFrontier } from "../src/edge-frontier.js";
import { writeEdgeFrontier, writeFrontierSnapshot } from "../src/edge-frontier-board.js";
import { holderHand, holderLineage, prepareHolderFrontier, readHolderFrontier, readRealmBoardFrontiers, waitingVouchers, landRealmGenesis, registerHandFrontierInto } from "../src/realm-frontier.js";
import { seatedCharter } from "./charter-fixture.js";

const REALM = "ab".repeat(32);
const hand = async (n: number) => { const seed = new Uint8Array(32).fill(n); return { key: hex(await ed.getPublicKeyAsync(seed)), sign: async (bytes: Uint8Array) => hex(await ed.signAsync(bytes, seed)) }; };

describe("realm board hands", () => {
  test("holder waits for its own genesis; its head cannot omit a seen raise or borrow quorum or stranger signatures", async () => {
    const board = emptyLarDoc(), voucher = await hand(91), stranger = await hand(92);
    const edgeIds = new Set(["edge"]), counted = [{ edgeId: "edge", hand: "holder" as const, raised: true, actCid: "raise" }];
    const read = () => readHolderFrontier({ realm: REALM, board, voucher: voucher.key, edgeIds, counted, pinned: null });
    expect(read()).toMatchObject({ status: "unknown", missing: [{ why: "no-frontier" }] });
    const charter = await seatedCharter({ seats: 2, threshold: 2, seed: 90 });
    await landRealmGenesis(board, REALM, charterHandLineage(charter.chain)!.lineage, (await charter.signers()).map((s) => ({ key: s.signer, sign: s.sign })));
    expect(read().status).toBe("unknown");
    const roster = holderLineage(voucher.key)[0]!;
    const forged = await signGenesisFrontier({ board: REALM, hand: holderHand(voucher.key), epoch: 0, rosterHash: roster.rosterHash }, [stranger]);
    writeFrontierSnapshot(board, []); writeEdgeFrontier(board, forged);
    expect(read()).toMatchObject({ status: "unknown", missing: [{ why: "below-threshold" }] });
    const prepared = await prepareHolderFrontier({ realm: REALM, board, voucher: voucher.key, counted: [], signer: voucher });
    registerHandFrontierInto(board, prepared);
    expect(read()).toMatchObject({ status: "unknown", missing: [{ why: "withholds-seen-raise" }] });
    expect(readHolderFrontier({ realm: REALM, board, voucher: voucher.key, edgeIds, counted: [], pinned: null }).status).toBe("known");
  });

  test("the board reports only the voucher whose own frontier has not arrived", async () => {
    const board = emptyLarDoc(), charter = await seatedCharter({ seats: 2, threshold: 2, seed: 93 });
    const lineage = charterHandLineage(charter.chain)!.lineage;
    await landRealmGenesis(board, REALM, lineage, (await charter.signers()).map((s) => ({ key: s.signer, sign: s.sign })));
    const first = await hand(94), second = await hand(95);
    registerHandFrontierInto(board, await prepareHolderFrontier({ realm: REALM, board, voucher: first.key, counted: [], signer: first }));
    const read = readRealmBoardFrontiers({ realm: REALM, board, quorumLineage: lineage, vouchers: new Map([[first.key, new Set<string>()], [second.key, new Set<string>()]]), counted: [], pins: {} });
    expect(read.quorum.status).toBe("known");
    expect(read.holders.get(first.key)?.status).toBe("known");
    expect(read.holders.get(second.key)?.status).toBe("unknown");
    expect(waitingVouchers(read)).toEqual([second.key]);
  });
});
