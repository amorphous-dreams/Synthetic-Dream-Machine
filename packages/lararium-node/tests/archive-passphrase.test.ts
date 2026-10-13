/**
 * archive-passphrase — the passphrase seal lifecycle over a vessel whose every share row rests under the vessel key.
 *
 * The lifecycle governs NO carrier: the charter reserve's share and each face's device recovery share rest as
 * custody rows (`seal-reserve-store`, `recovery-share-store`). Its verbs stand until the retirement, and this suite
 * holds what they do meanwhile: they find nothing to move, and they move nothing.
 *
 *   P1  the lifecycle names no carrier: `vaultCarriers()` answers none and `vault status` lists none, with a
 *       VK-sealed device share and a VK-sealed reserve share standing in the identity home.
 *   P2  `seal` seals nothing and skips nothing, `rotate` refuses "nothing is sealed", `repair` repairs nothing,
 *       and every share row's bytes stand untouched after each.
 *   P3  an empty passphrase refuses; a weak one warns.
 */
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, test } from "vitest";
import { readVkCarrier } from "@lararium/mesh";
import {
  archiveSealStatus, repairSplitKek, rotateArchivePassphrase, runVaultVerb, sealArchiveWithPassphrase, weakPassphraseWarning,
} from "../src/archive-passphrase.js";
import { ARCHIVE_PASSPHRASE_ENV } from "../src/archive-seal.js";
import { deviceSharePath, persistRecoveryDeviceShare } from "../src/recovery-share-store.js";
import { provisionCharterReserve, reserveMineSharePath } from "../src/seal-reserve-store.js";
import { vaultCarriers } from "../src/vault-carriers.js";
import { seatScratchCustody } from "./custody-seat-fixture.js";

const PASS_A = "correct horse battery staple", PASS_B = "a second synthetic passphrase";
const share = (x: number, recoveryEpoch = 1) => ({ bytes: { x, ys: Uint8Array.from([x, x + 1, x + 2]) }, custodian: "device" as const, recoveryEpoch });

const drops: Array<() => Promise<void>> = [];
const envBefore = process.env[ARCHIVE_PASSPHRASE_ENV];
afterEach(async () => {
  for (const drop of drops.splice(0).reverse()) await drop();
  // The seal verb sets the in-memory policy; no case here leaves one behind.
  if (envBefore === undefined) delete process.env[ARCHIVE_PASSPHRASE_ENV]; else process.env[ARCHIVE_PASSPHRASE_ENV] = envBefore;
});

/** A scratch vessel with both share families standing under its vessel key. */
async function stand(): Promise<{ readonly rows: () => Buffer[] }> {
  const c = await seatScratchCustody("archive-passphrase");
  drops.push(() => c.drop());
  await persistRecoveryDeviceShare(share(1), 0);
  await persistRecoveryDeviceShare(share(2), 1);
  await provisionCharterReserve(share(3), {
    reserveEpoch: 1, nextKeyCommit: "ab".repeat(32), threshold: 2, kahuCount: 3, guardianA: null, guardianB: null, mineShareSealed: true, issuedAt: "a-synthetic-stamp",
  });
  const paths = [deviceSharePath(0), deviceSharePath(1), reserveMineSharePath()];
  for (const p of paths) expect(readVkCarrier(readFileSync(p)), p).toBe("sealed");   // control: the rows stand, under the vessel key
  return { rows: () => paths.map((p) => readFileSync(p)) };
}
const same = (a: Buffer[], b: Buffer[]): boolean => a.length === b.length && a.every((bytes, i) => bytes.equals(b[i]!));

describe("the passphrase lifecycle governs no row", () => {
  test("P1 — it names no carrier while both share families stand sealed under the vessel key", async () => {
    await stand();
    expect(vaultCarriers()).toEqual([]);
    expect(archiveSealStatus().carriers).toEqual({});
    expect(archiveSealStatus({ probe: PASS_A })).toMatchObject({ carriers: {}, split: false });
    expect((await runVaultVerb("vault-status", {}))["carriers"]).toEqual({});
  });

  test("P2 — seal, rotate and repair move no byte of any share row", async () => {
    const v = await stand();
    const before = v.rows();
    expect(sealArchiveWithPassphrase(PASS_A)).toEqual({ sealed: [], skipped: [] });
    expect(same(v.rows(), before)).toBe(true);
    expect(() => rotateArchivePassphrase(PASS_A, PASS_B)).toThrow(/nothing is sealed/);
    expect(same(v.rows(), before)).toBe(true);
    expect(repairSplitKek(PASS_A, PASS_B)).toEqual({ repaired: [], alreadyConsistent: [] });
    expect(same(v.rows(), before)).toBe(true);
    expect(await runVaultVerb("vault-seal", { passphrase: PASS_A })).toMatchObject({ sealed: [], skipped: [] });
    expect(same(v.rows(), before)).toBe(true);
  });

  test("P3 — an empty passphrase refuses; a weak one warns", () => {
    expect(() => sealArchiveWithPassphrase("")).toThrow();
    expect(() => rotateArchivePassphrase(PASS_A, "")).toThrow();
    expect(weakPassphraseWarning("short")).toMatch(/floor/);
    expect(weakPassphraseWarning(PASS_A)).toBeNull();
  });
});
