/**
 * archive-passphrase.test (#60) — the at-rest seal LIFECYCLE over the share carriers.
 *
 * Proves the fail-closed guarantees the passphrase surface stands on:
 *   · seal      → cleartext shares become sealed envelopes.
 *   · rotate    → both shares open under the NEW passphrase and FAIL (GCM) under the old.
 *   · wrong old → ZERO writes: the on-disk bytes stay byte-identical to the pre-call state.
 *   · status    → truthful per-carrier state, including a SPLIT-KEK (and repair closes it).
 *   · daemon-up (runVaultVerb) and daemon-down (direct) land byte-identical shares.
 *
 * The seal itself is proved in archive-seal.test; this proves the LIFECYCLE composed over it.
 */
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { isSealedEnvelope, decodeEnvelope } from "@lararium/mesh";
import { scryptKek, unsealBytes, ARCHIVE_PASSPHRASE_ENV } from "../src/archive-seal.js";
import { larIdentityDir } from "../src/vessel-paths.js";
import { deviceSharePath, persistRecoveryDeviceShare } from "../src/recovery-share-store.js";
import {
  archiveSealStatus, sealArchiveWithPassphrase, rotateArchivePassphrase,
  repairSplitKek, runVaultVerb, weakPassphraseWarning,
} from "../src/archive-passphrase.js";

const saved: Record<string, string | undefined> = {};
function setEnv(k: string, v: string | undefined): void {
  if (!(k in saved)) saved[k] = process.env[k];
  if (v === undefined) delete process.env[k]; else process.env[k] = v;
}

const PASS_A = "correct horse battery staple";
const PASS_B = "a different long passphrase here";

const DEVICE_SHARE = { bytes: { x: 17, ys: new Uint8Array([18, 19, 20]) }, custodian: "device" as const, recoveryEpoch: 1 };
const DEVICE_SHARE_PLAIN = new TextEncoder().encode(JSON.stringify({ x: 17, ys: [18, 19, 20], custodian: "device", recoveryEpoch: 1 }));
const SECOND_SHARE_PLAIN = new TextEncoder().encode(JSON.stringify({ x: 45, ys: [46, 47, 48], custodian: "device", recoveryEpoch: 1 }));

/** Unseal a sealed carrier's bytes under a passphrase (mirrors the core's private opener). */
function opensUnder(bytes: Uint8Array, pass: string): boolean {
  try { const e = decodeEnvelope(bytes); unsealBytes(e, scryptKek(pass, e.salt)); return true; }
  catch { return false; }
}
function plainUnder(bytes: Uint8Array, pass: string): Uint8Array {
  const e = decodeEnvelope(bytes);
  return unsealBytes(e, scryptKek(pass, e.salt));
}

describe("archive-passphrase — the at-rest seal lifecycle", () => {
  let root: string;

  const writeCleartextShares = (opts: { second?: boolean } = {}): void => {
    persistRecoveryDeviceShare(DEVICE_SHARE, 0);
    if (opts.second) persistRecoveryDeviceShare({ bytes: { x: 45, ys: new Uint8Array([46, 47, 48]) }, custodian: "device", recoveryEpoch: 1 }, 1);
  };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lares-vault-"));
    setEnv("LAR_ROOT", root);                       // isolates BOTH the identity carriers AND the config
    setEnv(ARCHIVE_PASSPHRASE_ENV, undefined);
    setEnv("LARES_ARCHIVE_PASSPHRASE_NEW", undefined);
  });
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    for (const k of Object.keys(saved)) delete saved[k];
    rmSync(root, { recursive: true, force: true });
  });

  test("seal → cleartext device share becomes sealed and status records the seal policy", { timeout: 60_000 }, () => {
    writeCleartextShares();
    const r = sealArchiveWithPassphrase(PASS_A);
    expect(r.sealed).toEqual(["device-share-h0"]);
    expect(isSealedEnvelope(readFileSync(deviceSharePath(0)))).toBe(true);
    expect(archiveSealStatus().sealExpected).toBe(true);
    expect([...plainUnder(readFileSync(deviceSharePath(0)), PASS_A)]).toEqual([...DEVICE_SHARE_PLAIN]);
  });

  test("seal is idempotent — a second seal skips the already-sealed carriers", { timeout: 60_000 }, () => {
    writeCleartextShares();
    sealArchiveWithPassphrase(PASS_A);
    const before = readFileSync(deviceSharePath(0));
    const r2 = sealArchiveWithPassphrase(PASS_A);
    expect(r2.sealed).toEqual([]);                   // nothing re-sealed
    expect(r2.skipped).toEqual(["device-share-h0"]);
    expect([...readFileSync(deviceSharePath(0))]).toEqual([...before]);
  });

  test("rotate old→new — BOTH device shares open under the new passphrase and FAIL under the old", { timeout: 60_000 }, () => {
    writeCleartextShares({ second: true });
    sealArchiveWithPassphrase(PASS_A);
    const r = rotateArchivePassphrase(PASS_A, PASS_B);
    expect(r.rotated.sort()).toEqual(["device-share-h0", "device-share-h1"]);
    for (const p of [deviceSharePath(0), deviceSharePath(1)]) {
      expect(opensUnder(readFileSync(p), PASS_B)).toBe(true);
      expect(opensUnder(readFileSync(p), PASS_A)).toBe(false);
    }
    // plaintext survives the rotation intact.
    expect([...plainUnder(readFileSync(deviceSharePath(0)), PASS_B)]).toEqual([...DEVICE_SHARE_PLAIN]);
    expect([...plainUnder(readFileSync(deviceSharePath(1)), PASS_B)]).toEqual([...SECOND_SHARE_PLAIN]);
  });

  test("rotate with ONE device share — h0 rotates when h1 is absent", { timeout: 60_000 }, () => {
    writeCleartextShares();
    sealArchiveWithPassphrase(PASS_A);
    const r = rotateArchivePassphrase(PASS_A, PASS_B);
    expect(r.rotated).toEqual(["device-share-h0"]);
    expect(opensUnder(readFileSync(deviceSharePath(0)), PASS_B)).toBe(true);
    expect(existsSync(deviceSharePath(1))).toBe(false);
  });

  test("wrong old passphrase → ZERO writes (on-disk bytes byte-identical to pre-call)", { timeout: 60_000 }, () => {
    writeCleartextShares();
    sealArchiveWithPassphrase(PASS_A);
    const shareBefore = readFileSync(deviceSharePath(0));
    expect(() => rotateArchivePassphrase("the WRONG old passphrase", PASS_B)).toThrow();
    // fail-closed: not one byte moved.
    expect([...readFileSync(deviceSharePath(0))]).toEqual([...shareBefore]);
    // The device share still opens under the ORIGINAL passphrase.
    expect(opensUnder(readFileSync(deviceSharePath(0)), PASS_A)).toBe(true);
  });

  test("status — truthful per-carrier state (absent/cleartext/sealed) and split detection + repair", { timeout: 60_000 }, () => {
    // Cleartext share state.
    writeCleartextShares();
    let s = archiveSealStatus();
    expect(s.carriers["device-share-h0"]!.state).toBe("cleartext");
    // A device share that never stood names no carrier at all (the family reads the disk), and the reserve share
    // rides the vessel key, so this lifecycle names no carrier for it.
    expect((s.carriers as Record<string, unknown>)["reserve-share"]).toBeUndefined();
    expect(s.carriers["device-share-h1"]).toBeUndefined();

    // Seal h0 under PASS_A, then add and seal h1 under PASS_B to create a split.
    sealArchiveWithPassphrase(PASS_A);
    persistRecoveryDeviceShare({ bytes: { x: 45, ys: new Uint8Array([46, 47, 48]) }, custodian: "device", recoveryEpoch: 1 }, 1);
    sealArchiveWithPassphrase(PASS_B);
    s = archiveSealStatus({ probe: PASS_A });
    expect(s.carriers["device-share-h0"]!.opensUnderProbe).toBe(true);
    expect(s.carriers["device-share-h1"]!.opensUnderProbe).toBe(false);
    expect(s.split).toBe(true);                      // the carriers disagree on PASS_A → split-KEK

    // repair: bring the lagging share (opens under PASS_B) UNDER PASS_A.
    const rep = repairSplitKek(PASS_B, PASS_A);
    expect(rep.repaired).toEqual(["device-share-h1"]);
    expect(rep.alreadyConsistent).toEqual(["device-share-h0"]);
    const after = archiveSealStatus({ probe: PASS_A });
    expect(after.split).toBe(false);
    expect(after.carriers["device-share-h0"]!.opensUnderProbe).toBe(true);
    expect(after.carriers["device-share-h1"]!.opensUnderProbe).toBe(true);
  });

  test("daemon-up (runVaultVerb) and daemon-down (direct) land byte-equivalent carriers + set the in-memory policy", { timeout: 60_000 }, async () => {
    // daemon-down: direct seal.
    writeCleartextShares();
    sealArchiveWithPassphrase(PASS_A);
    const directPlaintext = plainUnder(readFileSync(deviceSharePath(0)), PASS_A);

    // fresh vessel, daemon-up path: the same seal through the verb handler.
    rmSync(larIdentityDir(), { recursive: true, force: true });
    writeCleartextShares();
    setEnv(ARCHIVE_PASSPHRASE_ENV, undefined);
    const out = await runVaultVerb("vault-seal", { passphrase: PASS_A });
    expect(out["verb"]).toBe("vault-seal");
    expect(isSealedEnvelope(readFileSync(deviceSharePath(0)))).toBe(true);
    // the handler updated the worker's OWN in-memory seal policy (no un-rotate on the next M3 seal).
    expect(process.env[ARCHIVE_PASSPHRASE_ENV]).toBe(PASS_A);
    // both paths recover the SAME plaintext.
    expect([...plainUnder(readFileSync(deviceSharePath(0)), PASS_A)]).toEqual([...directPlaintext]);

    // rotate through the handler moves the policy with the carriers.
    await runVaultVerb("vault-rotate", { old: PASS_A, new: PASS_B });
    expect(process.env[ARCHIVE_PASSPHRASE_ENV]).toBe(PASS_B);
    expect(opensUnder(readFileSync(deviceSharePath(0)), PASS_B)).toBe(true);

    // status through the handler is a pure read (no policy mutation).
    const st = await runVaultVerb("vault-status", {});
    expect(st["sealExpected"]).toBe(true);
  });

  test("empty passphrase is refused (fail-closed); a weak one only WARNS (soft floor)", { timeout: 60_000 }, () => {
    writeCleartextShares();
    expect(() => sealArchiveWithPassphrase("")).toThrow();
    expect(weakPassphraseWarning("short")).toMatch(/floor/);
    expect(weakPassphraseWarning(PASS_A)).toBeNull();
  });

  // The second device-share handle remains on the lifecycle through rotation.
  test("rotate carries every device share — no carrier stays behind", { timeout: 120_000 }, () => {
    writeCleartextShares();
    persistRecoveryDeviceShare({ bytes: { x: 45, ys: new Uint8Array([46, 47, 48]) }, custodian: "device", recoveryEpoch: 1 }, 1);

    const sealed = sealArchiveWithPassphrase(PASS_A);
    expect(sealed.sealed.sort()).toEqual(["device-share-h0", "device-share-h1"]);
    expect(isSealedEnvelope(readFileSync(deviceSharePath(1)))).toBe(true);

    const rotated = rotateArchivePassphrase(PASS_A, PASS_B);
    expect(rotated.rotated.sort()).toEqual(["device-share-h0", "device-share-h1"]);
    expect(opensUnder(readFileSync(deviceSharePath(1)), PASS_B)).toBe(true);
    expect(opensUnder(readFileSync(deviceSharePath(1)), PASS_A)).toBe(false);
    expect(Array.from(plainUnder(readFileSync(deviceSharePath(0)), PASS_B))).toEqual(Array.from(DEVICE_SHARE_PLAIN));
    expect(Array.from(plainUnder(readFileSync(deviceSharePath(1)), PASS_B))).toEqual(Array.from(SECOND_SHARE_PLAIN));

    const status = archiveSealStatus({ probe: PASS_B });
    expect(status.carriers["device-share-h1"]).toMatchObject({ state: "sealed", opensUnderProbe: true });
    expect(status.split).toBe(false);
  });
});
