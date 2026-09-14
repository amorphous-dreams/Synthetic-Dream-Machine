/**
 * archive-passphrase (node atom) — the passphrase-LIFECYCLE surface over the at-rest seal (G1, #60).
 *
 * `archive-seal` frames the crypto atoms (scrypt KEK, AES-256-GCM seal/unseal, the envelope). This file
 * adds NO new crypto — it composes those atoms into the operator's four lifecycle gestures over the two
 * secret carriers the vessel holds at rest:
 *   · keyhive-archive.bin           — the sovereign identity floor; the daemon RE-SEALS it every boot (M3).
 *   · veil-archive.bin              — the veil identity's archive; re-sealed beside the vessel's every boot.
 *   · recovery-device-share-h${N}.bin — the device recovery share, ONE PER PERSONA (written at each
 *                                     persona's founding). The enumeration READS THE DISK for them —
 *                                     a family spelled as a single path is a family that escapes rotate,
 *                                     repair, status and the export refusal (see `deviceShareCarriers`).
 *   · seal-reserve-mine-share.bin   — the vessel's one share of the Nexus reserve seed; written at the seal rite.
 *
 * ONE RULE NAMES THE SET: every file a boot opens through `openArchiveBytes` under the resolved seal policy
 * rides this lifecycle. A carrier sealed under the policy and left out of a rotate stays under the OLD
 * passphrase, and the next boot faults at its GCM tag under the new one — a split no status named.
 *
 * TWO-CARRIER ATOMICITY (FORK-2, RATIFY — the collapse was blocked). The two carriers hold GENUINELY
 * INDEPENDENT write lifecycles: the archive re-seals on every boot (a frequent write the M3 path owns,
 * which does NOT hold the device-share in scope and writes even under the cleartext policy), while the
 * device-share writes only at founding. One shared envelope would force the frequent M3 writer to
 * unseal-and-rebundle a co-tenant secret it never holds — corrupting the device-share on any boot that
 * ran without it. So the carriers stay TWO files, and this surface holds them consistent through a
 * ratification discipline instead: PRE-VALIDATE every unseal, STAGE every temp, then RENAME in sequence.
 * A crash strictly BETWEEN the two renames is the only residual split-KEK window, which `archiveSealStatus`
 * DETECTS and `repairSplitKek` re-seals shut.
 *
 * THE PASSPHRASE NEVER PERSISTS. Every function DERIVES a KEK at the moment and DROPS the passphrase when
 * it returns; plaintext buffers zeroize the instant they are re-sealed. No function returns or logs key
 * material — a status read reports per-carrier STATE (absent/cleartext/sealed/unopenable) and never the key.
 *
 * ONE READER ANSWERS "WHAT STANDS ON THIS CARRIER", AND IT IS `readSealCarrier`. The strict probe
 * `isSealedEnvelope` answers a DECODER's question ("can I frame this?") and a flat false on every
 * envelope version it cannot frame. Every lifecycle verb here asks the writer's question instead —
 * "does a seal already stand?" — because folding `unopenable` onto `cleartext` made each verb draw a
 * different wrong conclusion from one wrong reading: status told the operator no seal stands, rotate
 * wrapped the ciphertext a second time, repair reported success over a broken carrier, and the boot
 * reading came up `opens: true` over a sealed archive. Reach for the strict probe only where a decode
 * is about to happen.
 *
 * FAIL-CLOSED throughout: a wrong old passphrase throws at the GCM tag BEFORE any byte is written
 * (zero-write), an empty passphrase is refused, and a would-be silent overwrite on export is refused.
 *
 * THE BOOT READING PROBES; IT NEVER COUNTS THE ENVIRONMENT. `archiveOpens`/`readArchiveOpening` decide
 * whether a boot can open what it must read by TRIAL-OPENING the boot carriers under the supplied
 * passphrase. A key that is merely PRESENT proves nothing: a wrong one satisfies presence and the vessel
 * would rise on a key that cannot unseal, the GCM tag refusing it later at whichever sovereign act read
 * the archive first. The reading names FIVE answers rather than one boolean, because folding "no key",
 * "wrong key" and "torn carrier" together inverts fail-closed into fail-open. What should HAPPEN after a
 * failed probe stands OPEN as a fork — see `readArchiveOpening`; the waking floor still stands here.
 */

import { readFileSync, existsSync, writeFileSync, renameSync, rmSync, openSync, fsyncSync, closeSync, chmodSync, mkdirSync, realpathSync } from "node:fs";
import { dirname, resolve, basename, join } from "node:path";
import { randomBytes } from "node:crypto";
import { decodeEnvelope, readSealCarrier } from "@lararium/mesh";
import {
  scryptKek, sealBytes, unsealBytes, openArchiveBytes, ARCHIVE_PASSPHRASE_ENV,
  passphraseSealPolicy, probeArchiveBytes, type CarrierProbe,
} from "./archive-seal.js";
import { archivePath } from "./identity-anchors.js";
import { deviceSharePath } from "./recovery-share-store.js";
import {
  vaultCarriers, deviceShareName, DEVICE_SHARE_FILE,
  type VaultCarrier, type CarrierName, type DeviceShareName,
} from "./vault-carriers.js";
import { setSealExpected, sealExpected as readSealExpected, type LaresConfig } from "./lares-config.js";
import { probeSecretService, keychainKekAvailable } from "./secret-service-probe.js";
import { larIdentityDir } from "./vessel-paths.js";
import { vesselKeyCensus, type KeyCensusEntry } from "./key-class.js";

const SALT_LEN = 16;

/** The SOFT floor: a passphrase shorter than this WARNS but is never rejected (FORK-4, operator agency). */
export const PASSPHRASE_MIN_LENGTH = 12;

/**
 * A warning string when a passphrase reads weak, else null. SOFT floor only — the caller warns and
 * proceeds; the core NEVER hard-rejects on length (a determined operator owns their own risk).
 */
export function weakPassphraseWarning(passphrase: string): string | null {
  if (passphrase.length < PASSPHRASE_MIN_LENGTH) {
    return `passphrase is ${passphrase.length} chars — under the ${PASSPHRASE_MIN_LENGTH}-char floor; a short passphrase weakens the scrypt KEK against an offline guess`;
  }
  return null;
}

/**
 * THE CARRIER ENUMERATION LIVES ONCE, IN `vault-carriers`, and the key census reads the SAME atom for the
 * SAME set. It moved there for the reason the enumeration itself exists: two derivations of one fact
 * drift, and a `vault status` naming `recovery-device-share-h1` under `keys` while omitting it from
 * `carriers` was exactly that drift, one output disagreeing with itself. See that file for why the DISK is
 * the source and why every location is spelled by its writer's own path function.
 */
type Carrier = VaultCarrier;
const carriers = vaultCarriers;
// The names stay readable from this surface — every existing importer of `CarrierName` reads the lifecycle,
// not the enumeration, and this is the lifecycle's door.
export type { CarrierName, DeviceShareName };

/**
 * Resolve a path the way the FILESYSTEM will, so a comparison against a carrier path compares LOCATIONS
 * rather than spellings. A string check wearing a path check's clothes misses three ordinary shapes: a
 * RELATIVE dest (resolved through the process cwd), a `..` TRAVERSAL that lands back on a carrier, and a
 * SYMLINK whose target is a carrier.
 *
 * `realpathSync` needs the leaf to exist, and an export destination usually does not — so it falls back to
 * realpath'ing the deepest EXISTING ancestor (the directory) and rejoining the basename. That resolves a
 * symlinked directory on the way in while still naming a leaf that has yet to be created.
 */
function resolvedLocation(p: string): string {
  const abs = resolve(p);
  try { return realpathSync(abs); } catch { /* the leaf does not stand yet */ }
  try { return join(realpathSync(dirname(abs)), basename(abs)); } catch { return abs; }
}

/**
 * Which sealed carrier a path RESOLVES onto, or null when it names somewhere else entirely.
 *
 * A DEVICE-SHARE SLOT COUNTS EVEN WHILE IT HOLDS NOTHING. The other three carriers exist or do not, but
 * the share family has slots the writer will mint later, and an export landing on an empty one seals an
 * arbitrary backup exactly where `persistRecoveryDeviceShare(share, N)` must write — after which the
 * write guard refuses that write forever, over bytes no passphrase in the vault opens. The pattern names
 * the family; standing bytes are not what makes a location a carrier's.
 */
function carrierAtPath(p: string): CarrierName | null {
  const target = resolvedLocation(p);
  const standing = carriers().find((c) => resolvedLocation(c.path) === target)?.name;
  if (standing) return standing;
  const m = DEVICE_SHARE_FILE.exec(basename(target));
  if (m) {
    const index = Number(m[1]);
    if (Number.isSafeInteger(index) && resolvedLocation(deviceSharePath(index)) === target) {
      return deviceShareName(index);
    }
  }
  return null;
}

/**
 * THREE READINGS PLUS ABSENCE, BECAUSE FOLDING ANY TWO LIES TO THE OPERATOR. `unopenable` names a seal
 * that STANDS and that this build cannot frame — an unknown envelope version, or a damaged magic over
 * intact framing. It is neither neighbour: reported as `cleartext` it tells an operator NO SEAL STANDS
 * where one does, and they act on that map (export, rotate, re-seal); reported as `sealed` it invites a
 * key to be tried against bytes no key can be judged against. Its own name is the only truthful answer.
 */
export type CarrierState = "absent" | "cleartext" | "sealed" | "unopenable";

export interface CarrierStatus {
  readonly state: CarrierState;
  /** The seal mode from the envelope header (passphrase/keychain) — only when sealed. */
  readonly mode?: "passphrase" | "keychain";
  /** When a probe passphrase is supplied: does THIS carrier open under it? (sealed carriers only). */
  readonly opensUnderProbe?: boolean;
}

export interface ArchiveSealStatus {
  readonly carriers: Record<CarrierName, CarrierStatus>;
  /** EVERY KEY NAMES ITS CLASS — the identity dir's census (`key-class`): `device-minted` · `seed` · `cloud-synced`. */
  readonly keys: readonly KeyCensusEntry[];
  /** True when a probe was supplied and the sealed carriers DISAGREE on it — a split-KEK signal. */
  readonly split: boolean;
  /** The boot-gate marker (config hint) — sealing is expected. */
  readonly sealExpected: boolean;
  /** Is `LARES_ARCHIVE_PASSPHRASE` present in the environment? (presence only — never the value). */
  readonly passphraseEnvSet: boolean;
  /**
   * Why the keychain KEK leg reads dark or lit on THIS machine. Carried so an operator reads the reason
   * rather than guessing at a silence — a leg that never explains itself gets mistaken for a leg that
   * never ran.
   */
  readonly keychain: { readonly persistentStore: boolean; readonly reason: string; readonly kekAvailable: boolean };
}

/**
 * Trial-open raw carrier bytes under a passphrase, THREE-VALUED — the distinction itself lives ONCE, in
 * `archive-seal`'s `probeArchiveBytes`, so the boot reading here and the WRITE guard
 * (`archive-write-guard`) can never drift into disagreeing about what a torn carrier means. See that atom
 * for why `unreadable` must never fold into `key-fails` (the pin-reader inversion).
 */
function probeCarrier(bytes: Uint8Array, passphrase: string): CarrierProbe {
  return probeArchiveBytes(bytes, passphraseSealPolicy(passphrase));
}

/** Try unsealing raw carrier bytes under a passphrase; true on a clean GCM open, false on any failure. */
function opensUnder(bytes: Uint8Array, passphrase: string): boolean {
  return probeCarrier(bytes, passphrase) === "opens";
}

/** Seal plaintext under a FRESH-salt scrypt KEK (no IV/salt ever repeats — archive-seal law). */
function sealUnder(plaintext: Uint8Array, passphrase: string): Uint8Array {
  const salt = randomBytes(SALT_LEN);
  return sealBytes(plaintext, scryptKek(passphrase, salt), "passphrase", salt);
}

/**
 * The RATIFY commit: write EVERY temp (fsync'd) before renaming ANY, then rename in sequence. A failure
 * before the first rename leaves the on-disk carriers BYTE-IDENTICAL (zero-write); a crash strictly
 * between renames leaves a split-KEK the status/repair path closes. Callers MUST pre-validate all unseals
 * before calling this, so a wrong passphrase never reaches a temp write.
 */
function stageAndCommit(writes: readonly { path: string; bytes: Uint8Array }[]): void {
  const staged: string[] = [];
  try {
    for (const w of writes) {
      const tmp = `${w.path}.${process.pid}.vault-tmp`;
      writeFileSync(tmp, w.bytes);
      const fd = openSync(tmp, "r+");
      try { fsyncSync(fd); } finally { closeSync(fd); }   // flush payload BEFORE the rename exposes it
      staged.push(tmp);
    }
  } catch (err) {
    // Zero renames ran — remove every temp so the carriers stay exactly as they were.
    for (const t of staged) { try { rmSync(t, { force: true }); } catch { /* best-effort */ } }
    throw err;
  }
  for (let i = 0; i < writes.length; i++) {
    renameSync(staged[i]!, writes[i]!.path);            // atomic pointer swap, per carrier
    try { chmodSync(writes[i]!.path, 0o600); } catch { /* best-effort on a non-POSIX fs */ }
  }
  // Persist the rename dirents (best-effort; the fs already lands them durably on platforms without dir-fsync).
  for (const w of writes) {
    try { const dfd = openSync(dirname(w.path), "r"); try { fsyncSync(dfd); } finally { closeSync(dfd); } }
    catch { /* platform without dir-fsync */ }
  }
}

/** Zero a plaintext buffer the instant it is no longer needed (narrow the in-memory secret window). */
function wipe(bytes: Uint8Array): void { bytes.fill(0); }

/**
 * Report the seal state of BOTH carriers — TRUTHFUL and key-free. Never derives, prints, or returns key
 * material. With `probe` supplied it additionally reports which sealed carriers OPEN under that passphrase
 * (the split-KEK detector); a split reads true when the sealed carriers disagree on the probe.
 */
export function archiveSealStatus(opts: { probe?: string; cfg?: LaresConfig } = {}): ArchiveSealStatus {
  const out = {} as Record<CarrierName, CarrierStatus>;
  const probeResults: boolean[] = [];
  for (const c of carriers()) {
    if (!existsSync(c.path)) { out[c.name] = { state: "absent" }; continue; }
    let bytes: Uint8Array;
    try { bytes = readFileSync(c.path); } catch { out[c.name] = { state: "absent" }; continue; }
    // VERSION-AWARE, and the distinction is reported rather than folded. A carrier this build cannot
    // frame carries NO mode and NO probe verdict: a mode read off an undecodable header would be a
    // fabrication, and `opensUnderProbe: false` would send the operator to re-type a credential that
    // was right all along (the pin-reader law — a default may state a fact, never lose one).
    const reading = readSealCarrier(bytes);
    if (reading === "bare") { out[c.name] = { state: "cleartext" }; continue; }
    if (reading === "unopenable") { out[c.name] = { state: "unopenable" }; continue; }
    const mode = decodeEnvelope(bytes).mode;
    if (opts.probe !== undefined) {
      const opens = opensUnder(bytes, opts.probe);
      probeResults.push(opens);
      out[c.name] = { state: "sealed", mode, opensUnderProbe: opens };
    } else {
      out[c.name] = { state: "sealed", mode };
    }
  }
  // Split-KEK: a probe opened SOME sealed carriers but not all — the carriers rode different KEKs.
  const split = probeResults.length > 1 && probeResults.some((v) => v) && probeResults.some((v) => !v);
  const probe = probeSecretService();
  return {
    carriers: out,
    keys: vesselKeyCensus(larIdentityDir()),
    split,
    sealExpected: readSealExpected(opts.cfg),
    passphraseEnvSet: Boolean(process.env[ARCHIVE_PASSPHRASE_ENV]),
    keychain: { persistentStore: probe.persistent, reason: probe.reason, kekAvailable: keychainKekAvailable() },
  };
}

export interface SealResult { readonly sealed: CarrierName[]; readonly skipped: CarrierName[]; }

/**
 * Seal every CLEARTEXT carrier under a fresh-salt KEK from `passphrase`, atomically (ratify). Already-sealed
 * carriers are skipped (idempotent); absent carriers are skipped. FAIL-CLOSED: an empty passphrase is
 * refused (never a zero-entropy KEK). Writes the boot-gate marker so a later boot without the passphrase
 * fails PRECISELY. Zero-write when nothing is cleartext.
 */
export function sealArchiveWithPassphrase(passphrase: string): SealResult {
  if (!passphrase) throw new Error("archive-passphrase: refusing to seal under an empty passphrase");
  const sealed: CarrierName[] = [];
  const skipped: CarrierName[] = [];
  const writes: { path: string; bytes: Uint8Array }[] = [];
  const plaintexts: Uint8Array[] = [];
  for (const c of carriers()) {
    if (!existsSync(c.path)) { skipped.push(c.name); continue; }
    const bytes = readFileSync(c.path);
    // VERSION-BLIND ON PURPOSE (`readSealCarrier`, not `isSealedEnvelope`). A carrier whose header this
    // build cannot frame — an unknown envelope version, a damaged magic over intact framing — is still a
    // SEALED carrier, and treating it as cleartext would wrap its ciphertext a second time under a fresh
    // KEK while recording `sealExpected`. No bytes are lost by that, but the operator's seal state would
    // then describe a double wrap nothing names. Skip it: `vault repair` and a backup own that carrier.
    if (readSealCarrier(bytes) !== "bare") { skipped.push(c.name); continue; }   // already sealed — idempotent
    writes.push({ path: c.path, bytes: sealUnder(bytes, passphrase) });
    plaintexts.push(bytes);
    sealed.push(c.name);
  }
  if (writes.length > 0) stageAndCommit(writes);
  for (const p of plaintexts) wipe(p);
  // Mark sealing in force whenever a carrier now reads sealed on disk (this call OR a prior one) — the
  // boot-gate must fire even if every carrier was already sealed and this call sealed nothing new.
  // The marker asks the SAME version-aware reader the skip above asks: a seal this build cannot frame
  // is still a seal standing on disk, and the boot-gate must fire over it.
  if (carriers().some((c) => existsSync(c.path) && readSealCarrier(readFileSync(c.path)) !== "bare")) {
    setSealExpected(true);
  }
  return { sealed, skipped };
}

export interface RotateResult { readonly rotated: CarrierName[]; }

/**
 * Rotate the passphrase: unseal every SEALED carrier under `oldPassphrase`, re-seal ALL present carriers
 * under `newPassphrase`, atomically (ratify). A wrong `oldPassphrase` throws at the GCM tag during
 * PRE-VALIDATION — before any temp is written — so a bad old passphrase leaves the carriers byte-identical
 * (zero-write). A cleartext carrier present alongside the sealed one is brought UNDER the new passphrase
 * in the same act (so all carriers converge on the new KEK). Refuses when nothing is sealed (use `seal`).
 */
export function rotateArchivePassphrase(oldPassphrase: string, newPassphrase: string): RotateResult {
  if (!newPassphrase) throw new Error("archive-passphrase: refusing to rotate to an empty passphrase");
  const present = carriers().filter((c) => existsSync(c.path));
  const readings = present.map((c) => ({ c, reading: readSealCarrier(readFileSync(c.path)) }));
  // ══ THE CENSUS RUNS BEFORE ANYTHING ELSE, AND IT IS VERSION-AWARE ════════════════════════════════
  // This loop asked `isSealedEnvelope`, which answers a flat false on an envelope version it cannot
  // frame — so a carrier holding an intact seal fell to the cleartext branch below, where "a cleartext
  // carrier carries its own plaintext" handed its CIPHERTEXT to the sealer and WRAPPED IT A SECOND
  // TIME. No bytes were lost (they survive one layer deeper), but the operator's recorded seal state
  // then described a double wrap nothing names, and the carrier's real KEK moved out of the vault's
  // reach. A rotate must converge EVERY carrier on the new KEK; a carrier that cannot move means the
  // act cannot be performed, so refuse the whole rotate rather than leave a split nothing named.
  const unopenable = readings.filter((r) => r.reading === "unopenable").map((r) => r.c.name);
  if (unopenable.length > 0) {
    throw new Error(
      `archive-passphrase: refusing to rotate — carrier(s) ${unopenable.join(", ")} hold a seal this ` +
      `build cannot frame (unopenable: an unknown envelope version, or a damaged magic over intact ` +
      `framing). No key can be judged against those bytes, so a rotate would wrap their ciphertext a ` +
      `second time. Recover them from a backup, then rotate`,
    );
  }
  if (!readings.some((r) => r.reading === "sealed")) {
    throw new Error("archive-passphrase: nothing is sealed — use `vault seal` to seal cleartext carriers first");
  }
  // PRE-VALIDATE every unseal under the OLD passphrase before touching disk. A wrong old passphrase
  // throws HERE (GCM tag), aborting with zero writes. THE GCM TAG IS THE PROOF OF OPERATOR INTENT —
  // the census above adds a refusal ahead of it and moves no write earlier.
  const plans: { path: string; plaintext: Uint8Array; name: CarrierName }[] = [];
  for (const { c, reading } of readings) {
    const bytes = readFileSync(c.path);
    const plaintext = reading === "sealed"
      ? unsealBytes(decodeEnvelope(bytes), scryptKek(oldPassphrase, decodeEnvelope(bytes).salt))
      : bytes;   // a BARE carrier carries its own plaintext — and only a bare one reaches here
    plans.push({ path: c.path, plaintext, name: c.name });
  }
  // Stage the re-seals under the NEW passphrase, then commit in sequence.
  const writes = plans.map((p) => ({ path: p.path, bytes: sealUnder(p.plaintext, newPassphrase) }));
  stageAndCommit(writes);
  for (const p of plans) wipe(p.plaintext);
  setSealExpected(true);
  return { rotated: plans.map((p) => p.name) };
}

export interface ExportResult { readonly dest: string; readonly bytes: number; readonly mode: "passphrase"; }

/**
 * Export the keyhive archive as a passphrase-SEALED backup to an operator path — NEVER the raw cleartext.
 * The CURRENT archive is opened through the vessel's live policy (`LARES_ARCHIVE_PASSPHRASE` when sealed;
 * bare when cleartext); the backup is then ALWAYS re-sealed under `passphrase` (fresh salt) — so a
 * cleartext vessel still writes an ENCRYPTED backup. Refuses a silent overwrite (pass `force` to replace).
 * Atomic + 0600. The passphrase drops and the plaintext zeroizes on return.
 */
export function exportSealedArchive(passphrase: string, destPath: string, force = false): ExportResult {
  if (!passphrase) throw new Error("archive-passphrase: refusing to export under an empty passphrase");
  const src = archivePath();
  if (!existsSync(src)) throw new Error(`archive-passphrase: no keyhive archive at ${src} to export`);
  // AN EXPORT PROVES INTENT ABOUT A BACKUP, NEVER ABOUT THE CARRIER IT WAS AIMED AT. Aimed at a live
  // carrier it re-seals the archive under an ARBITRARY passphrase and lands it there, consulting no
  // standing-bytes openability: the plaintext survives (so `vault repair` recovers it) but the live policy
  // stops opening the carrier and the next boot reads the floor. Refuse the destination instead — BEFORE
  // the exists/force question, so `--force` cannot walk past it.
  const carrierHit = carrierAtPath(destPath);
  if (carrierHit) {
    throw new Error(
      `archive-passphrase: refusing to export onto the "${carrierHit}" carrier itself (${destPath}) — an ` +
      `export re-seals under the passphrase you supplied here, which would leave the live policy unable to ` +
      `open the carrier and the next boot reading the waking floor. Write the backup somewhere else; use ` +
      `\`lares vault rotate\` to change the passphrase a carrier rides`,
    );
  }
  if (existsSync(destPath) && !force) {
    throw new Error(`archive-passphrase: ${destPath} exists — pass --force to overwrite (refusing a silent clobber)`);
  }
  // Open the current archive through the LIVE policy: a sealed archive needs LARES_ARCHIVE_PASSPHRASE
  // (openArchiveBytes throws PRECISELY when it is sealed but unconfigured); a cleartext archive passes through.
  const plaintext = openArchiveBytes(readFileSync(src));
  const sealed = sealUnder(plaintext, passphrase);
  wipe(plaintext);
  mkdirSync(dirname(destPath), { recursive: true });
  // atomicWriteFileSync-equivalent kept inline so the export shares the SAME temp→fsync→rename discipline
  // and lands 0600 in one act.
  stageAndCommit([{ path: destPath, bytes: sealed }]);
  return { dest: destPath, bytes: sealed.length, mode: "passphrase" };
}

export interface RepairResult { readonly repaired: CarrierName[]; readonly alreadyConsistent: CarrierName[]; }

/**
 * Repair a split-KEK: bring every sealed carrier UNDER `sealPassphrase`. A carrier that already opens under
 * `sealPassphrase` is left untouched (consistent); a carrier that opens only under `openPassphrase` (the
 * lagging one a crashed rotate left behind) is re-sealed under `sealPassphrase`, atomically. A carrier that
 * opens under NEITHER is a hard error (nothing here can recover it). Fail-closed, zero-write on any failure
 * before the commit.
 */
export function repairSplitKek(openPassphrase: string, sealPassphrase: string): RepairResult {
  if (!sealPassphrase) throw new Error("archive-passphrase: refusing to repair to an empty passphrase");
  const repaired: CarrierName[] = [];
  const alreadyConsistent: CarrierName[] = [];
  const writes: { path: string; bytes: Uint8Array }[] = [];
  const plaintexts: Uint8Array[] = [];
  for (const c of carriers()) {
    if (!existsSync(c.path)) continue;
    const bytes = readFileSync(c.path);
    const reading = readSealCarrier(bytes);
    if (reading === "bare") continue;         // cleartext carriers are not part of a KEK split
    // AN UNOPENABLE CARRIER IS A HARD ERROR, the same as one opening under NEITHER passphrase — and for
    // the same reason, with the same remedy. `isSealedEnvelope` folded it onto "cleartext", so it was
    // silently CONTINUED: `vault repair` then reported success while that carrier stayed broken, which
    // is the one thing a repair verb must never do.
    if (reading === "unopenable") {
      throw new Error(
        `archive-passphrase: carrier "${c.name}" holds a seal this build cannot frame (unopenable) — ` +
        `no key can be judged against it, so nothing here can repair it (recover it from a backup)`,
      );
    }
    if (opensUnder(bytes, sealPassphrase)) { alreadyConsistent.push(c.name); continue; }
    if (!opensUnder(bytes, openPassphrase)) {
      throw new Error(`archive-passphrase: carrier "${c.name}" opens under NEITHER passphrase — cannot repair (recover it from a backup)`);
    }
    const env = decodeEnvelope(bytes);
    const plaintext = unsealBytes(env, scryptKek(openPassphrase, env.salt));
    writes.push({ path: c.path, bytes: sealUnder(plaintext, sealPassphrase) });
    plaintexts.push(plaintext);
    repaired.push(c.name);
  }
  if (writes.length > 0) stageAndCommit(writes);
  for (const p of plaintexts) wipe(p);
  if (repaired.length > 0) setSealExpected(true);
  return { repaired, alreadyConsistent };
}

/**
 * The BOOT-GATE (FORK-3/5). Called on the boot load path: when the config marks sealing expected but no
 * `LARES_ARCHIVE_PASSPHRASE` rides the environment, throw a PRECISE message that names the fix — instead
 * of the generic sealed-without-key throw that surfaces only once the reader hits the envelope. The marker
 * is a HINT (config), never a secret; this only reads presence of the env var, never its value.
 *
 * ══ THE UNATTENDED-REBOOT TENSION — NAMED, NOT SOLVED (operator, 2026-08-08) ═════════════════════
 *
 * THIS GATE THROWS, AND AT CIVIC SCALE THAT READS WRONG. A hearth serving a neighbourhood reboots at 3am
 * after a power cut. Nobody is awake to type a passphrase. Today the vessel REFUSES TO BOOT and the place
 * goes dark until a human returns — so the at-rest seal, which exists to protect a STOLEN DISK, converts an
 * ordinary power cut into an outage. That trade is defensible for one operator's laptop and indefensible
 * for a crossroads a family depends on.
 *
 * THE OPTION SPACE, with what each actually costs:
 *   · CLEARTEXT + warning        — boots always, protects nothing at rest. Honest, and the current fallback.
 *   · PASSPHRASE IN A DOTFILE    — boots always, and the KEK sits beside the ciphertext it protects. This is
 *                                  obfuscation posing as isolation — the exact thing `archive-seal` refuses
 *                                  to do automatically, done by hand instead. It reports SEALED while
 *                                  offering no offline protection, which is worse than honest cleartext
 *                                  because it stops the operator looking.
 *   · OS KEYCHAIN                — distrusted here by ruling: on WSL2 a KEK can land in the kernel keyutils
 *                                  cache and BRICK the identity on reboot. The leg stays dark behind two
 *                                  independent probes.
 *   · TPM / HARDWARE-SEALED      — survives reboot, binds to platform state, needs hardware a Pi-class
 *                                  crossroads may or may not carry. UNEXPLORED here.
 *   · BOOT LOCKED, UNSEAL LATER  — the vessel STANDS without its secrets and serves what needs none; an act
 *                                  unseals it afterward. See below; this reads most pono and stands UNBUILT.
 *
 * WHY "BOOT LOCKED" FITS THE HOUSE ALREADY. The veil-ladder rules that every vessel stands anon at its floor
 * — its own key, its own local content, no group — and MUST always fall back there; caps stack above the
 * floor and never dissolve it. A vessel that cannot open its archive has lost the caps, not the floor. So the
 * pono shape is not a refusal but a DEGRADE: come up at the anon floor, serve the public shelf (which needs
 * no secret to serve), hold every sovereign act closed, and say loudly what it cannot do until unsealed.
 *
 * AND THE RAISE BELONGS TO THIS LAYER ALONE — a correction, because an earlier reading put it one layer out.
 * Opening a vessel's archive is the act of whoever holds THAT VESSEL's opening secret. It cannot be a kahu
 * quorum: a cabal is seated FROM declared Handles standing on an already-raised lararium, so a raise waiting
 * on a quorum could never found the first Nexus — the dependency runs in a circle. A quorum's acts sit one
 * layer out (the antigen, carriage contracts, the seal lineage) and reach no vessel's archive; a kahu
 * holding shares would become the collector the vault exists to refuse (waking-floor: KAHU MUST NOT HOLD
 * SHARES; Tang gives the escrow-free shape a share-holding quorum cannot).
 *
 * WHAT STAYS RULED AND WHAT STAYS OPEN, so a later hand does not mistake one for the other:
 *   RULED   the KEK is passphrase-primary; a random key beside the ciphertext is refused; a missing
 *           passphrase NEVER silently degrades to weak key handling.
 *   OPEN    whether a sealed vessel REFUSES or DEGRADES on an unattended boot, and what may unseal it
 *           afterward. This gate throws because refusing is the safe default while the answer is unmade —
 *           an outage is recoverable and a silently-unsealed identity is not. It is a placeholder for a
 *           ruling, never the ruling.
 *
 * The shape, the Elyncia reading, and the OPEN downgrade-attack question live at
 * lar:///ha.ka.ba/lares/api/pono/waking-floor — the waking floor.
 */
/**
 * ══ THE READING PROBES; IT DOES NOT COUNT THE ENVIRONMENT ════════════════════════════════════════
 *
 * `archiveOpens` gates `standAs` on the boot path (`main.ts`). Asking only whether
 * `LARES_ARCHIVE_PASSPHRASE` CARRIES A VALUE answers presence where the boot asked fitness: a WRONG
 * passphrase satisfies presence, the vessel rises to hearth on a key that cannot unseal, and the GCM
 * tag refuses it later — at whichever sovereign act happens to read the archive first, far from the
 * cause. So the reading TRIAL-OPENS the carriers a boot actually opens, reusing this module's own
 * unseal atoms (the same `vault status --check` probes with) rather than minting a second derivation.
 *
 * FIVE ANSWERS, BECAUSE TWO INVERT FAIL-CLOSED (the pin-reader law). A single boolean folded "no seal
 * expected", "no key present" and "key present but refused" onto one another; and a torn carrier —
 * bytes that never even framed — would fold onto "wrong passphrase", sending an operator to re-type a
 * credential that was right all along while a corruption sat unnamed. Each answer therefore carries
 * its own name and its own `why`, and only `opens` is derived from an actual successful unseal.
 *
 * WHICH CARRIERS. The BOOT opens the keyhive archive and the veil archive (`open-node-vessel.ts`), so
 * those are what a boot reading probes. A disagreement among the OTHER carriers is a split-KEK, which
 * `archiveSealStatus`/`vault repair` own and which does not decide whether this vessel can stand.
 *
 * ⚠ THE FORK THIS DOES NOT RULE, and deliberately leaves standing. What should HAPPEN after a failed
 * probe — keep the waking-floor stand, or refuse the stand outright — stands OPEN at
 * `lar:///ha.ka.ba/lares/docs/pono/seal-and-seat-handoff` #/forks ("Which stand reads the seal"), beside
 * the wider unattended-reboot tension named above. Nothing here answers it: the floor STILL STANDS on a
 * shut archive, exactly as before. This changes only what the reading KNOWS and what it SAYS — a wrong
 * passphrase is now named wrong AT THE POINT IT IS READ instead of passing as open.
 */
export type ArchiveOpeningKind =
  /** The config marks no seal in force — nothing to open, nothing probed. */
  | "no-seal-expected"
  /** Sealing marked expected, yet no sealed carrier stands on disk — the hint is a config guess, the disk is the fact. */
  | "nothing-sealed"
  /** A key rides the environment and it TRIAL-OPENED every boot carrier. */
  | "opens"
  /** Sealing expected and no key rides the environment. */
  | "key-absent"
  /** A key rides the environment and the GCM tag REFUSED it. Presence held; fitness did not. */
  | "key-wrong"
  /** A sealed boot carrier will not DECODE. No key can be judged against it, so none is blamed. */
  | "unreadable";

export interface ArchiveOpening {
  readonly kind: ArchiveOpeningKind;
  /** Can the boot open what it must read? Only `opens`, `no-seal-expected` and `nothing-sealed` say yes. */
  readonly opens: boolean;
  /** Did an actual trial-unseal run? False whenever there was no key, or nothing sealed to try it on. */
  readonly probed: boolean;
  /** Operator-facing reason, key-free — never the passphrase, never any derived material. */
  readonly why: string;
}

/** The carriers a BOOT opens through `openArchiveBytes`, in read order. */
function bootCarriers(): readonly Carrier[] {
  return carriers().filter((c) => c.name === "archive" || c.name === "veil");
}

/**
 * Read whether this vessel's archive OPENS — a reading, never a verdict on whether to proceed.
 *
 * The boot asks this and stands accordingly: open → the class the recipe asked for; shut → the waking floor
 * (`standAs`). A reading rather than a throw is the whole ruling — refusing converts an ordinary power cut
 * into an outage, while the seal exists against a stolen disk.
 */
export function readArchiveOpening(cfg?: LaresConfig, env: NodeJS.ProcessEnv = process.env): ArchiveOpening {
  // ══ THE DISK OUTRANKS THE GUESS ═════════════════════════════════════════════════════════════════
  // This module's own `nothing-sealed` clause already rules it — "the hint is a config guess, the disk
  // is the fact" — and an earlier body contradicted that clause by returning off the marker and the
  // env var BEFORE any carrier was opened. Two clauses of one module ruled one moment differently.
  //
  // Reading the disk first settles two seams with no config change:
  //   · a CLEARED vessel keeps `sealExpected` (`vessel clear --force` does not remove it) while no
  //     carrier stands. The guess said `key-absent` — a FALSE floor over an empty identity home.
  //   · a BOOT-SEALED vessel carries `sealExpected: false` beside sealed bytes (the M3 re-seal never
  //     calls `setSealExpected`), so the guess short-circuited to `no-seal-expected` / `opens: true`
  //     and a MISTYPED passphrase read as opening. The disk names it `key-wrong`.
  // NO CONFIG CHANGE is the point: an unattended vessel is never made to demand a passphrase it was
  // never given (founding-runbook — "the var exists so one ceremony can run unattended, never so a
  // machine can seal itself forever"). Only a vessel with SEALED BYTES ON DISK is ever asked for one.
  //
  // FAIL-CLOSED MOVES WITH THE ORDER, it does not soften: sealed carriers standing + no key still
  // reads `key-absent`, shut. What changes is that the sealed bytes, not the marker, decide WHETHER
  // the question of a key arises at all.
  const sealed: { name: CarrierName; bytes: Uint8Array }[] = [];
  for (const c of bootCarriers()) {
    if (!existsSync(c.path)) continue;
    let bytes: Uint8Array;
    try { bytes = readFileSync(c.path); } catch {
      return { kind: "unreadable", opens: false, probed: false, why: `the ${c.name} carrier cannot be read from disk` };
    }
    // ══ THE THIRD READING DECIDES HERE TOO, AND ITS ABSENCE WAS A FAIL-OPEN ═══════════════════════
    // `isSealedEnvelope` answers false on an envelope version this build cannot frame, so an intact
    // seal fell to this `continue`, the `sealed` list came up EMPTY, and the reading below returned
    // `no-seal-expected` / `opens: true` over a sealed archive — the exact inversion the five answers
    // exist to prevent. This module already NAMES the right answer (`unreadable`), and names it apart
    // from `key-wrong` on purpose: these bytes never framed, so no passphrase was ever tested and none
    // may be blamed. The reading is reported BEFORE the key question arises, so it holds with or
    // without a key in the environment.
    const reading = readSealCarrier(bytes);
    if (reading === "bare") continue;         // bare cleartext passes straight through the boot's reader
    if (reading === "unopenable") {
      return {
        kind: "unreadable", opens: false, probed: false,
        why: `the ${c.name} carrier holds a seal this build cannot frame (an unknown envelope version, ` +
             `or a damaged magic over intact framing) — no passphrase can open it (recover it from a backup)`,
      };
    }
    sealed.push({ name: c.name, bytes });
  }
  // Nothing sealed stands. The marker only chooses which TRUE thing to say; both open.
  if (sealed.length === 0) {
    return readSealExpected(cfg)
      ? {
          kind: "nothing-sealed", opens: true, probed: false,
          why: "sealing is marked expected and no sealed boot carrier stands on disk — nothing to open",
        }
      : { kind: "no-seal-expected", opens: true, probed: false, why: "no seal stands in force — the archive reads bare" };
  }
  // Sealed bytes stand, so a key is genuinely owed — whatever the marker guessed.
  const key = env[ARCHIVE_PASSPHRASE_ENV];
  if (!key) {
    return {
      kind: "key-absent", opens: false, probed: false,
      why: `your archive is sealed and ${ARCHIVE_PASSPHRASE_ENV} carries no passphrase`,
    };
  }
  // Trial-open every SEALED boot carrier. A cleartext or absent one needed no key and was skipped above.
  const results: { name: CarrierName; probe: CarrierProbe }[] =
    sealed.map((s) => ({ name: s.name, probe: probeCarrier(s.bytes, key) }));
  const torn = results.find((r) => r.probe === "unreadable");
  if (torn) {
    // NAMED APART FROM A WRONG KEY on purpose: these bytes never framed, so the passphrase was never tested.
    return {
      kind: "unreadable", opens: false, probed: false,
      why: `the ${torn.name} carrier will not decode as a sealed envelope — no passphrase can open it (recover it from a backup)`,
    };
  }
  const refused = results.find((r) => r.probe === "key-fails");
  if (refused) {
    return {
      kind: "key-wrong", opens: false, probed: true,
      why: `${ARCHIVE_PASSPHRASE_ENV} does not open the ${refused.name} carrier — the passphrase is present but wrong`,
    };
  }
  return { kind: "opens", opens: true, probed: true, why: "the supplied passphrase opened every sealed boot carrier" };
}

/**
 * Whether this vessel's archive OPENS. A PROBE — see `readArchiveOpening` for the five answers it folds
 * and for the fork this deliberately leaves open. Callers wanting the reason read that instead.
 */
export function archiveOpens(cfg?: LaresConfig, env: NodeJS.ProcessEnv = process.env): boolean {
  return readArchiveOpening(cfg, env).opens;
}

/**
 * The boot-gate throw. It now fires on a WRONG passphrase as well as an absent one, and says WHICH —
 * the message an operator reads decides whether they re-type a credential or go find a backup.
 */
export function assertSealReady(cfg?: LaresConfig, env: NodeJS.ProcessEnv = process.env): void {
  const reading = readArchiveOpening(cfg, env);
  if (reading.opens) return;
  throw new Error(
    `[lararium] ${reading.why} — set ${ARCHIVE_PASSPHRASE_ENV} to the passphrase that sealed it, then boot again`,
  );
}

/**
 * The DAEMON vault handler — the node-side shore injected into the daemon behavior (the persistArchive
 * inversion, #60). It runs IN the daemon worker, so it does the carrier fs ops AND updates the worker's
 * OWN in-memory seal policy: after a successful seal/rotate/repair it sets `process.env[ARCHIVE_PASSPHRASE_ENV]`
 * to the passphrase now in force, so any subsequent in-session seal (the M3 archive floor) rides the NEW
 * passphrase — never the old. That closes the un-rotate window: the carriers re-seal atomically AND the
 * policy the daemon would seal under next agrees with them. The passphrase rides the verb args over the
 * owner-only 0600 UDS — the SAME trust boundary as a CLI argument on the operator's own machine — and is
 * dropped after each op (it lives only in process.env, exactly as the launch environment already holds it;
 * it never reaches disk).
 */
export async function runVaultVerb(verb: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const str = (k: string): string => {
    const v = args[k];
    if (typeof v !== "string" || v.length === 0) throw new Error(`vault ${verb}: "${k}" (string) required`);
    return v;
  };
  switch (verb) {
    case "vault-status": {
      const probe = typeof args["probe"] === "string" ? (args["probe"] as string) : undefined;
      const status = archiveSealStatus(probe ? { probe } : {});
      return { verb, ...status };
    }
    case "vault-seal": {
      const passphrase = str("passphrase");
      const r = sealArchiveWithPassphrase(passphrase);
      process.env[ARCHIVE_PASSPHRASE_ENV] = passphrase;   // in-memory policy → next seal rides the new pass
      return { verb, ...r };
    }
    case "vault-rotate": {
      const oldPass = str("old");
      const newPass = str("new");
      const r = rotateArchivePassphrase(oldPass, newPass);
      process.env[ARCHIVE_PASSPHRASE_ENV] = newPass;      // no un-rotate: the policy moves with the carriers
      return { verb, ...r };
    }
    case "vault-export": {
      const passphrase = str("passphrase");
      const dest = str("dest");
      const force = args["force"] === true;
      const r = exportSealedArchive(passphrase, dest, force);
      return { verb, ...r };
    }
    case "vault-repair": {
      const openPass = str("openPass");
      const sealPass = str("sealPass");
      const r = repairSplitKek(openPass, sealPass);
      process.env[ARCHIVE_PASSPHRASE_ENV] = sealPass;
      return { verb, ...r };
    }
    default:
      throw new Error(`archive-passphrase: unknown vault verb "${verb}"`);
  }
}
