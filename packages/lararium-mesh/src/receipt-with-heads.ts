/**
 * receipt-with-heads — the vessel's answer to a wiki island's receipt request that names its heads.
 *
 * The island lays an edit in its own Repo; the vessel's Repo holds a copy that reaches storage. The ask names the
 * heads the island holds of each document, and the vessel answers only once its own copy holds every one of them and
 * has flushed the documents. The wait rides the handle's `heads-changed` event and carries no timer. A document the
 * vessel holds no handle for, and a malformed ask, answer with no receipt issued.
 *
 * Canon: lar:///ha.ka.ba/lares/docs/pono/dreamdom#/what-a-sink-keeps
 */
import { hasHeads } from "@automerge/automerge";
import type { AutomergeUrl, DocHandle, DocumentId, Repo } from "@automerge/automerge-repo";
import type { IslandMsg_ReceiptRequest } from "./island-protocol.js";

/** Backstop only: the primary stall is a closed channel the vessel reads. How many changes the vessel's copy may take without holding the island's heads before the ask answers stalled (rounds, never a timer). */
export const RECEIPT_STALL_ROUNDS = 512;
const MAX_HEADS = 1024;
const MAX_DOCUMENTS = 64;
const HEAD_HASH = /^[0-9a-f]{64}$/;

export async function answerReceiptWithHeads(repo: Repo | null, ask: IslandMsg_ReceiptRequest, islandPeer?: string): Promise<{ issued: boolean; stalled?: boolean; why?: string }> {
  if (!repo) return { issued: false, why: "no vessel Repo stands" };
  const heads = ask.heads;
  if (typeof heads !== "object" || heads === null || !Array.isArray(ask.documentIds) || ask.documentIds.length > MAX_DOCUMENTS) return { issued: false, why: "malformed receipt request" };
  const written: DocumentId[] = [];
  for (const id of ask.documentIds) {
    if (typeof id !== "string") return { issued: false, why: "malformed receipt request" };
    const named = Object.hasOwn(heads, id) ? heads[id] : undefined;
    if (!Array.isArray(named) || named.length > MAX_HEADS || !named.every((h) => typeof h === "string" && HEAD_HASH.test(h))) return { issued: false, why: "malformed receipt request" };
    const handle = repo.handles[id as DocumentId] as DocHandle<unknown> | undefined;
    if (!handle) return { issued: false, why: "the vessel holds no copy of the document" };
    if (named.length > 0) {
      const holds = (): boolean => { try { return hasHeads(handle.doc() as Parameters<typeof hasHeads>[0], named); } catch { return false; } };
      if (!holds()) {
        let rounds = 0;
        let channelClosed = false;
        const arrived = await new Promise<boolean>((resolve) => {
          const finish = (done: boolean): void => { handle.off("heads-changed", onChange); repo.networkSubsystem.off("peer-disconnected", onGone); resolve(done); };
          const onChange = (): void => {
            const done = holds();
            if (done || ++rounds >= RECEIPT_STALL_ROUNDS) finish(done);
          };
          // A closed channel carries no heads: the vessel reads that fact, not a count.
          const onGone = ({ peerId }: { peerId: string }): void => { if (peerId === islandPeer) { channelClosed = true; finish(holds()); } };
          handle.on("heads-changed", onChange);
          if (islandPeer !== undefined) {
            repo.networkSubsystem.on("peer-disconnected", onGone);
            if (!repo.peers.includes(islandPeer as never)) { channelClosed = true; finish(holds()); }
          }
        });
        if (!arrived) return { issued: false, stalled: true, why: channelClosed ? `stalled: the island's channel closed before the vessel's copy of ${id} held its heads` : `stalled: the vessel's copy of ${id} changed ${RECEIPT_STALL_ROUNDS} times without holding the island's heads` };
      }
    }
    written.push(handle.documentId);
  }
  try { if (written.length > 0) await repo.flush(written); } catch (error) { return { issued: false, why: error instanceof Error ? error.message : String(error) }; }
  return { issued: true };
}

/** The ask `answerReceiptWithHeads` reads, built for a document set whose heads the island named. It rides no port. */
function receiptAskOf(documentIds: readonly string[], heads: Readonly<Record<string, readonly string[]>>): IslandMsg_ReceiptRequest {
  return { requestId: "receipt-in-store", documentIds: [...documentIds], heads: Object.fromEntries(documentIds.map((id) => [id, [...heads[id]!]])) } as IslandMsg_ReceiptRequest;
}

/**
 * THE RECEIPT CAPABILITY'S WHOLE ACT, one helper both hosts call (the node's vessel and the browser's): no host keeps a
 * second copy, so a host that passed no island peer or never re-found a derived document cannot drift from the other:
 * wait until each named document has reached `repo`, then flush them into its store.
 * It resolves only after the store holds every one durably, so an acknowledgment never runs ahead of the save.
 *
 * A document an island just minted reaches this Repo over the island's sync leg alone, and the ask rides a faster
 * road than that leg's handshake. Until the Repo has met the island's peer, `unavailable` says nothing about the
 * island's copy, so the ask waits for `legReady` (the leg standing, the Repo having met its peer) and then reads;
 * an `unavailable` after that is the peers' own answer and rejects. `onClose` (the teardown subscription) ends the wait when the vessel stands
 * down. No timer runs here; the asking island's own patience bounds the wait from its side.
 */
export async function receiptInStore(
  repo: Pick<Repo, "find" | "flush"> & Partial<Pick<Repo, "findWithProgress" | "handles" | "networkSubsystem" | "peers">>,
  documentIds: readonly string[],
  leg?: { readonly ready: Promise<unknown>; readonly onClose: (fn: () => void) => () => void },
  heads?: Readonly<Record<string, readonly string[]>>,
): Promise<void> {
  let islandPeer: string | undefined;
  if (leg) {
    // The teardown subscription leaves when the wait settles, so a completed ask holds nothing of the capability.
    const stood = await new Promise<{ peer: unknown } | null>((resolve, reject) => {
      const off = leg.onClose(() => resolve(null));
      leg.ready.then((peer) => { off(); resolve({ peer }); }, (error: unknown) => { off(); reject(error); });
    });
    if (stood === null) throw new Error(`the vessel stood down before the island's sync leg stood (${documentIds.join(", ")})`);
    if (typeof stood.peer === "string") islandPeer = stood.peer;
  }
  const named = heads && documentIds.length > 0 && documentIds.every((id) => (heads[id]?.length ?? 0) > 0);
  if (named && repo.findWithProgress && repo.handles) {
    // The island names the heads it holds. A derived id the vessel asked for earlier may stand cached unavailable, and
    // that says nothing of the island's copy: the vessel's copy has to come to hold the heads, so the wait rides the
    // handle's own `heads-changed`, never a find that settled before the bytes could arrive.
    for (const id of documentIds) repo.findWithProgress(`automerge:${id}` as AutomergeUrl);
    const answer = await answerReceiptWithHeads(repo as unknown as Repo, receiptAskOf(documentIds, heads!), islandPeer);
    if (!answer.issued) throw new Error(answer.why ?? "the vessel's copy did not come to hold the island's heads");
    return;
  }
  for (const id of documentIds) await repo.find(`automerge:${id}` as AutomergeUrl);
  await repo.flush(documentIds as DocumentId[]);
}
