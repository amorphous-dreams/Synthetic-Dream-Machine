/**
 * disk-outranks-the-guess — CURE 2. `readArchiveOpening` consulted the CONFIG GUESS before it read
 * the DISK FACT, and its own module already ruled which of the two wins:
 *
 *   `archive-passphrase.ts` (the `nothing-sealed` kind):
 *     "Sealing marked expected, yet no sealed carrier stands on disk —
 *      the hint is a config guess, the disk is the fact."
 *
 * Two clauses of ONE module ruled ONE moment differently: the doc-comment named the disk the fact,
 * and the body returned `key-absent` (and `no-seal-expected`) off the config marker + the env var
 * BEFORE any carrier was opened. Reading the disk first settles both seams at once:
 *
 *   S3  a cleared vessel (`rm -rf <lares>/identity` + `vessel clear --force`) keeps `sealExpected`
 *       while no carrier stands. The guess said `key-absent` — a FALSE floor. The disk says
 *       `nothing-sealed`, `opens: true`, and the vessel lights its hearth.
 *   S2b a vessel the BOOT sealed carries `sealExpected: false` beside sealed bytes, so the guess
 *       short-circuited to `no-seal-expected` / `opens: true` and a MISTYPED passphrase read as
 *       opening. The disk says `key-wrong`, `probed: true` — with no config change, so an
 *       unattended vessel is never made to demand a passphrase it was never given
 *       (`founding-runbook`: "the var exists so one ceremony can run unattended, never so a machine
 *       can seal itself forever").
 *
 * `probed` carries the load here: it is the one field proving the apparatus RAN rather than guessed.
 *
 * Isolation: every test drives a fresh `mkdtemp` identity home through XDG_* + LAR_ROOT; the
 * operator's live vessel at `~/.local/share/lares` is never reachable from here.
 */
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { larIdentityDir } from "../src/vessel-paths.js";
import { persistIdentityArchive, archivePath } from "../src/identity-anchors.js";
import { readArchiveOpening, archiveSealStatus } from "../src/archive-passphrase.js";
import { setSealExpected } from "../src/lares-config.js";
import { ARCHIVE_PASSPHRASE_ENV } from "../src/archive-seal.js";
import { isSealedEnvelope } from "@lararium/mesh";

const PASS_A = "disk-outranks-guess-alpha-0";
const PASS_B = "disk-outranks-guess-bravo-0";

const SOVEREIGN = Uint8Array.from(Array.from({ length: 64 }, (_, i) => (i * 11 + 5) & 0xff));

const saved: Record<string, string | undefined> = {};
function setEnv(k: string, v: string | undefined): void {
  if (!(k in saved)) saved[k] = process.env[k];
  if (v === undefined) delete process.env[k]; else process.env[k] = v;
}

describe("CURE 2 — the disk outranks the guess", () => {
  let home: string;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "lares-disk-outranks-"));
    setEnv("LAR_ROOT", home);
    setEnv("XDG_STATE_HOME", join(home, "state"));
    setEnv("XDG_DATA_HOME", join(home, "data"));
    setEnv("XDG_CONFIG_HOME", join(home, "config"));
    setEnv(ARCHIVE_PASSPHRASE_ENV, undefined);
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
      delete saved[k];
    }
    rmSync(home, { recursive: true, force: true });
  });

  // ── RED 1 · S3 — the survived marker over an EMPTY disk ─────────────────────────────────────────
  // `vessel clear --force` does not remove `sealExpected` (founding-runbook §regenesis-live), and
  // `rm -rf <lares>/identity` removes every carrier. The guess read a sealed vessel with no key and
  // stood the vessel at a floor nothing on disk justified.
  test("RED — `sealExpected` + NO carrier + no env var reads `nothing-sealed`, and the vessel opens", () => {
    setSealExpected(true);
    expect(archiveSealStatus().sealExpected).toBe(true);
    expect(existsSync(archivePath()), "no carrier stands — the identity home was cleared").toBe(false);

    const reading = readArchiveOpening();
    expect(reading.kind).toBe("nothing-sealed");
    expect(reading.opens, "nothing stands on disk to open — the floor has nothing to fence").toBe(true);
    expect(reading.probed, "no carrier and no key: nothing was tried").toBe(false);
  });

  // ── RED 2 · S2b — the BOOT-sealed vessel meets a mistyped passphrase ─────────────────────────────
  // The M3 boot re-seal SEALS a carrier and never calls `setSealExpected`, so the marker reads false
  // beside sealed bytes. The guess short-circuited to `opens: true` on a WRONG key.
  test("RED — a boot-sealed vessel + a WRONG passphrase reads `key-wrong`, shut, and PROBED", () => {
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);
    persistIdentityArchive(SOVEREIGN);                       // the M3 shape: sealed by boot, no `vault seal`
    expect(isSealedEnvelope(readFileSync(archivePath())), "the boot sealed it").toBe(true);
    expect(archiveSealStatus().sealExpected, "and recorded nothing in the config").toBe(false);

    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_B);                  // a mistyped passphrase
    const reading = readArchiveOpening();
    expect(reading.kind).toBe("key-wrong");
    expect(reading.opens).toBe(false);
    // `probed` is the one field proving the apparatus RAN rather than guessed.
    expect(reading.probed, "the GCM tag was actually asked").toBe(true);
  });

  // ── RED 3 · the same vessel, the RIGHT passphrase — the reorder must not cost the open case ──────
  test("RED — a boot-sealed vessel + the RIGHT passphrase reads `opens`, and PROBED", () => {
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);
    persistIdentityArchive(SOVEREIGN);
    const reading = readArchiveOpening();
    expect(reading.kind).toBe("opens");
    expect(reading.opens).toBe(true);
    expect(reading.probed).toBe(true);
  });

  // ── CONTROL · FAIL-CLOSED MUST SURVIVE THE REORDER ──────────────────────────────────────────────
  // The whole point of reading the disk first is that a sealed carrier with no key still reads shut.
  // If this ever passes as `nothing-sealed`/`no-seal-expected`, the reorder has opened the door it
  // was written to keep closed.
  test("CONTROL — `sealExpected` + a SEALED carrier + no env var still reads `key-absent`, shut", () => {
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);
    persistIdentityArchive(SOVEREIGN);
    setSealExpected(true);
    setEnv(ARCHIVE_PASSPHRASE_ENV, undefined);

    const reading = readArchiveOpening();
    expect(reading.kind).toBe("key-absent");
    expect(reading.opens, "fail-closed survives the reorder").toBe(false);
    expect(reading.probed, "there was no key to try").toBe(false);
  });

  // ── CONTROL · a vessel that never sealed anything reads bare ────────────────────────────────────
  // A CLEARTEXT carrier is not a sealed one: the disk read must skip it, not count it.
  test("CONTROL — no marker + a CLEARTEXT carrier reads `no-seal-expected`, and opens", () => {
    persistIdentityArchive(SOVEREIGN);                       // no passphrase in env → cleartext
    expect(isSealedEnvelope(readFileSync(archivePath()))).toBe(false);

    const reading = readArchiveOpening();
    expect(reading.kind).toBe("no-seal-expected");
    expect(reading.opens).toBe(true);
    expect(reading.probed).toBe(false);
  });

  // ── CONTROL · a founding — nothing on disk at all, no marker ────────────────────────────────────
  test("CONTROL — a founding (no carrier, no marker) reads `no-seal-expected`, and opens", () => {
    rmSync(larIdentityDir(), { recursive: true, force: true });
    const reading = readArchiveOpening();
    expect(reading.kind).toBe("no-seal-expected");
    expect(reading.opens).toBe(true);
  });

  // ── CONTROL · a TORN carrier is still named apart from a wrong key ──────────────────────────────
  // `unreadable` names bytes that never framed, so no passphrase was ever tested. A carrier the
  // MAGIC probe accepts and the decoder refuses must keep that name after the reorder.
  test("CONTROL — a sealed carrier whose body will not decode still reads `unreadable`", () => {
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);
    persistIdentityArchive(SOVEREIGN);
    const sealed = readFileSync(archivePath());
    // Keep the MAGIC+VERSION prefix (so the envelope probe still says "sealed") and truncate the
    // body past any recoverable framing.
    writeFileSync(archivePath(), sealed.subarray(0, 6));
    const reading = readArchiveOpening();
    expect(reading.kind).toBe("unreadable");
    expect(reading.opens).toBe(false);
    expect(reading.probed, "these bytes never framed — the passphrase was never tested").toBe(false);
  });
});
