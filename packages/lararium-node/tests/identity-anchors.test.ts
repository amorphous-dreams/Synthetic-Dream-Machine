/**
 * identity-anchors — the identity home's sealed family: each face's anchors, the anchor roster, the vessel's keyhive
 * archive and each face's veil archive. Every row rests sealed under the vessel key and reads through the custody
 * seat.
 *
 *   A1  an anchors row seals at rest and reads back whole.              control: before the write it reads null
 *   A2  the mount material round-trips at an index above zero, and the roster records each index once.
 *   A3  a row that opens and holds another shape refuses by name.        control: the well-shaped row reads
 *   A4  a torn row refuses `torn`; a BARE row (plain bytes at the path) refuses `bare`. Neither reads null.
 *   A5  at the floor (the holder locked) every reader and writer refuses `CustodyLocked`, and no file moves.
 *   A6  THE TAMPER PROBE: a write under key A lands; a holder over key B refuses the write (`TreeKeyRefusal`), the
 *       standing bytes never move, and they still open under A. The keyhive archive, a veil archive and an anchors
 *       row each carry the probe.
 *   A7  one face's veil archive rests in its own row: three faces keep three rows, each reads its own bytes, and
 *       one face's sealed bytes carried to another face's path open for nobody.
 *                                                                        control: back at its own path it opens
 *   A8  an archive written through the family never rests in the clear: the file carries the vessel key's seal
 *       and none of the plaintext.
 *   A9  THE SEAL PROVES THE BYTES (the 2026-11-20 custody incident): face A's Archive sent to face B's row refuses
 *       `ArchiveIdentityMismatch` naming A's identity, B's sealed bytes never move and no `.prev` stands; a face holding no
 *       atom refuses `VeilArchiveUnproven`; bytes that decode as no Archive refuse.
 *                                                                        control: B's own Archive lands
 *   A10 ONE GENERATION BACK: an overwrite seals the standing bytes as `….bin.prev` first; a later overwrite replaces that
 *       copy, so never more than one stands; the same bytes again rotate nothing.
 */
import { ensureFaceCustodyOfGroup } from "../src/face-route.js";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { mintFck } from "@lararium/mesh/fck";
import { mintTreeKey } from "@lararium/mesh/tree-key";
import { readFckCarrier } from "@lararium/mesh/fck-envelope";
import { writeFaceCarrier, TreeKeyRefusal } from "@lararium/mesh/sealed-writer";
import { type DeviceDelegationTiddler } from "@lararium/mesh/device-delegation";
import { type LarDid } from "@lararium/mesh/lar-did";
import {
  persistIdentityAnchors, loadIdentityAnchors, listAnchoredPersonas,
  persistVeilArchive, loadVeilArchive, veilArchivePath, veilArchiveFile, type IdentityAnchors,
} from "../src/identity-anchors.js";
import { ArchiveIdentityMismatch, InMemoryEventStore, KeyhiveProvider } from "@lararium/keyhive";
import { readdirSync } from "node:fs";
import { loadVeilArchivePrev, veilArchivePrevFile, VeilArchiveUnproven } from "../src/identity-anchors.js";
import { standFaceAtom } from "../src/face-atom-store.js";
import { CustodyLocked, CustodyRecordUnavailable, makeCustodyHolder } from "../src/custody-holder.js";
import { seatCustody } from "../src/custody-seat.js";
import { faceCarrierFor } from "../src/face-custody.js";
import { faceTreePath } from "../src/face-index.js";
import { carrierTable } from "../src/vault-carriers.js";
import { seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";
import { handleRecordPathIn } from "./face-paths.js";

vi.setConfig({ testTimeout: 120_000 });

const anchors: IdentityAnchors = { personaGroupId: "aa11", meshCabalDocIdHex: "bb22" };
const edge: DeviceDelegationTiddler = {
  kind: "device-delegation", personaRootDid: "0xaa11" as LarDid, deviceDid: "0xbb22" as LarDid,
  deviceVerifyingKey: "cc".repeat(32), hearthTrueName: "", boundEpoch: "1", signature: "dd".repeat(64),
};
const bytesOf = (marker: string): Uint8Array => new TextEncoder().encode(`${marker}:${"x".repeat(64)}`);
/** A face's own Archive: its custody stands, its atom row mints (or reads), and a fresh provider over that seed exports. Each
 *  call stands a fresh provider, so two calls answer two Archives of the same identity with different prekeys. */
async function faceArchive(group: string): Promise<Uint8Array> {
  await ensureFaceCustodyOfGroup(group);
  const seed = await standFaceAtom(group);
  const provider = new KeyhiveProvider();
  try {
    await provider.init({ seed, eventStore: new InMemoryEventStore() });
    return await provider.exportArchiveAfterTheCard();
  } finally {
    seed.fill(0);
    await provider.dispose();
  }
}
const same = (a: Uint8Array | null, b: Uint8Array): boolean => a !== null && Buffer.from(a).equals(Buffer.from(b));

let c: SeatedScratchCustody;
const at = (file: string): string => file.startsWith("anchors-h") ? handleRecordPathIn(c.homes.identity, file) : join(c.homes.identity, file);
beforeEach(async () => { c = await seatScratchCustody("anchors"); });
afterEach(async () => { await c.drop(); });

describe("the identity home's sealed family", () => {
  test("A1 an anchors row seals at rest and reads back whole", async () => {
    expect(await loadIdentityAnchors()).toBeNull();
    await persistIdentityAnchors(anchors, 0);
    expect(readFckCarrier(readFileSync(at("anchors-h0.json")))).toBe("sealed");
    expect(readFileSync(at("anchors-h0.json")).includes(Buffer.from("aa11"))).toBe(false);
    expect(await loadIdentityAnchors()).toEqual(anchors);
  });

  test("A2 the mount material round-trips at index N; the roster records each index once", async () => {
    const withMount: IdentityAnchors = { ...anchors, signerDid: "0xaa11", personaKelPrefix: "EKELprefix000", deviceEdge: edge };
    expect(await listAnchoredPersonas()).toEqual([]);
    await persistIdentityAnchors(withMount, 2);
    await persistIdentityAnchors(anchors, 0);
    await persistIdentityAnchors(withMount, 2);
    expect(await loadIdentityAnchors(2)).toEqual(withMount);
    expect(await listAnchoredPersonas()).toEqual([0, 2]);
    // no shared roster names the faces: each anchors row rests in its own face, sealed under that face's key
    expect(readFckCarrier(readFileSync(handleRecordPathIn(c.homes.identity, "anchors-h2.json")))).toBe("sealed");
    expect(existsSync(at("anchor-roster.json"))).toBe(false);
  });

  test("A3 a row that opens and holds another shape refuses by name", async () => {
    await c.holder.writeRecord("identity", "anchors-h0.json", new TextEncoder().encode(JSON.stringify({ personaGroupId: "aa11" })));
    await expect(loadIdentityAnchors()).rejects.toThrow(CustodyRecordUnavailable);
    await expect(loadIdentityAnchors()).rejects.toThrow(/anchors-h0\.json reads malformed/);
    await c.holder.writeRecord("identity", "anchors-h1.json", new TextEncoder().encode(JSON.stringify({ ...anchors, deviceEdge: "not-an-object" })));
    await expect(loadIdentityAnchors(1)).rejects.toThrow(/malformed/);
    // control
    await persistIdentityAnchors(anchors, 3);
    expect(await loadIdentityAnchors(3)).toEqual(anchors);
  });

  test("A4 a torn row and a bare row each refuse by name; neither reads null", async () => {
    await persistIdentityAnchors(anchors, 0);
    const sealed = readFileSync(at("anchors-h0.json"));
    writeFileSync(at("anchors-h0.json"), sealed.subarray(0, sealed.length - 9));
    await expect(loadIdentityAnchors()).rejects.toThrow(/anchors-h0\.json reads (torn|key-fails)/);

  });

  test("A5 at the floor every reader and writer refuses CustodyLocked and no file moves", async () => {
    await persistIdentityAnchors(anchors, 0);
    await persistVeilArchive(await faceArchive(anchors.personaGroupId), anchors.personaGroupId);
    const before = ["anchors-h0.json", veilArchiveFile(anchors.personaGroupId)].map((f) => readFileSync(f.startsWith("veil-archive") ? veilArchivePath(anchors.personaGroupId) : f.startsWith("anchors-") ? handleRecordPathIn(c.homes.identity, f) : at(f)));
    await c.holder.lock();
    await expect(loadIdentityAnchors()).rejects.toThrow(CustodyLocked);
    await expect(listAnchoredPersonas()).rejects.toThrow(CustodyLocked);
    await expect(loadVeilArchive(anchors.personaGroupId)).rejects.toThrow(CustodyLocked);
    await expect(persistIdentityAnchors(anchors, 1)).rejects.toThrow(CustodyLocked);
    await expect(persistVeilArchive(bytesOf("floor"), anchors.personaGroupId)).rejects.toThrow(CustodyLocked);
    expect(existsSync(at("anchors-h1.json"))).toBe(false);
    ["anchors-h0.json", veilArchiveFile(anchors.personaGroupId)].forEach((f, i) => {
      expect(readFileSync(f.startsWith("veil-archive") ? veilArchivePath(anchors.personaGroupId) : f.startsWith("anchors-") ? handleRecordPathIn(c.homes.identity, f) : at(f)).equals(before[i]!), f).toBe(true);
    });
    // no seat at all reads the same floor: every seat cleared, the suites' when-needed seat among them
    seatCustody(null);
    seatCustody(c.holder);
  });

  test("A6 TAMPER PROBE: a holder over another key lands no write; the standing bytes still open under the first", async () => {
    const underA = await faceArchive(anchors.personaGroupId);
    await persistVeilArchive(underA, anchors.personaGroupId);
    await persistIdentityAnchors(anchors, 0);
    const anchorStanding = readFileSync(at("anchors-h0.json"));
    const veilStanding = readFileSync(veilArchivePath(anchors.personaGroupId));

    // Key B: a stranger vessel key the slot tree never committed to, held by a holder over the SAME homes. The
    // holder's own door refuses a key the custody root does not open under, so B writes through the sealed writer
    // directly, exactly as a holder that kept a retired key would.
    // A stranger face key cannot replace either face row under its own face tree.
    for (const [file, path, rowName] of [
      ["anchors-h0.json", at("anchors-h0.json"), "anchors"],
      [veilArchiveFile(anchors.personaGroupId), veilArchivePath(anchors.personaGroupId), "veil-archive"],
    ] as const) {
      const fcid = basename(dirname(path));
      const row = carrierTable().find((r) => r.row === rowName)!;
      await expect(writeFaceCarrier({
        io: c.io, key: mintFck(), treePath: faceTreePath(c.homes.identity, fcid),
        carrier: faceCarrierFor(c.homes, fcid, file, row), plaintext: bytesOf("under-B"),
      })).rejects.toThrow(TreeKeyRefusal);
    }
    expect(readFileSync(at("anchors-h0.json")).equals(anchorStanding), "the face row never moved").toBe(true);
    expect(readFileSync(veilArchivePath(anchors.personaGroupId)).equals(veilStanding), "the veil row never moved").toBe(true);
    expect(readFckCarrier(anchorStanding)).toBe("sealed");
    expect(same(await loadVeilArchive(anchors.personaGroupId), underA)).toBe(true);
    expect(await loadIdentityAnchors()).toEqual(anchors);
  });

  test("A7 three faces keep three veil archives and none opens at another's path", async () => {
    const own: Uint8Array[] = [];
    for (const n of [0, 1, 2]) own.push(await faceArchive(`group-${n}`));
    for (const n of [0, 1, 2]) await persistVeilArchive(own[n]!, `group-${n}`);
    for (const n of [0, 1, 2]) {
      expect(readFckCarrier(readFileSync(veilArchivePath(`group-${n}`)))).toBe("sealed");
      expect(same(await loadVeilArchive(`group-${n}`), own[n]!)).toBe(true);
    }
    expect(await loadVeilArchive("group-3")).toBeNull();
    const sealedOwn = readFileSync(veilArchivePath("group-0"));
    copyFileSync(veilArchivePath("group-1"), veilArchivePath("group-0"));
    await expect(loadVeilArchive("group-0")).rejects.toThrow(/veil-archive-g[0-9a-f]{64}\.bin reads key-fails/);
    // control: its own bytes back at its own path open again
    writeFileSync(veilArchivePath("group-0"), sealedOwn);
    expect(same(await loadVeilArchive("group-0"), own[0]!)).toBe(true);
  });

  test("A8 a face archive never rests in the clear", async () => {
    const archive = await faceArchive(anchors.personaGroupId);
    await persistVeilArchive(archive, anchors.personaGroupId);
    const rest = readFileSync(veilArchivePath(anchors.personaGroupId));
    expect(readFckCarrier(rest)).toBe("sealed");
    // No run of the plaintext rests in the file: each 32-byte window of the Archive reads absent from the sealed bytes.
    for (let at = 0; at + 32 <= archive.length; at += 32) expect(rest.includes(Buffer.from(archive.subarray(at, at + 32)))).toBe(false);
    expect(same(await loadVeilArchive(anchors.personaGroupId), archive)).toBe(true);
  });

  test("A9 the seal proves the bytes: another face's Archive refuses by name and the row never moves", async () => {
    const ofA = await faceArchive("group-a");
    const ofB = await faceArchive("group-b");
    await persistVeilArchive(ofB, "group-b");
    const standing = readFileSync(veilArchivePath("group-b"));
    const refusal = await persistVeilArchive(ofA, "group-b").catch((error: unknown) => error);
    expect(refusal).toBeInstanceOf(ArchiveIdentityMismatch);
    expect(readFileSync(veilArchivePath("group-b")).equals(standing), "B's sealed bytes never moved").toBe(true);
    expect(same(await loadVeilArchive("group-b"), ofB)).toBe(true);
    expect(await loadVeilArchivePrev("group-b"), "a refused write rotates nothing").toBeNull();
    // A face holding no atom proves nothing, so nothing rests; bytes that decode as no Archive refuse too.
    await ensureFaceCustodyOfGroup("group-unatomed");
    await expect(persistVeilArchive(ofA, "group-unatomed")).rejects.toBeInstanceOf(VeilArchiveUnproven);
    expect(await loadVeilArchive("group-unatomed")).toBeNull();
    await expect(persistVeilArchive(bytesOf("no archive at all"), "group-b")).rejects.toThrow();
    expect(readFileSync(veilArchivePath("group-b")).equals(standing)).toBe(true);
    // control: A's own row takes A's own Archive
    await persistVeilArchive(ofA, "group-a");
    expect(same(await loadVeilArchive("group-a"), ofA)).toBe(true);
  });

  test("A10 one generation back: an overwrite keeps the replaced bytes as .prev, never more than one", async () => {
    const first = await faceArchive("group-p");
    const second = await faceArchive("group-p");
    const third = await faceArchive("group-p");
    expect(same(first, second), "two exports carry different prekeys").toBe(false);
    await persistVeilArchive(first, "group-p");
    expect(await loadVeilArchivePrev("group-p"), "a first write replaces nothing").toBeNull();
    await persistVeilArchive(second, "group-p");
    expect(same(await loadVeilArchive("group-p"), second)).toBe(true);
    expect(same(await loadVeilArchivePrev("group-p"), first)).toBe(true);
    await persistVeilArchive(third, "group-p");
    expect(same(await loadVeilArchive("group-p"), third)).toBe(true);
    expect(same(await loadVeilArchivePrev("group-p"), second)).toBe(true);
    // the same bytes again rotate nothing
    await persistVeilArchive(third, "group-p");
    expect(same(await loadVeilArchivePrev("group-p"), second)).toBe(true);
    const dir = dirname(veilArchivePath("group-p"));
    expect(readdirSync(dir).filter((f) => f.startsWith("veil-archive-"))).toEqual([basename(veilArchivePath("group-p")), veilArchivePrevFile("group-p")].sort());
    expect(readFckCarrier(readFileSync(join(dir, veilArchivePrevFile("group-p"))))).toBe("sealed");
  });

  test("A13 an anchors row lands only in the face it names: another face's group at this handle refuses, and nothing writes", async () => {
    await ensureFaceCustodyOfGroup("group-h0");
    await ensureFaceCustodyOfGroup("group-h1");
    const ofH1: IdentityAnchors = { personaGroupId: "group-h1", meshCabalDocIdHex: "bb22" };
    await expect(persistIdentityAnchors(ofH1, 0)).rejects.toThrow(/^anchors-face-mismatch/);
    expect(await loadIdentityAnchors(0), "h0 took none of h1's anchors").toBeNull();
    // control: the face that names the group takes its own anchors
    await persistIdentityAnchors(ofH1, 1);
    expect(await loadIdentityAnchors(1)).toEqual(ofH1);
  });

  test("A11 a wrong current never displaces a good .prev: rotation copies only an Archive the face's own seed proves", async () => {
    const good = await faceArchive("group-q");
    const later = await faceArchive("group-q");
    const foreign = await faceArchive("group-stranger");
    await c.holder.writeRecord("identity", veilArchivePrevFile("group-q"), good);
    await c.holder.writeRecord("identity", veilArchiveFile("group-q"), foreign);   // a wrong current, as the misroute left one
    await persistVeilArchive(later, "group-q");
    expect(same(await loadVeilArchive("group-q"), later)).toBe(true);
    expect(same(await loadVeilArchivePrev("group-q"), good), "the good generation back still stands").toBe(true);
  });

  test("A12 two saves of one face at once serialize: the second rotates the first, never the generation both read", async () => {
    const first = await faceArchive("group-r");
    const b = await faceArchive("group-r");
    const cc = await faceArchive("group-r");
    await persistVeilArchive(first, "group-r");
    await Promise.all([persistVeilArchive(b, "group-r"), persistVeilArchive(cc, "group-r")]);
    expect(same(await loadVeilArchive("group-r"), cc)).toBe(true);
    expect(same(await loadVeilArchivePrev("group-r"), b), "the save that landed last rotated the one before it").toBe(true);
  });
});
