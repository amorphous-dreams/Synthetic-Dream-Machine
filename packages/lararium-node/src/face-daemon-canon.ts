/** Stand a vessel-local daemon canon for a worn face. The control document names the canon; the face still seals it. */
import type { AutomergeUrl, DocHandle, Repo } from "@automerge/automerge-repo";
import { CONTROL_HOME_ID, daemonFaceCanonBag, emptyLarDoc, ownEntry, storedLarRecord, tiddlerText, type LarDoc } from "@lararium/mesh";

/** The daemon canon for this face and vessel. */
export interface FaceDaemonCanon {
  readonly bagId: string;
  readonly url: string;
  readonly handle: DocHandle<LarDoc>;
}

/** Reopen or mint the document named in the vessel control home. */
export async function standFaceDaemonCanon(opts: {
  readonly repo: Repo;
  /** The vessel control document. */
  readonly control: Pick<DocHandle<LarDoc>, "doc" | "change">;
  readonly faceRelation: string;
}): Promise<FaceDaemonCanon> {
  const bagId = daemonFaceCanonBag(opts.faceRelation);
  const title = `${CONTROL_HOME_ID}/daemon-canon/${encodeURIComponent(opts.faceRelation)}`;
  const named = tiddlerText(ownEntry(opts.control.doc()?.tiddlers, title));
  if (named && named.startsWith("automerge:")) {
    return { bagId, url: named, handle: await opts.repo.find<LarDoc>(named as AutomergeUrl) };
  }
  const handle = opts.repo.create<LarDoc>(emptyLarDoc());
  opts.control.change((doc) => {
    doc.tiddlers[title] = storedLarRecord(title, { text: handle.url, kind: "oracle" }, "daemon-face-canon");
  });
  return { bagId, url: handle.url, handle };
}
