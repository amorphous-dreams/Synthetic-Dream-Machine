/**
 * a-reading-never-a-throw — CURE 3. The sharpest carrier-vs-code disagreement in the tree.
 *
 * On a BOOT-SEALED vessel met with a mistyped passphrase the boot DIED at
 * `archive-seal.ts` → `openArchiveBytes`, carrying:
 *
 *   "archive-seal: found a sealed archive (…) but no key source is configured —
 *    set LARES_ARCHIVE_PASSPHRASE to the passphrase that sealed it"
 *
 * — and a key WAS configured. It simply did not fit. The message named the wrong fact, and the
 * boot refused to stand for want of a key. THREE carriers rule that it must not:
 *
 *   waking-floor #/the-shape:
 *     <<~ has Wake Stand "at/the-minimum-reachable-cap-stack ~ never a refusal">>
 *     <<~ has Wake Serve "what/needs-no-secret ~ the public shelf serves without opening anything">>
 *     <<~ has Wake Hold  "closed/every-sovereign-act ~ a locked vessel signs nothing">>
 *   founding-runbook §rulings:
 *     "the vessel that cannot open its archive holds no key to misuse."
 *   archive-passphrase (readArchiveOpening):
 *     "A reading rather than a throw is the whole ruling — refusing converts an ordinary power cut
 *      into an outage, while the seal exists against a stolen disk."
 *
 * HOW IT WAS CURED, and where the cure does NOT sit. `openArchiveBytes` is RIGHT to throw: a sealed
 * envelope it cannot open must never read back as an empty identity. It is NOT weakened here, and a
 * test below pins that it still throws. What changed is that the BOOT stops asking it a question it
 * has already been told the answer to: with the disk read BEFORE the config guess (CURE 2), the
 * mistyped-passphrase vessel reads `key-wrong` / `opens: false`, `open-node-vessel` never calls
 * `loadIdentityArchive()`, and `standAs` stands the vessel at the floor with its reason named.
 *
 * So this file's reds fail with CURE 2 reverted and pass with it standing — which is the point: the
 * cure is a composition of two facts, and this file is the one that reads the composition.
 *
 * Isolation: a fresh `mkdtemp` identity home through XDG_* + LAR_ROOT.
 */
import { mkdtempSync, rmSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { persistIdentityArchive, loadIdentityArchive, archivePath } from "../src/identity-anchors.js";
import { archiveOpens, readArchiveOpening } from "../src/archive-passphrase.js";
import { ARCHIVE_PASSPHRASE_ENV, openArchiveBytes } from "../src/archive-seal.js";
import { isSealedEnvelope } from "@lararium/mesh";
import { standAs, personaSlotCeiling } from "@lararium/mesh";

const PASS_A = "reading-never-throw-alpha-0";
const PASS_B = "reading-never-throw-bravo-0";
const SOVEREIGN = Uint8Array.from(Array.from({ length: 64 }, (_, i) => (i * 13 + 1) & 0xff));

const saved: Record<string, string | undefined> = {};
function setEnv(k: string, v: string | undefined): void {
  if (!(k in saved)) saved[k] = process.env[k];
  if (v === undefined) delete process.env[k]; else process.env[k] = v;
}

/** THE BOOT'S OWN COMPOSITION, as `open-node-vessel` performs it: read once, gate both loads on it. */
function bootArchiveRead(): { opens: boolean; archiveBytes: Uint8Array | null } {
  const opens = archiveOpens();
  return { opens, archiveBytes: opens ? loadIdentityArchive() : null };
}

describe("CURE 3 — a reading, never a throw", () => {
  let home: string;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "lares-reading-not-throw-"));
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

  /** Stand a boot-sealed vessel (the M3 shape: sealed BY A BOOT, no `vault seal`), then mistype. */
  function bootSealedThenMistyped(): void {
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);
    persistIdentityArchive(SOVEREIGN);
    expect(isSealedEnvelope(readFileSync(archivePath())), "the boot sealed it").toBe(true);
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_B);
  }

  // ── RED 1 · NO THROW ESCAPES THE BOOT'S ARCHIVE READ ────────────────────────────────────────────
  test("RED — a boot-sealed vessel + a mistyped passphrase: the boot's archive read does not throw", () => {
    bootSealedThenMistyped();
    expect(() => bootArchiveRead()).not.toThrow();
    expect(bootArchiveRead().archiveBytes, "it stands WITHOUT the archive, never against it").toBeNull();
  });

  // ── RED 2 · THE VESSEL STANDS — AT THE FLOOR, FACELESS BY CLASS ──────────────────────────────────
  test("RED — it stands `herm`, and the floor seats no persona", () => {
    bootSealedThenMistyped();
    const standing = standAs("hearth", archiveOpens());
    expect(standing).toBe("herm");
    expect(personaSlotCeiling("herm"), "the vessel that cannot open its archive holds no key to misuse").toBe(0);
  });

  // ── RED 3 · THE ANNOUNCEMENT NAMES THE FACT IT MET ──────────────────────────────────────────────
  // The old message said "no key source is configured" while a key WAS configured. The reading now
  // names presence-held/fitness-refused, so the operator is not sent to set a var they already set.
  test("RED — the reading announces `key-wrong`, and the `why` names the passphrase as present but wrong", () => {
    bootSealedThenMistyped();
    const reading = readArchiveOpening();
    expect(reading.kind).toBe("key-wrong");
    expect(reading.why).toMatch(/present but wrong/);
    expect(reading.why, "never 'no key source is configured' — a key IS configured").not.toMatch(/no key source/);
    expect(reading.probed, "the apparatus RAN").toBe(true);
  });

  // ── RED 4 · AND IT WRITES NOTHING (the composition with CURE 1) ──────────────────────────────────
  // Both carriers byte-identical AND mtime-identical across the read — an unattended boot that
  // stands and serves must leave the sovereign bytes exactly where it found them.
  test("RED — the barred boot leaves the carrier byte-identical AND mtime-identical", () => {
    bootSealedThenMistyped();
    const bytesBefore = readFileSync(archivePath());
    const mtimeBefore = statSync(archivePath()).mtimeMs;

    bootArchiveRead();

    expect(readFileSync(archivePath()).equals(bytesBefore)).toBe(true);
    expect(statSync(archivePath()).mtimeMs).toBe(mtimeBefore);
  });

  // ── CONTROL · `openArchiveBytes` IS STILL RIGHT TO THROW — DO NOT WEAKEN IT ──────────────────────
  // The cure moved the QUESTION, never the answer. A sealed envelope that will not open must never
  // read back as an empty identity: that is how a mistyped passphrase destroys an archive.
  test("CONTROL — `openArchiveBytes` still THROWS on a sealed envelope it cannot open", () => {
    bootSealedThenMistyped();
    const sealed = readFileSync(archivePath());
    setEnv(ARCHIVE_PASSPHRASE_ENV, undefined);
    expect(() => openArchiveBytes(sealed)).toThrow();
  });

  // ── CONTROL · `loadIdentityArchive` still throws WHEN ASKED ──────────────────────────────────────
  // The boot's gate is what stops asking. The reader itself keeps its loud refusal, so any future
  // caller that skips the gate still fails loudly rather than booting a fresh empty identity.
  test("CONTROL — `loadIdentityArchive` still throws when called past the gate", () => {
    bootSealedThenMistyped();
    expect(() => loadIdentityArchive()).toThrow();
  });

  // ── THE WELD · `bootArchiveRead` above MUST stay the boot's real composition ─────────────────────
  // `bootArchiveRead` restates what `open-node-vessel` performs, and a restatement that drifts from
  // its original proves nothing about the boot (the COLLIDE-THE-INSTRUMENT lesson: a fixture pins
  // the grammar, only the corpus pins the reader). So this reads the ACTUAL boot source and pins
  // that BOTH loads sit behind the one reading — an ungated `loadIdentityArchive()` anywhere in that
  // file would put the throw back on the boot path with every test above still green.
  test("WELD — `open-node-vessel` gates BOTH archive loads on ONE `archiveOpens()` reading", () => {
    const src = readFileSync(new URL("../src/open-node-vessel.ts", import.meta.url), "utf8");
    // Every call site of either loader, with the 40 chars before it.
    const calls = [...src.matchAll(/.{0,40}(loadIdentityArchive|loadVeilArchive)\(\)/g)];
    expect(calls.length, "both loaders are called exactly once each").toBe(2);
    for (const c of calls) {
      expect(c[0], `ungated load: ${c[0]}`).toMatch(/opens \? (loadIdentityArchive|loadVeilArchive)\(\)$/);
    }
    // And the SAME reading rides into the worker, so the read gate and the write gate cannot drift.
    expect(src).toMatch(/const opens = archiveOpens\(\);/);
    expect(src).toMatch(/archiveOpens:\s*opens,/);
  });

  // ── CONTROL · THE HEARTH WHOSE KEY OPENS STILL READS ITS ARCHIVE ────────────────────────────────
  test("CONTROL — the right passphrase: the boot reads the archive back and stands `hearth`", () => {
    setEnv(ARCHIVE_PASSPHRASE_ENV, PASS_A);
    persistIdentityArchive(SOVEREIGN);
    const read = bootArchiveRead();
    expect(read.opens).toBe(true);
    expect(read.archiveBytes).not.toBeNull();
    expect(Uint8Array.from(read.archiveBytes!)).toEqual(SOVEREIGN);
    expect(standAs("hearth", read.opens)).toBe("hearth");
  });
});
