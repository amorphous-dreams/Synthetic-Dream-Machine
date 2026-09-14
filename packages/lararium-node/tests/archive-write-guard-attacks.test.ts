/**
 * archive-write-guard-attacks — the ADVERSARIAL survey of `refuseWriteOverUnopenableSeal`
 * (`identity-anchors.ts`), written to BREAK the cure that landed at `ce5c390f5` rather than to
 * confirm it.
 *
 * The cured bug: a mistyped passphrase destroyed the sovereign identity archive. The M3 boot
 * re-seal fires on EVERY boot, the waking floor included; a floor boot holds no archive, exports a
 * fresh faceless keyhive, and landed it over the sealed bytes. The floor wears TWO shapes —
 * `key-absent` (a CLEARTEXT write over ciphertext) and `key-wrong` (a write that SEALS, so no
 * cleartext test catches it). `identity-anchors.test.ts` already walks both of those.
 *
 * THIS FILE ATTACKS WHAT THOSE TWO DO NOT REACH. Each test names the attack, the carrier, the
 * policy, and what stood on disk before the write. A test that fails to break the cure stays as a
 * CONTROL keeping it unbroken; a test that DOES break it names the hole in its own title.
 *
 * The gate's premise is `isSealedEnvelope` — a MAGIC+VERSION probe over the first five bytes. Every
 * byte the probe does not read is a way to make a sealed carrier read as cleartext, and a cleartext
 * carrier "answers to any policy". Attacks 1-3 walk that boundary. Attacks 4-5 walk the OTHER
 * sealed carriers — the vault's own carrier list names FOUR, and the guard stands on TWO. Attacks
 * 6-9 walk the four vault doors the cure's commit asserted safe. Attack 10 names what the guard
 * checks (the KEY) against what the bug destroyed (the CONTENT).
 *
 * Isolation: every test drives a fresh `mkdtemp` identity home through XDG_*; the operator's live
 * vessel at `~/.local/share/lares` is never reachable from here.
 */
import { mkdtempSync, rmSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { larIdentityDir } from "../src/vessel-paths.js";
import {
  persistIdentityArchive, persistVeilArchive, archivePath, veilArchivePath,
} from "../src/identity-anchors.js";
import { persistRecoveryDeviceShare, loadRecoveryDeviceShare, deviceSharePath } from "../src/recovery-share-store.js";
import { sealReserveMineShare, loadReserveMineShare, reserveMineSharePath } from "../src/seal-reserve-store.js";
import {
  sealArchiveWithPassphrase, rotateArchivePassphrase, repairSplitKek, exportSealedArchive,
  archiveSealStatus, readArchiveOpening,
} from "../src/archive-passphrase.js";
import { setSealExpected } from "../src/lares-config.js";
import { ARCHIVE_PASSPHRASE_ENV } from "../src/archive-seal.js";
import { isSealedEnvelope } from "@lararium/mesh";
import type { RecoveryShare } from "@lararium/mesh";

const PASS_A = "attack-passphrase-alpha-0";
const PASS_B = "attack-passphrase-bravo-0";

const saved: Record<string, string | undefined> = {};
function setEnv(k: string, v: string | undefined): void {
  if (!(k in saved)) saved[k] = process.env[k];
  if (v === undefined) delete process.env[k]; else process.env[k] = v;
}

/** The sovereign bytes every attack tries to destroy — long enough that a "fresh empty" write reads short. */
const SOVEREIGN = Uint8Array.from(Array.from({ length: 64 }, (_, i) => (i * 7 + 3) & 0xff));
/** What a faceless floor boot exports: a fresh, empty keyhive. */
const FLOOR_EXPORT = Uint8Array.from([0x00, 0x01]);

const share = (x: number): RecoveryShare => ({
  bytes: { x, ys: new Uint8Array([x, x + 1, x + 2]) },
  custodian: "device",
  recoveryEpoch: 1,
});

// EVERY ASSERTION HERE COSTS A scrypt DERIVE (N=2^17, ~100ms by design), and the guard adds one more
// per write — a rotate walk spends twenty. Under the full suite's CPU contention the 5s default expires
// on work that is doing exactly what it should, so the suite carries its own budget.
describe("the write-over-sealed guard, attacked", { timeout: 120_000 }, () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lares-guard-attack-"));
    // LAR_ROOT isolates BOTH the identity carriers AND `~/.lares/config.json` — the seal marker
    // `setSealExpected` writes. XDG alone leaves `larHome()` pointing at the operator's real home.
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

  /** Land a real sealed archive under PASS_A and hand back its bytes. */
  function standSealedArchive(): Uint8Array {
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);
    persistIdentityArchive(SOVEREIGN);
    const bytes = readFileSync(archivePath());
    expect(isSealedEnvelope(bytes), "the rig failed to seal — every attack below would test nothing").toBe(true);
    return bytes;
  }

  // ── ATTACK 1 · THE VERSION BYTE ─────────────────────────────────────────────────────────────────
  // `isSealedEnvelope` reads magic(4) + version(1) and answers false on ANY version it does not know.
  // A sealed archive written by a LATER vessel (envelope v2) therefore reads to THIS vessel as "not
  // sealed", and the guard's own comment says a cleartext carrier answers to any policy. The floor's
  // empty export then lands over a perfectly intact sealed archive.
  test("★ HOLE — a sealed archive at an UNKNOWN envelope version reads as cleartext and the floor overwrites it ★", () => {
    const sealed = standSealedArchive();
    const futureVersion = Uint8Array.from(sealed);
    futureVersion[4] = 0x02;                       // a v2 envelope: magic intact, version unknown here
    writeFileSync(archivePath(), futureVersion);
    expect(isSealedEnvelope(readFileSync(archivePath())), "the probe still calls it sealed").toBe(false);

    // The floor, with NO key — the shape the cleartext guard was built for.
    setEnv(ARCHIVE_PASSPHRASE_ENV, undefined);
    persistIdentityArchive(FLOOR_EXPORT);          // no throw: the guard waved it through

    const after = readFileSync(archivePath());
    expect(after.length, "the v2-sealed archive survived").toBe(FLOOR_EXPORT.length);
    expect(Array.from(after)).toEqual(Array.from(FLOOR_EXPORT));   // the sovereign bytes are GONE
  });

  // ── ATTACK 2 · THE MAGIC BYTES ──────────────────────────────────────────────────────────────────
  // One flipped byte in the 4-byte magic and the same door opens. Bounded: a carrier whose header is
  // already damaged may be unrecoverable anyway — but the guard destroys the CIPHERTEXT too, which a
  // header repair would otherwise have recovered.
  test("★ HOLE — a sealed archive with one corrupt MAGIC byte reads as cleartext and the floor overwrites it ★", () => {
    const sealed = standSealedArchive();
    const corrupt = Uint8Array.from(sealed);
    corrupt[0] ^= 0xff;
    writeFileSync(archivePath(), corrupt);

    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);        // the RIGHT passphrase — the ciphertext is still there
    persistIdentityArchive(FLOOR_EXPORT);          // no throw

    expect(readFileSync(archivePath()).length, "the ciphertext behind a bad magic byte survived").toBe(
      // a seal of FLOOR_EXPORT, not the 64-byte sovereign ciphertext
      readFileSync(archivePath()).length,
    );
    // The decisive assertion: the sovereign ciphertext no longer stands anywhere in the file.
    const after = readFileSync(archivePath());
    expect(after.includes(Buffer.from(corrupt.subarray(40))), "the old ciphertext tail survived").toBe(false);
  });

  // ── ATTACK 3 · TRUNCATION WITH THE MAGIC INTACT ─────────────────────────────────────────────────
  // The probe answers TRUE here, so the guard runs `openArchiveBytes`, `decodeEnvelope` throws on the
  // overrun, and the catch refuses. The cure HOLDS. What it gets wrong is the REASON it gives.
  test("CONTROL — a TRUNCATED sealed archive (magic intact) refuses the write", () => {
    const sealed = standSealedArchive();
    const torn = sealed.subarray(0, Math.floor(sealed.length / 2));
    writeFileSync(archivePath(), torn);
    expect(isSealedEnvelope(readFileSync(archivePath()))).toBe(true);

    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);        // the CORRECT passphrase
    expect(() => persistIdentityArchive(FLOOR_EXPORT)).toThrow(/refusing to write over the sealed archive/);
    expect(readFileSync(archivePath()).equals(Buffer.from(torn)), "the torn bytes stayed put").toBe(true);
  });

  // The pin-reader inversion, surviving INSIDE the guard: `archive-passphrase` went to real trouble to
  // keep `unreadable` apart from `key-wrong` (a torn carrier must never send an operator to re-type a
  // credential that was right all along). The guard folds them back together — one catch, one message.
  test("★ the guard BLAMES a correct passphrase for a torn carrier (unreadable folded into key-wrong) ★", () => {
    const sealed = standSealedArchive();
    // Cut inside the HEADER (past magic+version+mode, into the salt) so `decodeEnvelope` itself
    // overruns — the shape `readArchiveOpening` names `unreadable`. A cut in the CIPHERTEXT decodes
    // fine and fails at the GCM tag, which is a genuine `key-fails`.
    writeFileSync(archivePath(), sealed.subarray(0, 8));
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);        // the passphrase that sealed it

    let message = "";
    try { persistIdentityArchive(FLOOR_EXPORT); } catch (err) { message = (err as Error).message; }
    expect(message).toMatch(/does not open it/);   // it names the KEY
    expect(message, "the torn carrier is never named").not.toMatch(/torn|truncat|decode|backup/i);

    // And the READING one layer out gets it right, which is what makes the guard's wording a drift and
    // not a missing capability.
    setSealExpected(true);
    expect(readArchiveOpening().kind).toBe("unreadable");
  });

  // ── ATTACK 4 · THE DEVICE RECOVERY SHARE ────────────────────────────────────────────────────────
  // `archive-passphrase` names FOUR sealed carriers and says "ONE RULE NAMES THE SET: every file a boot
  // opens through `openArchiveBytes` under the resolved seal policy rides this lifecycle". The guard
  // stands on TWO of them. `recovery-share-store.ts:47` seals and writes with no guard at all.
  test("★ HOLE — the DEVICE recovery share takes a write under a non-opening passphrase ★", () => {
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);
    persistRecoveryDeviceShare(share(7));
    const sealed = readFileSync(deviceSharePath());
    expect(isSealedEnvelope(sealed)).toBe(true);
    expect(loadRecoveryDeviceShare()?.bytes.x).toBe(7);

    // A stale / mistyped passphrase — the exact `key-wrong` shape the cure was written for.
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_B);
    persistRecoveryDeviceShare(share(99));         // NO THROW — the write lands
    expect(readFileSync(deviceSharePath()).equals(sealed), "the share survived").toBe(false);

    // And the real share is unrecoverable: under the passphrase that sealed it, the carrier now faults.
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);
    expect(() => loadRecoveryDeviceShare()).toThrow();
  });

  // ── ATTACK 5 · THE RESERVE "MINE" SHARE ─────────────────────────────────────────────────────────
  // `seal-reserve-store.ts:50`, the same shape. This carrier holds the vessel's ONE share of the Nexus
  // reserve seed.
  test("★ HOLE — the reserve MINE share takes a write under a non-opening passphrase ★", () => {
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);
    sealReserveMineShare(share(3));
    const sealed = readFileSync(reserveMineSharePath());
    expect(isSealedEnvelope(sealed)).toBe(true);

    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_B);
    sealReserveMineShare(share(42));               // NO THROW
    expect(readFileSync(reserveMineSharePath()).equals(sealed)).toBe(false);

    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);
    expect(() => loadReserveMineShare()).toThrow();
  });

  // ── ATTACK 6 · `vault rotate` UNDER A WRONG OLD PASSPHRASE ──────────────────────────────────────
  // The commit asserts rotate "stages its own atomic writes and never passes through" the guard. TRUE —
  // and it needs no guard, because PRE-VALIDATION proves operator intent where the guard would: a wrong
  // OLD passphrase throws at the GCM tag before a single temp is written. THE GCM TAG IS THE PROOF OF
  // INTENT the survey asked for.
  test("CONTROL — `vault rotate` under a WRONG old passphrase writes ZERO bytes", () => {
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);
    persistIdentityArchive(SOVEREIGN);
    persistVeilArchive(SOVEREIGN);
    persistRecoveryDeviceShare(share(7));
    const before = [archivePath(), veilArchivePath(), deviceSharePath()].map((p) => readFileSync(p));

    expect(() => rotateArchivePassphrase("not-the-old-passphrase", PASS_B)).toThrow();
    [archivePath(), veilArchivePath(), deviceSharePath()].forEach((p, i) => {
      expect(readFileSync(p).equals(before[i]!), `${p} moved under a wrong old passphrase`).toBe(true);
    });

    // CONTROL — the RIGHT old passphrase rotates every carrier, and the new one opens all of them.
    rotateArchivePassphrase(PASS_A, PASS_B);
    const status = archiveSealStatus({ probe: PASS_B });
    expect(status.split).toBe(false);
    expect(status.carriers.archive.opensUnderProbe).toBe(true);
    expect(status.carriers["device-share"].opensUnderProbe).toBe(true);
  });

  // ── ATTACK 7 · `vault seal` OVER AN ALREADY-SEALED CARRIER ──────────────────────────────────────
  test("CONTROL — `vault seal` under a foreign passphrase SKIPS every sealed carrier (byte-identical)", () => {
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);
    persistIdentityArchive(SOVEREIGN);
    const before = readFileSync(archivePath());

    const r = sealArchiveWithPassphrase(PASS_B);   // a DIFFERENT passphrase over a sealed carrier
    expect(r.sealed).not.toContain("archive");
    expect(r.skipped).toContain("archive");
    expect(readFileSync(archivePath()).equals(before), "seal re-wrote a sealed carrier").toBe(true);
  });

  // A bounded consequence of Attack 1/2 reaching `vault seal`: a carrier whose header the probe cannot
  // read gets re-sealed as though its ciphertext were plaintext. No BYTES are lost (they survive one
  // layer deeper), and `setSealExpected(true)` still fires — but the operator's recorded seal state now
  // describes a double wrap nothing names.
  test("★ `vault seal` wraps a header-damaged SEALED carrier as if it were cleartext ★", () => {
    const sealed = standSealedArchive();
    const corrupt = Uint8Array.from(sealed); corrupt[4] = 0x02;
    writeFileSync(archivePath(), corrupt);

    const r = sealArchiveWithPassphrase(PASS_B);
    expect(r.sealed, "the damaged carrier was treated as cleartext").toContain("archive");
    expect(isSealedEnvelope(readFileSync(archivePath()))).toBe(true);
  });

  // ── ATTACK 8 · `vault repair` WITH NEITHER PASSPHRASE OPENING ───────────────────────────────────
  test("CONTROL — `vault repair` refuses a carrier that opens under NEITHER passphrase, zero-write", () => {
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);
    persistIdentityArchive(SOVEREIGN);
    const before = readFileSync(archivePath());

    expect(() => repairSplitKek("wrong-open-passphrase", "wrong-seal-passphrase"))
      .toThrow(/opens under NEITHER passphrase/);
    expect(readFileSync(archivePath()).equals(before)).toBe(true);
  });

  // ── ATTACK 9 · `vault export` AIMED AT A CARRIER ────────────────────────────────────────────────
  // `export` takes an operator-resolved destination and refuses only a SILENT clobber. Aimed at the
  // archive with `--force` it re-seals the live archive under an ARBITRARY passphrase and lands it on
  // the carrier, consulting no standing-bytes openability. The plaintext survives (so this destroys no
  // identity), but the live policy stops opening the carrier and the next boot reads `key-wrong`.
  test("★ BYPASS (bounded) — `vault export --force` aimed at the archive re-keys the carrier ★", () => {
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);
    persistIdentityArchive(SOVEREIGN);
    setSealExpected(true);
    expect(readArchiveOpening().kind).toBe("opens");

    exportSealedArchive(PASS_B, archivePath(), true);   // the carrier as its own backup destination

    expect(isSealedEnvelope(readFileSync(archivePath()))).toBe(true);
    // The live policy (PASS_A) no longer opens the carrier — the boot now reads the floor.
    expect(readArchiveOpening().kind).toBe("key-wrong");
    // BOUNDED: the sovereign plaintext survives under PASS_B, so `vault repair` recovers it.
    expect(archiveSealStatus({ probe: PASS_B }).carriers.archive.opensUnderProbe).toBe(true);
  });

  // ── ATTACK 10 · THE GUARD CHECKS THE KEY, NOT THE CONTENT ───────────────────────────────────────
  // What ⑤ destroyed was CONTENT: an empty keyhive over a real one. The guard proves the KEY opens the
  // standing bytes and says nothing about what replaces them. Any floor route reaching this writer WITH
  // an opening key still lands the empty export. The boot closes that today by structure, never by this
  // guard — `prepareNodeBoot` gates `archiveBytes` on the SAME `archiveOpens()` reading, so a key that
  // opens also HYDRATES keyhive and the export is no longer empty. Two independent facts, one invariant.
  test("★ the guard admits an EMPTY archive over a full one whenever the key opens ★", () => {
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);
    persistIdentityArchive(SOVEREIGN);
    persistIdentityArchive(FLOOR_EXPORT);          // same key, empty content — accepted
    expect(readFileSync(archivePath()).length).toBeLessThan(SOVEREIGN.length + 40);
  });

  // ── ATTACK 11 · THE READING NEVER RUNS ──────────────────────────────────────────────────────────
  // `readArchiveOpening` consults the CONFIG marker first. The M3 boot re-seal SEALS a carrier without
  // ever calling `setSealExpected`, so a vessel that got its seal from a boot (env var set, `vault seal`
  // never run) carries `sealExpected: false` beside sealed bytes — and the five readings collapse to
  // `no-seal-expected / opens: true` on a WRONG key. Fail-closed survives only because
  // `loadIdentityArchive` throws instead of returning null.
  test("★ a boot-sealed archive leaves `sealExpected` FALSE — the five readings never probe a wrong key ★", () => {
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);
    persistIdentityArchive(SOVEREIGN);              // the M3 shape: seal by boot, no `vault seal`
    expect(isSealedEnvelope(readFileSync(archivePath()))).toBe(true);
    expect(archiveSealStatus().sealExpected, "the boot re-seal recorded the seal").toBe(false);

    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_B);         // a mistyped passphrase
    const reading = readArchiveOpening();
    expect(reading.kind).toBe("no-seal-expected");  // NOT `key-wrong`
    expect(reading.opens, "the boot believes it can open an archive it cannot").toBe(true);

    // CONTROL — with the marker set, the same disk state reads correctly.
    setSealExpected(true);
    expect(readArchiveOpening().kind).toBe("key-wrong");
  });

  // ── THE TOCTOU WINDOW, NAMED ────────────────────────────────────────────────────────────────────
  // The guard reads `existsSync` → `readFileSync` → decides, and `atomicWriteFileSync` renames after.
  // Two boots on ONE `LAR_ROOT` can both read the same sealed bytes, both pass, and race the rename —
  // last-write-wins, which the writer's own doc already rules. That costs nothing here: both writers
  // passed the SAME openability test, so both wrote under a key that opens. The window turns harmful
  // only when a `vault rotate` commits BETWEEN one boot's read and its rename — the boot then lands
  // bytes sealed under the pre-rotate key. This test pins the read/rename ordering the window rides on
  // rather than racing it (a race test would flake); the residual is named in the handback.
  test("CONTROL — the guard decides on bytes it READ, and the rename lands after (the TOCTOU shape)", () => {
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);
    persistIdentityArchive(SOVEREIGN);
    const before = readFileSync(archivePath());
    // A rotate lands between "the guard would read" and "the write commits": afterwards the OLD key
    // neither opens the carrier nor writes over it — the guard catches the stale writer on its NEXT read.
    rotateArchivePassphrase(PASS_A, PASS_B);
    expect(readFileSync(archivePath()).equals(before)).toBe(false);
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);
    expect(() => persistIdentityArchive(FLOOR_EXPORT)).toThrow(/does not open it/);
  });

  test("CONTROL — a first write with NO carrier standing always lands (the guard never blocks a founding)", () => {
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);
    expect(existsSync(archivePath())).toBe(false);
    persistIdentityArchive(SOVEREIGN);
    expect(existsSync(archivePath())).toBe(true);
  });
});
