/**
 * rest-with-heads — the vessel's answer to a wiki island's rest ask that names its heads.
 *
 * The island lays an edit in its own Repo; the vessel's Repo holds a copy that reaches storage. The ask names the
 * heads the island holds of each document, and the vessel answers only once its own copy holds every one of them and
 * has flushed the documents. The wait rides the handle's `heads-changed` event and carries no timer. A document the
 * vessel holds no handle for, and a malformed ask, answer unrested.
 *
 * Canon: lar:///ha.ka.ba/lares/docs/pono/dreamdom#/what-a-sink-keeps
 */
import { hasHeads } from "@automerge/automerge";
import type { DocHandle, DocumentId, Repo } from "@automerge/automerge-repo";
import type { IslandMsg_DocRest } from "./island-protocol.js";

/** Backstop only: the primary stall is a closed channel the vessel reads. How many changes the vessel's copy may take without holding the island's heads before the ask answers stalled (rounds, never a timer). */
export const REST_STALL_ROUNDS = 512;
const MAX_HEADS = 1024;
const MAX_DOCUMENTS = 64;
const HEAD_HASH = /^[0-9a-f]{64}$/;

export async function answerRestWithHeads(repo: Repo | null, ask: IslandMsg_DocRest, islandPeer?: string): Promise<{ rested: boolean; stalled?: boolean; why?: string }> {
  if (!repo) return { rested: false, why: "no vessel Repo stands" };
  const heads = ask.heads;
  if (typeof heads !== "object" || heads === null || !Array.isArray(ask.documentIds) || ask.documentIds.length > MAX_DOCUMENTS) return { rested: false, why: "malformed rest ask" };
  const written: DocumentId[] = [];
  for (const id of ask.documentIds) {
    if (typeof id !== "string") return { rested: false, why: "malformed rest ask" };
    const named = Object.hasOwn(heads, id) ? heads[id] : undefined;
    if (!Array.isArray(named) || named.length > MAX_HEADS || !named.every((h) => typeof h === "string" && HEAD_HASH.test(h))) return { rested: false, why: "malformed rest ask" };
    const handle = repo.handles[id as DocumentId] as DocHandle<unknown> | undefined;
    if (!handle) return { rested: false, why: "the vessel holds no copy of the document" };
    if (named.length > 0) {
      const holds = (): boolean => { try { return hasHeads(handle.doc() as Parameters<typeof hasHeads>[0], named); } catch { return false; } };
      if (!holds()) {
        let rounds = 0;
        let channelClosed = false;
        const arrived = await new Promise<boolean>((resolve) => {
          const finish = (done: boolean): void => { handle.off("heads-changed", onChange); repo.networkSubsystem.off("peer-disconnected", onGone); resolve(done); };
          const onChange = (): void => {
            const done = holds();
            if (done || ++rounds >= REST_STALL_ROUNDS) finish(done);
          };
          // A closed channel carries no heads: the vessel reads that fact, not a count.
          const onGone = ({ peerId }: { peerId: string }): void => { if (peerId === islandPeer) { channelClosed = true; finish(holds()); } };
          handle.on("heads-changed", onChange);
          if (islandPeer !== undefined) {
            repo.networkSubsystem.on("peer-disconnected", onGone);
            if (!repo.peers.includes(islandPeer as never)) { channelClosed = true; finish(holds()); }
          }
        });
        if (!arrived) return { rested: false, stalled: true, why: channelClosed ? `stalled: the island's channel closed before the vessel's copy of ${id} held its heads` : `stalled: the vessel's copy of ${id} changed ${REST_STALL_ROUNDS} times without holding the island's heads` };
      }
    }
    written.push(handle.documentId);
  }
  try { if (written.length > 0) await repo.flush(written); } catch (error) { return { rested: false, why: error instanceof Error ? error.message : String(error) }; }
  return { rested: true };
}
