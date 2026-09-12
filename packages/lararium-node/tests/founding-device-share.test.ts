/**
 * founding-device-share.test — the device recovery share MINTS at the face founding.
 *
 * Absent by choice and absent by omission read identical from outside; only the mint at founding tells
 * them apart (recovery ruling: inception ARMS 1-of-1 self-recovery). `armRecoveryAtFounding` splits the
 * persona root 2-of-3 once, seals the device share into the identity home under the live seal policy, and
 * hands the two off-device carriers back for the operator to place BY HAND.
 *
 * CONTROLS: a second call re-mints nothing (byte-identical carrier — a re-stand never re-splits); the
 * reserve share stays absent (one leg, not two — the keel pass owns the reserve); a missing persona root
 * refuses rather than fabricating a share.
 */
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { isSealedEnvelope } from "@lararium/mesh";
import { generateOrLoadPersonaGroupRoot } from "../src/node-vessel-identity.js";
import { loadRecoveryDeviceShare, deviceSharePath } from "../src/recovery-share-store.js";
import { reserveMineSharePath } from "../src/seal-reserve-store.js";
import { archiveSealStatus } from "../src/archive-passphrase.js";
import { armRecoveryAtFounding } from "../src/commands/init.js";

const saved: Record<string, string | undefined> = {};
function setEnv(k: string, v: string | undefined): void {
  saved[k] = process.env[k];
  if (v === undefined) delete process.env[k]; else process.env[k] = v;
}

describe("the device share mints at the face founding", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lares-found-share-"));
    setEnv("LAR_ROOT", undefined);
    setEnv("XDG_STATE_HOME", join(root, "state"));
    setEnv("XDG_DATA_HOME", join(root, "state"));
    setEnv("LARES_ARCHIVE_PASSPHRASE", undefined);
  });
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    rmSync(root, { recursive: true, force: true });
  });

  test("a founding mints the share; a re-found never re-mints; the reserve stays absent", async () => {
    await generateOrLoadPersonaGroupRoot(root, 0);
    expect(loadRecoveryDeviceShare(0)).toBeNull();

    const first = await armRecoveryAtFounding(root, 0);
    expect(first.minted).toBe(true);
    expect(first.recordedCode.length).toBeGreaterThan(0);
    expect(first.escrowCarrier.length).toBeGreaterThan(0);
    expect(loadRecoveryDeviceShare(0)?.custodian).toBe("device");
    const bytes = readFileSync(deviceSharePath(0));
    expect(archiveSealStatus().carriers["device-share"].state).toBe("cleartext");   // no policy → bare, honestly

    // CONTROL: the second act (a re-light, a re-stand) leaves the carrier byte-identical.
    const again = await armRecoveryAtFounding(root, 0);
    expect(again.minted).toBe(false);
    expect(readFileSync(deviceSharePath(0)).equals(bytes)).toBe(true);

    // CONTROL: one leg, not two.
    expect(existsSync(reserveMineSharePath())).toBe(false);
    expect(archiveSealStatus().carriers["reserve-share"].state).toBe("absent");
  });

  test("under the seal policy the share lands sealed (passphrase), the same policy the veil rides", async () => {
    setEnv("LARES_ARCHIVE_PASSPHRASE", "founding-share-witness-passphrase");
    await generateOrLoadPersonaGroupRoot(root, 1);
    const r = await armRecoveryAtFounding(root, 1);
    expect(r.minted).toBe(true);
    expect(isSealedEnvelope(readFileSync(deviceSharePath(1)))).toBe(true);
    expect(loadRecoveryDeviceShare(1)?.custodian).toBe("device");
    // h0 stays untouched — the split keys by handle-index.
    expect(loadRecoveryDeviceShare(0)).toBeNull();
  });

  test("CONTROL: no persona root at the index → refuses, fabricates no share", async () => {
    await expect(armRecoveryAtFounding(root, 3)).rejects.toThrow();
    expect(existsSync(deviceSharePath(3))).toBe(false);
  });
});
