/** Stand a vessel-local daemon canon for a worn face: the node and the browser vessel share this one door. The control
 *  document names the canon; the face still seals it. */
import * as A from "@automerge/automerge";
import { generateAutomergeUrl, parseAutomergeUrl, type AutomergeUrl, type DocHandle, type DocumentId, type Repo } from "@automerge/automerge-repo";
import { emptyLarDoc, tiddlerText, type LarDoc } from "./base-doc.js";
import { CONTROL_HOME_ID } from "./lar-uris.js";
import { storedLarRecord } from "./stored-record.js";
import { ownEntry } from "./stored-value.js";
import { daemonFaceCanonBag } from "./wiki-recipe.js";

/** The daemon canon for this face and vessel. */
export interface FaceDaemonCanon {
  readonly bagId: string;
  readonly url: string;
  readonly documentId: string;
}

/** Reopen or mint the document named in the vessel control home.
 *
 * NAMED BEFORE ITS FIRST BYTE. A fresh canon's id mints ahead; `beforeFirstByte` hands the vessel's sealed map that id
 * under the canon's bag (it seals under the lit face) before the document's first byte moves, and only then does the
 * document stand and the control document name it. A reopen finds a document the map already names from the control
 * document.
 *
 * A REOPEN NAMES, IT NEVER READS. The canon rests sealed under the face, and a restart's load of it waits on the daemon
 * island's door (`door-unanswered`), which opens only after the composition this stand serves. So the reopen hands back
 * the name the control document carries and the island opens the document once its door stands; awaiting the document
 * here would hold the composition on itself. */
export async function standFaceDaemonCanon(opts: {
  readonly repo: Repo;
  /** The vessel control document. */
  readonly control: Pick<DocHandle<LarDoc>, "doc" | "change">;
  readonly faceRelation: string;
  readonly beforeFirstByte?: (bagId: string, documentId: string) => void;
}): Promise<FaceDaemonCanon> {
  const bagId = daemonFaceCanonBag(opts.faceRelation);
  const title = `${CONTROL_HOME_ID}/daemon-canon/${encodeURIComponent(opts.faceRelation)}`;
  const named = tiddlerText(ownEntry(opts.control.doc()?.tiddlers, title));
  if (named && named.startsWith("automerge:")) {
    const documentId = parseAutomergeUrl(named as AutomergeUrl).documentId;
    opts.beforeFirstByte?.(bagId, documentId);
    return { bagId, url: named, documentId };
  }
  const documentId = parseAutomergeUrl(generateAutomergeUrl()).documentId;
  opts.beforeFirstByte?.(bagId, documentId);
  const handle = opts.repo.import<LarDoc>(A.save(A.from(emptyLarDoc() as unknown as Record<string, unknown>)), { docId: documentId as DocumentId });
  opts.control.change((doc) => {
    doc.tiddlers[title] = storedLarRecord(title, { text: handle.url, kind: "oracle" }, "daemon-face-canon");
  });
  return { bagId, url: handle.url, documentId };
}
