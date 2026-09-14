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
 *   · `readArchiveOpening`     → FAIL-OPEN. The sealed list came up empty, so the boot read
 *                                `no-seal-expected` / `opens: true` over a sealed archive.
 *   · `openArchiveBytes`       → handed the CIPHERTEXT back as though it were plaintext.
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

import { larIdentityDir } from "../src/vessel-paths.js";
import { persistIdentityArchive, persistVeilArchive, archivePath, veilArchivePath } from "../src/identity-anchors.js";
import {
  archiveSealStatus, rotateArchivePassphrase, repairSplitKek, readArchiveOpening,
  sealArchiveWithPassphrase, exportSealedArchive,
} from "../src/archive-passphrase.js";
import { ARCHIVE_PASSPHRASE_ENV, openArchiveBytes, passphraseSealPolicy } from "../src/archive-seal.js";
import { setSealExpected } from "../src/lares-config.js";
import { isSealedEnvelope, readSealCarrier } from "@lararium/mesh";

const PASS_A = "unopenable-passphrase-alpha-0";
const PASS_B = "unopenable-passphrase-bravo-0";

const saved: Record<string, string | undefined> = {};
function setEnv(k: string, v: string | undefined): void {
  if (!(k in saved)) saved[k] = process.env[k];
  if (v === undefined) delete process.env[k]; else process.env[k] = v;
}

const SOVEREIGN = Uint8Array.from(Array.from({ length: 64 }, (_, i) => (i * 7 + 3) & 0xff));
const VEIL = Uint8Array.from(Array.from({ length: 48 }, (_, i) => (i * 11 + 5) & 0xff));

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

  /** Land a real sealed archive under PASS_A, then BUMP its envelope version — a seal from a later vessel. */
  function standVersionBumpedArchive(): Uint8Array {
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);
    persistIdentityArchive(SOVEREIGN);
    const sealed = readFileSync(archivePath());
    expect(isSealedEnvelope(sealed), "the rig failed to seal — every assertion below would test nothing").toBe(true);
    const bumped = Uint8Array.from(sealed);
    bumped[4] = 0x02;                          // envelope v2: magic intact, version this build cannot frame
    writeFileSync(archivePath(), bumped);
    // The premise, pinned: the strict probe reads FALSE here and the three-valued reader reads a seal.
    expect(isSealedEnvelope(readFileSync(archivePath())), "the strict probe is what lied").toBe(false);
    expect(readSealCarrier(readFileSync(archivePath())), "the reader that tells the truth").toBe("unopenable");
    return bumped;
  }

  /** A sealed VEIL carrier under PASS_A, so a rotate has something genuinely sealed to rotate. */
  function standSealedVeil(): Uint8Array {
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);
    persistVeilArchive(VEIL);
    const bytes = readFileSync(veilArchivePath());
    expect(isSealedEnvelope(bytes), "the rig failed to seal the veil").toBe(true);
    return bytes;
  }

  // ── RED ① · THE STATUS LIE ──────────────────────────────────────────────────────────────────────
  test("RED — `vault status` reports `unopenable`, NOT `cleartext`, over a seal it cannot frame", () => {
    standVersionBumpedArchive();
    const s = archiveSealStatus();
    expect(s.carriers.archive!.state, "status told the operator no seal stands where one stands")
      .toBe("unopenable");
    // FAULT-PIN against a WEAKENING, not only an absence: a cure that folded `unopenable` onto
    // `sealed` would also clear the assertion above if it were written as a `not.toBe("cleartext")`.
    // These two bite either fold.
    expect(s.carriers.archive!.state).not.toBe("cleartext");
    expect(s.carriers.archive!.state).not.toBe("sealed");
    // A mode read off a header this build cannot decode would be a fabrication — none is offered.
    expect(s.carriers.archive!.mode, "no mode may be claimed from an undecodable header").toBeUndefined();
  });

  test("RED — `status --check` claims NO openability verdict over an unopenable carrier", () => {
    standVersionBumpedArchive();
    const s = archiveSealStatus({ probe: PASS_A });   // the passphrase that ACTUALLY sealed these bytes
    expect(s.carriers.archive!.state).toBe("unopenable");
    // The pin-reader law at the probe: no key can be judged against bytes that never framed, so none
    // may be blamed. A `false` here would send the operator to re-type a credential that was right.
    expect(s.carriers.archive!.opensUnderProbe, "a key was never tested, so none is reported").toBeUndefined();
    expect(s.split, "one unopenable carrier is not a KEK split").toBe(false);
  });

  // ── RED ② · THE DOUBLE WRAP ─────────────────────────────────────────────────────────────────────
  test("RED — `vault rotate` REFUSES rather than wrapping an unopenable carrier a second time", () => {
    const veilBefore = standSealedVeil();
    const bumped = standVersionBumpedArchive();      // sealed veil + unopenable archive, both present

    expect(() => rotateArchivePassphrase(PASS_A, PASS_B)).toThrow(/unopenable|cannot (be )?frame/i);

    // ZERO-WRITE, both carriers — the refusal lands BEFORE any temp, exactly as a wrong old passphrase does.
    expect(readFileSync(archivePath()).equals(Buffer.from(bumped)), "the unopenable bytes stood").toBe(true);
    expect(readFileSync(veilArchivePath()).equals(Buffer.from(veilBefore)), "the healthy carrier was not touched").toBe(true);
    // FAULT-PIN on the WRAP itself, not only on the throw: a cure that threw AFTER staging would leave
    // the archive double-wrapped. One unwrap under PASS_B must not reveal another envelope.
    const stillOne = readFileSync(archivePath());
    expect(readSealCarrier(stillOne)).toBe("unopenable");
    // And no temp file survived the refusal.
    expect(readdirSync(larIdentityDir()).filter((f) => f.includes("vault-tmp")), "a temp outlived the refusal").toEqual([]);
  });

  // ── RED ③ · THE SILENT SKIP ─────────────────────────────────────────────────────────────────────
  test("RED — `vault repair` refuses an unopenable carrier instead of reporting success over it", () => {
    standSealedVeil();
    const bumped = standVersionBumpedArchive();
    expect(() => repairSplitKek(PASS_A, PASS_B)).toThrow(/unopenable|cannot (be )?frame/i);
    expect(readFileSync(archivePath()).equals(Buffer.from(bumped))).toBe(true);
  });

  // ── RED ④ · THE FAIL-OPEN AT BOOT ───────────────────────────────────────────────────────────────
  test("RED — the boot reading names `unreadable` over an unopenable boot carrier (it read `opens` before)", () => {
    standVersionBumpedArchive();
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);
    const r = readArchiveOpening();
    expect(r.kind).toBe("unreadable");
    expect(r.opens, "the boot believed it could open an archive it cannot even frame").toBe(false);
    expect(r.probed, "no key was tested against bytes that never framed").toBe(false);
    expect(r.why).toMatch(/archive/);
    // FAULT-PIN: with NO key the reading must STILL name the carrier, never the missing key — a cure
    // that only re-ordered the key check would read `key-absent` here and mislead the operator.
    setEnv(ARCHIVE_PASSPHRASE_ENV, undefined);
    expect(readArchiveOpening().kind).toBe("unreadable");
  });

  // ── RED ⑤ · CIPHERTEXT HANDED BACK AS PLAINTEXT ─────────────────────────────────────────────────
  test("RED — `openArchiveBytes` refuses an unopenable carrier instead of returning its ciphertext", () => {
    const bumped = standVersionBumpedArchive();
    expect(() => openArchiveBytes(bumped, passphraseSealPolicy(PASS_A))).toThrow(/cannot (be )?frame|unopenable/i);
    // FAULT-PIN on the actual harm: whatever it does, it must never hand back the stored bytes.
    let out: Uint8Array | null = null;
    try { out = openArchiveBytes(bumped, passphraseSealPolicy(PASS_A)); } catch { /* the refusal */ }
    expect(out, "ciphertext was returned as though it were plaintext").toBeNull();
  });

  test("RED — `vault export` refuses an unopenable source instead of re-sealing its ciphertext", () => {
    standVersionBumpedArchive();
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);
    const dest = join(root, "backup.bin");
    expect(() => exportSealedArchive(PASS_B, dest)).toThrow(/cannot (be )?frame|unopenable/i);
  });

  // ══ CONTROLS — a set of only negatives is satisfied by INERTNESS, so each one asserts a POSITIVE ══

  test("CONTROL — a genuinely BARE carrier still reads `cleartext`", () => {
    setEnv(ARCHIVE_PASSPHRASE_ENV, undefined);
    persistIdentityArchive(SOVEREIGN);
    expect(readSealCarrier(readFileSync(archivePath()))).toBe("bare");
    expect(archiveSealStatus().carriers.archive!.state).toBe("cleartext");
    expect(readArchiveOpening().opens, "a bare carrier still opens").toBe(true);
  });

  test("CONTROL — a NORMAL sealed carrier still reads `sealed`, with its mode and its probe verdict", () => {
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);
    persistIdentityArchive(SOVEREIGN);
    const s = archiveSealStatus({ probe: PASS_A });
    expect(s.carriers.archive!.state).toBe("sealed");
    expect(s.carriers.archive!.mode).toBe("passphrase");
    expect(s.carriers.archive!.opensUnderProbe, "the right key still reads open").toBe(true);
    expect(archiveSealStatus({ probe: PASS_B }).carriers.archive!.opensUnderProbe, "the wrong key still reads shut").toBe(false);
    expect(readArchiveOpening().kind).toBe("opens");
  });

  test("CONTROL — a correct rotate still succeeds end-to-end, and the new passphrase opens the result", () => {
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);
    persistIdentityArchive(SOVEREIGN);
    persistVeilArchive(VEIL);
    const r = rotateArchivePassphrase(PASS_A, PASS_B);
    expect(r.rotated).toContain("archive");
    expect(r.rotated).toContain("veil");
    // The POSITIVE: the bytes open under the NEW passphrase and yield the ORIGINAL plaintext.
    const opened = openArchiveBytes(readFileSync(archivePath()), passphraseSealPolicy(PASS_B));
    expect(Buffer.from(opened).equals(Buffer.from(SOVEREIGN)), "rotate lost the plaintext").toBe(true);
    expect(archiveSealStatus({ probe: PASS_B }).carriers.archive!.opensUnderProbe).toBe(true);
  });

  test("CONTROL — a WRONG old passphrase still writes ZERO bytes (the GCM tag is the proof of intent)", () => {
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);
    persistIdentityArchive(SOVEREIGN);
    persistVeilArchive(VEIL);
    const before = readFileSync(archivePath());
    const veilBefore = readFileSync(veilArchivePath());
    const mtime = statSync(archivePath()).mtimeMs;

    expect(() => rotateArchivePassphrase("the-wrong-old-passphrase", PASS_B)).toThrow();

    expect(readFileSync(archivePath()).equals(before), "the archive took a write").toBe(true);
    expect(readFileSync(veilArchivePath()).equals(veilBefore), "the veil took a write").toBe(true);
    expect(statSync(archivePath()).mtimeMs, "the carrier was rewritten with identical bytes").toBe(mtime);
    expect(readdirSync(larIdentityDir()).filter((f) => f.includes("vault-tmp")), "a temp was staged before the tag").toEqual([]);
    // The POSITIVE: the RIGHT old passphrase still rotates afterward — the refusal left nothing wedged.
    expect(rotateArchivePassphrase(PASS_A, PASS_B).rotated).toContain("archive");
  });

  test("CONTROL — `vault seal` still skips an unopenable carrier (the reading it already asked kept its answer)", () => {
    const bumped = standVersionBumpedArchive();
    const r = sealArchiveWithPassphrase(PASS_B);
    expect(r.skipped).toContain("archive");
    expect(r.sealed).not.toContain("archive");
    expect(readFileSync(archivePath()).equals(Buffer.from(bumped))).toBe(true);
  });

  test("CONTROL — sealing still records the boot-gate marker over a healthy carrier", () => {
    setEnv(ARCHIVE_PASSPHRASE_ENV, undefined);
    persistIdentityArchive(SOVEREIGN);
    expect(archiveSealStatus().sealExpected).toBe(false);
    sealArchiveWithPassphrase(PASS_A);
    expect(archiveSealStatus().sealExpected, "the marker did not land").toBe(true);
    setSealExpected(true);
  });
});
