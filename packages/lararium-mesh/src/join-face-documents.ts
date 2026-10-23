/**
 * join-face-documents — this device's own entry joins the face's shared documents when they ARRIVE.
 *
 * A face's circles and identities are the face's documents: the founder minted them, and an admitted device adopts them by
 * url and syncs them. A fresh device holds neither yet at its admit, so its own identity entry (and the circles the ceremony
 * seeds) cannot land there. The entry lands the moment the replica holds the document, once: `joinFaceDocuments` writes
 * into a document already held (a boot never waits on a peer), `joinFaceDocumentsOnArrival` writes when one arrives, and
 * an entry already standing is never overwritten.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/persona-circle
 */

import type { Repo } from "@automerge/automerge-repo";
import type { LarDoc } from "./base-doc.js";
import { buildCeremonyTiddlers } from "./cold-boot-ceremony.js";
import { IDENTITIES_NAMESPACE } from "./lar-uris.js";
import { MEMBER_ADD_PREFIX } from "./social-tiddlers.js";
import { heldDocOf } from "./persona-act-board.js";
import { storedRecord } from "./stored-record.js";
import { parseAutomergeUrl, type AutomergeUrl } from "@automerge/automerge-repo";

type DocHandle = import("@automerge/automerge-repo").DocHandle<LarDoc>;

/** This device's ceremony entries into one shared document; true where a new entry landed. An entry standing is never overwritten. */
function writeOwnEntries(handle: DocHandle, which: "identities" | "circles", atomKey: string, displayName?: string): boolean {
  let wrote = false;
  handle.change((doc: LarDoc) => {
    for (const t of buildCeremonyTiddlers(atomKey, displayName)) {
      if ((t.bag === IDENTITIES_NAMESPACE) !== (which === "identities")) continue;
      const standing = doc.tiddlers[t.title] as { tiddler?: Record<string, unknown> } | undefined;
      if (standing) {
        // A circle the face already holds (the founder's `operators`) gains THIS device's own membership dot, add-only: the joinee's
        // dot is a replica-keyed key no other device writes, so the merge never overwrites or removes another member.
        if (t.bag !== IDENTITIES_NAMESPACE && standing.tiddler) {
          for (const [field, value] of Object.entries(t.fields)) {
            if (field.startsWith(MEMBER_ADD_PREFIX) && !(field in standing.tiddler)) { standing.tiddler[field] = value; wrote = true; }
          }
        }
        continue;
      }
      doc.tiddlers[t.title] = storedRecord({ tiddler: { title: t.title, ...t.fields }, meta: { authority: t.authority } });
      wrote = true;
    }
  });
  return wrote;
}

/** Write this device's ceremony entries into each shared document the replica holds; answers which documents took a write. */
export function joinFaceDocuments(
  repo: Repo, urls: { readonly identities: string; readonly circles: string }, atomKey: string, displayName?: string,
): { readonly identities: boolean; readonly circles: boolean } {
  const wrote = { identities: false, circles: false };
  for (const which of ["identities", "circles"] as const) {
    if (!heldDocOf(repo, urls[which])) continue;
    const handle = repo.handles[parseAutomergeUrl(urls[which] as AutomergeUrl).documentId];
    if (handle) wrote[which] = writeOwnEntries(handle as DocHandle, which, atomKey, displayName);
  }
  return wrote;
}

/**
 * THE ENTRY JOINS WHEN THE DOCUMENT ARRIVES: a document the replica does not yet hold is awaited by a causal read (the
 * repo's own progress view, which fires when the document becomes ready), never a timer and never the next boot. The
 * subscription ends at `stop()`; the caller invokes this only for a face whose proof passed, so a vessel outside the group
 * never reaches it and writes nothing.
 */
export function joinFaceDocumentsOnArrival(
  repo: Repo, urls: { readonly identities: string; readonly circles: string }, atomKey: string, displayName?: string,
): { readonly stop: () => void } {
  const unsubscribes: Array<() => void> = [];
  let stopped = false;
  for (const which of ["identities", "circles"] as const) {
    const progress = repo.findWithProgress(urls[which] as AutomergeUrl);
    let written = false;
    const arrive = (state: ReturnType<typeof progress.peek>): void => {
      if (stopped || written || state.state !== "ready") return;
      written = true;
      writeOwnEntries(state.handle as unknown as DocHandle, which, atomKey, displayName);
    };
    unsubscribes.push(progress.subscribe(arrive));
    arrive(progress.peek());
  }
  return { stop: () => { stopped = true; for (const u of unsubscribes) u(); } };
}
