/**
 * THE OUTCOME CENSUS (K20): no outcome the daemon document keeps pairs a requester with a key it must not rest beside.
 *
 * A face row (`STORE_DOOR_FACE_ROWS`) answers on the session's socket alone, so ANY outcome under one of those verbs
 * reads as a linkage: it says the row's answer rested in a document the face fleet syncs. Every other outcome reads as
 * a linkage when it names a requester (`requested-by`, or a session's `face`) and its bytes carry one of the keys the
 * caller names (a face's per-Nexus leaf, its bond, a vouch's signer). A key matches in either spelling, bare or `0x`.
 *
 * It reads a document's records as they rest (`{ tiddler, meta }`, strings wrapped as Automerge hands them out) or
 * bare field maps. The census reads what it counted
 * (`outcomes`), so a zero it reports stands beside the records it read; a walk proves it on a planted positive, planted
 * in the shape the document keeps, before it trusts a clean result (the silent-zero law).
 */
import { OUTCOME_URI_PREFIX } from "./verb-tiddler.js";
import { plainValue } from "./stored-value.js";

export interface OutcomeLinkage {
  readonly title: string;
  readonly verb:  string;
  readonly why:   "socket-only-verb" | "requester-beside-key";
}

const bare = (key: string): string => key.trim().toLowerCase().replace(/^0x/, "");

export function censusOutcomeLinkage(
  tiddlers: Readonly<Record<string, unknown>>,
  opts: { readonly socketOnly: ReadonlySet<string>; readonly keys: readonly string[] },
): { readonly outcomes: number; readonly linked: readonly OutcomeLinkage[] } {
  const keys = opts.keys.map(bare).filter((k) => k.length > 0);
  const linked: OutcomeLinkage[] = [];
  let outcomes = 0;
  for (const [title, record] of Object.entries(tiddlers)) {
    if (!title.startsWith(OUTCOME_URI_PREFIX) || record === null || typeof record !== "object") continue;
    // A document keeps each record as `{ tiddler, meta }`, its strings as Automerge hands them out (an immutable scalar
    // carries its string in `val`); a bare field map reads as its own fields. Every value reads plain.
    const inner = (record as Record<string, unknown>)["tiddler"];
    const fields = plainValue(inner !== null && typeof inner === "object" ? inner : record) as Record<string, unknown>;
    outcomes += 1;
    const verb = typeof fields["verb"] === "string" ? fields["verb"] : "";
    if (opts.socketOnly.has(verb)) { linked.push({ title, verb, why: "socket-only-verb" }); continue; }
    const names = (v: unknown): boolean => typeof v === "string" && v.length > 0;
    if (!names(fields["requested-by"]) && !names(fields["face"])) continue;
    const text = JSON.stringify(fields).toLowerCase();
    if (keys.some((k) => text.includes(k))) linked.push({ title, verb, why: "requester-beside-key" });
  }
  return { outcomes, linked };
}
