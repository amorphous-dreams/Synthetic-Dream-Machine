/**
 * face-daemon-canon — THE DAEMON WIKI'S CANON FOR THE WORN FACE: `bags/daemon-<F>` (`daemonFaceCanonBag`).
 *
 * The daemon wiki's canon follows the face, never the vessel: the daemon document (`bags/daemon`) keeps no canon role.
 * The face's own catalog names the canon's document under its bag coordinate; a face whose catalog names none mints the
 * document at its first worn stand and names it there, so the canon outlives every restart of that face and every
 * re-founding of the house.
 *
 * Meme: lar:///ha.ka.ba/lararium/browser/face-daemon-canon
 */
import type { AutomergeUrl, DocHandle, Repo } from "@automerge/automerge-repo";
import { daemonFaceCanonBag, emptyLarDoc, ownEntry, storedLarRecord, tiddlerText, type LarDoc } from "@lararium/mesh";

/** The face's daemon canon, as its catalog names it: the bag and the document. */
export interface FaceDaemonCanon {
  readonly bagId: string;
  readonly url: string;
  readonly handle: DocHandle<LarDoc>;
}

/** Stand the worn face's daemon canon: the document `catalog` names under `bags/daemon-<F>`, else a fresh one named there. */
export async function standFaceDaemonCanon(opts: {
  readonly repo: Repo;
  /** The worn face's own catalog view: the row lands on the face's half, sealed under it. */
  readonly catalog: Pick<DocHandle<LarDoc>, "doc" | "change">;
  readonly faceRelation: string;
}): Promise<FaceDaemonCanon> {
  const bagId = daemonFaceCanonBag(opts.faceRelation);
  const named = tiddlerText(ownEntry(opts.catalog.doc()?.tiddlers, bagId));
  if (named && named.startsWith("automerge:")) {
    return { bagId, url: named, handle: await opts.repo.find<LarDoc>(named as AutomergeUrl) };
  }
  const handle = opts.repo.create<LarDoc>(emptyLarDoc());
  opts.catalog.change((doc) => {
    doc.tiddlers[bagId] = storedLarRecord(bagId, { text: handle.url, kind: "oracle" }, "daemon-face-canon");
  });
  return { bagId, url: handle.url, handle };
}
