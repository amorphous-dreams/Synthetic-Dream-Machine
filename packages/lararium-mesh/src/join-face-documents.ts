/**
 * join-face-documents — this device's own entry joins the face's shared documents on the first boot that HOLDS them.
 *
 * A face's circles and identities are the face's documents: the founder minted them, and an admitted device adopts them by
 * url and syncs them. A fresh device holds neither yet at its admit, so its own identity entry (and the circles the ceremony
 * seeds) cannot land there. The first boot whose replica already holds a document writes the entry, once: a document not
 * held is left alone (a boot never waits on a peer), and an entry already standing is never overwritten.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/persona-circle
 */

import type { Repo } from "@automerge/automerge-repo";
import type { LarDoc } from "./base-doc.js";
import { buildCeremonyTiddlers } from "./cold-boot-ceremony.js";
import { IDENTITIES_NAMESPACE } from "./lar-uris.js";
import { heldDocOf } from "./persona-act-board.js";
import { storedRecord } from "./stored-record.js";
import { parseAutomergeUrl, type AutomergeUrl } from "@automerge/automerge-repo";

/** Write this device's ceremony entries into each shared document the replica holds; answers which documents took a write. */
export function joinFaceDocuments(
  repo: Repo, urls: { readonly identities: string; readonly circles: string }, atomKey: string, displayName?: string,
): { readonly identities: boolean; readonly circles: boolean } {
  const wrote = { identities: false, circles: false };
  for (const which of ["identities", "circles"] as const) {
    if (!heldDocOf(repo, urls[which])) continue;
    const handle = repo.handles[parseAutomergeUrl(urls[which] as AutomergeUrl).documentId];
    if (!handle) continue;
    handle.change((doc: LarDoc) => {
      for (const t of buildCeremonyTiddlers(atomKey, displayName)) {
        if ((t.bag === IDENTITIES_NAMESPACE) !== (which === "identities")) continue;
        if (doc.tiddlers[t.title]) continue;
        doc.tiddlers[t.title] = storedRecord({ tiddler: { title: t.title, ...t.fields }, meta: { authority: t.authority } });
        wrote[which] = true;
      }
    });
  }
  return wrote;
}
