/**
 * stood-document — A DOCUMENT AN ISLAND STOOD AT A DERIVED ADDRESS CROSSES WITH ITS NAME.
 *
 * An island stands a document at a derived address (`materializeSharedLarDoc`: a realm workbench) by asking every peer
 * first, its own vessel among them. The vessel holds nothing yet, answers `unavailable`, and its repo keeps that verdict, so
 * a later `find` on that url refuses at once. The island's sync push of the stood document travels one port, its answer that
 * names the url another; whichever lands first decided the mount. The ordering rides the answer itself: the island carries
 * the stood document's bytes beside the name (`stoodDocumentBytes`), and the vessel lands them at that url
 * (`landStoodDocument`) before anything reads it. No clock decides; the name never arrives ahead of what it names.
 *
 * Canon: lar:///ha.ka.ba/lares/docs/pono/cabal-realm#/the-workbench
 */
import * as A from "@automerge/automerge";
import { interpretAsDocumentId, type AutomergeUrl, type DocHandle, type DocumentId, type Repo } from "@automerge/automerge-repo";
import type { DaemonMsg_ResolveBindingResult } from "./island-protocol.js";

/** The island's side: the stood document's bytes, to ride beside its name. */
export function stoodDocumentBytes(handle: DocHandle<unknown>): Uint8Array {
  const doc = handle.doc();
  if (doc === undefined) throw new Error(`stood-document: ${handle.url} holds no document to carry`);
  return A.save(doc as A.Doc<unknown>);
}

/**
 * The vessel's side: land `bytes` at `url` in `repo`. A handle the repo already holds (the earlier ask's verdict, or a copy
 * that synced first) takes the bytes as an incremental merge, so the call is idempotent and never forks the document.
 */
export function landStoodDocument(repo: Repo, url: string, bytes: Uint8Array): void {
  repo.import(bytes, { docId: interpretAsDocumentId(url as AutomergeUrl) as DocumentId });
}

/** The vessel lands every stood document a binding answer carries, before the answer settles and the mount reads it. */
export function landBindingDocuments(repo: Repo, msg: Pick<DaemonMsg_ResolveBindingResult, "workingUrl" | "workingDoc">): void {
  if (msg.workingUrl && msg.workingDoc) landStoodDocument(repo, msg.workingUrl, msg.workingDoc);
}
