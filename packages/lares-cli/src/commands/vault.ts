/**
 * `lares vault {status,unlock,lock,bind,unbind,backup,restore}` — the vessel key custody door.
 *
 * The vessel key seals the vessel's private rows. `unlock` and `lock` open and drop it on the standing vessel;
 * `bind` and `unbind` change the human routes that open it, and an unbind that rotates moves the key itself in one
 * act; `status` gives one reading of every standing file the carrier table names, and names every private file it
 * does not; `backup` and `restore` carry one face off the vessel and back.
 *
 * A CREDENTIAL RIDES A TTY ALONE (`custody-prompt`): no flag, no environment variable and no pipe carries one, and
 * nothing here echoes one. It drops the instant the act returns.
 */

import {
  FsCustodyIo, unlockCustody, bindCustodySlot, unbindCustodySlot, custodyStatus,
  type CustodyHomes, type CustodyStatus, type CustodyStatusRow,
} from "@lararium/node";
import { openVk, decodeSlotTree, type Credential, type SlotSpec } from "@lararium/mesh";
import { larIdentityDir, larDataDir, larSealHome } from "../env.js";
import { gatherBundleRoute, gatherCards, gatherCredentials, gatherNewSlot, gatherStayingSlot } from "../custody-prompt.js";
import { backupLines, cutBundleToFile } from "../vault-backup.js";
import { importLines, restoreFromBundle, restoreFromCards, restoreLines } from "../vault-restore.js";
import { sealedActVia } from "../sealed-act-door.js";
import { udsAlive } from "../local-connector.js";
import { sendCustodyFrame, type CustodyDoorAnswer } from "../custody-door.js";
import { emit, exitFor, refuseUsage, wantsJson } from "../render.js";
import { helpLines } from "../command-help.js";
import type { ParsedArgs } from "../parse-args.js";

function usage(args: ParsedArgs, typed?: string): number {
  return refuseUsage(args, "vault", helpLines("vault"), typed ? `unknown sub-verb "${typed}"` : undefined);
}

class UsageError extends Error {}

/** The refusals the custody door names: each leads its error line, so a caller reads the class, not a guess. */
const NAMED_REFUSALS: ReadonlySet<string> = new Set([
  "OldShapeRefusal", "CustodyRefusal", "TreeVkRefusal", "CensusRefusal",
  "CustodyLockRefused", "CustodyFoundingRefused", "CredentialTtyRefusal", "RotationSlotsRefused",
]);

function custodyHomes(): CustodyHomes {
  return { identity: larIdentityDir(), storage: larDataDir(), seal: larSealHome() };
}

/** The sentence `vault status` prints beside the relation rows, and `vault unbind` beside its rotation offer. */
const RELATION_LINE =
  "rotation never repairs the loss of a relation carrier: a relation secret derives from no house key, so only the " +
  "other party can re-issue it. Back the carrier itself up.";

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
  const homes = custodyHomes();
  const custody = await custodyStatus({ io: new FsCustodyIo(homes), homes });
  // What the STANDING vessel holds, read off its custody door: a read, it opens nothing.
  const door = daemonUp ? await sendCustodyFrame({ op: "custody" }) : null;
  emit(args, {
    ok: true,
    data: { custody, door },
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
    },
  });
  return 0;
}

/** How many files one row and reading may print by name before the section folds them into one counted line. */
const ROW_FOLD = 4;

/** One standing file's line: the row, where it rests, its custody class, its key class, its ONE reading, and why. */
function rowLine(r: CustodyStatusRow): string {
  const why = r.fault
    ? r.bare === null
      ? `  FAULT — the vessel key governs this row and no seal of it stands (it reads ${r.reading})`
      : r.reading === "bare"
        ? "  FAULT — this file took the row's spelling and fails the name its own bytes derive"
        : `  FAULT — this row rests outside the vessel key, and the file reads ${r.reading}: no rotation re-seals it`
    : r.bare !== null ? `  by law: ${r.bare}` : "";
  return `    ${r.name.padEnd(30)} ${r.home.padEnd(9)} ${r.custody.padEnd(11)} ${String(r.keyClass ?? "-").padEnd(14)} ${r.reading.padEnd(10)} ${r.file}${why}`;
}

/**
 * The "custody (VK)" section: the slot tree, then ONE reading of every standing file the carrier table names, then
 * every private file it does not name. A row outside the vessel key prints the law it rests bare under; a hot or
 * cold row that reads anything but `sealed` prints as a fault.
 */
function printCustody(c: CustodyStatus): void {
  console.log("custody (VK):");
  if (c.tree.reading === "absent") console.log("  slot tree      absent — no vk-slots.bin stands (a founding seals custody from birth)");
  else if (c.tree.reading === "unreadable") console.log(`  slot tree      UNREADABLE — ${c.tree.why}`);
  else {
    console.log(`  slot tree      ${c.tree.slots.length} slot(s)`);
    for (const sl of c.tree.slots) console.log(`    ${sl.id}  t=${sl.t}  ${sl.pins.join(" + ")}`);
  }
  const sealed = c.rows.filter((r) => r.reading === "sealed" && !r.fault).length;
  const byLaw = c.rows.filter((r) => r.bare !== null && !r.fault).length;
  const faults = c.rows.filter((r) => r.fault);
  console.log(c.rows.length === 0
    ? "  carriers       none standing"
    : `  carriers       ${c.rows.length} standing: ${sealed} sealed under the vessel key, ${byLaw} outside it by law, ${faults.length} at fault`);
  // A row that names many files (a spend per burn, a rest file per record) folds into one counted line per reading.
  const groups = new Map<string, CustodyStatusRow[]>();
  for (const r of c.rows) {
    const key = `${r.row}\u0000${r.reading}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  for (const rows of groups.values()) {
    if (rows.length <= ROW_FOLD || rows[0]!.fault) { for (const r of rows) console.log(rowLine(r)); continue; }
    const r = rows[0]!;
    console.log(`    ${`${r.row} ×${rows.length}`.padEnd(30)} ${r.home.padEnd(9)} ${r.custody.padEnd(11)} ${String(r.keyClass ?? "-").padEnd(14)} ${r.reading.padEnd(10)}${r.bare !== null ? `   by law: ${r.bare}` : ""}`);
  }
  if (c.outside.length === 0) console.log("  outside the table  nothing: every private file in the three homes answers to a row");
  for (const o of c.outside) console.log(`  OUTSIDE THE TABLE  ${o.home}/${o.file} (${o.why}): no row names this file, so no rotation re-seals it and no bundle weighs it`);
  const relation = c.rows.filter((r) => r.keyClass === "relation");
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
    : u.reading === "serving-unopenable" ? `the vessel key opened and the serving key did not (${u.why}) — nothing stays held; a vessel whose serving tree stands torn or apart from its key re-founds`
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
    case "serving-unopenable": return `the vessel key opened and the serving key did not (${String(a["why"])}) — nothing stays held; a vessel whose serving tree stands torn or apart from its key re-founds.`;
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
  if (args.flags["cards"] === true) return vaultRestoreCards(args);
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

/**
 * `vault restore --cards --face <key|prefix> --as <N>`: rebuild a face's root from its split cards. The command reads
 * each card on a terminal, builds the face's body in its own process and hands it, sealed under a fresh key, to the
 * same act a bundle rides. Paper restores a root, never memory: a bundle carries the memory (`--memory`).
 */
async function vaultRestoreCards(args: ParsedArgs): Promise<number> {
  if (args.positional[1] !== undefined || args.flags["memory"] === true) throw new UsageError("--cards reads the cards on a terminal and takes no bundle file and no --memory: paper restores a root, never memory");
  const asRaw = args.options["as"];
  if (asRaw === undefined || !/^(0|[1-9]\d*)$/.test(asRaw) || !Number.isSafeInteger(Number(asRaw))) throw new UsageError("--cards needs the free handle-index the face lands at: `lares vault restore --cards --face <key|prefix> --as <N>`");
  const named = typeof args.options["face"] === "string" ? args.options["face"].trim() : "";
  if (named.length === 0) throw new UsageError("--cards needs the face the cards should rebuild, by its root's public key or its prefix: `--face <key|persona-…>`");
  const face = named.startsWith("persona-") ? { prefix: named } : { verifyingKey: named };
  if (!wantsJson(args)) console.log("The split's cards: for each, the custodian it came from, then its code (hidden).");
  const cards = await gatherCards("lares vault restore --cards");
  const result = await restoreFromCards({ cards, face, as: Number(asRaw), run: (act, actArgs) => sealedActVia(act, actArgs) });
  if (!result.ok) {
    emit(args, { ok: false, error: { code: result.reason, message: result.message }, data: { reason: result.reason }, human: () => console.error(`lares vault restore --cards: ${result.reason}: ${result.message}`) });
    return 1;
  }
  emit(args, { ok: true, data: { ...result }, human: () => { for (const line of restoreLines(result)) console.log(line); } });
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

  // GATHER EVERY STAYING SLOT'S ROUTE BEFORE ANY BYTE MOVES: a rotation mints a new VK and binds each slot that stays
  // over it, so a typo found after a write would leave the tree on a VK nobody holds.
  let staying: SlotSpec[] | undefined;
  if (rotate) {
    const status = await custodyStatus({ io, homes });
    if (status.tree.reading !== "readable") throw new UsageError("the slot tree is not readable; nothing was changed");
    if (!status.tree.slots.some((sl) => sl.id === slotId)) throw new UsageError(`no slot ${slotId} stands in the tree`);
    const tree = decodeSlotTree(await io.read(`${homes.identity}/vk-slots.bin`));
    staying = [];
    for (const sl of status.tree.slots.filter((x) => x.id !== slotId)) {
      const got = await gatherStayingSlot(sl);
      const proof = tree.reading === "readable" ? openVk(tree.tree, got.credentials) : null;
      if (!proof || proof.reading !== "opens" || proof.slot !== sl.id) {
        throw new UsageError(`what was typed for slot ${sl.id} does not open it; nothing was changed`);
      }
      staying.push(got.spec);
    }
  }

  // ONE ACT. With --rotate the removal and the rotation land together: the rotation's census and its opening of
  // every carrier run before any byte moves, so a carrier that refuses the rotation leaves the slot bound.
  const out = await unbindCustodySlot({ io, homes, vk: u.vk, slotId, ...(staying ? { rotate: staying } : {}) });
  const say = (line: string): void => { if (!wantsJson(args)) console.log(line); };
  say(`unbound: slot ${slotId} no longer opens the vessel key (${out.tree.slots.length} slot(s) stand).`);
  if (out.rotated) {
    say(`rotated: a new vessel key seals every carrier; ${out.tree.slots.length} slot(s) re-bound; the removed route opens nothing.`);
    say("  " + RELATION_LINE);
  } else {
    say("");
    say("  ROTATION OFFER — " + out.rotationOffer);
    say("  " + RELATION_LINE);
    say("  not rotated. A copy of the tree taken before this unbind still opens the key through the removed slot.");
    say("  to end that route now:  lares vault unbind <slot-id> --rotate   (re-reads each staying slot's route)");
  }
  emit(args, { ok: true, data: { slotId, rotated: out.rotated, rotationOffer: out.rotationOffer, slots: out.tree.slots.length }, human: () => undefined });
  return 0;
}
