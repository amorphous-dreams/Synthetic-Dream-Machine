/**
 * nexus-kapae-cmd — the KĀPAE antigen door: raise a quorum-signed ban on a presenter nym, lift it at a
 * higher version, and fold the board that carries both.
 *
 * ── FAIL CLOSED, AND THE WRITER NEVER SEES A SUB-QUORUM HUNK ────────────────────────────────────
 * Every refusal here — an unseated charter, a sub-quorum signature set, a malformed nym — renders as a
 * clean error and writes NOTHING. The gate lives in the node door (`runNexusKapae`), not in this
 * surface, so a CLI that mis-parsed its arguments cannot talk its way past the quorum rule.
 *
 * A LIFT SUPERSEDES BY VERSION rather than by deletion: `un_kapae` mints at a higher version and the
 * fold reads whichever entry stands highest. Nothing is ever removed from the board, so the record of
 * a ban survives its own lifting — which is the point of keeping an antigen rather than a blocklist.
 *
 * ── WHY `-cmd` IN THE NAME ──────────────────────────────────────────────────────────────────────
 * `@lararium/node` already carries a `commands/nexus-kapae.ts`, and THIS file imports from it
 * (`runNexusKapae`, `runNexusKapaeList`, `NexusKapaeError`). Two same-basename modules with a live
 * import between them is a reader trap, so this takes the `-cmd` suffix the house already uses where a
 * child holds command handlers (`bag-declare-cmd.ts`, `persona-admit-cmd.ts`).
 *
 * This door holds no reference back into `nexus.ts`; the dependency runs one way, parent to child.
 */
import { runNexusKapae, runNexusKapaeList, NexusKapaeError } from "@lararium/node";
import { larSealHome } from "../env.js";
import { emit, exitFor } from "../render.js";
import type { ParsedArgs } from "../parse-args.js";

/**
 * `lares nexus kapae <nym> [--reason]` raises a quorum-signed ban; `lares nexus kapae --list` folds the
 * current Kapae'd set. FAIL CLOSED: a REFUSAL (unseated charter, sub-quorum, malformed nym) renders as a
 * clean error and writes nothing — main gates every hunk, so the writer never lands a sub-quorum entry.
 */
export async function cmdKapae(args: ParsedArgs): Promise<number> {
  if (args.flags["list"]) return await kapaeList(args);
  const nym = args.positional[1];
  if (!nym) {
    console.error("usage: lares nexus kapae <nym> [--reason <text>]   |   lares nexus kapae --list");
    return 2;
  }
  return await kapaeRaise(args, "kapae", nym);
}

export async function cmdUnKapae(args: ParsedArgs): Promise<number> {
  const nym = args.positional[1];
  if (!nym) {
    console.error("usage: lares nexus un_kapae <nym>");
    return 2;
  }
  return await kapaeRaise(args, "un_kapae", nym);
}

async function kapaeRaise(args: ParsedArgs, action: "kapae" | "un_kapae", nym: string): Promise<number> {
  const reason = args.options["reason"];
  try {
    const r = await runNexusKapae({ action, nym, ...(reason ? { reason } : {}), sealHome: larSealHome() });
    emit(args, {
      ok: true,
      data: {
        action: r.action, nym: r.nym, version: r.version, priorVersion: r.priorVersion,
        sealEpochCid: r.sealEpochCid, threshold: r.threshold, signers: r.signers,
        boardUrl: r.boardUrl, kapaedNow: r.kapaedNow,
      },
      human: () => {
        const verb = action === "kapae" ? "BANNED" : "LIFTED";
        console.log(`nexus ${action} → ${verb} ${nym.slice(0, 16)}… (version ${r.version}${r.priorVersion !== null ? `, superseding ${r.priorVersion}` : ""})`);
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
    const code = err instanceof NexusKapaeError ? "refused" : "error";
    emit(args, { ok: false, error: { code, message: msg }, human: () => console.error(`lares nexus ${action}: ${msg}`) });
    return exitFor("error");
  }
}

async function kapaeList(args: ParsedArgs): Promise<number> {
  try {
    const r = await runNexusKapaeList({ sealHome: larSealHome() });
    emit(args, {
      ok: true,
      data: {
        sealEpochCid: r.sealEpochCid || null, threshold: r.threshold,
        seatedKeys: r.seatedKeys, kapaed: r.kapaed, entries: r.entries,
      },
      human: () => {
        console.log(`nexus kapae — the antigen board fold:`);
        console.log(`  epoch:      ${r.sealEpochCid || "(unseated — the antigen stays inert)"}`);
        console.log(`  quorum:     ${r.threshold}-of-N · seated keys: ${r.seatedKeys}`);
        console.log(`  Kapae'd (${r.kapaed.length}):`);
        for (const n of r.kapaed) console.log(`    ${n}`);
        if (r.kapaed.length === 0) console.log(`    (none stand banned)`);
        console.log(`  board entries (${r.entries.length}):`);
        for (const e of r.entries) console.log(`    ${e.action.padEnd(8)} v${e.version}  ${e.nym.slice(0, 16)}…  (${e.signers} sig)`);
      },
    });
    return 0;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emit(args, { ok: false, error: { code: "error", message: msg }, human: () => console.error(`lares nexus kapae --list: ${msg}`) });
    return exitFor("error");
  }
}
