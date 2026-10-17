/**
 * The journal-append door — a wiki island's projector hands the daemon's journal the bag it laid
 * (`docs/pono/mesh-goldens`). The daemon writes the vessel journal alone; a projector standing in another
 * island posts one `projection:bag-projected` event, the vessel routes it to the daemon as `journal-append`,
 * and the daemon admits it here.
 *
 * Admission reads two things the payload cannot claim alone: the invocation names the projector as its
 * requester under the projection listenable, and the mirror directory the entry names stands on disk holding a
 * carrier. An entry naming a directory that does not stand refuses by name, so a forged early `bag-projected`
 * can neither announce files that are absent nor take the bag's one entry ahead of the real one.
 */
import { readdirSync, statSync } from "node:fs";
import { LARES_VERB_ARGS_WIRE_FIELD } from "@lararium/mesh";

export const JOURNAL_APPEND_VERB = "journal-append";
export const JOURNAL_APPEND_REQUESTER = "disk-projector";
export const BAG_PROJECTED_LISTENABLE = "projection:bag-projected";

export interface BagProjected { readonly bagId: string; readonly path: string }

/** The event a projecting island posts once per bag it lays. */
export function bagProjectedEvent(wikiUri: string, info: BagProjected): {
  type: "event"; wikiUri: string; listenable: string; payload: Record<string, string>;
} {
  return {
    type: "event",
    wikiUri,
    listenable: BAG_PROJECTED_LISTENABLE,
    payload: {
      verb: JOURNAL_APPEND_VERB,
      requestedBy: JOURNAL_APPEND_REQUESTER,
      [LARES_VERB_ARGS_WIRE_FIELD]: JSON.stringify({ kind: "bag-projected", data: info }),
    },
  };
}

export interface JournalAppendInvocation {
  readonly requestedBy?: string | undefined;
  readonly listenable?: string | undefined;
}

export type JournalAppendVerdict =
  | { readonly ok: true; readonly append: { readonly kind: "bag-projected"; readonly data: BagProjected } }
  | { readonly ok: false; readonly refusal: string; readonly why: string };

/** A mirror directory stands when it is a directory holding at least one entry. */
export function mirrorStands(path: string): boolean {
  try {
    return statSync(path).isDirectory() && readdirSync(path).length > 0;
  } catch {
    return false;
  }
}

export function admitJournalAppend(
  invocation: JournalAppendInvocation,
  args: Readonly<Record<string, unknown>>,
  stands: (path: string) => boolean = mirrorStands,
): JournalAppendVerdict {
  if (invocation.requestedBy !== JOURNAL_APPEND_REQUESTER || invocation.listenable !== BAG_PROJECTED_LISTENABLE) {
    return { ok: false, refusal: "not-a-projector", why: "journal-append answers only a projector's bag-projected event" };
  }
  if (args["kind"] !== "bag-projected") {
    return { ok: false, refusal: "invalid-payload", why: "journal-append carries only bag-projected" };
  }
  const data = args["data"];
  const row = data && typeof data === "object" ? data as Record<string, unknown> : null;
  if (!row || typeof row["bagId"] !== "string" || row["bagId"].length === 0 || typeof row["path"] !== "string" || row["path"].length === 0) {
    return { ok: false, refusal: "invalid-payload", why: "bag-projected names a bagId and a path" };
  }
  const info: BagProjected = { bagId: row["bagId"], path: row["path"] };
  if (!stands(info.path)) {
    return { ok: false, refusal: "mirror-not-standing", why: `no carrier stands under ${info.path}` };
  }
  return { ok: true, append: { kind: "bag-projected", data: info } };
}
