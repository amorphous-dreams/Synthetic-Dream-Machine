/**
 * Red-first N contract at the node's charter doors: a joint charter lands at import, and raises a roster at
 * the read boot takes (`parseNexusDoc` → `foundingRoster`), only with both seats' inception signatures over one
 * image. The offer, the join and the bare inception file never land as a charter.
 *
 * The reds run under LAR_UNBUILT_REDS=1 and turn green in the signed-inception commit. Every charter here comes
 * from the fixture factory over the founders' own seat and cold keys; a doc the factory built gets bent, never
 * written by hand.
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ed from "@noble/ed25519";
import { cidV1Sha256, coldKeyFromSeed, foundingRoster, hex, seatFingerprint, type NexusDoc, type SealEpoch } from "@lararium/mesh";
import {
  charterInceptionBytes, cofoundJoin, cofoundOffer, sealCofound, type CharterInception,
} from "../../lararium-mesh/src/cofound.js";
import { heldCharter } from "../../lararium-mesh/tests/charter-fixture.js";
import { CarriedCharterError, importCarriedCharter } from "../src/carried-set.js";
import { parseNexusDoc, renderNexusDoc } from "../src/nexus-doc.js";

const red = process.env.LAR_UNBUILT_REDS === "1" ? test : test.skip;
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

/** The founders' act, and the unsigned joint charter the factory builds over the same seats and successors. */
async function act() {
  const [aCold, bCold] = await Promise.all([coldKeyFromSeed(seedOf(83)), coldKeyFromSeed(seedOf(84))]);
  const a = { seat: await key(81), next: aCold.digest }, b = { seat: await key(82), next: bCold.digest };
  const offer = cofoundOffer({ ...a, charterLaw: LAW, manifest: MANIFEST });
  const join = await cofoundJoin(offer, b, seatFingerprint(a.seat), await hand(82));
  const inception = await sealCofound(join, { offer, heardJoinSeat: seatFingerprint(b.seat) }, await hand(81));
  const charter = heldCharter({ keys: [a.seat, b.seat], threshold: 2,
    successors: { keys: [aCold.verifyingKey, bCold.verifyingKey], threshold: 2 } });
  return { a, offer, join, inception, charter };
}
/** The factory's doc with its genesis carrying `inception`: the shape the signed-inception commit reads. */
const incepted = (doc: NexusDoc, inception: CharterInception): NexusDoc =>
  ({ ...doc, sealLineage: [{ ...doc.sealLineage![0]!, inception } as SealEpoch] });

describe("the node's charter doors meet a joint genesis", () => {
  test("CONTROL: the factory's joint genesis names the AID both founders composed", async () => {
    const { charter, inception } = await act();
    expect(charter.aid).toBe(inception.image.aid);
  });

  test("CONTROL: an ordinary one-founder seed lands as a carried charter and raises its roster", async () => {
    const seed = heldCharter({ keys: [await key(91)], threshold: 1 });
    const body = renderNexusDoc(seed.doc());
    expect(foundingRoster(parseNexusDoc(body)).keys).toEqual([await key(91)]);
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

  red("COFOUND_REQUIRES_TWO_INCEPTION_SIGNATURES: an unsigned joint charter raises no roster and lands nowhere", async () => {
    const { charter } = await act();
    const body = renderNexusDoc(charter.doc());
    expect(foundingRoster(parseNexusDoc(body)).keys).toEqual([]);
    expect(() => importCarriedCharter(sealHome(), body)).toThrow(CarriedCharterError);
  });

  red("COFOUND_REQUIRES_TWO_INCEPTION_SIGNATURES: a half-signed joint charter raises no roster and lands nowhere", async () => {
    const { charter, inception } = await act();
    for (const signatures of [[], inception.signatures.slice(0, 1), inception.signatures.slice(1)]) {
      const body = renderNexusDoc(incepted(charter.doc(), { ...inception, signatures }));
      expect(foundingRoster(parseNexusDoc(body)).keys).toEqual([]);
      expect(() => importCarriedCharter(sealHome(), body)).toThrow(CarriedCharterError);
    }
  });

  red("COFOUND_REQUIRES_TWO_INCEPTION_SIGNATURES: two signatures over different images land nowhere", async () => {
    const { a, charter, inception } = await act();
    const split = { ...inception.image, charterLaw: `${LAW}-other` };
    const signatures = [...inception.signatures.filter((s) => s.signer !== a.seat),
      { signer: a.seat, sig: await (await hand(81)).sign(charterInceptionBytes(split)) }];
    const body = renderNexusDoc(incepted(charter.doc(), { ...inception, signatures }));
    expect(() => importCarriedCharter(sealHome(), body)).toThrow(CarriedCharterError);
  });

  red("COFOUND_REQUIRES_TWO_INCEPTION_SIGNATURES: a signer named twice or outside the seats lands nowhere, beside both seats' signatures", async () => {
    const { charter, inception } = await act();
    const foreign = await hand(89);
    const foreignSig = { signer: foreign.signer, sig: await foreign.sign(charterInceptionBytes(inception.image)) };
    for (const signatures of [[...inception.signatures, inception.signatures[0]!], [...inception.signatures, foreignSig]]) {
      const body = renderNexusDoc(incepted(charter.doc(), { ...inception, signatures }));
      expect(() => importCarriedCharter(sealHome(), body)).toThrow(CarriedCharterError);
    }
  });

  red("PIN after the seal: the doc carries its inception through render and parse, and the signed charter lands", async () => {
    const { charter, inception } = await act();
    const body = renderNexusDoc(incepted(charter.doc(), inception));
    expect((parseNexusDoc(body)?.sealLineage?.[0] as { inception?: unknown } | undefined)?.inception).toEqual(inception);
    expect(foundingRoster(parseNexusDoc(body)).keys).toHaveLength(2);
    expect(importCarriedCharter(sealHome(), body).aid).toBe(inception.image.aid);
  });
});
