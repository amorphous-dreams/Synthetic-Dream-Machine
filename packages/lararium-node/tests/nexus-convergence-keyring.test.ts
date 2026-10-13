/**
 * nexus-convergence-keyring.test.ts — one Nexus's convergence secrets, named by (Nexus AID, epoch CID), and the
 * seal proofs against the REAL seal primitive (`sealBodyOnCas` / `openBodyOnCas`).
 *
 *   K1  `current()` answers the secret the charter HEAD names, whatever order the entries arrived in.
 *                                                        control: with the other epoch as head it answers that one
 *   K2  same content + same secret → same cid; a different epoch's secret → a different cid.
 *   K3  a body sealed under each epoch opens with that epoch's re-derived read-cap.
 *   K4  a member missing an epoch's secret re-derives nothing for it (a throw that names the epoch).
 *   K5  a head that names no held secret, and a charter that names no head, each fail closed at `current()`.
 *                                                        control: the held epochs still answer `forEpoch`
 *   K6  a mis-sized secret, one epoch named twice, an entry for ANOTHER Nexus and a malformed name each refuse.
 *   K7  read-all: a member handed both epochs reads a body sealed before it joined.
 *   K8  no counter names a secret: the same epoch CID under two Nexus AIDs names two secrets, and a keyring for one
 *       Nexus never answers the other's.
 */
import { describe, test, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { sealBodyOnCas, openBodyOnCas, CONVERGENCE_SECRET_LEN } from "@lararium/mesh";
import {
  mintNexusSecret, makeNexusConvergenceKeyring, readCapForEpoch, epochNameKey,
  type NexusEpochSecret,
} from "../src/nexus-convergence-keyring.js";

const enc = (s: string) => new TextEncoder().encode(s);
const text = (b: Uint8Array) => new TextDecoder().decode(b);
const body = enc("a private cad body the Nexus dedups within its own epoch");

const AID = "epoch0-" + "a1".repeat(32);
const OTHER_AID = "epoch0-" + "b2".repeat(32);
const GENESIS = AID;
const ROLLED = "epoch-" + "c3".repeat(32);
const e0 = mintNexusSecret({ nexusAid: AID, epochCid: GENESIS });
const e1 = mintNexusSecret({ nexusAid: AID, epochCid: ROLLED });
const full = makeNexusConvergenceKeyring({ nexusAid: AID, headEpochCid: ROLLED, entries: [e0, e1] });

describe("the keyring names a secret by Nexus and epoch", () => {
  test("K1 current() answers the secret the charter head names, in any arrival order", () => {
    expect(full.current().epochCid).toBe(ROLLED);
    expect([...full.current().secret]).toEqual([...e1.secret]);
    const reversed = makeNexusConvergenceKeyring({ nexusAid: AID, headEpochCid: ROLLED, entries: [e1, e0] });
    expect([...reversed.current().secret]).toEqual([...e1.secret]);
    expect(full.epochCids).toEqual([GENESIS, ROLLED]);
    // control: the head decides, and nothing else
    const atGenesis = makeNexusConvergenceKeyring({ nexusAid: AID, headEpochCid: GENESIS, entries: [e0, e1] });
    expect([...atGenesis.current().secret]).toEqual([...e0.secret]);
  });

  test("K2 same content + same secret → same cid; another epoch's secret → another cid", () => {
    const a = sealBodyOnCas(body, full.forEpoch(ROLLED)!);
    const b = sealBodyOnCas(body, full.forEpoch(ROLLED)!);
    expect(b.cid).toBe(a.cid);
    expect(sealBodyOnCas(body, full.forEpoch(GENESIS)!).cid).not.toBe(a.cid);
  });

  test("K3 a body sealed under each epoch opens with that epoch's re-derived read-cap", () => {
    const s0 = sealBodyOnCas(body, full.forEpoch(GENESIS)!);
    const s1 = sealBodyOnCas(body, full.forEpoch(ROLLED)!);
    expect(text(openBodyOnCas(s0.ciphertext, s0.readCap))).toBe(text(body));
    expect(text(openBodyOnCas(s1.ciphertext, s1.readCap))).toBe(text(body));
    expect(readCapForEpoch(body, GENESIS, full)).toEqual(s0.readCap);
    expect(readCapForEpoch(body, ROLLED, full)).toEqual(s1.readCap);
  });
});

describe("fail-closed", () => {
  test("K4 a member missing an epoch's secret re-derives nothing for it", () => {
    const late = makeNexusConvergenceKeyring({ nexusAid: AID, headEpochCid: ROLLED, entries: [e1] });
    expect(late.forEpoch(GENESIS)).toBeUndefined();
    expect(() => readCapForEpoch(body, GENESIS, late)).toThrow(new RegExp(`no secret for epoch ${GENESIS}`));
  });

  test("K5 a head that names no held secret, and no head at all, each fail closed", () => {
    const behind = makeNexusConvergenceKeyring({ nexusAid: AID, headEpochCid: ROLLED, entries: [e0] });
    expect(() => behind.current()).toThrow(/no secret held for the head epoch/);
    expect([...behind.forEpoch(GENESIS)!]).toEqual([...e0.secret]);   // control: the held epoch still reads
    const headless = makeNexusConvergenceKeyring({ nexusAid: AID, headEpochCid: null, entries: [e0] });
    expect(() => headless.current()).toThrow(/names no head epoch/);
    const empty = makeNexusConvergenceKeyring({ nexusAid: AID, headEpochCid: GENESIS, entries: [] });
    expect(empty.epochCids).toEqual([]);
    expect(() => empty.current()).toThrow(/no secret held/);
  });

  test("K6 a mis-sized secret, a doubled epoch, another Nexus's entry and a malformed name each refuse", () => {
    const short: NexusEpochSecret = { nexusAid: AID, epochCid: GENESIS, secret: new Uint8Array(randomBytes(CONVERGENCE_SECRET_LEN - 1)) };
    const stand = (entries: NexusEpochSecret[]) => makeNexusConvergenceKeyring({ nexusAid: AID, headEpochCid: GENESIS, entries });
    expect(() => stand([short])).toThrow(/MUST be exactly/);
    expect(() => stand([e0, mintNexusSecret({ nexusAid: AID, epochCid: GENESIS })])).toThrow(/duplicate/);
    expect(() => stand([e0, mintNexusSecret({ nexusAid: OTHER_AID, epochCid: GENESIS })])).toThrow(/holds .* alone/);
    expect(() => mintNexusSecret({ nexusAid: "", epochCid: GENESIS })).toThrow(/printable token/);
    expect(() => mintNexusSecret({ nexusAid: AID, epochCid: "two words" })).toThrow(/printable token/);
    expect(() => mintNexusSecret({ nexusAid: AID, epochCid: 3 as unknown as string })).toThrow(/printable token/);
    expect(stand([e0]).epochCids).toEqual([GENESIS]);   // control: the well-shaped entry stands
  });
});

describe("read-all and the scoped name", () => {
  test("K7 a member handed both epochs reads a body sealed before it joined", () => {
    const sealedOld = sealBodyOnCas(body, e0.secret);
    const fresh = makeNexusConvergenceKeyring({ nexusAid: AID, headEpochCid: ROLLED, entries: [e0, e1] });
    expect(text(openBodyOnCas(sealedOld.ciphertext, readCapForEpoch(body, GENESIS, fresh)))).toBe(text(body));
  });

  test("K8 one epoch CID under two Nexus AIDs names two secrets", () => {
    const a = mintNexusSecret({ nexusAid: AID, epochCid: ROLLED });
    const b = mintNexusSecret({ nexusAid: OTHER_AID, epochCid: ROLLED });
    expect(epochNameKey(a)).not.toBe(epochNameKey(b));
    expect(epochNameKey({ nexusAid: AID.toUpperCase(), epochCid: ROLLED.toUpperCase() })).toBe(epochNameKey(a));   // both parts fold case
    const other = makeNexusConvergenceKeyring({ nexusAid: OTHER_AID, headEpochCid: ROLLED, entries: [b] });
    expect(sealBodyOnCas(body, other.current().secret).cid).not.toBe(sealBodyOnCas(body, a.secret).cid);
  });
});
