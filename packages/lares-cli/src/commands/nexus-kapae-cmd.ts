/**
 * nexus-kapae-cmd — the KĀPAE antigen door: raise a quorum-signed ban on a presenter nym, mint a causal lift,
 * and fold the board that carries both.
 *
 * ── FAIL CLOSED, AND THE WRITER NEVER SEES A SUB-QUORUM HUNK ────────────────────────────────────
 * Every refusal here — an unseated charter, a sub-quorum signature set, a malformed nym — renders as a
 * clean error and writes NOTHING. The gate lives in the node door (`runNexusKapae`), not in this
 * surface, so a CLI that mis-parsed its arguments cannot talk its way past the quorum rule.
 *
 * A LIFT supersedes by causal fold rather than deletion: `un_kapae` extends the observed frontier and the
 * fold resolves the verified causal acts. Nothing is ever removed from the board, so the record of a ban
 * survives its own lifting — which is the point of keeping an antigen rather than a blocklist.
 *
 * ── WHY `-cmd` IN THE NAME ──────────────────────────────────────────────────────────────────────
 * `@lararium/node` already carries a `commands/nexus-kapae.ts`, and THIS file imports from it
 * (`runNexusKapae`, `runNexusKapaeList`, `NexusKapaeError`). Two same-basename modules with a live
 * import between them is a reader trap, so this takes the `-cmd` suffix the house already uses where a
 * child holds command handlers (`bag-declare-cmd.ts`, `persona-admit-cmd.ts`).
 *
 * ONE STORE DOOR. While the vessel stands, the act runs inside it (`nexus-kapae` over the local socket), so a ban
 * lands on the replica the running gate folds; with no vessel standing, it runs here, holding the store for the
 * moment of the act (`store-door`).
 *
 * This door holds no reference back into `nexus.ts`; the dependency runs one way, parent to child.
 */
import { readFileSync } from "node:fs";
import { NexusKapaeError, type NexusKapaeResult, type NexusKapaeListResult, type NexusKapaePartialResult } from "@lararium/node";
import { storeVerb, storeFailure } from "../store-door.js";
import { emit, exitFor } from "../render.js";
import { partialOutOrRefuse, writePartialFile, type PartialWritten } from "./partial-file.js";
import type { ParsedArgs } from "../parse-args.js";

const KAPAE_USAGE = "usage: lares nexus kapae <nym> [--reason <text>] [--nexus <aid>]   |   lares nexus kapae --list [--nexus <aid>]";
const PARTIAL_USAGE = "usage: lares nexus <kapae | un_kapae> <nym> [--nexus <aid>] --out <partial>   |   lares nexus <kapae | un_kapae> --from <partial> [--out <file>]";
const refuseKapae = (msg: string): Error => new NexusKapaeError(msg);

/**
 * `lares nexus kapae <nym> [--reason]` raises a quorum-signed ban; `lares nexus kapae --list` folds the
 * current Kapae'd set. FAIL CLOSED: a REFUSAL (unseated charter, sub-quorum, malformed nym) renders as a
 * clean error and writes nothing — main gates every hunk, so the writer never lands a sub-quorum entry.
 */
export async function cmdKapae(args: ParsedArgs): Promise<number> {
  if (args.flags["list"]) return await kapaeList(args);
  if (args.options["from"] !== undefined) return await kapaePartial(args, "kapae");
  const nym = args.positional[1];
  if (!nym) {
    console.error(args.options["out"] !== undefined ? PARTIAL_USAGE : KAPAE_USAGE);
    return 2;
  }
  if (args.options["out"] !== undefined) return await kapaeOpen(args, "kapae", nym);
  return await kapaeRaise(args, "kapae", nym);
}

export async function cmdUnKapae(args: ParsedArgs): Promise<number> {
  if (args.options["from"] !== undefined) return await kapaePartial(args, "un_kapae");
  const nym = args.positional[1];
  if (!nym) {
    console.error(args.options["out"] !== undefined ? PARTIAL_USAGE : "usage: lares nexus un_kapae <nym> [--nexus <aid>]");
    return 2;
  }
  if (args.options["out"] !== undefined) return await kapaeOpen(args, "un_kapae", nym);
  return await kapaeRaise(args, "un_kapae", nym);
}

async function kapaeRaise(args: ParsedArgs, action: "kapae" | "un_kapae", nym: string): Promise<number> {
  const reason = args.options["reason"];
  const aid = args.options["nexus"];
  try {
    const r = (await storeVerb("nexus-kapae", { action, nym, ...(reason ? { reason } : {}), ...(aid ? { aid } : {}) }, NexusKapaeError)).output as unknown as NexusKapaeResult;
    emit(args, {
      ok: true,
      data: {
        action: r.action, nym: r.nym, actCid: r.actCid, parents: r.parents,
        sealEpochCid: r.sealEpochCid, threshold: r.threshold, signers: r.signers,
        boardUrl: r.boardUrl, kapaedNow: r.kapaedNow,
      },
      human: () => {
        const verb = action === "kapae" ? "BANNED" : "LIFTED";
        console.log(`nexus ${action} → ${verb} ${nym.slice(0, 16)}… (act ${r.actCid.slice(0, 16)}…, ${r.parents.length} parent(s))`);
        console.log(`  signed by:  ${r.signers.length} of ${r.threshold} required founding-kahu roots`);
        for (const s of r.signers) console.log(`    ${s.slice(0, 16)}…`);
        console.log(`  epoch:      ${r.sealEpochCid}`);
        console.log(`  board:      ${r.boardUrl}`);
        console.log(`  enforced:   ${r.kapaedNow ? "Kapae'd (a presenter under this nym now draws Mu)" : "NOT Kapae'd (a standing lift or higher entry supersedes)"}`);
      },
    });
    return 0;
  } catch (err) {
    const msg  = err instanceof Error ? err.message : String(err);
    const failure = storeFailure(err, err instanceof NexusKapaeError ? "refused" : "error");
    emit(args, { ok: false, error: failure, human: () => console.error(`lares nexus ${action}: ${msg}`) });
    return exitFor(failure.code);
  }
}

/** Report one partial step: the verdict here, the seats signed, where the file landed, and the act once it lands. */
function emitKapaePartial(args: ParsedArgs, action: "kapae" | "un_kapae", step: string, r: NexusKapaePartialResult, written: PartialWritten | null): number {
  const path = written?.path ?? null;
  const l = r.landed;
  emit(args, {
    ok: true,
    data: { verdict: r.verdict, signed: r.signed, path, ...(written?.error ? { outError: written.error } : {}), partial: r.partial, landed: l },
    human: () => {
      console.log(`nexus ${step} → ${r.verdict.toUpperCase()} (${r.signed.length} seat(s) signed under ${r.partial.aid.slice(0, 22)}…)`);
      for (const s of r.signed) console.log(`    ${s.slice(0, 16)}…`);
      if (path) console.log(`  partial:     ${path}`);
      if (written?.error) console.error(`lares nexus ${step}: the act ran, and the partial file did not land (${written.error}); carry the partial below instead`);
      // No file holds the partial as it stands now: print it whole, so a landed or cosigned act never strands.
      if (!path) console.log(`  partial (carry this): ${JSON.stringify(r.partial)}`);
      if (l) {
        console.log(`  landed:      act ${l.actCid.slice(0, 16)}… on this vessel's board (${l.kapaedNow ? "nym stands Kapae'd" : "nym NOT Kapae'd (a standing lift or higher entry supersedes)"})`);
        console.log(`  next:        carry the partial back, so the other vault lands the same act (\`lares nexus ${action} --from <partial>\`)`);
      } else {
        console.log(`  next:        carry the partial to the vault that holds another seat (\`lares nexus ${action} --from <partial> --out <file>\`)`);
      }
    },
  });
  // A write that failed after the act ran answers non-zero, so automation that reads the status alone never drops the
  // partial; the JSON still carries the partial and the act.
  return written?.error ? 1 : 0;
}

/**
 * THE TWO-VAULT DOOR. `kapae|un_kapae <nym> [--nexus <aid>] --out <file>` signs with every seat of the head roster
 * this vessel holds and writes the act as a PARTIAL file; nothing lands. FAIL CLOSED: a vessel holding the whole
 * quorum, or no seat, opens none.
 */
async function kapaeOpen(args: ParsedArgs, action: "kapae" | "un_kapae", nym: string): Promise<number> {
  const out = args.options["out"]!;
  const aid = args.options["nexus"];
  try {
    partialOutOrRefuse(refuseKapae, out);
    const { output } = await storeVerb("nexus-kapae-open", { action, nym, ...(aid ? { aid } : {}) }, NexusKapaeError);
    const r = output as unknown as NexusKapaePartialResult;
    return emitKapaePartial(args, action, `${action} --out`, r, writePartialFile(out, r.partial));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const failure = storeFailure(err, err instanceof NexusKapaeError ? "refused" : "error");
    emit(args, { ok: false, error: failure, human: () => console.error(`lares nexus ${action} --out: ${msg}`) });
    return exitFor(failure.code);
  }
}

/**
 * `kapae --from <partial> [--out <file>]` takes a partial the other vault wrote. This vessel judges it against its
 * OWN charter head and antigen board before any signature: `ready` takes the signature of every seat this vessel
 * holds that has not signed, `complete` lands the act on this vessel's board, and any other verdict refuses by name
 * with nothing signed or landed. `--out` writes the grown partial for the other vault.
 */
async function kapaePartial(args: ParsedArgs, action: "kapae" | "un_kapae"): Promise<number> {
  const from = args.options["from"]!;
  const out = args.options["out"];
  try {
    if (out !== undefined) partialOutOrRefuse(refuseKapae, out, from);
    let partial: unknown;
    try { partial = JSON.parse(readFileSync(from, "utf8")); }
    catch { throw new NexusKapaeError(`cannot read ${from} as a partial file`); }
    const { output } = await storeVerb("nexus-kapae-partial", { partial, action }, NexusKapaeError);
    const r = output as unknown as NexusKapaePartialResult;
    return emitKapaePartial(args, action, `${action} --from`, r, out !== undefined ? writePartialFile(out, r.partial) : null);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const failure = storeFailure(err, err instanceof NexusKapaeError ? "refused" : "error");
    emit(args, { ok: false, error: failure, human: () => console.error(`lares nexus ${action} --from: ${msg}`) });
    return exitFor(failure.code);
  }
}

async function kapaeList(args: ParsedArgs): Promise<number> {
  try {
    // `via` says where the row ran: inside the standing vessel (`daemon`), or here, holding the store (`direct`).
    const { output, via } = await storeVerb("nexus-kapae-list", args.options["nexus"] ? { aid: args.options["nexus"] } : {}, NexusKapaeError);
    const r = output as unknown as NexusKapaeListResult;
    emit(args, {
      ok: true,
      data: {
        sealEpochCid: r.sealEpochCid || null, threshold: r.threshold,
        seatedKeys: r.seatedKeys, kapaed: r.kapaed, entries: r.entries, via,
      },
      human: () => {
        console.log(`nexus kapae — the antigen board fold:`);
        console.log(`  epoch:      ${r.sealEpochCid || "(unseated — the antigen stays inert)"}`);
        console.log(`  quorum:     ${r.threshold}-of-N · seated keys: ${r.seatedKeys}`);
        console.log(`  Kapae'd (${r.kapaed.length}):`);
        for (const n of r.kapaed) console.log(`    ${n}`);
        if (r.kapaed.length === 0) console.log(`    (none stand banned)`);
        console.log(`  board entries (${r.entries.length}):`);
        for (const e of r.entries) console.log(`    ${e.action.padEnd(8)} ${e.actCid.slice(0, 16)}…  ${e.nym.slice(0, 16)}…  (${e.parents.length} parent(s), ${e.signers} sig)`);
      },
    });
    return 0;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const failure = storeFailure(err);
    emit(args, { ok: false, error: failure, human: () => console.error(`lares nexus kapae --list: ${msg}`) });
    return exitFor(failure.code);
  }
}
