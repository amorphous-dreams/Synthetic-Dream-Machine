/**
 * `lares vault {status,unlock,lock,bind,unbind,seal,rotate,repair}` — the vessel key custody door, and the
 * retiring passphrase lifecycle over the share carriers.
 *
 * The vessel key seals the vessel's private rows; `unlock`, `lock`, `bind` and `unbind` open, drop and re-route
 * it. The passphrase lifecycle (`seal`, `rotate`, `repair`) governs the share carriers alone: the device recovery
 * shares and the reserve share.
 *
 * DAEMON-FIRST: when the daemon holds the socket, the MUTATING verbs route THROUGH it, so the
 * daemon re-persists the carriers AND updates its own in-memory seal policy in one act (no un-rotate).
 * When the daemon is DOWN, the CLI does the direct file op itself (same core functions, this process).
 *
 * THE PASSPHRASE NEVER TOUCHES argv OR the shell history: interactively it reads from a no-echo TTY prompt
 * (double-entry for a NEW passphrase — a typo would be a self-lockout); non-interactively it rides an
 * environment variable (LARES_ARCHIVE_PASSPHRASE / _NEW), never a flag. It drops the instant the op returns.
 */

import { join } from "node:path";
import { readFileSync } from "node:fs";
import {
  archiveSealStatus, sealArchiveWithPassphrase, rotateArchivePassphrase,
  repairSplitKek, weakPassphraseWarning,
  ARCHIVE_PASSPHRASE_ENV,
} from "@lararium/node";
import {
  FsCustodyIo, unlockCustody, bindCustodySlot, unbindCustodySlot, rotateCustody, custodyStatus,
  type CustodyHomes, type CustodyStatus,
} from "@lararium/node";
import { openVk, decodeSlotTree, type Credential, type SlotSpec } from "@lararium/mesh";
import { larIdentityDir, larDataDir, larSealHome } from "../env.js";
import { gatherBundleRoute, gatherCredentials, gatherNewSlot, gatherStayingSlot } from "../custody-prompt.js";
import { backupLines, cutBundleToFile } from "../vault-backup.js";
import { importLines, restoreFromBundle, restoreLines } from "../vault-restore.js";
import { sealedActVia } from "../sealed-act-door.js";
import { discordianReading } from "@lararium/node";
import { throughStoreDoor } from "../store-door.js";
import { udsAlive } from "../local-connector.js";
import { sendCustodyFrame, type CustodyDoorAnswer } from "../custody-door.js";
import { emit, exitFor, refuseUsage, wantsJson } from "../render.js";
import { helpLines } from "../command-help.js";
import { canPromptSecret, promptSecret, promptSecretConfirmed } from "../prompt-secret.js";
import type { ParsedArgs } from "../parse-args.js";

/** The env var carrying a NEW/target passphrase for non-interactive seal/rotate. */
const NEW_PASS_ENV = "LARES_ARCHIVE_PASSPHRASE_NEW";

function usage(args: ParsedArgs, typed?: string): number {
  return refuseUsage(args, "vault", helpLines("vault"), typed ? `unknown sub-verb "${typed}"` : undefined);
}

/** The CURRENT passphrase — env first, else a no-echo prompt. Non-interactive without the env → usage error. */
async function currentPass(args: ParsedArgs, label: string): Promise<string> {
  const env = process.env[ARCHIVE_PASSPHRASE_ENV];
  if (env) {
    if (canPromptSecret()) console.error(`  using ${ARCHIVE_PASSPHRASE_ENV} from the environment — no prompt opened.`);
    return env;
  }
  if (args.flags["yes"] || !canPromptSecret()) {
    throw new UsageError(`set ${ARCHIVE_PASSPHRASE_ENV} for non-interactive use`);
  }
  return promptSecret(`${label}: `);
}

/**
 * A NEW passphrase — env first (non-interactive), else a double-entry no-echo prompt (anti-lockout).
 *
 * A TTY caller carrying the env var keeps the env: setting it deliberately means it. But the bypass
 * SAYS SO, because an operator who expected a prompt and met silence learns nothing from the silence —
 * they conclude the prompt is broken, or worse, that they typed something they never typed. A shell
 * carrying a passphrase from an earlier command reads exactly like a shell that does not.
 */
async function newPass(args: ParsedArgs, label: string): Promise<string> {
  const env = process.env[NEW_PASS_ENV];
  if (args.flags["yes"] || !canPromptSecret()) {
    if (!env) throw new UsageError(`set ${NEW_PASS_ENV} for non-interactive use`);
    return env;
  }
  if (env) {
    console.error(`  using ${NEW_PASS_ENV} from the environment — no prompt opened.`);
    console.error(`  to type it instead:  env -u ${NEW_PASS_ENV} lares vault <verb>`);
    return env;
  }
  return promptSecretConfirmed(label);
}

class UsageError extends Error {}

/** A rotation that would refuse mid-way, caught before the slot is removed. */
class RotationPreflightRefusal extends Error { override readonly name = "RotationPreflightRefusal"; }

/** The refusals the custody door names: each leads its error line, so a caller reads the class, not a guess. */
const NAMED_REFUSALS: ReadonlySet<string> = new Set([
  "OldShapeRefusal", "CustodyRefusal", "TreeVkRefusal", "CensusRefusal",
  "CustodyLockRefused", "CustodyFoundingRefused", "CredentialTtyRefusal", "RotationPreflightRefusal",
]);

function custodyHomes(): CustodyHomes {
  return { identity: larIdentityDir(), storage: larDataDir(), seal: larSealHome() };
}

/** The sentence `vault status` prints beside the relation rows, and `vault unbind` beside its rotation offer. */
const RELATION_LINE =
  "rotation never repairs the loss of a relation carrier: a relation secret derives from no house key, so only the " +
  "other party can re-issue it. Back the carrier itself up.";

/** Warn (never reject) on a weak passphrase — the SOFT floor. */
function warnIfWeak(pass: string): void {
  const w = weakPassphraseWarning(pass);
  if (w) console.error(`  warning: ${w}`);
}

/** Where the seal-day rides — NON-SECRET, beside the identity it belongs to. */
function sealDayPath(): string { return join(larIdentityDir(), ".archive-seal-day.json"); }

/** Read the recorded seal-day, or null when this vault was sealed without one. */
function readSealDay(): { stamp: string; prose: string; source: string } | null {
  try { return JSON.parse(readFileSync(sealDayPath(), "utf8")) as { stamp: string; prose: string; source: string }; }
  catch { return null; }
}

/**
 * `lares vault passphrase` — read back WHICH DAY a sealed vault carries, and what to type.
 *
 * ANSWERING THE FIRST QUESTION PLAINLY: no CLI can set `LARES_ARCHIVE_PASSPHRASE` in the operator's shell —
 * a child process cannot write its parent's environment, on any OS. What a CLI can do is hold the ceremony
 * (`vault seal --ddate`) and read the record back (here), so the operator never has to remember a composed
 * string, only their own secret.
 */
function vaultPassphrase(args: ParsedArgs): number {
  const recorded = readSealDay();
  const today    = discordianReading();
  emit(args, {
    ok: true,
    data: { recorded, today: { prose: today.prose, stamp: today.stamp, source: today.source, agrees: today.agrees ?? null } },
    human: () => {
      console.log(`today:  ${today.prose}   [${today.source}]`);
      if (today.agrees === false) {
        console.log("  ⚠ ddate and the computed calendar DISAGREE — a foreign ddate, or a leap-year rule we have wrong.");
      }
      if (!recorded) {
        console.log("this vault carries NO recorded seal-day — it was sealed before the stamp existed.");
        console.log("  a re-seal or a rotate records one; the passphrase itself is unaffected either way.");
        return;
      }
      console.log(`sealed: ${recorded.prose}`);
      console.log(`  stamp:  ${recorded.stamp}`);
      console.log("  the day is a STAMP ON the passphrase, never a PART of it — this vault opens on your");
      console.log("  secret alone. Losing this record loses a nice fact and no access at all.");
    },
  });
  return 0;
}

export async function cmdVault(args: ParsedArgs): Promise<number> {
  const sub = args.positional[0];
  if (!sub) { usage(args); return 2; }
  const daemonUp = await udsAlive();

  try {
    switch (sub) {
      case "status":     return await vaultStatus(args, daemonUp);
      case "unlock":     return await vaultUnlock(args, daemonUp);
      case "lock":       return await vaultLock(args, daemonUp);
      case "bind":       return await vaultBind(args);
      case "unbind":     return await vaultUnbind(args);
      case "backup":     return await vaultBackup(args, daemonUp);
      case "restore":    return await vaultRestore(args, daemonUp);
      case "passphrase": return vaultPassphrase(args);
      case "seal":    return await vaultSeal(args, daemonUp);
      case "rotate":  return await vaultRotate(args, daemonUp);
      case "repair":  return await vaultRepair(args, daemonUp);
      default:
        console.error(`lares vault: unknown sub-verb "${sub}"`);
        return usage(args, sub);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // THE CUSTODY REFUSALS READ BY NAME. A caller tells a torn tree from a wrong credential from a held lock by the
    // name, so the name leads the line and the exit code stays the refusal's (1), never a usage error's.
    if (err instanceof Error && NAMED_REFUSALS.has(err.name)) {
      const named = `${err.name}: ${msg}`;
      emit(args, { ok: false, error: { code: err.name, message: named }, human: () => console.error(`lares vault ${sub}: ${named}`) });
      return 1;
    }
    const code = err instanceof UsageError ? "usage" : "error";
    emit(args, { ok: false, error: { code, message: msg }, human: () => console.error(`lares vault ${sub}: ${msg}`) });
    return exitFor(code);
  }
}

async function vaultStatus(args: ParsedArgs, daemonUp: boolean): Promise<number> {
  // --check probes a passphrase to detect a split-KEK (the carriers disagree on it).
  let probe: string | undefined;
  if (args.flags["check"]) {
    probe = process.env[ARCHIVE_PASSPHRASE_ENV] ?? (canPromptSecret() ? await promptSecret("passphrase to probe: ") : undefined);
  }
  const vargs: Record<string, unknown> = probe ? { probe } : {};
  const { output, via } = await throughStoreDoor({ verb: "vault-status", args: vargs, direct: () => ({ ...archiveSealStatus(probe ? { probe } : {}) }), daemonUp });
  const homes = custodyHomes();
  const custody = await custodyStatus({ io: new FsCustodyIo(homes), homes });
  // What the STANDING vessel holds, read off its custody door: a read, it opens nothing.
  const door = daemonUp ? await sendCustodyFrame({ op: "custody" }) : null;
  emit(args, {
    ok: true,
    data: { ...output, via, custody, door },
    human: () => {
      if (door?.["testScratch"] === true) console.log("TEST SCRATCH ROOT — a harness staged this vessel; its custody opens under the published test route. Never a vessel anyone keeps.");
      if (door && typeof door["unlocked"] === "boolean") {
        console.log(door["unlocked"]
          ? `vessel key     HELD by the standing vessel (slot ${String(door["slot"])}); it stands as ${String(door["standing"])}. \`lares vault lock\` drops it.`
          : `vessel key     NOT held: the vessel stands as ${String(door["standing"])} with ${String(door["attemptsLeft"])} unlock attempt(s) left this boot. \`lares vault unlock\` opens it.`);
      } else {
        console.log("vessel key     no vessel stands on this store, so no process holds it.");
      }
      printCustody(custody);
      const carriers = (output["carriers"] ?? {}) as Record<string, { state: string; mode?: string; opensUnderProbe?: boolean }>;
      console.log(`vault status (${via}):`);
      for (const [name, c] of Object.entries(carriers)) {
        const probeMark = c.opensUnderProbe === undefined ? "" : c.opensUnderProbe ? "  ✓ opens under probe" : "  ✗ does NOT open under probe";
        // 18 columns, because the device share names a FAMILY: one carrier per persona
        // (`device-share-h0`, `device-share-h1`, …), and a 14-column field ran the widest name into its state.
        console.log(`  ${name.padEnd(18)} ${c.state}${c.mode ? ` (${c.mode})` : ""}${probeMark}`);
      }
      // `unopenable` is a FAULT, not a third resting state, so it says so rather than sitting in the
      // column beside `sealed` as though it were one. It reads apart from a split-KEK: no passphrase
      // reaches these bytes at all, so `repair` cannot cure it and only a backup can.
      const unopenable = Object.entries(carriers).filter(([, c]) => c.state === "unopenable").map(([n]) => n);
      if (unopenable.length > 0) {
        console.error(
          `  ⚠ UNOPENABLE: ${unopenable.join(", ")} hold a seal this build cannot frame — no passphrase ` +
          `opens them and \`vault repair\` cannot cure it; recover from a backup`,
        );
      }
      if (output["split"]) console.error("  ⚠ SPLIT-KEK: the carriers ride different passphrases — run `lares vault repair`");
      console.log(`  sealExpected   ${output["sealExpected"]}`);
      console.log(`  passphraseEnv  ${output["passphraseEnvSet"] ? "set" : "unset"}`);
      // The keychain leg says WHY it reads dark. A silent leg gets mistaken for a leg that never ran.
      const kc = output["keychain"] as { persistentStore?: boolean; reason?: string; kekAvailable?: boolean } | undefined;
      if (kc) {
        console.log(`  keychainKek    ${kc.kekAvailable ? "available" : "dark"} — ${kc.reason ?? "no reason reported"}`);
      }
      // EVERY KEY NAMES ITS CLASS (basket-one #/the-phone-seat): device-minted · seed · cloud-synced. A key
      // the census cannot class never renders as a device key by omission — the class rides beside the name.
      //
      // AND EVERY KEY NAMES ITS CUSTODY, on a SECOND column, because `class` names two regimes. Three keys
      // read `seed` and only two of them ride the vault lifecycle above — a reader who saw `seed` alone and
      // swept "every seed" would either write over the persona-group root or skip it while reporting success.
      // `at-rest` says which; the carrier name joins the row to the `carriers` block overhead.
      const keys = (output["keys"] ?? []) as readonly { name: string; class: string; file?: string; atRest?: string; carrier?: string | null }[];
      const sealedSeeds = keys.filter((k) => k.class === "seed" && k.atRest === "sealed").length;
      const bareSeeds   = keys.filter((k) => k.class === "seed" && k.atRest === "cleartext").length;
      console.log(`  keys           ${keys.length} (cloud-synced: ${keys.filter((k) => k.class === "cloud-synced").length} — none stand today; a PRF/passkey wrap MUST declare one)`);
      console.log(`                 seed keys: ${sealedSeeds} under the vault lifecycle · ${bareSeeds} riding no seal`);
      // 14 for the class, 10 for the at-rest word ("cleartext"), so neither runs into the next field.
      for (const k of keys) {
        const custody = k.atRest ?? "unnamed";
        const where   = k.carrier ? ` → ${k.carrier}` : "";
        console.log(`    ${k.name.padEnd(28)} ${k.class.padEnd(14)} ${custody.padEnd(10)}${k.file ? ` ${k.file}` : ""}${where}`);
      }
    },
  });
  return 0;
}

async function vaultSeal(args: ParsedArgs, daemonUp: boolean): Promise<number> {
  const secret = await newPass(args, "new passphrase");
  warnIfWeak(secret);
  // EVERY seal stamps its day. It needs no flag because it changes nothing about the passphrase — the
  // vault opens on exactly what the operator typed, and the day rides beside it as a record.
  const pass    = secret;
  const erisian = discordianReading();
  const { output, via } = await throughStoreDoor({ verb: "vault-seal", args: { passphrase: pass }, direct: () => ({ ...sealArchiveWithPassphrase(pass) }), daemonUp });
  const sealed = (output["sealed"] ?? []) as string[];

  // NO STAMP GETS WRITTEN HERE. No carrier answers the passphrase lifecycle, so this seal seals none, and a day
  // nobody sealed on never gets recorded. `stamped` therefore reads false; `vault passphrase` reads back a stamp
  // an earlier seal left, where one stands.
  emit(args, {
    ok: true, data: { ...output, via, sealedCount: sealed.length, stamped: sealed.length > 0 },
    human: () => {
      if (sealed.length === 0) {
        // A no-op reads as a no-op. The common cause is worth naming: a passphrase in the environment
        // during founding seals the carriers THERE, so this movement finds nothing left to do.
        console.log(`sealed NOTHING (${via}) — every carrier already stands sealed, or none exists yet.`);
        console.log("  no stamp written: the day records a seal that happened, never one attempted.");
        console.log("  see what stands:      lares vault status");
        console.log("  change the passphrase: lares vault rotate");
        return;
      }
      console.log(`sealed ${sealed.join(", ")} (${via})`);
      console.log(`  sealed on ${erisian.prose}   [${erisian.source}]`);
      console.log("  the day is a STAMP, never part of the passphrase — the vault opens on what you typed.");
      console.log("  read it back any time with:  lares vault passphrase");
    },
  });
  return 0;
}

async function vaultRotate(args: ParsedArgs, daemonUp: boolean): Promise<number> {
  const oldP = await currentPass(args, "current passphrase");
  const newP = await newPass(args, "new passphrase");
  warnIfWeak(newP);
  const { output, via } = await throughStoreDoor({ verb: "vault-rotate", args: { old: oldP, new: newP }, direct: () => ({ ...rotateArchivePassphrase(oldP, newP) }), daemonUp });
  emit(args, {
    ok: true, data: { ...output, via },
    human: () => console.log(`rotated ${((output["rotated"] ?? []) as string[]).join(", ") || "(none)"} (${via})`),
  });
  return 0;
}

async function vaultRepair(args: ParsedArgs, daemonUp: boolean): Promise<number> {
  // The lagging carrier opens under the OPEN passphrase; re-seal it under the SEAL (target) passphrase.
  const openP = await currentPass(args, "passphrase that opens the LAGGING carrier");
  const sealP = await newPass(args, "target passphrase (opens the other carrier)");
  const { output, via } = await throughStoreDoor({ verb: "vault-repair", args: { openPass: openP, sealPass: sealP }, direct: () => ({ ...repairSplitKek(openP, sealP) }), daemonUp });
  emit(args, {
    ok: true, data: { ...output, via },
    human: () => {
      const repaired = (output["repaired"] ?? []) as string[];
      console.log(`repaired ${repaired.length ? repaired.join(", ") : "(nothing — carriers already consistent)"} (${via})`);
    },
  });
  return 0;
}

/** The "custody (VK)" section: the slot tree, then every standing table row with its key class and reading. */
function printCustody(c: CustodyStatus): void {
  console.log("custody (VK):");
  if (c.tree.reading === "absent") console.log("  slot tree      absent — no vk-slots.bin stands (a founding seals custody from birth)");
  else if (c.tree.reading === "unreadable") console.log(`  slot tree      UNREADABLE — ${c.tree.why}`);
  else {
    console.log(`  slot tree      ${c.tree.slots.length} slot(s)`);
    for (const sl of c.tree.slots) console.log(`    ${sl.id}  t=${sl.t}  ${sl.pins.join(" + ")}`);
  }
  const standing = c.rows.filter((r) => r.reading !== "absent");
  if (standing.length === 0) console.log("  carriers       none standing");
  for (const r of standing) {
    console.log(`    ${r.row.padEnd(22)} ${r.home.padEnd(9)} ${r.custody.padEnd(5)} ${String(r.keyClass ?? "-").padEnd(14)} ${r.reading}`);
  }
  // OWED = a hot or cold row still bare. The floor rows (`floor`, `floor-plain`) never move under the VK by rule, so
  // they never count.
  const bare = standing.filter((r) => (r.custody === "hot" || r.custody === "cold") && r.reading === "bare").length;
  if (bare > 0) console.log(`  ${bare} hot/cold carrier(s) read bare: their writers have not yet moved under the VK. Floor rows (floor, floor-plain) never move under it and are not counted.`);
  const relation = standing.filter((r) => r.keyClass === "relation");
  console.log(`  relation class ${relation.length} standing${relation.length ? ` (${relation.map((r) => r.row).join(", ")})` : ""}`);
  console.log(`  note           ${RELATION_LINE}`);
}

/** Read the tree at the identity home and prove `credentials` open it, or explain why not. Writes nothing beyond the settle. */
async function openOrRefuse(args: ParsedArgs, verb: string, homes: CustodyHomes, io: FsCustodyIo, creds: readonly Credential[]) {
  const u = await unlockCustody({ io, homes, credentials: creds });
  if (u.reading === "opens") return u;
  const why =
    u.reading === "no-slot-opens" ? `no slot opens under what was presented${u.notes.length ? ` (${u.notes.join("; ")})` : ""} — nothing was changed`
    : u.reading === "tree-absent"  ? "no slot tree stands at the identity home — nothing to unlock (a founding seals custody from birth)"
    : `the slot tree reads unreadable: ${u.why} — a torn tree is not a credential error; nothing was changed`;
  emit(args, { ok: false, error: { code: u.reading, message: why }, data: { reading: u.reading }, human: () => console.error(`lares vault ${verb}: ${why}`) });
  return null;
}

/** What the custody door's answer means to a person, one line per reading. */
function unlockLine(a: CustodyDoorAnswer): string {
  const standing = typeof a["standing"] === "string" ? a["standing"] : "?";
  const refused = typeof a["refused"] === "string" ? ` The sovereign composition did not stand: ${a["refused"]}.` : "";
  switch (a["reading"]) {
    case "opens":            return a["held"] === false
      ? `slot ${String(a["slot"])} opened the vessel key, and the vessel dropped it again: it stands as ${standing}.${refused}`
      : `unlocked: slot ${String(a["slot"])} opened the vessel key; the vessel stands as ${standing}.${refused}`;
    case "already-unlocked": return `already unlocked: the vessel holds its key and stands as ${standing}.`;
    case "no-slot-opens":    return `no slot opens under what was presented — nothing was changed; ${String(a["attemptsLeft"])} attempt(s) left before this vessel refuses every unlock until it restarts.`;
    case "attempts-spent":   return "this vessel refuses every unlock until it restarts: its unlock attempts for this boot stand spent. Restart it (`lares vessel stand --restart`), then unlock.";
    case "tree-absent":      return "no slot tree stands at the identity home — nothing to unlock (a founding seals custody from birth).";
    case "tree-unreadable":  return `the slot tree reads unreadable: ${String(a["why"])} — a torn tree is not a credential error; nothing was changed.`;
    case "root-unopenable":  return `the vessel key opened and the custody root did not (${String(a["why"])}) — nothing stays held; recover the custody root from a backup.`;
    default:                 return typeof a["errorMessage"] === "string" ? a["errorMessage"] : `the vessel answered ${JSON.stringify(a)}`;
  }
}

/**
 * `vault unlock`. A vessel that stands holds no key until a person presents a credential: with a daemon up, the
 * credential rides ONE custody frame to it, the daemon opens the vessel key and composes again with what the key
 * opens. With no daemon up the credential gets proven against the slot tree and nothing stays open, since no
 * process stands to hold it.
 */
async function vaultUnlock(args: ParsedArgs, daemonUp: boolean): Promise<number> {
  const homes = custodyHomes();
  const io = new FsCustodyIo(homes);
  const creds = await gatherCredentials("lares vault unlock", routeFlag(args));
  if (daemonUp) {
    const a = await sendCustodyFrame({ op: "unlock", credentials: creds });
    if (a === null) {
      emit(args, { ok: false, error: { code: "daemon-unreachable", message: "the vessel stopped answering before the unlock landed" }, human: () => console.error("lares vault unlock: the vessel stopped answering before the unlock landed — check `lares vessel read`, then unlock again") });
      return 1;
    }
    const ok = (a["reading"] === "opens" && a["held"] !== false) || a["reading"] === "already-unlocked";
    emit(args, ok
      ? { ok: true, data: a, human: () => console.log(unlockLine(a)) }
      : { ok: false, error: { code: String(a["reading"] ?? (a["refusal"] as { reason?: string } | undefined)?.reason ?? "refused"), message: unlockLine(a) }, data: a, human: () => console.error(`lares vault unlock: ${unlockLine(a)}`) });
    return ok ? 0 : 1;
  }
  const u = await openOrRefuse(args, "unlock", homes, io, creds);
  if (!u) return 1;
  emit(args, {
    ok: true, data: { reading: "opens", slot: u.slot, held: false },
    human: () => console.log(`slot ${u.slot} opens the vessel key. No vessel stands on this store, so nothing holds it open — stand the vessel (\`lares vessel stand\`), then run \`lares vault unlock\` again.`),
  });
  return 0;
}

/** `vault lock`: the standing vessel drops its key, tears its sovereign composition down and stands at the floor. */
async function vaultLock(args: ParsedArgs, daemonUp: boolean): Promise<number> {
  if (!daemonUp) {
    emit(args, { ok: true, data: { locked: true, was: "no-vessel" }, human: () => console.log("no vessel stands on this store: nothing holds a key, so nothing to lock.") });
    return 0;
  }
  const a = await sendCustodyFrame({ op: "lock" });
  if (a === null || a["locked"] !== true) {
    const why = a && typeof a["errorMessage"] === "string" ? a["errorMessage"] : "the vessel stopped answering before the lock landed";
    emit(args, { ok: false, error: { code: "lock-unconfirmed", message: why }, human: () => console.error(`lares vault lock: ${why}`) });
    return 1;
  }
  emit(args, { ok: true, data: a, human: () => console.log(a["was"] === "unlocked"
    ? `locked: the vessel dropped its key and stands as ${String(a["standing"])}; every sovereign act waits on \`lares vault unlock\`.`
    : `already locked: the vessel holds no key and stands as ${String(a["standing"])}.`) });
  return 0;
}

/**
 * `vault backup --face <N> --out <file>`: cut one face's backup bundle. The standing vessel, unlocked and wearing
 * that face, builds the body behind its custody door; this command reads the vessel's own route and then the
 * bundle's new route on a terminal, binds the bundle's slot tree in its own process and writes the file.
 */
async function vaultBackup(args: ParsedArgs, daemonUp: boolean): Promise<number> {
  const faceRaw = args.options["face"];
  const out = args.options["out"];
  if (typeof faceRaw !== "string" || !/^(0|[1-9]\d*)$/.test(faceRaw) || !Number.isSafeInteger(Number(faceRaw))) {
    throw new UsageError("backup needs the face's handle-index: `lares vault backup --face <N> --out <file>` (indices print under `lares persona list`)");
  }
  if (typeof out !== "string" || out.length === 0) throw new UsageError("backup needs a file to write: `lares vault backup --face <N> --out <file>`");
  if (!daemonUp) {
    const why = "a cut needs the standing vessel, unlocked, wearing that face: its island holds the content keys. Stand it (`lares vessel stand`), unlock it (`lares vault unlock`), then cut.";
    emit(args, { ok: false, error: { code: "no-vessel", message: why }, human: () => console.error(`lares vault backup: ${why}`) });
    return 1;
  }
  if (!wantsJson(args)) console.log("First this vessel's own route: it proves a person stands at this cut.");
  const vesselCredentials = await gatherCredentials("lares vault backup", routeFlag(args));
  const bundleRoutes = await gatherBundleRoute("lares vault backup");
  const result = await cutBundleToFile({ face: Number(faceRaw), out, vesselCredentials, bundleRoutes, send: (frame) => sendCustodyFrame(frame) });
  if (!result.ok) {
    emit(args, { ok: false, error: { code: result.reason, message: result.message }, data: { reason: result.reason, ...(result.attemptsLeft !== undefined ? { attemptsLeft: result.attemptsLeft } : {}) }, human: () => console.error(`lares vault backup: ${result.reason}: ${result.message}`) });
    return 1;
  }
  emit(args, { ok: true, data: { ...result }, human: () => { for (const line of backupLines(result)) console.log(line); } });
  return 0;
}

/**
 * `vault restore <file> [--as <N>] [--memory]`: bring one face back from its backup bundle. The command reads the
 * bundle's route on a terminal and opens the slot tree; the vessel opens the body behind its custody door and lands
 * the face as a recovery act, at a NEW seat. `--memory` lands the bundle's content keys on that seat instead: it
 * needs the vessel standing unlocked and wearing the face.
 */
async function vaultRestore(args: ParsedArgs, daemonUp: boolean): Promise<number> {
  const file = args.positional[1];
  if (!file) throw new UsageError("restore needs the bundle's file: `lares vault restore <file> [--as <N>] [--memory]`");
  const asRaw = args.options["as"];
  if (asRaw !== undefined && (!/^(0|[1-9]\d*)$/.test(asRaw) || !Number.isSafeInteger(Number(asRaw)))) throw new UsageError("--as takes a handle-index: `lares vault restore <file> --as <N>`");
  const memory = args.flags["memory"] === true;
  if (memory && asRaw !== undefined) throw new UsageError("--memory lands keys on the seat of the face the vessel wears, and takes no --as");
  if (memory && !daemonUp) {
    const why = "an import needs the vessel standing unlocked and wearing the restored face: its island wraps each key for this vessel's own seat. Stand it (`lares vessel stand`), unlock it (`lares vault unlock`), then import.";
    emit(args, { ok: false, error: { code: "no-vessel", message: why }, human: () => console.error(`lares vault restore: ${why}`) });
    return 1;
  }
  if (!wantsJson(args)) console.log("The bundle's own route: the passphrase or the paper sheet it got sealed under.");
  const credentials = await gatherCredentials("lares vault restore", routeFlag(args));
  const result = await restoreFromBundle({
    file, credentials, memory, ...(asRaw !== undefined ? { as: Number(asRaw) } : {}),
    run: (act, actArgs) => sealedActVia(act, actArgs),
  });
  if (!result.ok) {
    emit(args, { ok: false, error: { code: result.reason, message: result.message }, data: { reason: result.reason }, human: () => console.error(`lares vault restore: ${result.reason}: ${result.message}`) });
    return 1;
  }
  emit(args, { ok: true, data: { ...result }, human: () => { for (const line of result.kind === "restore" ? restoreLines(result) : importLines(result)) console.log(line); } });
  return 0;
}

function routeFlag(args: ParsedArgs): { route?: "paper" | "passphrase" } {
  if (args.flags["paper"]) return { route: "paper" };
  if (args.flags["passphrase"]) return { route: "passphrase" };
  return {};
}

async function vaultBind(args: ParsedArgs): Promise<number> {
  if (args.flags["paper"] && args.flags["passphrase"]) throw new UsageError("bind takes --passphrase or --paper, not both");
  const homes = custodyHomes();
  const io = new FsCustodyIo(homes);
  const creds = await gatherCredentials("lares vault bind");
  const u = await openOrRefuse(args, "bind", homes, io, creds);
  if (!u) return 1;
  const spec = await gatherNewSlot("lares vault bind", args.flags["paper"] ? "paper" : "passphrase");
  const out = await bindCustodySlot({ io, homes, vk: u.vk, spec });
  emit(args, {
    ok: true, data: { slotId: out.slotId, slots: out.tree.slots.length },
    human: () => console.log(`bound: slot ${out.slotId} now opens the vessel key (${out.tree.slots.length} slot(s) stand).`),
  });
  return 0;
}

async function vaultUnbind(args: ParsedArgs): Promise<number> {
  const slotId = args.positional[1];
  if (!slotId) throw new UsageError("unbind needs a slot id: `lares vault unbind <slot-id> [--rotate]` (ids print under `lares vault status`; --rotate takes no value and stands before or after the id)");
  const rotate = args.flags["rotate"] === true;
  const homes = custodyHomes();
  const io = new FsCustodyIo(homes);
  const creds = await gatherCredentials("lares vault unbind");
  const u = await openOrRefuse(args, "unbind", homes, io, creds);
  if (!u) return 1;

  // GATHER EVERY STAYING SLOT'S ROUTE BEFORE ANY BYTE MOVES: a rotation mints a new VK and each slot that stays must
  // be re-bound over it, so a typo found after the unbind would leave the tree on a VK nobody holds.
  const staying: SlotSpec[] = [];
  if (rotate) {
    const status = await custodyStatus({ io, homes });
    if (status.tree.reading !== "readable") throw new UsageError("the slot tree is not readable; nothing was changed");
    if (!status.tree.slots.some((sl) => sl.id === slotId)) throw new UsageError(`no slot ${slotId} stands in the tree`);
    // REFUSE THE ROTATION BEFORE THE UNBIND, never between them: the sealed writer re-seals only bytes the VK sealed,
    // so a hot or cold carrier still bare would refuse the rotation AFTER the slot was already removed.
    const bare = status.rows.filter((r) => (r.custody === "hot" || r.custody === "cold") && r.reading === "bare").map((r) => r.row);
    if (bare.length > 0) {
      throw new RotationPreflightRefusal(
        `--rotate re-seals every hot and cold carrier under a new vessel key, and ${bare.length} still read bare (${bare.join(", ")}): ` +
        "their writers have not moved under the VK. Nothing was changed; unbind without --rotate, or rotate once those carriers are sealed",
      );
    }
    const tree = decodeSlotTree(await io.read(`${homes.identity}/vk-slots.bin`));
    for (const sl of status.tree.slots.filter((x) => x.id !== slotId)) {
      const got = await gatherStayingSlot(sl);
      const proof = tree.reading === "readable" ? openVk(tree.tree, got.credentials) : null;
      if (!proof || proof.reading !== "opens" || proof.slot !== sl.id) {
        throw new UsageError(`what was typed for slot ${sl.id} does not open it; nothing was changed`);
      }
      staying.push(got.spec);
    }
  }

  const out = await unbindCustodySlot({ io, homes, vk: u.vk, slotId });
  const say = (line: string): void => { if (!wantsJson(args)) console.log(line); };
  say(`unbound: slot ${slotId} no longer opens the vessel key (${out.tree.slots.length} slot(s) stand).`);
  say("");
  say("  ROTATION OFFER — " + out.rotationOffer);
  say("  " + RELATION_LINE);
  let rotated = false;
  if (rotate) {
    const r = await rotateCustody({ io, homes, oldVk: u.vk, slots: staying });
    rotated = true;
    say(`rotated: a new vessel key seals every carrier; ${r.tree.slots.length} slot(s) re-bound; the removed route opens nothing.`);
  } else {
    say("  not rotated. A copy of the tree taken before this unbind still opens the key through the removed slot.");
    say("  to end that route now:  lares vault unbind <slot-id> --rotate   (re-reads each staying slot's route)");
  }
  emit(args, { ok: true, data: { slotId, rotated, rotationOffer: out.rotationOffer, slots: out.tree.slots.length }, human: () => undefined });
  return 0;
}
