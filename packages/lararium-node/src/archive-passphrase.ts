/**
 * archive-passphrase (node atom) — the passphrase-LIFECYCLE surface over the at-rest seal (G1, #60).
 *
 * `archive-seal` frames the crypto atoms (scrypt KEK, AES-256-GCM seal/unseal, the envelope). This file
 * adds NO new crypto — it composes those atoms into the operator's lifecycle gestures over the share
 * carriers the vessel still keeps under a passphrase:
 *   · recovery-device-share-h${N}.bin — the device recovery share, ONE PER PERSONA (written at each
 *                                     persona's founding). The enumeration READS THE DISK for them —
 *                                     a family spelled as a single path is a family that escapes rotate,
 *                                     repair and status (see `deviceShareCarriers`).
 *   · seal-reserve-mine-share.bin   — the vessel's one share of the Nexus reserve seed; written at the seal rite.
 * The keyhive archive and the veil archives rest under the vessel key (`identity-anchors`); this lifecycle
 * governs neither, and refuses any carrier it meets sealed that way.
 *
 * ONE RULE NAMES THE SET: every file a boot opens through `openArchiveBytes` under the resolved seal policy
 * rides this lifecycle. A carrier sealed under the policy and left out of a rotate stays under the OLD
 * passphrase, and the next boot faults at its GCM tag under the new one — a split no status named.
 *
 * SEVERAL CARRIERS, ONE RATIFICATION. The carriers hold independent write lifecycles (each share writes at its
 * own rite), so they stay separate files, and this surface holds them consistent through a ratification
 * discipline: PRE-VALIDATE every unseal, STAGE every temp, then RENAME in sequence. A crash strictly BETWEEN two
 * renames is the only residual split-KEK window, which `archiveSealStatus` DETECTS and `repairSplitKek` re-seals
 * shut.
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
 * wrapped the ciphertext a second time, and repair reported success over a broken carrier. Reach for the strict
 * probe only where a decode is about to happen.
 *
 * FAIL-CLOSED throughout: a wrong old passphrase throws at the GCM tag BEFORE any byte is written
 * (zero-write), and an empty passphrase is refused.
 */

import { readFileSync, existsSync, writeFileSync, renameSync, rmSync, openSync, fsyncSync, closeSync, chmodSync } from "node:fs";
import { dirname } from "node:path";
import { randomBytes } from "node:crypto";
import { decodeEnvelope, readSealCarrier } from "@lararium/mesh";
import {
  scryptKek, sealBytes, unsealBytes, ARCHIVE_PASSPHRASE_ENV,
  passphraseSealPolicy, probeArchiveBytes, type CarrierProbe,
} from "./archive-seal.js";
import {
  vaultCarriers,
  type CarrierName, type DeviceShareName,
} from "./vault-carriers.js";
import { setSealExpected, sealExpected as readSealExpected, type LaresConfig } from "./lares-config.js";
import { probeSecretService, keychainKekAvailable } from "./secret-service-probe.js";
import { larIdentityDir } from "./vessel-paths.js";
import { vesselKeyCensus, type KeyCensusEntry } from "./key-class.js";
import { readVkCarrier } from "@lararium/mesh";

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
const carriers = vaultCarriers;

/** A carrier sealed under the vessel key answers to the custody door alone; the passphrase lifecycle refuses it by name. */
export class VkSealedCarrierRefusal extends Error {
  constructor(readonly carrier: CarrierName, readonly act: string) {
    super(`[vault] ${act} refused: the ${carrier} carrier rests sealed under the vessel key — the passphrase lifecycle never wraps, rotates, repairs or exports it; open it with \`lares vault unlock\`.`);
    this.name = "VkSealedCarrierRefusal";
  }
}

function refuseVkSeal(carrier: CarrierName, bytes: Uint8Array, act: string): void {
  const reading = readVkCarrier(bytes);
  if (reading === "sealed" || reading === "torn" || reading === "unopenable") throw new VkSealedCarrierRefusal(carrier, act);
}
// The names stay readable from this surface — every existing importer of `CarrierName` reads the lifecycle,
// not the enumeration, and this is the lifecycle's door.
export type { CarrierName, DeviceShareName };

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
  /** EVERY KEY NAMES ITS CLASS — the identity dir's census (`key-class`): `device-minted` · `seed` · `cloud-synced` · `relation`. */
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
  const standing = carriers().filter((c) => existsSync(c.path)).map((c) => ({ c, bytes: readFileSync(c.path) }));
  for (const { c, bytes } of standing) refuseVkSeal(c.name, bytes, "seal");
  for (const c of carriers()) {
    const row = standing.find((s) => s.c.name === c.name);
    if (!row) { skipped.push(c.name); continue; }
    const bytes = row.bytes;
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
  const readings = present.map((c) => ({ c, bytes: readFileSync(c.path) }));
  for (const { c, bytes } of readings) refuseVkSeal(c.name, bytes, "rotate");
  const classified = readings.map(({ c, bytes }) => ({ c, reading: readSealCarrier(bytes) }));
  // ══ THE CENSUS RUNS BEFORE ANYTHING ELSE, AND IT IS VERSION-AWARE ════════════════════════════════
  // This loop asked `isSealedEnvelope`, which answers a flat false on an envelope version it cannot
  // frame — so a carrier holding an intact seal fell to the cleartext branch below, where "a cleartext
  // carrier carries its own plaintext" handed its CIPHERTEXT to the sealer and WRAPPED IT A SECOND
  // TIME. No bytes were lost (they survive one layer deeper), but the operator's recorded seal state
  // then described a double wrap nothing names, and the carrier's real KEK moved out of the vault's
  // reach. A rotate must converge EVERY carrier on the new KEK; a carrier that cannot move means the
  // act cannot be performed, so refuse the whole rotate rather than leave a split nothing named.
  const unopenable = classified.filter((r) => r.reading === "unopenable").map((r) => r.c.name);
  if (unopenable.length > 0) {
    throw new Error(
      `archive-passphrase: refusing to rotate — carrier(s) ${unopenable.join(", ")} hold a seal this ` +
      `build cannot frame (unopenable: an unknown envelope version, or a damaged magic over intact ` +
      `framing). No key can be judged against those bytes, so a rotate would wrap their ciphertext a ` +
      `second time. Recover them from a backup, then rotate`,
    );
  }
  if (!classified.some((r) => r.reading === "sealed")) {
    throw new Error("archive-passphrase: nothing is sealed — use `vault seal` to seal cleartext carriers first");
  }
  // PRE-VALIDATE every unseal under the OLD passphrase before touching disk. A wrong old passphrase
  // throws HERE (GCM tag), aborting with zero writes. THE GCM TAG IS THE PROOF OF OPERATOR INTENT —
  // the census above adds a refusal ahead of it and moves no write earlier.
  const plans: { path: string; plaintext: Uint8Array; name: CarrierName }[] = [];
  for (const { c, reading } of classified) {
    const bytes = readings.find((r) => r.c.name === c.name)!.bytes;
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
  const standing = carriers().filter((c) => existsSync(c.path)).map((c) => ({ c, bytes: readFileSync(c.path) }));
  for (const { c, bytes } of standing) refuseVkSeal(c.name, bytes, "repair");
  for (const c of carriers()) {
    const row = standing.find((s) => s.c.name === c.name);
    if (!row) continue;
    const bytes = row.bytes;
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
