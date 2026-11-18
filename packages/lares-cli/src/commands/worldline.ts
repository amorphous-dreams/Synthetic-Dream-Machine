/**
 * `lares sense worldline <handle|session>` — walk a session's SPIRIT TREE from the durable
 * worldline edge-DAG.
 *
 * Reads the mempalace knowledge graph READ-ONLY (`<palace>/knowledge_graph.sqlite3`,
 * `mode=ro` — never a write, never through the python shore): the `lares-worldline`
 * adapter rows worldline-kg.ts projects — `prov:Delegation` (spawn → handback interval,
 * `source_drawer_id` = the spawn turn key) and `prov:Communication` (mid-flight inject).
 *
 * Sub-forms:
 *   lares sense worldline <run|handle>        the braid (tree, default) — spawn=fork ·
 *                                       handback=join · concurrent siblings marked ∥
 *   lares sense worldline tree <run>          the same, spelled
 *   lares sense worldline <run> --as-of <ts>  the braid AS-OF a valid-time frontier — a
 *                                       pure READ refinement (rows spawned after <ts>
 *                                       drop; an interval still open at <ts> reads OPEN).
 *                                       Mirrors the MCP `worldline(as_of)` arg.
 *   lares sense worldline enrich              fill the absent BEAT cell across every braid's
 *                                       lar_ffz membership stamps (same-turn drawers then
 *                                       share a beat cell — ultrametrically adjacent).
 *                                       Idempotent; reversible × trusted on the verb-grid.
 *                                       Runs the ONE shared core (@lararium/mempalace
 *                                       runFfzEnrich) the post-harvest pass also calls.
 *   lares sense worldline kapae <branch>      mute a worldline branch (move-not-delete). The
 *   lares sense worldline un-kapae <branch>   restore it. Both refuse honestly: the branch-mute is a
 *                                       WRITE with no home in this read-only KG handle, and must not
 *                                       ride harvest's kapaeTurn path.
 *   lares sense worldline diff <A> <B>        NOT AVAILABLE — an honest gap (below)
 *
 * The ∥ mark reads the KG rows' recorded intervals, a display reading: a sibling reads
 * SEQUENTIAL only when the previous sibling's recorded close stands strictly before its
 * recorded open, and ∥ otherwise. The mesh replay (`replayWorldlineEdges`) orders events by
 * causal links alone and never by these times; the KG rows carry no parent links, so this
 * tree reads the intervals the rows hold. (Comparing two PAST frontiers by their ITC stamps
 * is exactly the persisted-stamp gap `diff` refuses on — see below.)
 *
 * THE DIFF GAP (reported, not faked): ITC STAMPS ARE NOT QUERYABLY PERSISTED — the stamp
 * values live only in the in-memory registry (mesh/worldline-clock; the daemon's
 * worldline-compare re-derives them per call from a transcript). The KG persists the
 * EDGE-DAG the stamps re-project from, so `tree` stands on durable ground, but a
 * frontier-vs-frontier `diff <A> <B>` over two PAST stamps needs a persisted ITC
 * read-path (stamp serialization at capture). Until that lands, `diff` refuses honestly
 * rather than inventing causality from timestamps.
 *
 * One surface, two actors: prose on a TTY, deterministic JSON under --json (../render.ts).
 *
 * Meme: lar:///ha.ka.ba/lararium/api/agent-worldline#/attribution
 */

import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { PRED_DELEGATION, PRED_COMMUNICATION } from "@lararium/mesh";
import { resolvePalacePath } from "@lararium/mempalace";
import { runFfzEnrich, FfzEnrichUnavailable } from "@lararium/sensorium";
import { emit, exitFor } from "../render.js";
import type { ParsedArgs } from "../parse-args.js";

// ── the pure core (exported for tests) ────────────────────────────────────────────────────────────

/** One `lares-worldline` KG row (triples table, adapter_name='lares-worldline'). */
export interface WorldlineKgRow {
  readonly subject: string;
  readonly predicate: string;
  readonly object: string;
  readonly valid_from: string | null;
  readonly valid_to: string | null;
  /** source_drawer_id — the spawn turn key (kg_io.py's provenance slot). */
  readonly turn_key: string | null;
}

/** One node of the braid — a worldline (the run-root or a spirit). */
export interface WorldlineNode {
  readonly handle: string;
  /** The spirit's agent id (`handle.split(".")[1]`), or null at the run-root. */
  readonly agentId: string | null;
  readonly parent: string | null;
  readonly spawn: string | null;
  /** The handback close (valid_to), or null while the interval stands OPEN. */
  readonly handback: string | null;
  readonly turnKey: string | null;
  readonly open: boolean;
  /** Edge-DAG replay verdict vs the sibling before it — the ∥ mark (see module doc). */
  readonly concurrentWithPreviousSibling: boolean;
  /** prov:Communication edges landing on this worldline (mid-flight injects). */
  readonly injects: number;
  readonly children: WorldlineNode[];
}

export interface WorldlineTree {
  readonly run: string;
  readonly root: WorldlineNode;
  readonly spirits: number;
  readonly openSpirits: number;
}

/** Normalize a stored predicate to the mesh constant (kg_io lowercases on write). */
function normPredicate(p: string): string {
  const low = p.toLowerCase();
  if (low === PRED_DELEGATION.toLowerCase()) return PRED_DELEGATION;
  if (low === PRED_COMMUNICATION.toLowerCase()) return PRED_COMMUNICATION;
  return p;
}

/**
 * Build the braid from the KG rows — PURE (no I/O).
 * `run` = the run-root handle (a session id, possibly `run~frontier`).
 */
export function buildWorldlineTree(
  run: string,
  rows: readonly WorldlineKgRow[],
): WorldlineTree {

  // The ∥ mark — a display reading of the rows' recorded intervals: the previous sibling
  // reads sequential ONLY when its recorded close stands strictly before the next one's
  // recorded open; an open interval or a same-instant close leaves the pair ∥.
  const sequentialAfter = (prev: WorldlineKgRow, cur: WorldlineKgRow): boolean =>
    prev.valid_to !== null && cur.valid_from !== null && prev.valid_to < cur.valid_from;

  // Delegation rows → child nodes, grouped under their spawning subject.
  const injectCounts = new Map<string, number>();
  for (const r of rows) {
    if (normPredicate(r.predicate) !== PRED_COMMUNICATION) continue;
    injectCounts.set(r.object, (injectCounts.get(r.object) ?? 0) + 1);
  }
  const byParent = new Map<string, WorldlineKgRow[]>();
  for (const r of rows) {
    if (normPredicate(r.predicate) !== PRED_DELEGATION) continue;
    const kids = byParent.get(r.subject) ?? [];
    kids.push(r);
    byParent.set(r.subject, kids);
  }

  let spirits = 0;
  let openSpirits = 0;
  const build = (handle: string, parent: string | null, row: WorldlineKgRow | null): WorldlineNode => {
    const agentId = handle.includes(".") ? (handle.split(".")[1] ?? null) : null;
    const kidRows = [...(byParent.get(handle) ?? [])].sort(
      (a, b) => ((a.valid_from ?? "") < (b.valid_from ?? "") ? -1 : (a.valid_from ?? "") > (b.valid_from ?? "") ? 1 : a.object < b.object ? -1 : 1),
    );
    const children: WorldlineNode[] = [];
    let prev: WorldlineKgRow | null = null;
    for (const kr of kidRows) {
      spirits += 1;
      if (kr.valid_to === null) openSpirits += 1;
      const child = build(kr.object, handle, kr);
      children.push({
        ...child,
        concurrentWithPreviousSibling: prev !== null && !sequentialAfter(prev, kr),
      });
      prev = kr;
    }
    return {
      handle,
      agentId,
      parent,
      spawn: row?.valid_from ?? null,
      handback: row?.valid_to ?? null,
      turnKey: row?.turn_key ?? null,
      open: row !== null && row.valid_to === null,
      concurrentWithPreviousSibling: false,
      injects: injectCounts.get(handle) ?? 0,
      children,
    };
  };

  const root = build(run, null, null);
  return { run, root, spirits, openSpirits };
}

/**
 * Reconstruct the AS-OF frontier — PURE, read-only. Drops rows whose spawn (`valid_from`) lands
 * strictly after `asOf`; for a surviving row whose close (`valid_to`) also lands after `asOf`, clamps
 * the close to null so the interval reads OPEN as-of that frontier. A null `valid_from` (untimed edge)
 * survives untouched — the filter hides no edge it cannot place in time. `asOf` undefined → identity.
 */
export function filterRowsAsOf(rows: readonly WorldlineKgRow[], asOf: string | undefined): WorldlineKgRow[] {
  if (asOf === undefined || asOf === "") return [...rows];
  const out: WorldlineKgRow[] = [];
  for (const r of rows) {
    if (r.valid_from !== null && r.valid_from > asOf) continue;               // spawned after the frontier — unborn as-of
    out.push(r.valid_to !== null && r.valid_to > asOf ? { ...r, valid_to: null } : r);  // closed after — reads OPEN as-of
  }
  return out;
}

// ── the IO legs (read-only, honest on absence) ────────────────────────────────────────────────────

/** Read the run's `lares-worldline` rows from the KG sqlite, READ-ONLY (`mode=ro` semantics).
 *  Prefix-tolerant: `runArg` may be a session-id prefix; returns the DISTINCT runs it matched so
 *  the caller can disambiguate honestly. */
export function readWorldlineRows(
  kgPath: string,
  runArg: string,
): { rows: WorldlineKgRow[]; runs: string[] } {
  const db = new DatabaseSync(kgPath, { readOnly: true });
  try {
    const prefix = runArg.toLowerCase();
    const stmt = db.prepare(
      `SELECT subject, predicate, object, valid_from, valid_to, source_drawer_id AS turn_key
         FROM triples
        WHERE adapter_name = 'lares-worldline'
          AND (subject LIKE ? || '%' OR object LIKE ? || '%')
        ORDER BY valid_from, subject, object`,
    );
    const rows = stmt.all(prefix, prefix) as unknown as WorldlineKgRow[];
    // The distinct run-roots among the matched delegation subjects (a subject with no `.` = a root).
    const runs = [...new Set(rows.filter((r) => !r.subject.includes(".")).map((r) => r.subject))].sort();
    return { rows, runs };
  } finally {
    db.close();
  }
}

// ── render ────────────────────────────────────────────────────────────────────────────────────────

function shortTs(ts: string | null): string {
  if (!ts) return "…";
  const m = /T(\d{2}:\d{2}:\d{2})/.exec(ts);
  return m ? (m[1] as string) : ts;
}

function renderNode(n: WorldlineNode, indent: string, isLast: boolean, lines: string[]): void {
  const tee = isLast ? "└─" : "├─";
  const par = n.concurrentWithPreviousSibling ? "∥ " : "";
  const span = `${shortTs(n.spawn)} → ${n.open ? "OPEN" : shortTs(n.handback)}`;
  const inj = n.injects > 0 ? ` · injects ${n.injects}` : "";
  const key = n.turnKey ? ` · turnKey ${n.turnKey.slice(0, 8)}` : "";
  lines.push(`${indent}${tee} ${par}${n.agentId ?? n.handle}  ${span}${inj}${key}`);
  n.children.forEach((c, i) => renderNode(c, indent + (isLast ? "   " : "│  "), i === n.children.length - 1, lines));
}

export function renderWorldlineTree(t: WorldlineTree): string {
  const lines: string[] = [];
  const r = t.root;
  lines.push(`worldline ${t.run} — ${t.spirits} spirit${t.spirits === 1 ? "" : "s"} (${t.openSpirits} open)`);
  lines.push(`● ${r.handle}`);
  r.children.forEach((c, i) => renderNode(c, "", i === r.children.length - 1, lines));
  return lines.join("\n");
}

// ── the command ───────────────────────────────────────────────────────────────────────────────────

const DIFF_GAP =
  "worldline diff is not available: ITC stamps are not queryably persisted — the stamp values live " +
  "only in the in-memory registry (mesh/worldline-clock), re-derived per call. The KG persists the " +
  "edge-DAG (which `tree` re-projects), but a stamp-vs-stamp diff over two PAST frontiers needs a " +
  "persisted ITC read-path (stamp serialization at capture). Refusing honestly rather than inventing " +
  "causality from timestamps.";

// kapae / un-kapae refuse honestly. The verb mirrors the MCP `kapae`/`un_kapae` tools, but the mute
// is a WRITE (move-not-delete) and this command reads the KG mode=ro — the write MUST NOT ride this
// read-only handle, nor harvest's TS `kapaeTurn` path (which would couple kapae to a capture leg).
// The landing target — py `cascade_kapae` via worldline_io, or a writable TS KG handle — stays an
// open fork, surfaced not resolved.
const KAPAE_REFUSAL =
  "worldline kapae refuses honestly. The verb reads mode=ro, so the branch-mute (a write) cannot land " +
  "here, and it must not ride harvest's kapaeTurn path. Write-home fork (open): py cascade_kapae via " +
  "worldline_io, OR a writable TS KG handle.";

/** Refuse a kapae / un-kapae call honestly: a read-only KG handle cannot land the branch-mute write. */
function kapaeStub(args: ParsedArgs, verb: "kapae" | "un-kapae", branch: string): number {
  if (!branch) {
    console.error(`usage: lares sense worldline ${verb} <branch> [--tick <n>]  (refuses honestly — see below)`);
    return 2;
  }
  emit(args, {
    ok: false,
    error: { code: "verb-error", message: `worldline ${verb}: ${KAPAE_REFUSAL}`, hint: "the mute needs a writable KG handle; this read-only path cannot land it." },
    human: () => { console.error(`lares sense worldline ${verb} ${branch}: ${KAPAE_REFUSAL}`); },
  });
  return exitFor("verb-error");
}

export async function cmdWorldline(args: ParsedArgs): Promise<number> {
  const pos = [...args.positional];
  const SUBVERBS = new Set(["tree", "diff", "kapae", "un-kapae", "enrich"]);
  const sub = pos[0] !== undefined && SUBVERBS.has(pos[0]) ? (pos.shift() as string) : "tree";

  // kapae / un-kapae refuse honestly — a read-only KG handle cannot land the branch-mute write.
  if (sub === "kapae" || sub === "un-kapae") {
    return kapaeStub(args, sub, (pos[0] ?? "").trim());
  }

  // enrich — fill the absent BEAT cell across every braid's lar_ffz membership stamps
  // (same-turn drawers then share a beat cell, ultrametrically adjacent). Idempotent:
  // reversible × trusted on the verb-grid — only `_` cells fill, a re-run no-ops.
  if (sub === "enrich") {
    try {
      const report = runFfzEnrich(args.options["palace"]);
      emit(args, {
        ok: true,
        data: { mode: "enrich", ...report },
        human: () => {
          console.log("lares sense worldline enrich");
          console.log(`  braids: ${report.braids}  turns: ${report.turns}  stamps: ${report.stamped}`);
          console.log(`  rhythm testimony: locked ${report.locked} · holdover ${report.holdover} · phase-spread ${report.phase_spread.toFixed(4)}`);
        },
      });
      return 0;
    } catch (err) {
      const message = err instanceof FfzEnrichUnavailable ? err.message
        : `enrich failed: ${err instanceof Error ? err.message : String(err)}`;
      emit(args, {
        ok: false,
        error: { code: "verb-error", message, hint: "capture builds the fork-DAG the enrichment walks — feed transcripts first." },
        human: () => console.error(`lares sense worldline enrich: ${message}`),
      });
      return exitFor("verb-error");
    }
  }

  if (sub === "diff") {
    emit(args, {
      ok: false,
      error: { code: "verb-error", message: DIFF_GAP, hint: "Use `lares sense worldline <run>` — the tree re-projects the causal braid from the persisted edge-DAG." },
      human: () => { console.error(`lares sense worldline diff: ${DIFF_GAP}`); },
    });
    return exitFor("verb-error");
  }

  const target = (pos[0] ?? "").trim();
  if (!target) {
    console.error("usage: lares sense worldline <handle|session-id[-prefix]> [--palace <dir>] [--as-of <ts>] | lares sense worldline enrich [--palace <content-dir>] | lares sense worldline kapae <branch> | lares sense worldline diff <A> <B>");
    return 2;
  }
  // A worldline handle (`<run>.<agentId>`) walks its whole run; a run/session id walks itself.
  const runArg = (target.split(".")[0] ?? target).toLowerCase();

  const palace = args.options["palace"] ?? resolvePalacePath();
  const kgPath = join(palace, "knowledge_graph.sqlite3");
  if (!existsSync(kgPath)) {
    const msg = `no knowledge graph at ${kgPath}`;
    emit(args, {
      ok: false,
      error: { code: "not-found", message: msg, hint: "Worldline edges project when a session's spirits are observed — run `lares sense subagents <transcript>` first." },
      human: () => { console.error(`lares sense worldline: ${msg}`); console.error("  Worldline edges project when a session's spirits are observed — run `lares sense subagents <transcript>` first."); },
    });
    return exitFor("not-found");
  }

  let rows: WorldlineKgRow[];
  let runs: string[];
  try {
    ({ rows, runs } = readWorldlineRows(kgPath, runArg));
  } catch (err) {
    const msg = `knowledge graph read failed: ${err instanceof Error ? err.message : String(err)}`;
    emit(args, {
      ok: false,
      error: { code: "conflict", message: msg, hint: "The palace may be mid-repave — retry when the harvest settles." },
      human: () => console.error(`lares sense worldline: ${msg}`),
    });
    return exitFor("conflict");
  }

  if (rows.length === 0) {
    const msg = `no worldline edges match "${runArg}" (adapter lares-worldline)`;
    emit(args, {
      ok: false,
      error: { code: "not-found", message: msg, hint: "Edges land when a session's spirits are observed — `lares sense subagents <transcript>`." },
      human: () => console.error(`lares sense worldline: ${msg}`),
    });
    return exitFor("not-found");
  }
  if (runs.length > 1) {
    emit(args, {
      ok: false,
      error: { code: "usage", message: `prefix "${runArg}" matches ${runs.length} runs`, hint: `Disambiguate: ${runs.slice(0, 6).join(" · ")}` },
      human: () => {
        console.error(`lares sense worldline: prefix "${runArg}" matches ${runs.length} runs:`);
        for (const r of runs.slice(0, 12)) console.error(`  ${r}`);
      },
    });
    return exitFor("usage");
  }

  const run = runs[0] ?? runArg;
  // --as-of: a pure read-only frontier reconstruction (default undefined = the whole braid, unchanged).
  const asOf = args.options["as-of"];
  const framedRows = filterRowsAsOf(rows, asOf);
  const tree = buildWorldlineTree(run, framedRows);

  emit(args, {
    ok: true,
    data: {
      run: tree.run,
      spirits: tree.spirits,
      openSpirits: tree.openSpirits,
      ...(asOf !== undefined ? { asOf } : {}),
      tree: tree.root as unknown as Record<string, unknown>,
      diff: { available: false, reason: DIFF_GAP },
    },
    human: () => console.log(renderWorldlineTree(tree)),
  });
  return 0;
}
