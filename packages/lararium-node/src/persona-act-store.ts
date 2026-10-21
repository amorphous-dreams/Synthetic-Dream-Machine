/** Carry persona acts in LarDocs; proof decides which records count. */
import type { DocHandle, Repo, AutomergeUrl } from "@automerge/automerge-repo";
import { personaActRecordsOfGroup, writePersonaAct, type LarDoc, type SignedAct } from "@lararium/mesh";

export function appendPersonaActs(handle: DocHandle<LarDoc>, acts: readonly SignedAct[]): void {
  handle.change((draft) => { for (const act of acts) writePersonaAct(draft, act); });
}

export async function readFacePersonaRecords(repo: Repo, input: {
  readonly personaUrl: string;
  readonly group: string;
  readonly extraDocs?: readonly (LarDoc | null | undefined)[];
}): Promise<unknown[]> {
  const plane = await repo.find<LarDoc>(input.personaUrl as AutomergeUrl);
  return [plane.doc(), ...(input.extraDocs ?? [])].flatMap((doc) => personaActRecordsOfGroup(doc, input.group));
}
