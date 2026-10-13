/**
 * vault-status-names-unopenable — `archiveSealStatus` and its sibling lifecycle verbs MUST read a
 * carrier VERSION-AWARE, because the reading an operator acts on is the reading this file produces.
 *
 * THE HOLE. `readSealCarrier` (mesh) answers THREE readings — `bare` · `sealed` · `unopenable` — and
 * `sealArchiveWithPassphrase` already asks it. Four other readers in `archive-passphrase` still asked
 * `isSealedEnvelope`, a MAGIC+VERSION probe that answers a flat false on every version it does not
 * know. So a carrier holding an intact seal this build cannot frame read as `cleartext`, and each
 * reader drew a different wrong conclusion from the same wrong reading:
 *
 *   · `archiveSealStatus`      → `vault status` told the operator NO SEAL STANDS where one stands.
 *                                They then act on that map: export, rotate, re-seal.
 *   · `rotateArchivePassphrase`→ treated the ciphertext as its own plaintext and WRAPPED IT AGAIN.
 *   · `repairSplitKek`         → skipped it silently and reported success over a carrier still broken.
 *   · the boot-opening reader    → must not infer openability for a carrier outside this lifecycle.
 *
 * THE CURE IS ONE READER, ASKED EVERYWHERE. `unopenable` is reported as its OWN state and folded into
 * neither neighbour — the pin-reader law: a default that STATES a fact is fine, one that LOSES a fact
 * inverts fail-closed.
 *
 * ⚠ THE INVARIANT NO TEST HERE MAY LET SLIP: `rotateArchivePassphrase` pre-validates every unseal
 * under the OLD passphrase BEFORE a single temp is written, and the GCM tag IS the proof of operator
 * intent. The zero-write control below bites any cure that moves a write ahead of that tag.
 *
 * Isolation: every test drives a fresh `mkdtemp` identity home through `LAR_ROOT` + XDG_*; the
 * operator's live vessel at `~/.local/share/lares` is never reachable from here.
 */
import { mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { larDataDir, larIdentityDir, larSealHome } from "../src/vessel-paths.js";
import { FsCustodyIo } from "../src/custody-io.js";
import { foundCustody } from "../src/custody-session.js";
import { persistRecoveryDeviceShare, loadRecoveryDeviceShare, deviceSharePath } from "../src/recovery-share-store.js";
import {
  archiveSealStatus, rotateArchivePassphrase, repairSplitKek, sealArchiveWithPassphrase, VkSealedCarrierRefusal,
} from "../src/archive-passphrase.js";
import { ARCHIVE_PASSPHRASE_ENV } from "../src/archive-seal.js";
import { setSealExpected } from "../src/lares-config.js";
import { isSealedEnvelope, readSealCarrier, readVkCarrier, writeSealedCarrier } from "@lararium/mesh";

const PASS_A = "unopenable-passphrase-alpha-0";
const PASS_B = "unopenable-passphrase-bravo-0";

const saved: Record<string, string | undefined> = {};
function setEnv(k: string, v: string | undefined): void {
  if (!(k in saved)) saved[k] = process.env[k];
  if (v === undefined) delete process.env[k]; else process.env[k] = v;
}

const RECOVERY_SHARE = { bytes: { x: 7, ys: new Uint8Array([8, 9, 10]) }, custodian: "device" as const, recoveryEpoch: 1 };
const device0Path = () => deviceSharePath(0);
const device1Path = () => deviceSharePath(1);
const persistDeviceShare0 = () => persistRecoveryDeviceShare(RECOVERY_SHARE, 0);
const persistDeviceShare1 = () => persistRecoveryDeviceShare(RECOVERY_SHARE, 1);

describe("a seal this build cannot frame reads `unopenable`, never `cleartext`", { timeout: 120_000 }, () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lares-unopenable-"));
    setEnv("LAR_ROOT", root);
    setEnv("XDG_STATE_HOME", join(root, "state"));
    setEnv("XDG_DATA_HOME", join(root, "state"));
    setEnv("XDG_CONFIG_HOME", join(root, "config"));
    setEnv(ARCHIVE_PASSPHRASE_ENV, undefined);
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    rmSync(root, { recursive: true, force: true });
  });

  /** Land a sealed h0 share under PASS_A, then bump its envelope version. */
  function standVersionBumpedShare(): Uint8Array {
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);
    persistDeviceShare0();
    const sealed = readFileSync(device0Path());
    expect(isSealedEnvelope(sealed), "the rig failed to seal — every assertion below would test nothing").toBe(true);
    const bumped = Uint8Array.from(sealed);
    bumped[4] = 0x02;                          // envelope v2: magic intact, version this build cannot frame
    writeFileSync(device0Path(), bumped);
    // The premise, pinned: the strict probe reads FALSE here and the three-valued reader reads a seal.
    expect(isSealedEnvelope(readFileSync(device0Path())), "the strict probe is what lied").toBe(false);
    expect(readSealCarrier(readFileSync(device0Path())), "the reader that tells the truth").toBe("unopenable");
    return bumped;
  }

  /** Land a sealed h1 share under PASS_A for lifecycle controls. */
  function standSealedDeviceShare1(): Uint8Array {
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);
    persistDeviceShare1();
    const bytes = readFileSync(device1Path());
    expect(isSealedEnvelope(bytes), "the rig failed to seal the veil").toBe(true);
    return bytes;
  }

  // ── RED ① · THE STATUS LIE ──────────────────────────────────────────────────────────────────────
  test("RED — `vault status` reports `unopenable`, NOT `cleartext`, over a seal it cannot frame", () => {
    standVersionBumpedShare();
    const s = archiveSealStatus();
    expect(s.carriers["device-share-h0"]!.state, "status told the operator no seal stands where one stands")
      .toBe("unopenable");
    // FAULT-PIN against a WEAKENING, not only an absence: a cure that folded `unopenable` onto
    // `sealed` would also clear the assertion above if it were written as a `not.toBe("cleartext")`.
    // These two bite either fold.
    expect(s.carriers["device-share-h0"]!.state).not.toBe("cleartext");
    expect(s.carriers["device-share-h0"]!.state).not.toBe("sealed");
    // A mode read off a header this build cannot decode would be a fabrication — none is offered.
    expect(s.carriers["device-share-h0"]!.mode, "no mode may be claimed from an undecodable header").toBeUndefined();
  });

  test("RED — `status --check` claims NO openability verdict over an unopenable carrier", () => {
    standVersionBumpedShare();
    const s = archiveSealStatus({ probe: PASS_A });   // the passphrase that ACTUALLY sealed these bytes
    expect(s.carriers["device-share-h0"]!.state).toBe("unopenable");
    // The pin-reader law at the probe: no key can be judged against bytes that never framed, so none
    // may be blamed. A `false` here would send the operator to re-type a credential that was right.
    expect(s.carriers["device-share-h0"]!.opensUnderProbe, "a key was never tested, so none is reported").toBeUndefined();
    expect(s.split, "one unopenable carrier is not a KEK split").toBe(false);
  });

  // ── RED ② · THE DOUBLE WRAP ─────────────────────────────────────────────────────────────────────
  test("RED — `vault rotate` REFUSES rather than wrapping an unopenable carrier a second time", () => {
    const veilBefore = standSealedDeviceShare1();
    const bumped = standVersionBumpedShare();      // sealed veil + unopenable archive, both present

    expect(() => rotateArchivePassphrase(PASS_A, PASS_B)).toThrow(/unopenable|cannot (be )?frame/i);

    // ZERO-WRITE, both carriers — the refusal lands BEFORE any temp, exactly as a wrong old passphrase does.
    expect(readFileSync(device0Path()).equals(Buffer.from(bumped)), "the unopenable bytes stood").toBe(true);
    expect(readFileSync(device1Path()).equals(Buffer.from(veilBefore)), "the healthy carrier was not touched").toBe(true);
    // FAULT-PIN on the WRAP itself, not only on the throw: a cure that threw AFTER staging would leave
    // the h0 double-wrapped. One unwrap under PASS_B must not reveal another envelope.
    const stillOne = readFileSync(device0Path());
    expect(readSealCarrier(stillOne)).toBe("unopenable");
    // And no temp file survived the refusal.
    expect(readdirSync(larIdentityDir()).filter((f) => f.includes("vault-tmp")), "a temp outlived the refusal").toEqual([]);
  });

  // ── RED ③ · THE SILENT SKIP ─────────────────────────────────────────────────────────────────────
  test("RED — `vault repair` refuses an unopenable carrier instead of reporting success over it", () => {
    standSealedDeviceShare1();
    const bumped = standVersionBumpedShare();
    expect(() => repairSplitKek(PASS_A, PASS_B)).toThrow(/unopenable|cannot (be )?frame/i);
    expect(readFileSync(device0Path()).equals(Buffer.from(bumped))).toBe(true);
  });

  test("CONTROL — passphrase lifecycle verbs refuse a VK-sealed h0 share by name", async () => {
    const homes = { identity: larIdentityDir(), storage: larDataDir(), seal: larSealHome() };
    const io = new FsCustodyIo(homes);
    const { vk } = await foundCustody({
      io,
      homes,
      slots: [{ t: 1, pins: [{ kind: "passphrase", passphrase: "synthetic custody pin" }] }],
    });
    const path = device0Path();
    await writeSealedCarrier({
      io,
      vk,
      treePath: join(homes.identity, "vk-slots.bin"),
      carrier: { name: "identity/recovery-device-share-h0.bin", path, keyClass: "seed" },
      plaintext: new TextEncoder().encode("synthetic recovery share"),
    });
    expect(readVkCarrier(readFileSync(path))).toBe("sealed");
    expect(archiveSealStatus().carriers["device-share-h0"]!.state).toBe("cleartext");

    for (const [act, verb] of [
      ["seal", () => sealArchiveWithPassphrase(PASS_A)],
      ["rotate", () => rotateArchivePassphrase(PASS_A, PASS_B)],
      ["repair", () => repairSplitKek(PASS_A, PASS_B)],
    ] as const) {
      let refusal: unknown;
      try { verb(); } catch (error) { refusal = error; }
      expect(refusal).toBeInstanceOf(VkSealedCarrierRefusal);
      expect(refusal).toMatchObject({ carrier: "device-share-h0", act });
    }
  });

  // ══ CONTROLS — a set of only negatives is satisfied by INERTNESS, so each one asserts a POSITIVE ══

  test("CONTROL — a genuinely BARE carrier still reads `cleartext`", () => {
    setEnv(ARCHIVE_PASSPHRASE_ENV, undefined);
    persistDeviceShare0();
    expect(readSealCarrier(readFileSync(device0Path()))).toBe("bare");
    expect(archiveSealStatus().carriers["device-share-h0"]!.state).toBe("cleartext");
  });

  test("CONTROL — a NORMAL sealed carrier still reads `sealed`, with its mode and its probe verdict", () => {
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);
    persistDeviceShare0();
    const s = archiveSealStatus({ probe: PASS_A });
    expect(s.carriers["device-share-h0"]!.state).toBe("sealed");
    expect(s.carriers["device-share-h0"]!.mode).toBe("passphrase");
    expect(s.carriers["device-share-h0"]!.opensUnderProbe, "the right key still reads open").toBe(true);
    expect(archiveSealStatus({ probe: PASS_B }).carriers["device-share-h0"]!.opensUnderProbe, "the wrong key still reads shut").toBe(false);
  });

  test("CONTROL — a correct rotate still succeeds end-to-end, and the new passphrase opens the result", () => {
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);
    persistDeviceShare0();
    persistDeviceShare1();
    const r = rotateArchivePassphrase(PASS_A, PASS_B);
    expect(r.rotated).toContain("device-share-h0");
    expect(r.rotated).toContain("device-share-h1");
    // The new passphrase opens the share and yields the record written before rotation.
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_B);
    expect(loadRecoveryDeviceShare(0), "rotate lost the share plaintext").toEqual(RECOVERY_SHARE);
    expect(archiveSealStatus({ probe: PASS_B }).carriers["device-share-h0"]!.opensUnderProbe).toBe(true);
  });

  test("CONTROL — a WRONG old passphrase still writes ZERO bytes (the GCM tag is the proof of intent)", () => {
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);
    persistDeviceShare0();
    persistDeviceShare1();
    const before = readFileSync(device0Path());
    const secondBefore = readFileSync(device1Path());
    const mtime = statSync(device0Path()).mtimeMs;

    expect(() => rotateArchivePassphrase("the-wrong-old-passphrase", PASS_B)).toThrow();

    expect(readFileSync(device0Path()).equals(before), "the share took a write").toBe(true);
    expect(readFileSync(device1Path()).equals(secondBefore), "h1 took a write").toBe(true);
    expect(statSync(device0Path()).mtimeMs, "the carrier was rewritten with identical bytes").toBe(mtime);
    expect(readdirSync(larIdentityDir()).filter((f) => f.includes("vault-tmp")), "a temp was staged before the tag").toEqual([]);
    // The POSITIVE: the RIGHT old passphrase still rotates afterward — the refusal left nothing wedged.
    expect(rotateArchivePassphrase(PASS_A, PASS_B).rotated).toContain("device-share-h0");
  });

  test("CONTROL — `vault seal` still skips an unopenable carrier (the reading it already asked kept its answer)", () => {
    const bumped = standVersionBumpedShare();
    const r = sealArchiveWithPassphrase(PASS_B);
    expect(r.skipped).toContain("device-share-h0");
    expect(r.sealed).not.toContain("device-share-h0");
    expect(readFileSync(device0Path()).equals(Buffer.from(bumped))).toBe(true);
  });

  test("CONTROL — sealing still records the boot-gate marker over a healthy carrier", () => {
    setEnv(ARCHIVE_PASSPHRASE_ENV, undefined);
    persistDeviceShare0();
    expect(archiveSealStatus().sealExpected).toBe(false);
    sealArchiveWithPassphrase(PASS_A);
    expect(archiveSealStatus().sealExpected, "the marker did not land").toBe(true);
    setSealExpected(true);
  });
});
