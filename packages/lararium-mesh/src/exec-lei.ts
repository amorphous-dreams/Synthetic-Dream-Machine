/**
 * exec-lei — the executable-record lei's spend (backlog-awakens "The executable-record lei"; state/decisions "Five floors walked"
 * (2)). Operator, 2026-11-18: "a use case for `lei` caps in the browser vessel as well as node (and all future vessels)".
 *
 * The human strings an `exec` lei (the swarm door's `lei-kui`, rite `exec`, signed by the face's hand) for a seat or a realm
 * member: N returns, scoped to one wiki and, within it, a title set or one class of the executable-class list
 * (`exec-lei-scope.ts`). Each executable land spends one return in whichever vessel boots it, the browser's or the node's,
 * through this one function: the spend names the record's title as its head and the record's content cid as its tree, so the
 * vessel's signed return row witnesses the very bytes it let run. A record outside the scope spends nothing; a record that reads
 * as data needs no lei at all. With no lei standing, the record offers (`seat-startup-offer`) or waits in the tab.
 *
 * Rides the lei grammar whole: the same rows (`lei/exec/<wiki branch>/<cid>`, `lei-returned/<cid>/<n>`, `lei-unstrung/<cid>`),
 * the same chain, the same unstring and restring. It never co-signs (the record runs on this device) and rests on no receipt.
 */
import { canonicalJsonBytes, sha256HexBytesSync } from "./crypto.js";
import { executableClassOf } from "./executable-class.js";
import { execLeiBranch, type ExecLeiScope } from "./exec-lei-scope.js";
import { SwarmRefused, returnLei, type SwarmLeiBody, type SwarmLeiReach, type SwarmSignerPort, type SwarmTrust, type SwarmWikiPort } from "./swarm-tiddlers.js";
import { WARD_GATE_DECIDED } from "./ward-door-decided.js";
import type { ExecLeiPort } from "./seat-startup-offer.js";

export { execLeiBranch, execLeiScopeRefusal, type ExecLeiScope } from "./exec-lei-scope.js";

/** The content cid a return names as its tree: every field of the record but its title (the title rides as the head). */
export function execRecordCid(fields: Readonly<Record<string, unknown>>): string {
  const { title: _title, ...rest } = fields as Record<string, unknown>;
  return sha256HexBytesSync(canonicalJsonBytes(rest));
}

/** The record an exec spend names: the wiki it lands in, its title and fields, and the writer where the spender knows one. */
export interface ExecLand {
  readonly wiki: string;
  readonly title: string;
  readonly fields: Readonly<Record<string, unknown>>;
  /** The writer the vessel read (the asking seat at a door). Where it reads one, the lei's scope must name that writer. */
  readonly writer?: string;
}

/** Why the standing lei's scope does not reach this record, or null where it does. */
export function execScopeRefusal(scope: ExecLeiScope | undefined, land: ExecLand, cls: string): SwarmRefused | null {
  if (scope === undefined || scope.wiki !== land.wiki) return new SwarmRefused("swarm-lei-out-of-scope", `the exec lei standing for this line reaches no wiki "${land.wiki}"`);
  if (land.writer !== undefined && scope.writer !== land.writer) return new SwarmRefused("swarm-lei-writer-mismatch", `the exec lei for "${land.wiki}" was strung for "${scope.writer}", not "${land.writer}"`);
  if (scope.titles !== undefined && !scope.titles.includes(land.title)) return new SwarmRefused("swarm-lei-out-of-scope", `the exec lei for "${land.wiki}" names no title "${land.title}"`);
  if (scope.class !== undefined && scope.class !== cls) return new SwarmRefused("swarm-lei-out-of-scope", `the exec lei for "${land.wiki}" reaches the ${scope.class} class, and "${land.title}" reads ${cls}`);
  return null;
}

/**
 * Spend one return of the exec lei standing for the record's wiki: the vessel alone spends (`spender` signs the return row), and
 * the spend claims a row atomically, so racing lands never pass the count. Answers the lei, its count `n` and the record's cid.
 */
export async function spendExecLei(wiki: SwarmWikiPort, land: ExecLand, trust: SwarmTrust, group: string, spender: SwarmSignerPort):
  Promise<{ lei: string; reach: SwarmLeiReach; n: number; tree: string }> {
  const cls = executableClassOf(land.fields);
  if (cls === null) throw new SwarmRefused("swarm-lei-not-executable", `"${land.title}" reads as data and lands with no lei`);
  const tree = execRecordCid(land.fields);
  const spent = await returnLei(wiki, { rite: "exec", branch: execLeiBranch(land.wiki), head: land.title, tree }, trust, group, spender, WARD_GATE_DECIDED,
    (lei: SwarmLeiBody) => execScopeRefusal(lei.scope, land, cls.class));
  return { ...spent, tree };
}

/**
 * THE TAB HALF'S RULE (#260's tab half; state/decisions "Five floors walked" (1) and (5)): which of a wiki's startup records a
 * vessel booting that wiki runs. In a wiki the wearing face alone writes (`own`), every startup record runs: no other writer
 * reaches it, and the seat wall let no AI seat land one there without spending a lei's return at the door. In a wiki another
 * writer reaches (a shared realm's), a startup record runs only where the vessel's port spends one return of a standing exec lei
 * the face strung for it; any other waits, and the vessel shows it as an offer (never failing silent). Both vessels, the browser's
 * and the node's, read this one function.
 */
export async function admitStartupRecords(records: readonly { readonly title: string; readonly fields: Readonly<Record<string, unknown>> }[],
  at: { readonly wiki: string; readonly own: boolean; readonly port?: ExecLeiPort | undefined }): Promise<{ admitted: Set<string>; offered: { title: string; reason: string }[] }> {
  const admitted = new Set<string>(), offered: { title: string; reason: string }[] = [];
  for (const record of records) {
    if (at.own) { admitted.add(record.title); continue; }
    if (!at.port) { offered.push({ title: record.title, reason: "no-exec-lei-port" }); continue; }
    try { await at.port.spend({ wiki: at.wiki, title: record.title, fields: record.fields }); admitted.add(record.title); }
    catch (error) { if (!(error instanceof SwarmRefused)) throw error; offered.push({ title: record.title, reason: error.code }); }
  }
  return { admitted, offered };
}
