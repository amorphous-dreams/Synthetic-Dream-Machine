import { describe, expect, test } from "vitest";
import * as ed from "@noble/ed25519";
import { emptyLarDoc } from "../src/base-doc.js";
import { CABAL_INVITE_DOMAIN, type CabalInvite } from "../src/cabal-invite.js";
import { charterHandLineage } from "../src/charter-hand-lineage.js";
import { hex } from "../src/crypto.js";
import { realmAdmitBundle, readRealmAdmitBundle } from "../src/realm-admit-bundle.js";
import { landRealmGenesis, prepareHolderFrontier, prepareRealmFrontier, readRealmBoardFrontiers, registerHandFrontierInto } from "../src/realm-frontier.js";
import { seatedCharter } from "./charter-fixture.js";

const REALM = "ce".repeat(32);

describe("realm admit bundle", () => {
  test("a joiner without the board reads the carried heads, while a forged head and foreign realm wait", async () => {
    const charter = await seatedCharter({ seats: 2, threshold: 2, seed: 111 });
    const lineage = charterHandLineage(charter.chain)!.lineage, board = emptyLarDoc();
    const seats = (await charter.signers()).map((s) => ({ key: s.signer, sign: s.sign }));
    await landRealmGenesis(board, REALM, lineage, seats);
    registerHandFrontierInto(board, await prepareRealmFrontier({ realm: REALM, board, lineage, counted: ["raised-cid"], signers: seats }));
    const seed = new Uint8Array(32).fill(112);
    const voucher = { key: hex(await ed.getPublicKeyAsync(seed)), sign: async (bytes: Uint8Array) => hex(await ed.signAsync(bytes, seed)) };
    registerHandFrontierInto(board, await prepareHolderFrontier({ realm: REALM, board, voucher: voucher.key, counted: [], signer: voucher }));
    const invite: CabalInvite = { kind: CABAL_INVITE_DOMAIN, realmDocIdHex: REALM, joinerIdentityHex: "dd".repeat(32), voucherDid: voucher.key, boundEpoch: "0", sig: "ee".repeat(64) };
    const bundle = readRealmAdmitBundle(JSON.parse(JSON.stringify(realmAdmitBundle({ invite, realm: REALM, board }))))!;
    const raise = { actCid: "raised-cid", raised: true, hand: "quorum" as const, edgeId: "ab".repeat(32) };
    const read = (frontiers: typeof bundle.frontiers, counted: readonly (typeof raise)[] = [raise]) => readRealmBoardFrontiers({ realm: REALM, board: emptyLarDoc(), quorumLineage: lineage,
      vouchers: new Map([[voucher.key, new Set<string>()]]), counted, pins: {}, carried: frontiers });
    // A carried head never vouches for its own raises: until the act itself is counted here, the head waits.
    expect(read(bundle.frontiers, []).quorum).toMatchObject({ status: "unknown", missing: [{ why: "counts-unseen-raise" }] });
    expect(read(bundle.frontiers).quorum).toMatchObject({ status: "known", asOf: { quorum: { seq: 1 } } });
    expect(read(bundle.frontiers).holders.get(voucher.key)?.status).toBe("known");
    const forged = bundle.frontiers.map((entry) => entry.hand === "quorum" ? { ...entry, records: entry.records.map((raw) => {
      const r = raw as { body: Record<string, unknown>; signatures: unknown[] };
      return { ...r, body: { ...r.body, group: "ff".repeat(32) } };
    }) } : entry);
    expect(read(forged).quorum.status).toBe("unknown");
    expect(readRealmAdmitBundle({ ...bundle, realm: "ff".repeat(32) })).toBeNull();
    // The Nexus the realm stands under rides as a claim: a well-formed AID reads, anything else tears the bundle.
    const named = realmAdmitBundle({ invite, realm: REALM, nexus: charter.aid, board });
    expect(named.acts).toEqual([]);
    expect(readRealmAdmitBundle(JSON.parse(JSON.stringify(named)))?.nexus).toBe(charter.aid);
    expect(readRealmAdmitBundle({ ...named, nexus: "not-an-aid" })).toBeNull();
  });
});
