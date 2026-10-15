/**
 * face-bundle-cut — the cut builds ONE face's bundle body off a vessel's real sealed rows, and refuses by name.
 *
 *   C1  a cut carries the face's root, roster line, two anchor names, key history, names, proof keys, its own
 *       handle-book records and the memory section; the body opens under the bundle key alone.
 *   C2  the body holds NOTHING of another face, and nothing that names this vessel's seat: no veil tag, no device
 *       edge, no key group id, no seat claim, no chair label, no vessel-face key.   control: the rows do hold them
 *   C3  the table's bundle column and the cut's extractors name the same rows; a row the column names with no
 *       extractor refuses the cut.
 *   C4  each refusal, by name: face-not-held, face-not-worn (another face worn; no face worn; no composition),
 *       own-edge-shadowed (read at the entry: no row opens, no island ask leaves), key-history-unread (none; a
 *       history that fails to verify; a history under another prefix), memory-unavailable (no island; an island
 *       that refuses), and the island's own shadow refusal.
 *   C5  the memory section seals to the pair the bundle key derives: the island gets a public key and nothing else.
 *
 * Scratch roots, synthetic names and keys. Canon: lar:///ha.ka.ba/lararium/mesh/custody#/the-cut
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import * as ed from "@noble/ed25519";
import {
  HandleBook, bundleMemoryKeypair, hex, mintBundleKey, mintHandleInception, mintPersonaInception, openFaceBundleBody,
  openMemorySection, readFaceBundleBody, sealMemorySection, signHandleCard,
  type FaceBundleBody, type HandleCard, type HandleKelEvent, type PersonaKelEvent,
} from "@lararium/mesh";
import { BUNDLE_EXTRACTOR_ROWS, BackupRefused, CUT_REFUSALS, cutFaceBundle, type BackupDoor } from "../src/face-bundle-cut.js";
import { storeFaceProofKey, storeVesselFaceKey } from "../src/face-key-custody.js";
import { persistIdentityAnchors } from "../src/identity-anchors.js";
import { IslandVerbRefused } from "../src/island-verb-ask.js";
import { saveNodeHandleBook } from "../src/node-circle-store.js";
import {
  generateOrLoadPersonaGroupRoot, loadPersonaGroupRootSeed, makeNodePersonaDeclarationStore, makeNodePersonaPetnameStore,
} from "../src/node-vessel-identity.js";
import * as carriers from "../src/vault-carriers.js";
import { seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";

vi.setConfig({ testTimeout: 180_000 });

const CONTENT_KEY = Uint8Array.from({ length: 32 }, (_, i) => 0x60 ^ i);
const BAG = "lar:///ha.ka.ba/@test/bags/garden-notes";
const HOLD = { bagId: BAG, founding: "11".repeat(32), keyVersion: "22".repeat(32) };
const secretOf = (fill: number): Uint8Array => Uint8Array.from({ length: 32 }, (_, i) => (i * 7 + fill) & 0xff);
const publicOf = async (secret: Uint8Array): Promise<string> => hex(await ed.getPublicKeyAsync(secret));

async function cardOf(fill: number, glamour: string): Promise<HandleCard> {
  const seed = new Uint8Array(32).fill(fill);
  const did = `0x${await publicOf(seed)}`;
  const chain: HandleKelEvent[] = [mintHandleInception(did, did, "ab".repeat(32), `hkeynext-${"cd".repeat(32)}`)];
  return signHandleCard({ nym: chain[0]!.prefix, chain, glamour, parents: [], standing: null, fleetProof: null }, (b) => ed.signAsync(b, seed).then(hex));
}

let seat: SeatedScratchCustody;
let keys: { face0: string; face1: string };
let kel0: PersonaKelEvent[];
beforeEach(async () => {
  seat = await seatScratchCustody("bundle-cut");
  const r0 = await generateOrLoadPersonaGroupRoot(0);
  const r1 = await generateOrLoadPersonaGroupRoot(1);
  keys = { face0: r0.verifyingKey, face1: r1.verifyingKey };
  kel0 = [mintPersonaInception(`0x${keys.face0}`, "ab".repeat(32))];
  const kel1 = [mintPersonaInception(`0x${keys.face1}`, "cd".repeat(32))];
  await persistIdentityAnchors({
    personaGroupId: "GROUP-DOC-OF-FACE-ZERO", meshCabalDocIdHex: "CABAL-DOC-OF-FACE-ZERO",
    signerDid: `0x${keys.face0}`, personaKelPrefix: kel0[0]!.prefix, veilTag: "VEIL-TAG-OF-FACE-ZERO",
    deviceEdge: { title: "DEVICE-EDGE-OF-FACE-ZERO" } as never,
  }, 0);
  await persistIdentityAnchors({
    personaGroupId: "GROUP-DOC-OF-FACE-ONE", meshCabalDocIdHex: "CABAL-DOC-OF-FACE-ONE",
    signerDid: `0x${keys.face1}`, personaKelPrefix: kel1[0]!.prefix, veilTag: "VEIL-TAG-OF-FACE-ONE",
  }, 1);
  const petnames = await makeNodePersonaPetnameStore();
  await petnames.set(0, "the gardener");
  await petnames.set(1, "PETNAME-OF-FACE-ONE");
  const declarations = await makeNodePersonaDeclarationStore();
  await declarations.set(0, { handle: "gardener-handle", seat: true, chair: "CHAIR-OF-FACE-ZERO" });
  await declarations.set(1, { handle: "HANDLE-OF-FACE-ONE" });
  const proof0 = secretOf(3), proof1 = secretOf(5), vesselFace = secretOf(9);
  await storeFaceProofKey({ faceKey: await publicOf(proof0), nexus: "nexus-test-one" }, proof0, 0);
  await storeFaceProofKey({ faceKey: await publicOf(proof1), nexus: "nexus-test-one" }, proof1, 1);
  await storeVesselFaceKey({ faceKey: await publicOf(proof0), nexus: "nexus-test-one" }, vesselFace);
  const book = new HandleBook();
  const mine = await cardOf(11, "friend-of-zero"), theirs = await cardOf(12, "FRIEND-OF-ONE"), nobodys = await cardOf(13, "UNTAGGED-FRIEND");
  await book.ingest(mine, undefined, keys.face0); book.setPetname(mine.nym, "Ana", keys.face0);
  await book.ingest(theirs, undefined, keys.face1); book.setPetname(theirs.nym, "LABEL-OF-FACE-ONE", keys.face1);
  await book.ingest(nobodys); book.setPetname(nobodys.nym, "LABEL-OF-NOBODY");
  await saveNodeHandleBook(book);
});
afterEach(async () => { await seat.drop(); });

/** A composition's lend, as a standing vessel wearing face `worn` would hand it. `asked` keeps what reached the island. */
function door(over: Partial<BackupDoor> & { worn?: number | null } = {}): { door: BackupDoor; asked: Uint8Array[] } {
  const asked: Uint8Array[] = [];
  return {
    asked,
    door: {
      wornFace: () => (over.worn === undefined ? 0 : over.worn),
      ownEdgeShadowed: over.ownEdgeShadowed ?? (async () => false),
      cutMemory: over.cutMemory === undefined
        ? async (to) => {
            asked.push(Uint8Array.from(to));
            return { section: Buffer.from(sealMemorySection([{ bagId: BAG, locator: HOLD.founding, keyVersion: HOLD.keyVersion, key: CONTENT_KEY }], to)).toString("base64"), holds: [HOLD] };
          }
        : over.cutMemory,
      kel: over.kel ?? (async () => kel0),
    },
  };
}
const refusalOf = async (p: Promise<unknown>): Promise<string> => {
  const e = await p.then(() => null, (err: unknown) => err);
  return e === null ? "ANSWERED" : e instanceof BackupRefused ? e.reason : `threw: ${(e as Error).message.slice(0, 80)}`;
};
function opened(sealedBody: Uint8Array, bundleKey: Uint8Array): { body: FaceBundleBody; text: string } {
  const plain = openFaceBundleBody(sealedBody, bundleKey);
  if (plain === null) throw new Error("the body did not open under its own bundle key");
  const body = readFaceBundleBody(plain);
  if (body === null) throw new Error("the opened bytes read as no body");
  return { body, text: Buffer.from(plain).toString("utf8") };
}

describe("a cut carries one face's standing section and its memory section", () => {
  test("C1 — the body holds the face's root, lines, history, names, proof keys, records and memory, and opens under the bundle key alone", async () => {
    const bundleKey = mintBundleKey();
    const lend = door();
    const cut = await cutFaceBundle({ face: 0, bundleKey, door: lend.door });
    const { body } = opened(cut.sealedBody, bundleKey);
    const seed = await loadPersonaGroupRootSeed(0);
    expect(body.root).toEqual({ signingKey: hex(seed), verifyingKey: keys.face0 });
    expect(body.rosterLine).toEqual({ handleIndex: 0, verifyingKey: keys.face0 });
    expect(body.anchors).toEqual({ signerDid: `0x${keys.face0}`, personaKelPrefix: kel0[0]!.prefix });
    expect(body.kel.map((e) => e.eventCid)).toEqual(kel0.map((e) => e.eventCid));
    expect(body.names).toEqual({ petname: "the gardener", handle: "gardener-handle" });
    expect(body.faceProofKeys).toHaveLength(1);
    expect(body.faceProofKeys[0]!.secret).toBe(hex(secretOf(3)));
    expect(body.handleBook.records.map((r) => (r as { petname: string }).petname)).toEqual(["Ana"]);
    expect(body.memory.holds).toEqual([HOLD]);
    expect(cut.holds).toEqual([HOLD]);
    expect(cut.face).toEqual({ handleIndex: 0, verifyingKey: keys.face0 });
    expect(cut.carries).toEqual({ keyEvents: 1, faceProofKeys: 1, handleBookRecords: 1, petname: true, handle: true });
    // Another bundle's key opens nothing.
    expect(openFaceBundleBody(cut.sealedBody, mintBundleKey())).toBeNull();
  });

  test("C2 — the body holds nothing of another face and nothing that names this vessel's seat", async () => {
    const bundleKey = mintBundleKey();
    const cut = await cutFaceBundle({ face: 0, bundleKey, door: door().door });
    const { text } = opened(cut.sealedBody, bundleKey);
    const otherSeed = hex(await loadPersonaGroupRootSeed(1));
    const strangers = [
      otherSeed, keys.face1, "PETNAME-OF-FACE-ONE", "HANDLE-OF-FACE-ONE", hex(secretOf(5)), "FRIEND-OF-ONE", "LABEL-OF-FACE-ONE",
      "UNTAGGED-FRIEND", "LABEL-OF-NOBODY",
      "VEIL-TAG-OF-FACE-ZERO", "DEVICE-EDGE-OF-FACE-ZERO", "GROUP-DOC-OF-FACE-ZERO", "CABAL-DOC-OF-FACE-ZERO", "GROUP-AGENT-OF-FACE-ZERO",
      "CHAIR-OF-FACE-ZERO", "\"seat\"", hex(secretOf(9)), hex(seat.vk),
    ];
    for (const word of strangers) expect(text.includes(word), `the body carries ${word.slice(0, 24)}`).toBe(false);
    // CONTROL: the hunt finds a word the body does carry, and the cut of face 1 carries face 1's own.
    expect(text.includes("the gardener")).toBe(true);
    const otherKey = mintBundleKey();
    const kel1 = [mintPersonaInception(`0x${keys.face1}`, "cd".repeat(32))];
    const other = await cutFaceBundle({ face: 1, bundleKey: otherKey, door: door({ worn: 1, kel: async () => kel1 }).door });
    const otherText = opened(other.sealedBody, otherKey).text;
    for (const word of [otherSeed, "PETNAME-OF-FACE-ONE", "HANDLE-OF-FACE-ONE", hex(secretOf(5)), "LABEL-OF-FACE-ONE"]) expect(otherText.includes(word)).toBe(true);
    expect(otherText.includes("the gardener")).toBe(false);
  });

  test("C5 — the island receives the public half of the pair the bundle key derives, and the section opens under that pair alone", async () => {
    const bundleKey = mintBundleKey();
    const lend = door();
    const cut = await cutFaceBundle({ face: 0, bundleKey, door: lend.door });
    const pair = bundleMemoryKeypair(bundleKey);
    expect(lend.asked.map((to) => hex(to))).toEqual([hex(pair.public)]);
    const { body } = opened(cut.sealedBody, bundleKey);
    const entries = openMemorySection(Uint8Array.from(Buffer.from(body.memory.section, "base64")), pair.secret);
    expect(entries?.map((e) => hex(e.key))).toEqual([hex(CONTENT_KEY)]);
    expect(openMemorySection(Uint8Array.from(Buffer.from(body.memory.section, "base64")), bundleMemoryKeypair(mintBundleKey()).secret)).toBeNull();
  });
});

describe("the table picks the rows a bundle carries", () => {
  test("C3 — the bundle column and the cut's extractors name the same rows", () => {
    expect([...BUNDLE_EXTRACTOR_ROWS].sort()).toEqual(carriers.bundleRows().map((r) => r.row).sort());
    // The law's table (custody#/the-table): two rows ride whole, five ride as one face's lines, the rest stay.
    const by = (t: string): string[] => carriers.bundleRows().filter((r) => r.bundle === t).map((r) => r.row).sort();
    expect(by("whole")).toEqual(["face-proof-key", "persona-root"]);
    expect(by("lines")).toEqual(["anchors", "handle-book", "persona-declarations", "persona-petnames", "persona-roster"]);
    for (const stays of ["veil-archive", "keyhive-archive", "vessel-face-key", "gate-memory", "device-share", "public-handles", "restore-pending", "custody-root", "seat-key", "face-address-secret", "fleet-join-pending", "face-join-record"]) {
      expect(carriers.carrierTable().find((r) => r.row === stays)?.bundle, stays).toBe("stays");
    }
  });

  test("C3 — a row the column names with no extractor refuses the cut, and nothing gets sealed", async () => {
    const real = carriers.bundleRows();
    const spy = vi.spyOn(carriers, "bundleRows").mockReturnValue([...real, { row: "gate-memory", bundle: "whole" }]);
    try {
      await expect(cutFaceBundle({ face: 0, bundleKey: mintBundleKey(), door: door().door })).rejects.toThrow(/no extractor reads it/);
    } finally { spy.mockRestore(); }
  });
});

describe("a cut refuses by name, and a refused cut seals nothing", () => {
  test("C4 — the refusal names stand closed", () => {
    expect([...CUT_REFUSALS]).toEqual(["face-not-held", "face-not-worn", "own-edge-shadowed", "key-history-unread", "memory-unavailable"]);
  });

  test("C4 — a face this vessel holds no root for refuses `face-not-held`", async () => {
    expect(await refusalOf(cutFaceBundle({ face: 7, bundleKey: mintBundleKey(), door: door().door }))).toBe("face-not-held");
  });

  test("C4 — a face the vessel does not wear refuses `face-not-worn`: another face worn, no face worn, no composition", async () => {
    expect(await refusalOf(cutFaceBundle({ face: 0, bundleKey: mintBundleKey(), door: door({ worn: 1 }).door }))).toBe("face-not-worn");
    expect(await refusalOf(cutFaceBundle({ face: 0, bundleKey: mintBundleKey(), door: door({ worn: null }).door }))).toBe("face-not-worn");
    expect(await refusalOf(cutFaceBundle({ face: 0, bundleKey: mintBundleKey(), door: null }))).toBe("face-not-worn");
    // CONTROL: worn, the same cut answers.
    expect(await refusalOf(cutFaceBundle({ face: 0, bundleKey: mintBundleKey(), door: door().door }))).toBe("ANSWERED");
  });

  test("C4 — under its own shadow the cut refuses `own-edge-shadowed`: the shadow reads once, no island ask leaves and no root row opens", async () => {
    let reads = 0;
    const lend = door({ ownEdgeShadowed: async () => { reads++; return true; } });
    const openCold = vi.spyOn(seat.holder, "openColdRow");
    const readHot = vi.spyOn(seat.holder, "readRow");
    expect(await refusalOf(cutFaceBundle({ face: 0, bundleKey: mintBundleKey(), door: lend.door }))).toBe("own-edge-shadowed");
    expect(reads).toBe(1);
    expect(lend.asked).toEqual([]);
    expect(openCold).not.toHaveBeenCalled();
    expect(readHot, "no row opens under the shadow: not the roster, not a name").not.toHaveBeenCalled();
    // A shadowed vessel asked for a face it does not hold answers the shadow, and still opens no row.
    expect(await refusalOf(cutFaceBundle({ face: 7, bundleKey: mintBundleKey(), door: lend.door }))).toBe("own-edge-shadowed");
    expect(readHot).not.toHaveBeenCalled();
    // CONTROL: the clear cut reads the shadow once too, and does open the root row.
    let clearReads = 0;
    await cutFaceBundle({ face: 0, bundleKey: mintBundleKey(), door: door({ ownEdgeShadowed: async () => { clearReads++; return false; } }).door });
    expect(clearReads).toBe(1);
    expect(openCold).toHaveBeenCalled();
    expect(readHot).toHaveBeenCalled();
  });

  test("C4 — a board with no whole key history for the face refuses `key-history-unread`, before any island ask", async () => {
    const none = door({ kel: async () => [] });
    expect(await refusalOf(cutFaceBundle({ face: 0, bundleKey: mintBundleKey(), door: none.door }))).toBe("key-history-unread");
    expect(none.asked).toEqual([]);
    const bent = door({ kel: async () => [{ ...kel0[0]!, opKeyDid: `0x${keys.face1}` }] });
    expect(await refusalOf(cutFaceBundle({ face: 0, bundleKey: mintBundleKey(), door: bent.door }))).toBe("key-history-unread");
    const foreign = door({ kel: async () => [mintPersonaInception(`0x${keys.face1}`, "cd".repeat(32))] });
    expect(await refusalOf(cutFaceBundle({ face: 0, bundleKey: mintBundleKey(), door: foreign.door }))).toBe("key-history-unread");
  });

  test("C4 — no island, or an island that refuses, reads `memory-unavailable`; the island's own shadow reads `own-edge-shadowed`", async () => {
    expect(await refusalOf(cutFaceBundle({ face: 0, bundleKey: mintBundleKey(), door: door({ cutMemory: null }).door }))).toBe("memory-unavailable");
    const refusing = (reason: string | null) => door({ cutMemory: async () => { throw new IslandVerbRefused("sealed-memory-cut", "the island said no", reason); } }).door;
    expect(await refusalOf(cutFaceBundle({ face: 0, bundleKey: mintBundleKey(), door: refusing(null) }))).toBe("memory-unavailable");
    expect(await refusalOf(cutFaceBundle({ face: 0, bundleKey: mintBundleKey(), door: refusing("holder-locked") }))).toBe("memory-unavailable");
    expect(await refusalOf(cutFaceBundle({ face: 0, bundleKey: mintBundleKey(), door: refusing("own-edge-shadowed") }))).toBe("own-edge-shadowed");
    // A fault that names no refusal passes through under its own words.
    const faulting = door({ cutMemory: async () => { throw new Error("the port closed"); } }).door;
    expect(await refusalOf(cutFaceBundle({ face: 0, bundleKey: mintBundleKey(), door: faulting }))).toBe("threw: the port closed");
  });
});
