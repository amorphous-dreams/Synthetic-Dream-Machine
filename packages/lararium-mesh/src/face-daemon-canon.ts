/** Stand a vessel-local daemon canon for a worn face: the node and the browser vessel share this one door. The vessel's
 *  fixed-title state (`vessel-state`, its secret home) names the canon; the face still seals it. */
import * as A from "@automerge/automerge";
import { generateAutomergeUrl, parseAutomergeUrl, type AutomergeUrl, type DocHandle, type DocumentId, type Repo } from "@automerge/automerge-repo";
import { emptyLarDoc, tiddlerText, type LarDoc } from "./base-doc.js";
import { daemonCanonTitle } from "./device-daemon-docs.js";
import { storedLarRecord } from "./stored-record.js";
import { ownEntry } from "./stored-value.js";
import { daemonFaceCanonBag } from "./wiki-recipe.js";

/** The daemon canon for this face and vessel. */
export interface FaceDaemonCanon {
  readonly bagId: string;
  readonly url: string;
  readonly documentId: string;
}

/** Reopen or mint the document named in the vessel's fixed-title state.
 *
 * NAMED BEFORE ITS FIRST BYTE. A fresh canon's id mints ahead; `beforeFirstByte` hands the vessel's sealed map that id
 * under the canon's bag (it seals under the lit face) before the document's first byte moves, and only then does the
 * document stand and the vessel state name it. A reopen finds a document the map already names from the vessel state.
 *
 * A REOPEN NAMES, IT NEVER READS. The canon rests sealed under the face, and a restart's load of it waits on the daemon
 * island's door (`door-unanswered`), which opens only after the composition this stand serves. So the reopen hands back
 * the name the vessel state carries and the island opens the document once its door stands; awaiting the document
 * here would hold the composition on itself. */
export async function standFaceDaemonCanon(opts: {
  readonly repo: Repo;
  /** The vessel's fixed-title state (its secret home). */
  readonly state: Pick<DocHandle<LarDoc>, "doc" | "change">;
  readonly faceRelation: string;
  readonly beforeFirstByte?: (bagId: string, documentId: string) => void;
}): Promise<FaceDaemonCanon> {
  const bagId = daemonFaceCanonBag(opts.faceRelation);
  const title = daemonCanonTitle(opts.faceRelation);
  const named = tiddlerText(ownEntry(opts.state.doc()?.tiddlers, title));
  if (named && named.startsWith("automerge:")) {
    const documentId = parseAutomergeUrl(named as AutomergeUrl).documentId;
    opts.beforeFirstByte?.(bagId, documentId);
    return { bagId, url: named, documentId };
  }
  const documentId = parseAutomergeUrl(generateAutomergeUrl()).documentId;
  opts.beforeFirstByte?.(bagId, documentId);
  const handle = opts.repo.import<LarDoc>(A.save(A.from(emptyLarDoc() as unknown as Record<string, unknown>)), { docId: documentId as DocumentId });
  opts.state.change((doc) => {
    doc.tiddlers[title] = storedLarRecord(title, { text: handle.url, kind: "oracle" }, "daemon-face-canon");
  });
  return { bagId, url: handle.url, documentId };
}
