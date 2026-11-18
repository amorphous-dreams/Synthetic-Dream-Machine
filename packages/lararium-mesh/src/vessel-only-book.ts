/**
 * vessel-only-book — the vessel-only deny set as every vessel composes it: a growing set (`makeVesselOnlyDocs`) whose every
 * growth re-asks the vessel Repo's cached share verdicts (`shareConfigChanged`).
 *
 * automerge-repo resolves a document's ACCESS verdict once per (document, peer) and asks again only on `shareConfigChanged`,
 * so a vessel-only document a peer reached before the control document named it keeps flowing unless the growth re-asks.
 * The node and the browser vessel each stand their deny set here (isomorphic by intent), so a suite that stands this book
 * stands the vessels' own wiring. `repoOf` reads late: a growth before the Repo stands meets no cached verdict to re-ask.
 */
import type { Repo } from "@automerge/automerge-repo";
import { makeVesselOnlyDocs } from "./control-home.js";

/** Re-ask every cached share verdict on the Repo `repoOf` names; a Repo not yet standing, or closing, answers nothing. */
export function repoReverdict(repoOf: () => Pick<Repo, "shareConfigChanged"> | null | undefined): () => void {
  return () => { try { repoOf()?.shareConfigChanged(); } catch { /* not yet standing, or closing */ } };
}

/** The vessel-only deny set, each growth re-asking the vessel Repo's verdicts. */
export function vesselOnlyBook(repoOf: () => Pick<Repo, "shareConfigChanged"> | null | undefined): ReturnType<typeof makeVesselOnlyDocs> {
  return makeVesselOnlyDocs({ onGrow: repoReverdict(repoOf) });
}
