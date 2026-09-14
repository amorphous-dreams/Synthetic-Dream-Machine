/**
 * M2 — the veiled-Handle anchors round-trip through the sovereign identity home, so a
 * substrate rebirth can re-read the SAME PersonaGroup/MeshCabal ids + agentId.
 */
import { mkdtempSync, rmSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { larIdentityDir } from "../src/vessel-paths.js";
import { persistIdentityAnchors, loadIdentityAnchors, persistIdentityArchive, loadIdentityArchive, persistVeilArchive, loadVeilArchive, type IdentityAnchors } from "../src/identity-anchors.js";
import { isSealedEnvelope, type DeviceDelegationTiddler, type LarDid } from "@lararium/mesh";
import { ARCHIVE_PASSPHRASE_ENV } from "../src/archive-seal.js";

const saved: Record<string, string | undefined> = {};
function setEnv(k: string, v: string | undefined): void {
  saved[k] = process.env[k];
  if (v === undefined) delete process.env[k]; else process.env[k] = v;
}

describe("identity anchors (M2)", () => {
  let root: string;
  const anchors: IdentityAnchors = {
    personaGroupDocIdHex:   "aa11",
    meshCabalDocIdHex:      "bb22",
    personaGroupAgentIdHex: "cc33",
  };
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lares-anchors-"));
    setEnv("LAR_ROOT", undefined);
    setEnv("XDG_STATE_HOME", join(root, "state"));
    setEnv("XDG_DATA_HOME", join(root, "state"));   // identity/seal/library answer HERE
  });
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    rmSync(root, { recursive: true, force: true });
  });

  test("persists into the identity home and reads back identically", () => {
    expect(loadIdentityAnchors()).toBeNull();               // nothing yet
    persistIdentityAnchors(anchors);
    expect(existsSync(join(larIdentityDir(), "anchors-h0.json"))).toBe(true);
    expect(loadIdentityAnchors()).toEqual(anchors);
  });

  test("an incomplete anchors file reads as null (never a partial Handle)", () => {
    persistIdentityAnchors(anchors);
    // Overwrite with a partial record.
    writeFileSync(join(larIdentityDir(), "anchors-h0.json"), JSON.stringify({ personaGroupDocIdHex: "aa11" }));
    expect(loadIdentityAnchors()).toBeNull();
  });

  // The wear-reboot mount-switch: an added persona (N>0) founds mount:false and pins nothing into the daemon
  // doc, so its mount material must persist HERE to survive a reboot. All three are PUBLIC (a signer DID, a
  // KEL prefix, a signed grant record — no secret), so they belong beside the doc-ids.
  const edge: DeviceDelegationTiddler = {
    kind: "device-delegation",
    personaRootDid: "0xaa11" as LarDid,
    deviceDid: "0xbb22" as LarDid,
    deviceVerifyingKey: "cc".repeat(32),
    hearthTrueName: "",
    issuedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2027-01-01T00:00:00.000Z",
    boundEpoch: "1",
    signature: "dd".repeat(64),
  };

  test("CONTROL — the mount material (signerDid · KEL prefix · signed device edge) round-trips at index N", () => {
    const withMount: IdentityAnchors = {
      ...anchors, signerDid: "0xaa11", personaKelPrefix: "EKELprefix000", deviceEdge: edge,
    };
    persistIdentityAnchors(withMount, 1);
    expect(loadIdentityAnchors(1)).toEqual(withMount);
  });

  test("★ a malformed device edge reads as null — the re-pin never trusts a torn grant ★", () => {
    persistIdentityAnchors(anchors);
    // A well-formed anchor except the device edge is not an object (a torn/garbage write). The boot re-pin
    // would hand this to verifyDeviceDelegation; fail closed at the READ instead of feeding it a non-record.
    writeFileSync(join(larIdentityDir(), "anchors-h0.json"),
      JSON.stringify({ ...anchors, signerDid: "0xaa11", personaKelPrefix: "EKELprefix000", deviceEdge: "not-an-object" }));
    expect(loadIdentityAnchors()).toBeNull();
  });

  test("the keyhive archive round-trips through the identity home (M3)", () => {
    expect(loadIdentityArchive()).toBeNull();
    const bytes = Uint8Array.from([0x85, 0x6f, 0x4a, 0x83, 0x01, 0x02, 0x03]);
    persistIdentityArchive(bytes);
    expect(existsSync(join(larIdentityDir(), "keyhive-archive.bin"))).toBe(true);
    expect(Array.from(loadIdentityArchive() ?? [])).toEqual(Array.from(bytes));
  });

  // A vessel standing at the WAKING FLOOR boots WITHOUT its archive (no passphrase) and the M3 floor still
  // exports the keyhive it booted — a fresh, empty identity. Written over the sealed archive as cleartext,
  // that would replace the sovereign identity with nothing and read as "unsealed" to every later boot.
  test("a cleartext write REFUSES to replace a sealed archive (the floor writes no identity)", () => {
    const sovereign = Uint8Array.from([0x85, 0x6f, 0x4a, 0x83, 0x01, 0x02, 0x03]);
    setEnv(ARCHIVE_PASSPHRASE_ENV, "witness-passphrase-anchors");
    persistIdentityArchive(sovereign);
    persistVeilArchive(sovereign);
    const sealed = readFileSync(join(larIdentityDir(), "keyhive-archive.bin"));
    expect(isSealedEnvelope(sealed)).toBe(true);

    setEnv(ARCHIVE_PASSPHRASE_ENV, undefined);
    const fresh = Uint8Array.from([0x00, 0x01]);
    expect(() => persistIdentityArchive(fresh)).toThrow(/sealed/);
    expect(() => persistVeilArchive(fresh)).toThrow(/sealed/);
    expect(readFileSync(join(larIdentityDir(), "keyhive-archive.bin")).equals(sealed), "bytes untouched").toBe(true);
    expect(isSealedEnvelope(readFileSync(join(larIdentityDir(), "veil-archive.bin")))).toBe(true);

    // CONTROL: under the passphrase the same write lands (a re-seal, fresh salt), and reads back.
    setEnv(ARCHIVE_PASSPHRASE_ENV, "witness-passphrase-anchors");
    persistIdentityArchive(sovereign);
    expect(Array.from(loadIdentityArchive() ?? [])).toEqual(Array.from(sovereign));
    expect(Array.from(loadVeilArchive() ?? [])).toEqual(Array.from(sovereign));
  });

  /**
   * ── THE OTHER HALF OF THE SAME FLOOR, AND IT COSTS THE IDENTITY ────────────────────────────────
   * The cleartext guard above reads "no key" as the floor's only shape. A WRONG key wears the same
   * floor: `readArchiveOpening` answers `key-wrong`, the boot stands faceless, and the M3 export
   * still fires — this time with a passphrase in hand, so the seal SUCCEEDS and a fresh, empty
   * keyhive lands over the sovereign one, re-sealed under a passphrase that never opened it.
   *
   * MEASURED end to end: `vault rotate` old→new, then a stand under the OLD passphrase, and the
   * sealed archive comes back readable only under the OLD one. The next stand under the NEW
   * passphrase reads `key-wrong` and stands at the floor — `tests/e2e/vessel-sealed.test.ts` ⑤,
   * failing on `bag not registered: lar:///ha.ka.ba/wikis/lares/working`.
   *
   * THE INVARIANT: a write lands over a SEALED carrier only under a key that OPENS it. The seal
   * governs the write as well as the read; a mistyped passphrase destroys nothing.
   */
  test("★ a write under a NON-OPENING passphrase REFUSES to replace a sealed archive ★", () => {
    const sovereign = Uint8Array.from([0x85, 0x6f, 0x4a, 0x83, 0x01, 0x02, 0x03]);
    setEnv(ARCHIVE_PASSPHRASE_ENV, "witness-passphrase-current");
    persistIdentityArchive(sovereign);
    persistVeilArchive(sovereign);
    const sealed = readFileSync(join(larIdentityDir(), "keyhive-archive.bin"));
    const sealedVeil = readFileSync(join(larIdentityDir(), "veil-archive.bin"));

    // The floor's fresh keyhive, offered under a passphrase the sealed bytes never answer to.
    setEnv(ARCHIVE_PASSPHRASE_ENV, "witness-passphrase-stale-x");
    const fresh = Uint8Array.from([0x00, 0x01]);
    expect(() => persistIdentityArchive(fresh)).toThrow(/sealed/);
    expect(() => persistVeilArchive(fresh)).toThrow(/sealed/);
    expect(readFileSync(join(larIdentityDir(), "keyhive-archive.bin")).equals(sealed), "the stale key rewrote the archive").toBe(true);
    expect(readFileSync(join(larIdentityDir(), "veil-archive.bin")).equals(sealedVeil), "the stale key rewrote the veil").toBe(true);

    // CONTROL — the OPENING passphrase still writes, and the sovereign bytes read back whole.
    setEnv(ARCHIVE_PASSPHRASE_ENV, "witness-passphrase-current");
    persistIdentityArchive(sovereign);
    persistVeilArchive(sovereign);
    expect(Array.from(loadIdentityArchive() ?? [])).toEqual(Array.from(sovereign));
    expect(Array.from(loadVeilArchive() ?? [])).toEqual(Array.from(sovereign));
  });
});
