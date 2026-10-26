/**
 * cofound-ceremony — two vaults found one Nexus at two of two through the custody door's own rows, carrying files
 * alone. Each vault stands under its own scratch root and custody; the test switches `LAR_ROOT` between them, and
 * every file crosses as JSON text.
 *
 *   W1  THE WALK: A opens, B joins, A seals, B accepts. Both vaults file one joint charter under one AID, each holds
 *       its own seat and hearth cadence key and none of the other's, and each household seed stays byte-identical.
 *   R1  RED: the inception door signs no joint image for an offer this vault never recorded and judged
 *       (`cofound-offer-unrecorded`); CONTROL: the same door signs the image the vault's join recorded.
 *   R2  RED: B's join refuses a misheard fingerprint before any key mints, and a successor this vault already
 *       committed (`successor-reused`); one offer takes one answer (`cofound-recorded`).
 *   R3  RED: A's seal refuses a misheard joining seat and keeps no judged image; a vault that made no offer seals
 *       nothing; an offer that sealed one join's image seals no other (`cofound-judged-another`); once the joint
 *       charter stands, the same join signs nothing twice (`successor-reused`).
 *   R4  RED: B accepts no half-signed inception, none over another image and none for an offer it never joined.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { mintColdKey, offerFingerprint, readCofoundInception, readFckCarrier, seatFingerprint, charterInceptionBytes, type CofoundOffer } from "@lararium/mesh";
import { cidV1Sha256 } from "@lararium/mesh";
import { carriedCharterHome } from "../src/carried-set.js";
import { cofoundRecordFile, readCofoundRecord } from "../src/cofound-record.js";
import { cadenceKeyFile, heldCadenceKey } from "../src/cadence-key-store.js";
import { nexusCharterDocPath, readNexusDoc, writeNexusDoc } from "../src/nexus-doc.js";
import { generateOrLoadPersonaGroupRoot } from "../src/node-vessel-identity.js";
import { SealedActRefused, runSealedAct, type SealedActContext } from "../src/sealed-acts.js";
import { signLicensedInception } from "../src/seal-ceremony.js";
import { heldSeatKey, listSeatKeys } from "../src/seat-key-store.js";
import { larSealHome } from "../src/vessel-paths.js";
import { seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";
import { heldCharter } from "../../lararium-mesh/tests/charter-fixture.js";
import { fixtureKey } from "./fixture-keys.js";
import { handleRowPathIn } from "./face-paths.js";

vi.setConfig({ testTimeout: 180_000, hookTimeout: 180_000 });

const ctx: SealedActContext = { kelHead: null, personaSelves: null, walk: null, hosting: null, backup: null };
const drops: SeatedScratchCustody[] = [];
afterEach(async () => { for (const c of drops.splice(0).reverse()) await c.drop(); });

const cidOf = (text: string): string => cidV1Sha256(new TextEncoder().encode(text));
const MANIFEST = { image: `sha256:${"ab".repeat(32)}`, genesis: cidOf("genesis"), engine: cidOf("engine"), grammar: cidOf("grammar") };
const LAW = "lar:///ha.ka.ba/lararium/mesh/kahu#/seed-and-nexus";
const courier = <T>(v: T): Record<string, unknown> => JSON.parse(JSON.stringify(v)) as Record<string, unknown>;

/** One vault: its scratch root and custody, a persona root at h0, and a household seed at its primary path. */
async function vault(label: string, seedKey: number): Promise<{ readonly c: SeatedScratchCustody; readonly seedBytes: string }> {
  const c = await seatScratchCustody(label);
  drops.push(c);
  await generateOrLoadPersonaGroupRoot(0);
  writeNexusDoc(larSealHome(), heldCharter({ keys: [fixtureKey(seedKey)], threshold: 1, successors: { keys: [fixtureKey(seedKey + 1)], threshold: 1 } }).doc());
  return { c, seedBytes: readFileSync(nexusCharterDocPath(larSealHome()), "utf8") };
}
const at = (v: { readonly c: SeatedScratchCustody }): void => { process.env["LAR_ROOT"] = v.c.root; };
const act = (name: string, args: Record<string, unknown>) => runSealedAct(name, args, ctx);
const why = async (run: Promise<unknown>): Promise<string> =>
  run.then(() => "ran", (e: unknown) => (e instanceof SealedActRefused ? e.message : (e as Error).constructor.name));
const nextDigest = async (): Promise<string> => { const k = await mintColdKey(); k.seed.fill(0); return k.digest; };

async function opened(a: { readonly c: SeatedScratchCustody }) {
  at(a);
  const r = await act("cofound.open", { face: 0, next: await nextDigest(), charterLaw: LAW, manifest: MANIFEST }) as { offer: CofoundOffer; fingerprint: string };
  return { offer: courier(r.offer), fingerprint: r.fingerprint, seat: r.offer.seat };
}

describe("two vaults found one Nexus through the custody door", () => {
  test("W1 — open, join, seal, accept: one AID on both, each vault's own keys, both seeds untouched", async () => {
    const A = await vault("cofound-a", 0xa1), B = await vault("cofound-b", 0xb1);
    const { offer, fingerprint, seat: aSeat } = await opened(A);
    expect((await readCofoundRecord(fingerprint))?.image).toBeNull();

    at(B);
    const joined = await act("cofound.join", { face: 0, offer, heard: seatFingerprint(aSeat), next: await nextDigest() }) as { join: Record<string, unknown> };
    const joinFile = courier(joined.join);
    const bSeat = joinFile["seat"] as string, bCadence = (joinFile["cadence"] as { key: string }).key;

    at(A);
    const sealed = await act("cofound.seal", { join: joinFile, heard: seatFingerprint(bSeat) }) as { inception: unknown; charter: { aid: string; outcome: string } };
    const inceptionFile = courier(sealed.inception);
    expect(sealed.charter.outcome).toBe("landed");
    const aid = sealed.charter.aid;
    expect(aid).toMatch(/^nexus-[0-9a-f]{64}$/);

    at(B);
    const accepted = await act("cofound.accept", { inception: inceptionFile }) as { charter: { aid: string; outcome: string } };
    expect(accepted.charter).toMatchObject({ aid, outcome: "landed" });

    const inception = readCofoundInception(inceptionFile)!;
    expect(inception.image.keys).toEqual([aSeat, bSeat].sort());
    expect(offerFingerprint(inception.offer)).toBe(fingerprint);
    for (const v of [A, B]) {
      at(v);
      // The joint charter files under its own AID and reads both seats; the seed stands byte for byte.
      const doc = readNexusDoc(carriedCharterHome(larSealHome(), aid));
      expect(doc?.sealEpochCid).toBe(aid);
      expect(doc?.kahu.map((k) => k.verifyingKey).sort()).toEqual([aSeat, bSeat].sort());
      expect(readFileSync(nexusCharterDocPath(larSealHome()), "utf8")).toBe(v.seedBytes);
      const cadence = v === A ? inception.offer.cadence.key : bCadence;
      for (const file of [cofoundRecordFile(0, fingerprint), cadenceKeyFile(0, cadence)]) {
        expect(readFckCarrier(readFileSync(handleRowPathIn(v.c.homes.identity, file)))).toBe("sealed");
      }
    }
    // Each vault holds its own seat and hearth key, and none of the other's.
    at(A);
    expect(heldSeatKey(aSeat)).not.toBeNull();
    expect(heldSeatKey(bSeat)).toBeNull();
    expect(heldCadenceKey(inception.offer.cadence.key)).toBe(true);
    expect(heldCadenceKey(bCadence)).toBe(false);
    at(B);
    expect(heldSeatKey(bSeat)).not.toBeNull();
    expect(heldSeatKey(aSeat)).toBeNull();
    expect(heldCadenceKey(bCadence)).toBe(true);
    expect(heldCadenceKey(inception.offer.cadence.key)).toBe(false);
    expect(existsSync(join(B.c.root))).toBe(true);
  });

  test("R1 — the inception door signs a joint image only for a recorded, judged offer", async () => {
    const A = await vault("cofound-r1a", 0xa2), B = await vault("cofound-r1b", 0xb2);
    const { offer, seat: aSeat } = await opened(A);
    at(B);
    const joined = await act("cofound.join", { face: 0, offer, heard: seatFingerprint(aSeat), next: await nextDigest() }) as { join: Record<string, unknown> };
    const bSeat = joined.join["seat"] as string;
    const image = (await readCofoundRecord(offerFingerprint(offer as unknown as CofoundOffer)))!.image!;
    // CONTROL: B's door signs the image its row holds as judged, as B's seat.
    expect((await signLicensedInception(bSeat, charterInceptionBytes(image))).signer).toBe(bSeat);
    // RED: A holds the offer's row with NO judged image yet, so A's door refuses the same image.
    at(A);
    await expect(signLicensedInception(aSeat, charterInceptionBytes(image))).rejects.toMatchObject({ code: "cofound-offer-unrecorded" });
    // RED: an image the row never judged refuses at B, whatever its shape.
    at(B);
    const other = { ...image, founding: { ...image.founding!, cadence: "ab".repeat(32) } };
    await expect(signLicensedInception(bSeat, charterInceptionBytes(other))).rejects.toMatchObject({ code: "cofound-offer-unrecorded" });
    // RED: a seat B holds for ANOTHER founding signs no part of this one, though B holds both rows.
    const second = await opened(A);
    at(B);
    const joined2 = await act("cofound.join", { face: 0, offer: second.offer, heard: seatFingerprint(second.seat), next: await nextDigest() }) as { join: Record<string, unknown> };
    const bSeat2 = joined2.join["seat"] as string;
    expect(heldSeatKey(bSeat2)).not.toBeNull();
    await expect(signLicensedInception(bSeat2, charterInceptionBytes(image))).rejects.toMatchObject({ code: "signer-unseated" });
    const image2 = (await readCofoundRecord(offerFingerprint(second.offer as unknown as CofoundOffer)))!.image!;
    await expect(signLicensedInception(bSeat, charterInceptionBytes(image2))).rejects.toMatchObject({ code: "signer-unseated" });
  });

  test("R2 — a join refuses a misheard seat before any key mints, a reused successor, and a second answer", async () => {
    const A = await vault("cofound-r2a", 0xa3), B = await vault("cofound-r2b", 0xb3);
    const { offer, seat: aSeat } = await opened(A);
    at(B);
    const before = listSeatKeys().length;
    expect(await why(act("cofound.join", { face: 0, offer, heard: seatFingerprint(fixtureKey(3)), next: await nextDigest() }))).toMatch(/fingerprint typed as heard/);
    expect(listSeatKeys().length).toBe(before);
    // A successor the seed charter here committed refuses.
    const seedDigest = readNexusDoc(larSealHome())!.sealLineage![0]!.nextKeyDigests[0]!;
    expect(await why(act("cofound.join", { face: 0, offer, heard: seatFingerprint(aSeat), next: seedDigest }))).toMatch(/successor commitment already stands/);
    expect(listSeatKeys().length).toBe(before);
    // An OFFER whose own successor this vault already committed refuses too, before any key mints or row records.
    at(A);
    const reused = await act("cofound.open", { face: 0, next: seedDigest, charterLaw: LAW, manifest: MANIFEST }) as { offer: CofoundOffer };
    at(B);
    expect(await why(act("cofound.join", { face: 0, offer: courier(reused.offer), heard: seatFingerprint(reused.offer.seat), next: await nextDigest() }))).toMatch(/successor commitment already stands/);
    expect(listSeatKeys().length).toBe(before);
    expect(await readCofoundRecord(offerFingerprint(reused.offer))).toBeNull();
    // CONTROL: a fresh successor joins; a second answer to the same offer refuses.
    await act("cofound.join", { face: 0, offer, heard: seatFingerprint(aSeat), next: await nextDigest() });
    expect(listSeatKeys().length).toBe(before + 1);
    expect(await why(act("cofound.join", { face: 0, offer, heard: seatFingerprint(aSeat), next: await nextDigest() }))).toMatch(/already recorded that offer/);
    expect(listSeatKeys().length).toBe(before + 1);
    // A successor this vault's own recorded founding committed refuses at the next open, too.
    const joinedNext = (await readCofoundRecord(offerFingerprint(offer as unknown as CofoundOffer)))!.image!.nextKeyDigests;
    for (const d of joinedNext) {
      expect(await why(act("cofound.open", { face: 0, next: d, charterLaw: LAW, manifest: MANIFEST }))).toMatch(/successor commitment already stands/);
    }
  });

  test("R3 — a seal refuses a misheard joining seat, a vault with no offer, and a second join's image", async () => {
    const A = await vault("cofound-r3a", 0xa4), B = await vault("cofound-r3b", 0xb4), C = await vault("cofound-r3c", 0xc4);
    const { offer, fingerprint, seat: aSeat } = await opened(A);
    at(B);
    const jb = courier((await act("cofound.join", { face: 0, offer, heard: seatFingerprint(aSeat), next: await nextDigest() }) as { join: unknown }).join);
    at(C);
    const jc = courier((await act("cofound.join", { face: 0, offer, heard: seatFingerprint(aSeat), next: await nextDigest() }) as { join: unknown }).join);
    at(A);
    expect(await why(act("cofound.seal", { join: jb, heard: seatFingerprint(aSeat) }))).toMatch(/fingerprint typed as heard/);
    expect((await readCofoundRecord(fingerprint))?.image).toBeNull();
    at(B);
    expect(await why(act("cofound.seal", { join: jb, heard: seatFingerprint(jb["seat"] as string) }))).toMatch(/made no offer/);
    at(A);
    await act("cofound.seal", { join: jb, heard: seatFingerprint(jb["seat"] as string) });
    expect(await why(act("cofound.seal", { join: jc, heard: seatFingerprint(jc["seat"] as string) }))).toMatch(/already sealed another join/);
    // Once the joint charter stands here, its successors stand used: the same join signs nothing twice.
    expect(await why(act("cofound.seal", { join: jb, heard: seatFingerprint(jb["seat"] as string) }))).toMatch(/already committed/);
  });

  test("R4 — an accept refuses a half-signed inception, another image, and an offer this vault never joined", async () => {
    const A = await vault("cofound-r4a", 0xa5), B = await vault("cofound-r4b", 0xb5), C = await vault("cofound-r4c", 0xc5);
    const { offer, seat: aSeat } = await opened(A);
    at(B);
    const jb = courier((await act("cofound.join", { face: 0, offer, heard: seatFingerprint(aSeat), next: await nextDigest() }) as { join: unknown }).join);
    at(A);
    const inception = courier((await act("cofound.seal", { join: jb, heard: seatFingerprint(jb["seat"] as string) }) as { inception: unknown }).inception);
    const sigs = inception["signatures"] as unknown[];
    at(B);
    expect(await why(act("cofound.accept", { inception: { ...inception, signatures: sigs.slice(0, 1) } }))).not.toBe("ran");
    const cad = inception["cadence"] as { image: unknown; signatures: unknown[] };
    expect(await why(act("cofound.accept", { inception: { ...inception, cadence: { ...cad, signatures: cad.signatures.slice(1) } } }))).not.toBe("ran");
    expect(existsSync(join(larSealHome(), "carried"))).toBe(false);
    at(C);
    expect(await why(act("cofound.accept", { inception }))).toMatch(/never joined/);
    // A vault that joined the same offer with its own seat accepts no inception over B's image.
    await act("cofound.join", { face: 0, offer, heard: seatFingerprint(aSeat), next: await nextDigest() });
    expect(await why(act("cofound.accept", { inception }))).toMatch(/exactly the image this vessel joined/);
    // The offering vault accepts no inception of its own: it never joined.
    at(A);
    expect(await why(act("cofound.accept", { inception }))).toMatch(/never joined/);
    // CONTROL: the whole inception lands at B.
    at(B);
    expect(((await act("cofound.accept", { inception })) as { charter: { outcome: string } }).charter.outcome).toBe("landed");
  });
});
