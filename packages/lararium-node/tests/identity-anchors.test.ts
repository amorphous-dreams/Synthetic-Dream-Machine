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
 *   A6  THE TAMPER PROBE: a write under key A lands; a holder over key B refuses the write (`TreeVkRefusal`), the
 *       standing bytes never move, and they still open under A. The keyhive archive, a veil archive and an anchors
 *       row each carry the probe.
 *   A7  one face's veil archive rests in its own row: three faces keep three rows, each reads its own bytes, and
 *       one face's sealed bytes carried to another face's path open for nobody.
 *                                                                        control: back at its own path it opens
 *   A8  an archive written through the family never rests in the clear: the file carries the vessel key's seal
 *       and none of the plaintext.
 */
import { ensureFaceCustodyOfGroup } from "../src/face-route.js";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { mintFck, mintVk, readFckCarrier, readVkCarrier, writeFaceCarrier, TreeVkRefusal, type DeviceDelegationTiddler, type LarDid } from "@lararium/mesh";
import {
  persistIdentityAnchors, loadIdentityAnchors, listAnchoredPersonas, persistIdentityArchive, loadIdentityArchive,
  persistVeilArchive, loadVeilArchive, veilArchivePath, veilArchiveFile, archivePath, type IdentityAnchors,
} from "../src/identity-anchors.js";
import { CustodyLocked, CustodyRowUnavailable, makeCustodyHolder } from "../src/custody-holder.js";
import { seatCustody } from "../src/custody-seat.js";
import { faceCarrierFor } from "../src/face-custody.js";
import { faceTreePath } from "../src/face-index.js";
import { carrierTable } from "../src/vault-carriers.js";
import { seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";
import { handleRowPathIn } from "./face-paths.js";

vi.setConfig({ testTimeout: 120_000 });

const anchors: IdentityAnchors = { personaGroupId: "aa11", meshCabalDocIdHex: "bb22" };
const edge: DeviceDelegationTiddler = {
  kind: "device-delegation", personaRootDid: "0xaa11" as LarDid, deviceDid: "0xbb22" as LarDid,
  deviceVerifyingKey: "cc".repeat(32), hearthTrueName: "", boundEpoch: "1", signature: "dd".repeat(64),
};
const bytesOf = (marker: string): Uint8Array => new TextEncoder().encode(`${marker}:${"x".repeat(64)}`);

let c: SeatedScratchCustody;
const at = (file: string): string => file.startsWith("anchors-h") ? handleRowPathIn(c.homes.identity, file) : join(c.homes.identity, file);
beforeEach(async () => { c = await seatScratchCustody("anchors"); });
afterEach(async () => { await c.drop(); });

describe("the identity home's sealed family", () => {
  test("A1 an anchors row seals at rest and reads back whole", async () => {
    expect(await loadIdentityAnchors()).toBeNull();
    await persistIdentityAnchors(anchors);
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
    expect(readFckCarrier(readFileSync(handleRowPathIn(c.homes.identity, "anchors-h2.json")))).toBe("sealed");
    expect(existsSync(at("anchor-roster.json"))).toBe(false);
  });

  test("A3 a row that opens and holds another shape refuses by name", async () => {
    await c.holder.writeRow("identity", "anchors-h0.json", new TextEncoder().encode(JSON.stringify({ personaGroupId: "aa11" })));
    await expect(loadIdentityAnchors()).rejects.toThrow(CustodyRowUnavailable);
    await expect(loadIdentityAnchors()).rejects.toThrow(/anchors-h0\.json reads malformed/);
    await c.holder.writeRow("identity", "anchors-h1.json", new TextEncoder().encode(JSON.stringify({ ...anchors, deviceEdge: "not-an-object" })));
    await expect(loadIdentityAnchors(1)).rejects.toThrow(/malformed/);
    // control
    await persistIdentityAnchors(anchors, 3);
    expect(await loadIdentityAnchors(3)).toEqual(anchors);
  });

  test("A4 a torn row and a bare row each refuse by name; neither reads null", async () => {
    await persistIdentityAnchors(anchors);
    await persistIdentityArchive(bytesOf("archive"));
    const sealed = readFileSync(at("anchors-h0.json"));
    writeFileSync(at("anchors-h0.json"), sealed.subarray(0, sealed.length - 9));
    await expect(loadIdentityAnchors()).rejects.toThrow(/anchors-h0\.json reads (torn|key-fails)/);
    writeFileSync(archivePath(), bytesOf("a bare archive from an earlier shape"));
    await expect(loadIdentityArchive()).rejects.toThrow(/keyhive-archive\.bin reads bare/);
    // a writer never lands over what it cannot open
    await expect(persistIdentityArchive(bytesOf("fresh"))).rejects.toThrow();
    expect(readFileSync(archivePath()).equals(Buffer.from(bytesOf("a bare archive from an earlier shape")))).toBe(true);
  });

  test("A5 at the floor every reader and writer refuses CustodyLocked and no file moves", async () => {
    await persistIdentityAnchors(anchors);
    await persistIdentityArchive(bytesOf("archive"));
    await ensureFaceCustodyOfGroup(anchors.personaGroupId);
    await persistVeilArchive(bytesOf("veil"), anchors.personaGroupId);
    const before = ["anchors-h0.json", "keyhive-archive.bin", veilArchiveFile(anchors.personaGroupId)].map((f) => readFileSync(f.startsWith("veil-archive") ? veilArchivePath(anchors.personaGroupId) : f.startsWith("anchors-") ? handleRowPathIn(c.homes.identity, f) : at(f)));
    await c.holder.lock();
    await expect(loadIdentityAnchors()).rejects.toThrow(CustodyLocked);
    await expect(listAnchoredPersonas()).rejects.toThrow(CustodyLocked);
    await expect(loadIdentityArchive()).rejects.toThrow(CustodyLocked);
    await expect(loadVeilArchive(anchors.personaGroupId)).rejects.toThrow(CustodyLocked);
    await expect(persistIdentityAnchors(anchors, 1)).rejects.toThrow(CustodyLocked);
    await expect(persistIdentityArchive(bytesOf("floor"))).rejects.toThrow(CustodyLocked);
    await expect(persistVeilArchive(bytesOf("floor"), anchors.personaGroupId)).rejects.toThrow(CustodyLocked);
    expect(existsSync(at("anchors-h1.json"))).toBe(false);
    ["anchors-h0.json", "keyhive-archive.bin", veilArchiveFile(anchors.personaGroupId)].forEach((f, i) => {
      expect(readFileSync(f.startsWith("veil-archive") ? veilArchivePath(anchors.personaGroupId) : f.startsWith("anchors-") ? handleRowPathIn(c.homes.identity, f) : at(f)).equals(before[i]!), f).toBe(true);
    });
    // no seat at all reads the same floor: every seat cleared, the suites' when-needed seat among them
    seatCustody(null);
    await expect(loadIdentityArchive()).rejects.toThrow(CustodyLocked);
    seatCustody(c.holder);
  });

  test("A6 TAMPER PROBE: a holder over another key lands no write; the standing bytes still open under the first", async () => {
    await persistIdentityArchive(bytesOf("archive-under-A"));
    await ensureFaceCustodyOfGroup(anchors.personaGroupId);
    await persistVeilArchive(bytesOf("veil-under-A"), anchors.personaGroupId);
    await persistIdentityAnchors(anchors);
    const files = ["keyhive-archive.bin"];
    const standing = files.map((f) => readFileSync(f.startsWith("veil-archive") ? veilArchivePath(anchors.personaGroupId) : f.startsWith("anchors-") ? handleRowPathIn(c.homes.identity, f) : at(f)));
    const anchorStanding = readFileSync(at("anchors-h0.json"));
    const veilStanding = readFileSync(veilArchivePath(anchors.personaGroupId));

    // Key B: a stranger vessel key the slot tree never committed to, held by a holder over the SAME homes. The
    // holder's own door refuses a key the custody root does not open under, so B writes through the sealed writer
    // directly, exactly as a holder that kept a retired key would.
    const { writeSealedCarrier } = await import("@lararium/mesh");
    const { vkSlotsPath } = await import("../src/vault-carriers.js");
    const keyB = mintVk();
    for (const f of files) {
      await expect(writeSealedCarrier({
        io: c.io, vk: keyB, treePath: vkSlotsPath(c.homes.identity),
        carrier: { name: `identity/${f}`, path: at(f), keyClass: null }, plaintext: bytesOf("under-B"),
      })).rejects.toThrow(TreeVkRefusal);
    }
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
      })).rejects.toThrow(TreeVkRefusal);
    }
    await expect(makeCustodyHolder({ io: c.io, homes: c.homes }).adopt(keyB)).rejects.toThrow(/custody root reads key-fails/);
    files.forEach((f, i) => expect(readFileSync(f.startsWith("veil-archive") ? veilArchivePath(anchors.personaGroupId) : f.startsWith("anchors-") ? handleRowPathIn(c.homes.identity, f) : at(f)).equals(standing[i]!), `${f} never moved`).toBe(true));
    expect(readFileSync(at("anchors-h0.json")).equals(anchorStanding), "the face row never moved").toBe(true);
    expect(readFileSync(veilArchivePath(anchors.personaGroupId)).equals(veilStanding), "the veil row never moved").toBe(true);
    expect(readFckCarrier(anchorStanding)).toBe("sealed");
    expect(Array.from((await loadIdentityArchive())!)).toEqual(Array.from(bytesOf("archive-under-A")));
    expect(Array.from((await loadVeilArchive(anchors.personaGroupId))!)).toEqual(Array.from(bytesOf("veil-under-A")));
    expect(await loadIdentityAnchors()).toEqual(anchors);
  });

  test("A7 three faces keep three veil archives and none opens at another's path", async () => {
    for (const n of [0, 1, 2]) await ensureFaceCustodyOfGroup(`group-${n}`);
    for (const n of [0, 1, 2]) await persistVeilArchive(bytesOf(`veil-of-face-${n}`), `group-${n}`);
    for (const n of [0, 1, 2]) {
      expect(readFckCarrier(readFileSync(veilArchivePath(`group-${n}`)))).toBe("sealed");
      expect(Array.from((await loadVeilArchive(`group-${n}`))!)).toEqual(Array.from(bytesOf(`veil-of-face-${n}`)));
    }
    expect(await loadVeilArchive("group-3")).toBeNull();
    const own = readFileSync(veilArchivePath("group-0"));
    copyFileSync(veilArchivePath("group-1"), veilArchivePath("group-0"));
    await expect(loadVeilArchive("group-0")).rejects.toThrow(/veil-archive-g[0-9a-f]{64}\.bin reads key-fails/);
    // control: its own bytes back at its own path open again
    writeFileSync(veilArchivePath("group-0"), own);
    expect(Array.from((await loadVeilArchive("group-0"))!)).toEqual(Array.from(bytesOf("veil-of-face-0")));
  });

  test("A8 an archive never rests in the clear", async () => {
    const marker = bytesOf("PLAINTEXT-MARKER-keyhive-archive");
    await persistIdentityArchive(marker);
    const rest = readFileSync(archivePath());
    expect(readVkCarrier(rest)).toBe("sealed");
    expect(rest.includes(Buffer.from("PLAINTEXT-MARKER"))).toBe(false);
    expect(Array.from((await loadIdentityArchive())!)).toEqual(Array.from(marker));
  });
});
