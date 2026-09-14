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
import { mkdtempSync, rmSync, existsSync, writeFileSync, readFileSync, symlinkSync } from "node:fs";
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
import { isSealedEnvelope, readSealCarrier } from "@lararium/mesh";
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
  // CURED: `readSealCarrier` splits the reading the probe used to fold. Magic intact + a version this
  // vessel cannot decode reads `unopenable`, and an unopenable carrier refuses EVERY write — no key can be
  // judged against bytes this vessel cannot frame, so none may be blamed and none may overwrite them.
  test("★ CURED — a sealed archive at an UNKNOWN envelope version REFUSES the floor's write ★", () => {
    const sealed = standSealedArchive();
    const futureVersion = Uint8Array.from(sealed);
    futureVersion[4] = 0x02;                       // a v2 envelope: magic intact, version unknown here
    writeFileSync(archivePath(), futureVersion);
    // The strict probe still answers false — its CONTRACT is unchanged, and every old caller keeps it.
    expect(isSealedEnvelope(readFileSync(archivePath())), "the strict probe kept its reading").toBe(false);
    // The new reading is the one the guard stands on.
    expect(readSealCarrier(readFileSync(archivePath()))).toBe("unopenable");

    // The floor, with NO key — the shape the cleartext guard was built for.
    setEnv(ARCHIVE_PASSPHRASE_ENV, undefined);
    expect(() => persistIdentityArchive(FLOOR_EXPORT)).toThrow(/cannot decode/);

    // And with the RIGHT key too: an unopenable carrier is not a key question at all.
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);
    expect(() => persistIdentityArchive(FLOOR_EXPORT)).toThrow(/cannot decode/);

    expect(readFileSync(archivePath()).equals(Buffer.from(futureVersion)), "the v2 bytes stood").toBe(true);
  });

  // ── ATTACK 2 · THE MAGIC BYTES ──────────────────────────────────────────────────────────────────
  // One flipped byte in the 4-byte magic and the same door opens. Bounded: a carrier whose header is
  // already damaged may be unrecoverable anyway — but the guard destroys the CIPHERTEXT too, which a
  // header repair would otherwise have recovered.
  // CURED, and by a STRUCTURAL reading rather than a guess: the magic is a label, the LAYOUT is the
  // evidence. A sealed carrier with a damaged magic byte still frames self-consistently — version 0x01, a
  // known mode code, then three length-prefixed fields (salt/iv/tag) that land exactly inside the file with
  // ciphertext after. `readSealCarrier` reads that framing and answers `unopenable`, so the ciphertext a
  // header repair could recover is never overwritten. A genuine cleartext archive does not frame that way.
  test("★ CURED — a sealed archive with one corrupt MAGIC byte still REFUSES the write (the framing is the evidence) ★", () => {
    const sealed = standSealedArchive();
    const corrupt = Uint8Array.from(sealed);
    corrupt[0] ^= 0xff;
    writeFileSync(archivePath(), corrupt);
    expect(readSealCarrier(corrupt), "the damaged magic still frames as an envelope").toBe("unopenable");

    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);        // the RIGHT passphrase — the ciphertext is still there
    expect(() => persistIdentityArchive(FLOOR_EXPORT)).toThrow(/cannot decode/);

    // The decisive assertion, inverted: the sovereign ciphertext STILL stands, byte for byte.
    expect(readFileSync(archivePath()).equals(Buffer.from(corrupt)), "the ciphertext survived").toBe(true);
  });

  // The CONTROL that keeps the framing reading from becoming a blanket refusal: bytes that carry no seal
  // magic AND do not frame as an envelope still read `bare`, and a bare carrier answers to any policy — the
  // cleartext→sealed upgrade path the M3 floor rides must keep working.
  test("CONTROL — genuine cleartext bytes read `bare` and still take a write", () => {
    setEnv(ARCHIVE_PASSPHRASE_ENV, undefined);
    persistIdentityArchive(SOVEREIGN);                       // a bare, unsealed carrier
    expect(readSealCarrier(readFileSync(archivePath()))).toBe("bare");
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);                  // now configure a passphrase — the upgrade
    persistIdentityArchive(SOVEREIGN);                       // no throw: the bare carrier seals
    expect(isSealedEnvelope(readFileSync(archivePath()))).toBe(true);
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
  // CURED: the guard now probes through the SAME three-valued atom `readArchiveOpening` reads
  // (`probeArchiveBytes`, lifted into `archive-seal` so one definition serves both), and names which fact
  // it met. A torn carrier reads `unreadable` and the refusal says TORN — it never sends an operator to
  // re-type a credential that was right.
  test("★ CURED — the guard names a TORN carrier instead of blaming a correct passphrase ★", () => {
    const sealed = standSealedArchive();
    // Cut inside the HEADER (past magic+version+mode, into the salt) so `decodeEnvelope` itself
    // overruns — the shape `readArchiveOpening` names `unreadable`. A cut in the CIPHERTEXT decodes
    // fine and fails at the GCM tag, which is a genuine `key-fails`.
    writeFileSync(archivePath(), sealed.subarray(0, 8));
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);        // the passphrase that sealed it

    let message = "";
    try { persistIdentityArchive(FLOOR_EXPORT); } catch (err) { message = (err as Error).message; }
    expect(message, "the tear is named").toMatch(/torn/i);
    expect(message, "a backup is the route, not a re-type").toMatch(/backup/i);
    expect(message, "the passphrase is never blamed").not.toMatch(/does not open it/);

    // And it agrees with the READING one layer out — the same distinction, one definition.
    setSealExpected(true);
    expect(readArchiveOpening().kind).toBe("unreadable");

    // CONTROL — a genuinely WRONG key over an INTACT carrier still names the KEY. The cure separated the
    // two facts; it did not stop the guard naming a wrong passphrase.
    writeFileSync(archivePath(), sealed);
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_B);
    expect(() => persistIdentityArchive(FLOOR_EXPORT)).toThrow(/does not open it/);
  });

  // ── ATTACK 4 · THE DEVICE RECOVERY SHARE ────────────────────────────────────────────────────────
  // `archive-passphrase` names FOUR sealed carriers and says "ONE RULE NAMES THE SET: every file a boot
  // opens through `openArchiveBytes` under the resolved seal policy rides this lifecycle". The guard
  // stands on TWO of them. `recovery-share-store.ts:47` seals and writes with no guard at all.
  test("★ CURED — the DEVICE recovery share REFUSES a write under a non-opening passphrase ★", () => {
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);
    persistRecoveryDeviceShare(share(7));
    const sealed = readFileSync(deviceSharePath());
    expect(isSealedEnvelope(sealed)).toBe(true);
    expect(loadRecoveryDeviceShare()?.bytes.x).toBe(7);

    // A stale / mistyped passphrase — the exact `key-wrong` shape the cure was written for.
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_B);
    expect(() => persistRecoveryDeviceShare(share(99))).toThrow(/does not open it/);
    expect(readFileSync(deviceSharePath()).equals(sealed), "the share stood").toBe(true);

    // And the real share still reads back under the passphrase that sealed it.
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);
    expect(loadRecoveryDeviceShare()?.bytes.x).toBe(7);
    // CONTROL — the OPENING passphrase still re-persists freely (the guard proves the KEY, never the content).
    persistRecoveryDeviceShare(share(11));
    expect(loadRecoveryDeviceShare()?.bytes.x).toBe(11);
  });

  // ── ATTACK 5 · THE RESERVE "MINE" SHARE ─────────────────────────────────────────────────────────
  // `seal-reserve-store.ts:50`, the same shape. This carrier holds the vessel's ONE share of the Nexus
  // reserve seed.
  // AND THE AUDIT'S OWN WARD FAILS HERE — its verdict rested on "founding/seal-rite are their only
  // callers". `lares nexus seal reserve REFRESH` (nexus-seal.ts: `sealReserveProvision(args,"refresh")`)
  // re-runs `sealReserveMineShare` UNCONDITIONALLY, with no idempotence check of any kind. So this carrier
  // is re-written in ordinary operator life, not once at a rite — full severity, and the guard must stand
  // BEFORE the write rather than beside it.
  test("★ CURED — the reserve MINE share REFUSES a write under a non-opening passphrase ★", () => {
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);
    sealReserveMineShare(share(3));
    const sealed = readFileSync(reserveMineSharePath());
    expect(isSealedEnvelope(sealed)).toBe(true);

    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_B);
    expect(() => sealReserveMineShare(share(42))).toThrow(/does not open it/);
    expect(readFileSync(reserveMineSharePath()).equals(sealed)).toBe(true);

    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);
    expect(loadReserveMineShare()?.bytes.x).toBe(3);
    // CONTROL — the refresh rite under the LIVE passphrase still re-splits and re-seals.
    sealReserveMineShare(share(42));
    expect(loadReserveMineShare()?.bytes.x).toBe(42);
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
    expect(status.carriers["device-share-h0"]!.opensUnderProbe).toBe(true);
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
  test("★ CURED — `vault seal` SKIPS a header-damaged SEALED carrier instead of double-wrapping it ★", () => {
    const sealed = standSealedArchive();
    const corrupt = Uint8Array.from(sealed); corrupt[4] = 0x02;
    writeFileSync(archivePath(), corrupt);

    const r = sealArchiveWithPassphrase(PASS_B);
    expect(r.sealed, "the damaged carrier was NOT treated as cleartext").not.toContain("archive");
    expect(r.skipped).toContain("archive");
    expect(readFileSync(archivePath()).equals(Buffer.from(corrupt)), "the damaged bytes stood").toBe(true);
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
  // CURED: an export destination that RESOLVES onto any of the four sealed carriers is refused, `--force`
  // included. The comparison resolves BOTH sides fully first — `resolve()` for a relative dest, then
  // `realpathSync` over the deepest existing ancestor so a symlink and a `..` traversal land on the same
  // string the carrier resolves to. A string check wearing a path check's clothes would miss all three.
  test("★ CURED — `vault export --force` aimed at the archive REFUSES (and a symlink / `..` / relative dest too) ★", () => {
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);
    persistIdentityArchive(SOVEREIGN);
    persistRecoveryDeviceShare(share(7));
    setSealExpected(true);
    expect(readArchiveOpening().kind).toBe("opens");
    const before = readFileSync(archivePath());

    // ① the carrier named outright, with --force
    expect(() => exportSealedArchive(PASS_B, archivePath(), true)).toThrow(/onto the "archive" carrier/);

    // ② a `..` traversal that LANDS on the carrier
    const traversal = join(larIdentityDir(), "sub", "..", "keyhive-archive.bin");
    expect(() => exportSealedArchive(PASS_B, traversal, true)).toThrow(/onto the "archive" carrier/);

    // ③ a SYMLINK at the dest pointing at the carrier
    const link = join(root, "backup.bin");
    symlinkSync(archivePath(), link);
    expect(() => exportSealedArchive(PASS_B, link, true)).toThrow(/onto the "archive" carrier/);

    // ④ a RELATIVE dest resolving onto the carrier through the process cwd
    const cwd = process.cwd();
    try {
      process.chdir(larIdentityDir());
      expect(() => exportSealedArchive(PASS_B, "./keyhive-archive.bin", true)).toThrow(/onto the "archive" carrier/);
    } finally { process.chdir(cwd); }

    // ⑤ ANOTHER carrier, named by its own name — the guard covers the whole list, not just the archive
    expect(() => exportSealedArchive(PASS_B, deviceSharePath(), true)).toThrow(/onto the "device-share-h0" carrier/);

    // Nothing moved, and the live policy still opens the carrier.
    expect(readFileSync(archivePath()).equals(before)).toBe(true);
    expect(readArchiveOpening().kind).toBe("opens");

    // CONTROL — an ordinary destination still exports, and --force still replaces one.
    const dest = join(root, "real-backup.bin");
    expect(exportSealedArchive(PASS_B, dest, false).bytes).toBeGreaterThan(0);
    expect(isSealedEnvelope(readFileSync(dest))).toBe(true);
    expect(() => exportSealedArchive(PASS_B, dest, false)).toThrow(/--force/);
    expect(exportSealedArchive(PASS_B, dest, true).dest).toBe(dest);
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

  // ── ATTACK 12 · THE DEVICE-SHARE FAMILY THE ENUMERATION NEVER NAMED ─────────────────────────────
  // The WRITE guard reaches every device share (each writer calls it, whatever its handle-index). The
  // ENUMERATION did not: `carriers()` listed a bare `deviceSharePath()` — h0 alone — while the writer
  // mints `recovery-device-share-h${N}.bin` per persona. So every share at h1 and above escaped the four
  // consumers keyed off that list: `rotate` left it on the OLD passphrase and reported success, `repair`
  // could not see it, `status --check` read clean over a carrier it never opened, and the export refusal
  // did not defend its path. A vessel wearing two personas therefore split its own identity across two
  // passphrases with nothing saying so.
  //
  // THE CURE READS THE DISK. The identity dir is scanned for `recovery-device-share-h<N>.bin` and every
  // file found becomes a carrier — because the fact the lifecycle governs is a FILE THAT EXISTS, and a
  // roster is a written hint that can go missing exactly when it matters (`readAnchorRoster` reads a torn
  // roster as `[]`, which would re-open this same hole one layer along). `vesselKeyCensus` already scans
  // this same dir for this same family; a status naming `recovery-device-share-h1` under `keys` while
  // omitting it from `carriers` was one output disagreeing with itself.

  /** Seal a device share at each index under PASS_A, and hand back the sealed bytes per index. */
  function standShares(indices: readonly number[]): Map<number, Buffer> {
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);
    persistIdentityArchive(SOVEREIGN);
    const out = new Map<number, Buffer>();
    for (const i of indices) {
      persistRecoveryDeviceShare(share(i + 1), i);
      const bytes = readFileSync(deviceSharePath(i));
      expect(isSealedEnvelope(bytes), `the rig failed to seal h${i}`).toBe(true);
      out.set(i, bytes);
    }
    return out;
  }

  test("★ CURED — `vault rotate` moves EVERY device share, h1 and above included ★", () => {
    standShares([0, 1]);
    rotateArchivePassphrase(PASS_A, PASS_B);

    // The decisive reading: both shares OPEN under the new passphrase. Before the cure h1 stayed on
    // PASS_A and this threw at its GCM tag — while `rotate` reported success.
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_B);
    expect(loadRecoveryDeviceShare(0)?.bytes.x, "h0 rotated").toBe(1);
    expect(loadRecoveryDeviceShare(1)?.bytes.x, "h1 stayed on the OLD passphrase").toBe(2);

    // And the OLD passphrase opens neither — no leg was left behind.
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);
    expect(() => loadRecoveryDeviceShare(1)).toThrow();
  });

  test("★ CURED — `vault status --check` NAMES the split when h1 rides a foreign passphrase ★", () => {
    standShares([0]);
    // h1 seals under a DIFFERENT passphrase — the exact residue a pre-cure rotate left behind.
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_B);
    persistRecoveryDeviceShare(share(9), 1);

    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);
    const status = archiveSealStatus({ probe: PASS_A });
    expect(status.carriers["device-share-h1"], "h1 never reached the status at all").toBeDefined();
    expect(status.carriers["device-share-h0"]!.opensUnderProbe).toBe(true);
    expect(status.carriers["device-share-h1"]!.opensUnderProbe).toBe(false);
    expect(status.split, "the split-KEK detector went blind where a split is most likely").toBe(true);

    // CONTROL — `vault repair` now REACHES h1 and closes the split it just named.
    repairSplitKek(PASS_B, PASS_A);
    expect(archiveSealStatus({ probe: PASS_A }).split).toBe(false);
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);
    expect(loadRecoveryDeviceShare(1)?.bytes.x).toBe(9);
  });

  test("★ CURED — `vault export` aimed at a device share at h1 REFUSES (standing or not) ★", () => {
    standShares([0, 1]);
    const before = readFileSync(deviceSharePath(1));

    expect(() => exportSealedArchive(PASS_B, deviceSharePath(1), true))
      .toThrow(/onto the "device-share-h1" carrier/);
    expect(readFileSync(deviceSharePath(1)).equals(before), "the h1 share stood").toBe(true);

    // A slot that holds NOTHING YET is refused too: the PATTERN names the family, not only its extant
    // members. An export landing on an empty slot would seal an arbitrary backup where the next
    // `persistRecoveryDeviceShare(share, 5)` must write — and the guard would then refuse that write
    // forever, on bytes no passphrase in the vault opens.
    expect(existsSync(deviceSharePath(5))).toBe(false);
    expect(() => exportSealedArchive(PASS_B, deviceSharePath(5), true))
      .toThrow(/onto the "device-share-h5" carrier/);

    // CONTROL — an ordinary destination still exports.
    expect(exportSealedArchive(PASS_B, join(root, "backup.bin"), false).bytes).toBeGreaterThan(0);
  });

  test("CONTROL — a GAP in the numbering (h0 and h2, no h1) throws in no consumer", () => {
    standShares([0, 2]);
    const status = archiveSealStatus({ probe: PASS_A });
    expect(Object.keys(status.carriers)).not.toContain("device-share-h1");
    expect(status.carriers["device-share-h2"]!.state).toBe("sealed");
    expect(status.split).toBe(false);

    expect(rotateArchivePassphrase(PASS_A, PASS_B).rotated).toContain("device-share-h2");
    expect(repairSplitKek(PASS_B, PASS_B).alreadyConsistent).toContain("device-share-h2");
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_B);
    expect(loadRecoveryDeviceShare(2)?.bytes.x).toBe(3);
    expect(loadRecoveryDeviceShare(1), "an absent index reads absent, never a throw").toBeNull();
  });

  test("CONTROL — h0 ALONE behaves exactly as before (one share, one name, a clean rotate)", () => {
    standShares([0]);
    const status = archiveSealStatus({ probe: PASS_A });
    expect(Object.keys(status.carriers).filter((k) => k.startsWith("device-share"))).toEqual(["device-share-h0"]);
    expect(status.split).toBe(false);

    const r = rotateArchivePassphrase(PASS_A, PASS_B);
    expect(r.rotated).toEqual(["archive", "device-share-h0"]);
    expect(archiveSealStatus({ probe: PASS_B }).split).toBe(false);

    // CONTROL — the GCM tag still proves intent: a WRONG old passphrase writes zero bytes.
    const after = readFileSync(deviceSharePath(0));
    expect(() => rotateArchivePassphrase(PASS_A, "third-passphrase-charlie")).toThrow();
    expect(readFileSync(deviceSharePath(0)).equals(after), "a refused rotate moved the share").toBe(true);
  });

  test("CONTROL — the WRITE guard still refuses a non-opening write at h1 (the cure moved the finding, not the guard)", () => {
    standShares([0, 1]);
    const before = readFileSync(deviceSharePath(1));
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_B);
    expect(() => persistRecoveryDeviceShare(share(99), 1)).toThrow(/does not open it/);
    expect(readFileSync(deviceSharePath(1)).equals(before)).toBe(true);
  });
});
