/** Carry persona acts in LarDocs; proof decides which records count. */
import type { DocHandle, Repo, AutomergeUrl } from "@automerge/automerge-repo";
import { heldDocOf, restingDocOf, personaActRecordsOfGroup, writePersonaAct, type LarDoc, type SignedAct } from "@lararium/mesh";

export function appendPersonaActs(handle: DocHandle<LarDoc>, acts: readonly SignedAct[]): void {
  handle.change((draft) => { for (const act of acts) writePersonaAct(draft, act); });
}

export async function readFacePersonaRecords(repo: Repo, input: {
  readonly personaUrl: string;
  readonly group: string;
  readonly extraDocs?: readonly (LarDoc | null | undefined)[];
  /** A boot reads the plane only if this replica already holds it, never waiting on a peer; a founder's door waits for its own doc. */
  readonly heldOnly?: boolean;
  /** With `heldOnly`: a plane resting in this replica's own store counts as held though no mount loaded it (`restingDocOf`).
   *  A lit sibling's proof reads so: the composition mounts the worn face's plane alone, and a sibling's rests unread. */
  readonly resting?: boolean;
}): Promise<unknown[]> {
  const plane = input.heldOnly ? (input.resting ? await restingDocOf(repo, input.personaUrl) : heldDocOf(repo, input.personaUrl)) : (await repo.find<LarDoc>(input.personaUrl as AutomergeUrl)).doc();
  return [plane, ...(input.extraDocs ?? [])].flatMap((doc) => personaActRecordsOfGroup(doc, input.group));
}
