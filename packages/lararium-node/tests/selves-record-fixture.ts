/**
 * selves-record-fixture — one face's vessels over the sealed crossing fixture, each carrying the face's persona plane (a
 * clear document holding a signed public row) and its selves record (persona-selves-sealed#/design), the selves plane
 * composed as the node composes it: the record's rest read off the vessel's own bag map.
 */
import type { Repo } from "@automerge/automerge-repo";
import { AutomergeDocStore, emptyLarDoc, personaBagIdFor, selvesRecordBagOf, selvesRecordOf, selvesRestOf, SIGNER_DID_TIDDLER, type LarDoc } from "@lararium/mesh";
import { repoPersonaSelvesPlane } from "../src/persona-selves-plane.js";

/** The group the witnesses' face stands in, and its selves record. */
export const GROUP = "d3".repeat(16);
export const RECORD = selvesRecordOf(GROUP);
/** The public act the plane holds: the floor folds it in the clear. */
export const PUBLIC_SIGNER = "did:key:zSEARCH-ME-the-public-signer";

/** A vessel's bag map: the face's record under `face` while it stands lit, under no face while it stands shut. */
export const bagMapOf = (face: string | null) => (documentId: string) =>
  selvesRecordBagOf(documentId, [GROUP], face === null ? [] : [{ group: GROUP, face }]);

/** The face's plane in `repo`: a clear document holding the signer pin, a public act. */
export async function standPlane(repo: Repo) {
  const plane = repo.create<LarDoc>(emptyLarDoc());
  await new AutomergeDocStore(plane as never, personaBagIdFor(GROUP)).put(
    { tiddler: { title: SIGNER_DID_TIDDLER, text: PUBLIC_SIGNER } as never, meta: { authority: "lares-verb" } },
    { kind: "lares-verb", requestId: "plane-signer" },
  );
  return plane;
}

/** The selves plane over `repo`, its record's rest read off `bagOf`. */
export const selvesOver = (repo: Repo, planeUrl: string, bagOf: (documentId: string) => ReturnType<ReturnType<typeof bagMapOf>>) =>
  repoPersonaSelvesPlane(repo, [{ personaGroupId: GROUP, url: planeUrl }], async () => [{ handleIndex: 0, personaGroupId: GROUP }], {
    restOf: (documentId) => selvesRestOf(bagOf(documentId)),
  });
