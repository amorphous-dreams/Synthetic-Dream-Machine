/**
 * vessel-only-book — the vessel-only deny set as every vessel composes it: a growing set (`makeVesselOnlyDocs`) whose every
 * growth re-asks the vessel Repo's cached share verdicts (`shareConfigChanged`).
 *
 * automerge-repo resolves a document's ACCESS verdict once per (document, peer) and asks again only on `shareConfigChanged`,
 * so a vessel-only document a peer reached before the vessel state named it keeps flowing unless the growth re-asks.
 * The node and the browser vessel each stand their deny set here (isomorphic by intent), so a suite that stands this book
 * stands the vessels' own wiring. `repoOf` reads late: a growth before the Repo stands meets no cached verdict to re-ask.
 */
import type { Repo } from "@automerge/automerge-repo";
import { tiddlerText, type LarDoc } from "./base-doc.js";
import { DAEMON_CANON_TITLE_ROOT, DAEMON_SLOT_TITLE_ROOT, FLOOR_REGISTRY_ROOT } from "./device-daemon-docs.js";

/** The documents the place's daemon document names as the FLOOR's own (`FLOOR_REGISTRY_ROOT`): each stays on this vessel. */
export function floorOnlyDocIds(daemonDoc: LarDoc | null | undefined): Set<string> {
  const ids = new Set<string>();
  for (const [title, record] of Object.entries(daemonDoc?.tiddlers ?? {})) {
    if (!title.startsWith(FLOOR_REGISTRY_ROOT)) continue;
    const url = tiddlerText(record);
    if (url?.startsWith("automerge:") && url.length > 10) ids.add(url.slice(10));
  }
  return ids;
}

/** The vessel state's own document and every device document its rows name (`daemon-slot/…`, `daemon-canon/…`): each stays on this vessel. */
export function vesselOnlyDocIds(stateDoc: LarDoc | null | undefined, stateUrl: string | null): Set<string> {
  const ids = new Set<string>();
  const addUrl = (url: string | null) => { if (url?.startsWith("automerge:") && url.length > 10) ids.add(url.slice(10)); };
  addUrl(stateUrl);
  for (const [title, record] of Object.entries(stateDoc?.tiddlers ?? {})) {
    if (title.startsWith(DAEMON_SLOT_TITLE_ROOT) || title.startsWith(DAEMON_CANON_TITLE_ROOT)) addUrl(tiddlerText(record));
  }
  return ids;
}

/**
 * THE VESSEL-ONLY DENY SET a share verdict reads: the vessel state's document and every device document it names (`refresh`), and
 * each document a caller adds by hand. automerge-repo resolves a document's ACCESS verdict once per peer and asks again only
 * on `shareConfigChanged`, so a set that GROWS calls `onGrow`: the vessel wires it to that re-ask, and a peer whose verdict
 * was asked before the growth meets the new answer.
 */
export function makeVesselOnlyDocs(opts: { readonly onGrow?: () => void } = {}) {
  let named = new Set<string>();
  let floor = new Set<string>();
  const added = new Set<string>();
  const has = (documentId: string) => named.has(documentId) || floor.has(documentId) || added.has(documentId);
  return {
    has,
    /** Read the vessel state's names afresh; answers whether the set grew (and told `onGrow`). */
    refresh: (stateDoc: LarDoc | null | undefined, stateUrl: string | null): boolean => {
      const next = vesselOnlyDocIds(stateDoc, stateUrl);
      const grew = [...next].some((id) => !has(id));
      named = next;
      if (grew) opts.onGrow?.();
      return grew;
    },
    /** Read the floor registry's names afresh off the place's daemon document; answers whether the set grew (and told `onGrow`). */
    refreshFloor: (daemonDoc: LarDoc | null | undefined): boolean => {
      const next = floorOnlyDocIds(daemonDoc);
      const grew = [...next].some((id) => !has(id));
      floor = next;
      if (grew) opts.onGrow?.();
      return grew;
    },
    /** A document that stays on this vessel whatever the vessel state names (answers whether the set grew). */
    add: (documentId: string): boolean => {
      if (has(documentId)) { added.add(documentId); return false; }
      added.add(documentId);
      opts.onGrow?.();
      return true;
    },
  };
}


/** Re-ask every cached share verdict on the Repo `repoOf` names; a Repo not yet standing, or closing, answers nothing. */
export function repoReverdict(repoOf: () => Pick<Repo, "shareConfigChanged"> | null | undefined): () => void {
  return () => { try { repoOf()?.shareConfigChanged(); } catch { /* not yet standing, or closing */ } };
}

/** The vessel-only deny set, each growth re-asking the vessel Repo's verdicts. */
export function vesselOnlyBook(repoOf: () => Pick<Repo, "shareConfigChanged"> | null | undefined): ReturnType<typeof makeVesselOnlyDocs> {
  return makeVesselOnlyDocs({ onGrow: repoReverdict(repoOf) });
}
