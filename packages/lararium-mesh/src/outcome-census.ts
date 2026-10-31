/**
 * THE OUTCOME CENSUS (K20): no outcome the daemon document keeps pairs a requester with a key it must not rest beside.
 *
 * A face row (`STORE_DOOR_FACE_ROWS`) answers on the session's socket alone, so ANY outcome under one of those verbs
 * reads as a linkage: it says the row's answer rested in a document the face fleet syncs. Every other outcome reads as a
 * linkage when its bytes carry one of the keys the caller names (a face's per-Nexus leaf, its bond, a vouch's signer)
 * beside a requester: a top-level `requested-by` or session `face`, or anywhere in its body (a nested result, an error's
 * words) one of the identities the caller names (the face's atom, its proof subject). A key matches bare or `0x`, in
 * any case.
 *
 * It reads the document's records through the read door (`plainEntries`: `{ tiddler, meta }`, every wrapped Automerge
 * string unwrapped), tombstones included, and it counts what it read (`outcomes`), so a zero it reports stands beside
 * the records it read. A walk proves it on a planted positive, planted in the shape the document keeps, before it
 * trusts a clean result (the silent-zero law). It reads the current records alone: history it never reads.
 */
import { OUTCOME_URI_PREFIX } from "./verb-tiddler.js";
import { plainEntries, type StoredTiddlers } from "./stored-value.js";

export interface OutcomeLinkage {
  readonly title: string;
  readonly verb:  string;
  readonly why:   "socket-only-verb" | "requester-beside-key" | "identity-beside-key";
}

const bare = (key: string): string => key.trim().toLowerCase().replace(/^0x/, "");
const named = (v: unknown): boolean => typeof v === "string" && v.length > 0;

export function censusOutcomeLinkage(
  stored: StoredTiddlers | null | undefined,
  opts: { readonly socketOnly: ReadonlySet<string>; readonly keys: readonly string[]; readonly identities?: readonly string[] },
): { readonly outcomes: number; readonly linked: readonly OutcomeLinkage[] } {
  const keys = opts.keys.map(bare).filter((k) => k.length > 0);
  const identities = (opts.identities ?? []).map(bare).filter((k) => k.length > 0);
  const linked: OutcomeLinkage[] = [];
  let outcomes = 0;
  for (const [title, record] of plainEntries(stored)) {
    if (!title.startsWith(OUTCOME_URI_PREFIX)) continue;
    outcomes += 1;
    const fields = record.tiddler as Record<string, unknown>;
    const verb = typeof fields["verb"] === "string" ? fields["verb"] : "";
    if (opts.socketOnly.has(verb)) { linked.push({ title, verb, why: "socket-only-verb" }); continue; }
    const text = JSON.stringify(fields).toLowerCase();
    if (!keys.some((k) => text.includes(k))) continue;
    if (named(fields["requested-by"]) || named(fields["face"])) linked.push({ title, verb, why: "requester-beside-key" });
    else if (identities.some((id) => text.includes(id))) linked.push({ title, verb, why: "identity-beside-key" });
  }
  return { outcomes, linked };
}
