/**
 * N at the node's charter doors: a joint charter lands at import, and raises a roster at the read boot takes
 * (`parseNexusDoc` → `foundingRoster`), only with both seats' inception signatures over one image. The offer, the
 * join and the bare inception file never land as a charter.
 *
 * Every charter doc here bends one the fixture factory built over the founders' own seat keys; its lineage takes
 * the joint genesis the pure act sealed. No doc gets written by hand.
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ed from "@noble/ed25519";
import { cidV1Sha256, coldKeyFromSeed, foundingRoster, hex, seatFingerprint, type NexusDoc, type SealEpoch } from "@lararium/mesh";
import {
  charterInceptionBytes, cofoundGenesis, cofoundJoin, cofoundOffer, sealCofound,
} from "../../lararium-mesh/src/cofound.js";
import { heldCharter } from "../../lararium-mesh/tests/charter-fixture.js";
import { CarriedCharterError, importCarriedCharter } from "../src/carried-set.js";
import { parseNexusDoc, renderNexusDoc } from "../src/nexus-doc.js";
import { fixtureKey } from "./fixture-keys.js";

const seedOf = (n: number): Uint8Array => new Uint8Array(32).fill(n);
const key = async (n: number): Promise<string> => hex(await ed.getPublicKeyAsync(seedOf(n)));
const hand = async (n: number) => ({ signer: await key(n), sign: async (b: Uint8Array) => hex(await ed.signAsync(b, seedOf(n))) });
const cidOf = (text: string): string => cidV1Sha256(new TextEncoder().encode(text));
const MANIFEST = { image: `sha256:${"ab".repeat(32)}`, genesis: cidOf("genesis"), engine: cidOf("engine"), grammar: cidOf("grammar") };
const LAW = "lar:///ha.ka.ba/lararium/mesh/kahu#/seed-and-nexus";

let root: string;
let prior: string | undefined;
const sealHome = (): string => join(root, "state", "nexus");
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "lares-cofound-")); prior = process.env["LAR_ROOT"]; process.env["LAR_ROOT"] = root; });
afterEach(() => {
  if (prior === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior;
  rmSync(root, { recursive: true, force: true });
});

/** The founders' act, and a charter doc whose lineage holds the joint genesis it sealed. */
async function act() {
  const [aCold, bCold] = await Promise.all([coldKeyFromSeed(seedOf(83)), coldKeyFromSeed(seedOf(84))]);
  const a = { seat: await key(81), next: aCold.digest }, b = { seat: await key(82), next: bCold.digest };
  const offer = cofoundOffer({ ...a, charterLaw: LAW, manifest: MANIFEST });
  const join = await cofoundJoin(offer, b, seatFingerprint(a.seat), await hand(82));
  const inception = await sealCofound(join, { offer, heardJoinSeat: seatFingerprint(b.seat) }, await hand(81));
  const genesis = cofoundGenesis(inception);
  const seats = heldCharter({ keys: [a.seat, b.seat], threshold: 2 }).doc();
  const docOf = (g: SealEpoch): NexusDoc => ({ ...seats, sealEpochCid: g.epochCid, sealLineage: [g] });
  return { a, offer, join, inception, genesis, docOf };
}

describe("the node's charter doors meet a joint genesis", () => {
  test("CONTROL: an ordinary one-founder seed lands as a carried charter and raises its roster", () => {
    const seed = heldCharter({ keys: [fixtureKey(91)], threshold: 1 });
    const body = renderNexusDoc(seed.doc());
    expect(foundingRoster(parseNexusDoc(body)).keys).toEqual([fixtureKey(91)]);
    expect(importCarriedCharter(sealHome(), body).outcome).toBe("landed");
  });

  test("CONTROL: the offer, the join and the bare inception file never land as a charter", async () => {
    const { offer, join, inception } = await act();
    for (const file of [offer, join, inception]) {
      const body = JSON.stringify(file);
      expect(parseNexusDoc(body)).toBeNull();
      expect(() => importCarriedCharter(sealHome(), body)).toThrow(CarriedCharterError);
    }
  });

  test("the sealed joint charter carries its inception through render and parse, raises both seats and lands", async () => {
    const { genesis, docOf } = await act();
    const body = renderNexusDoc(docOf(genesis));
    expect(parseNexusDoc(body)?.sealLineage?.[0]?.inception).toEqual(genesis.inception);
    expect(foundingRoster(parseNexusDoc(body)).keys).toHaveLength(2);
    expect(importCarriedCharter(sealHome(), body).aid).toBe(genesis.epochCid);
  });

  test("COFOUND_REQUIRES_TWO_INCEPTION_SIGNATURES: an unsigned or half-signed joint charter raises no roster and lands nowhere", async () => {
    const { genesis, docOf } = await act();
    const signed = genesis.inception!.signatures;
    for (const signatures of [[], signed.slice(0, 1), signed.slice(1)]) {
      const body = renderNexusDoc(docOf({ ...genesis, inception: { ...genesis.inception!, signatures } }));
      expect(foundingRoster(parseNexusDoc(body)).keys).toEqual([]);
      expect(() => importCarriedCharter(sealHome(), body)).toThrow(CarriedCharterError);
    }
    const { inception: _i, ...bare } = genesis;
    expect(() => importCarriedCharter(sealHome(), renderNexusDoc(docOf(bare)))).toThrow(CarriedCharterError);
  });

  test("COFOUND_REQUIRES_TWO_INCEPTION_SIGNATURES: two signatures over different images, a doubled or a foreign signer land nowhere", async () => {
    const { a, genesis, docOf } = await act();
    const signed = genesis.inception!.signatures;
    const split = { ...genesis.inception!.image, founding: { offer: "ab".repeat(32) } };
    const foreign = await hand(89);
    const cases = [
      [...signed.filter((s) => s.signer !== a.seat), { signer: a.seat, sig: await (await hand(81)).sign(charterInceptionBytes(split)) }],
      [...signed, signed[0]!],
      [...signed, { signer: foreign.signer, sig: await foreign.sign(charterInceptionBytes(genesis.inception!.image)) }],
    ];
    for (const signatures of cases) {
      const body = renderNexusDoc(docOf({ ...genesis, inception: { ...genesis.inception!, signatures } }));
      expect(() => importCarriedCharter(sealHome(), body)).toThrow(CarriedCharterError);
    }
  });
});
