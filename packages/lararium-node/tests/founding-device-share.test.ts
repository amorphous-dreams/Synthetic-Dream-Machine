/**
 * founding-device-share.test — the device recovery share MINTS at the face founding.
 *
 * Absent by choice and absent by omission read identical from outside; only the mint at founding tells
 * them apart (recovery ruling: inception ARMS 1-of-1 self-recovery). `armRecoveryAtFounding` splits the
 * persona root 2-of-3 once, seals the device share into the identity home under the live seal policy, and
 * hands the two off-device carriers back for the operator to place BY HAND.
 *
 * CONTROLS: a second call re-mints nothing (byte-identical carrier — a re-stand never re-splits); the
 * founding seals one share beside the root and no second leg; a missing persona root
 * refuses rather than fabricating a share.
 */
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { readVkCarrier } from "@lararium/mesh";
import { generateOrLoadPersonaGroupRoot } from "../src/node-vessel-identity.js";
import { loadRecoveryDeviceShare, deviceSharePath } from "../src/recovery-share-store.js";
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
  });
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    rmSync(root, { recursive: true, force: true });
  });

  test("a founding mints the share; a re-found never re-mints; no second leg seals", async () => {
    await generateOrLoadPersonaGroupRoot(0);
    expect(await loadRecoveryDeviceShare(0)).toBeNull();

    const first = await armRecoveryAtFounding(root, 0);
    expect(first.minted).toBe(true);
    expect(first.recordedCode.length).toBeGreaterThan(0);
    expect(first.escrowCarrier.length).toBeGreaterThan(0);
    expect((await loadRecoveryDeviceShare(0))?.custodian).toBe("device");
    const bytes = readFileSync(deviceSharePath(0));
    expect(readVkCarrier(bytes)).toBe("sealed");                                        // a cold row under the vessel key, from its first write

    // CONTROL: the second act (a re-light, a re-stand) leaves the carrier byte-identical.
    const again = await armRecoveryAtFounding(root, 0);
    expect(again.minted).toBe(false);
    expect(readFileSync(deviceSharePath(0)).equals(bytes)).toBe(true);

    // CONTROL: one leg, not two: the founding seals the device share and nothing beside it in that home.
    expect(readdirSync(dirname(deviceSharePath(0))).filter((f) => f.endsWith(".bin") && f.includes("share"))).toEqual([basename(deviceSharePath(0))]);
  });

  test("the share lands under the vessel key, one row per face", async () => {
    await generateOrLoadPersonaGroupRoot(1);
    const r = await armRecoveryAtFounding(root, 1);
    expect(r.minted).toBe(true);
    const row = readFileSync(deviceSharePath(1));
    expect(readVkCarrier(row)).toBe("sealed");
    expect((await loadRecoveryDeviceShare(1))?.custodian).toBe("device");
    // h0 stays untouched — the split keys by handle-index.
    expect(await loadRecoveryDeviceShare(0)).toBeNull();
  });

  test("RED: the person holds both off-device shares BEFORE the device share rests, and a hand-out that fails seals nothing", async () => {
    await generateOrLoadPersonaGroupRoot(2);
    // The hand-out runs first: at that moment no device share rests yet.
    let restedAtHandOut: boolean | null = null;
    let handed: { recordedCode: string; escrowCarrier: string } | null = null;
    // A run that stops inside the hand-out (the terminal closed, the process ended) leaves NO device share...
    await expect(armRecoveryAtFounding(root, 2, () => { throw new Error("the run stopped before the person held the shares"); })).rejects.toThrow(/stopped before/);
    expect(existsSync(deviceSharePath(2))).toBe(false);
    // ...so the same command splits afresh, hands both shares out, and only then seals.
    const armed = await armRecoveryAtFounding(root, 2, (off) => { restedAtHandOut = existsSync(deviceSharePath(2)); handed = { ...off }; });
    expect(restedAtHandOut).toBe(false);
    expect(armed.minted).toBe(true);
    expect(handed).toEqual({ recordedCode: armed.recordedCode, escrowCarrier: armed.escrowCarrier });
    expect(readVkCarrier(readFileSync(deviceSharePath(2)))).toBe("sealed");
    // CONTROL: with the share at rest, a later run hands out nothing and re-splits nothing.
    let again = 0;
    expect((await armRecoveryAtFounding(root, 2, () => { again += 1; })).minted).toBe(false);
    expect(again).toBe(0);
  });

  test("CONTROL: no persona root at the index → refuses, fabricates no share", async () => {
    await expect(armRecoveryAtFounding(root, 3)).rejects.toThrow();
    expect(existsSync(deviceSharePath(3))).toBe(false);
  });
});
