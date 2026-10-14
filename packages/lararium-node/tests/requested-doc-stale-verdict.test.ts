/**
 * requested-doc-stale-verdict — COLLIDE THE INSTRUMENT on the automerge-repo side of the realm-bag stop.
 *
 * `DocSynchronizer` resolves the share verdict ONCE per (doc, peer) — at `addPeer`, and again only when
 * `Repo.shareConfigChanged()` calls `reevaluateSharePolicy`. A verdict that flips to deny emits
 * `doc-unavailable` and parks the peer; a verdict that flips BACK to allow moves nothing until the repo is
 * asked to read it again. Both directions then stop: the server drops the puller's sync messages, and the
 * puller's own outbound sync draws `doc-unavailable` back.
 *
 * This is the shape `meme-realm-bag` ⑬ measured on the wire — one book, one crossing, and no session after.
 *
 * PINNED (the stop `meme-realm-bag` ⑬ measured): the doc crosses on request, the verdict flips deny→allow with
 * no `shareConfigChanged`, and the puller's change never reaches the server's replica.
 * CONTROLS: a doc the verdict denies from the start never crosses at all; a doc denied AFTER it crossed
 * stops syncing (so the RED is a STALE verdict, not a dead wire); and the same flip WITH
 * `shareConfigChanged` carries the change — the cure's mechanism, proven here before it is wired.
 */
import { describe, test, expect } from "vitest";
import { Repo, type DocumentId, type PeerId } from "@automerge/automerge-repo";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";
import { shareConfigOf } from "@lararium/mesh";
import { arrival } from "../../lararium-mesh/tests/handshake.js";

type Doc = { text?: string; slot?: string };

/** The live realm verdict, and a listener for each answer A's policy gives about a document. */
interface Verdict { value: boolean; heard?: (documentId: DocumentId, verdict: boolean) => void }

/** Two repos over one channel. A holds the book; B pulls it by id. `open` is the live realm verdict. */
async function ford(open: Verdict) {
  const { port1, port2 } = new MessageChannel();
  const A = new Repo({
    network: [new MessageChannelNetworkAdapter(port1)],
    peerId: "A" as PeerId,
    shareConfig: shareConfigOf(async (_p: PeerId, documentId?: DocumentId) => {
      const verdict = documentId !== undefined && open.value;
      if (documentId !== undefined) open.heard?.(documentId, verdict);
      return verdict;
    }),
  });
  const B = new Repo({ network: [new MessageChannelNetworkAdapter(port2)], peerId: "B" as PeerId });
  await Promise.all([A.networkSubsystem.whenReady(), B.networkSubsystem.whenReady()]);
  return { A, B };
}

/**
 * Flip the verdict to DENY, ask A to read it again, and wait until the denial has TAKEN EFFECT: A tells a peer
 * that had asked for the book `doc-unavailable` at the moment it parks that peer, and B's own network hears it.
 * The wait hangs on that message, A's own word, and no clock.
 */
async function deny(A: Repo, B: Repo, open: Verdict, documentId: DocumentId): Promise<void> {
  const told = arrival<void>("B hearing A's `doc-unavailable` for the book (the denial taking effect at A)");
  const onMessage = (msg: { type?: string; documentId?: DocumentId }): void => {
    if (msg.type === "doc-unavailable" && msg.documentId === documentId) told.arrive();
  };
  B.networkSubsystem.on("message", onMessage as never);
  open.value = false;
  A.shareConfigChanged();
  try { await told.arrived; } finally { B.networkSubsystem.off("message", onMessage as never); }
}

/**
 * Flip the verdict to ALLOW, ask A to read it again, and wait until A has read it and applied it. A names no
 * peer on an allow, so the wait hangs on A's own read of the policy for the book, then yields one turn of the
 * event loop: the synchronizer applies the answer in promise continuations of the read's own turn, and the next
 * turn starts only once those ran. No clock decides it.
 */
async function allow(A: Repo, open: Verdict, documentId: DocumentId): Promise<void> {
  const read = arrival<void>("A reading the verdict \"allow\" for the book after shareConfigChanged");
  open.heard = (id, verdict) => { if (id === documentId && verdict) read.arrive(); };
  open.value = true;
  A.shareConfigChanged();
  try { await read.arrived; } finally { delete open.heard; }
  await new Promise<void>((turn) => setImmediate(turn));
}

const settle = async (p: Promise<unknown>, ms: number): Promise<"ready" | "unavailable" | "timeout"> =>
  Promise.race([
    p.then(() => "ready" as const, () => "unavailable" as const),
    new Promise<"timeout">((r) => setTimeout(() => r("timeout"), ms)),
  ]);

/**
 * Read A's own replica for the puller's slot — the only honest read of "did the change cross back". A crossing
 * answers at the replica's own `change`; `ms` bounds only the answer "it never crossed".
 */
async function serverSees(A: Repo, url: string, slot: string, ms = 3_000): Promise<boolean> {
  const h = await A.find<Doc>(url as never);
  if (h.doc()?.slot === slot) return true;
  return new Promise<boolean>((resolve) => {
    const onChange = (): void => { if (h.doc()?.slot === slot) { clearTimeout(never); h.off("change", onChange); resolve(true); } };
    const never = setTimeout(() => { h.off("change", onChange); resolve(false); }, ms);
    h.on("change", onChange);
  });
}

describe("a book pulled by request keeps syncing only while the verdict is re-read", () => {
  test("THE STOP, PINNED — the verdict flips deny→allow with no re-read and the puller's change never lands", async () => {
    const open: Verdict = { value: true };
    const { A, B } = await ford(open);
    const book = A.create<Doc>({ text: "salt: 12 · barley: 40" });
    const pulled = await B.find<Doc>(book.url);
    expect(pulled.doc()?.text, "the book crosses ONCE on B's request").toBe("salt: 12 · barley: 40");

    // The fold drops the bag (a proposal replaces the counted record) and A reverdicts.
    await deny(A, B, open, book.documentId);

    // The co-sign lands and A's realm plane refolds — but nothing asks the Repo to re-read.
    open.value = true;
    pulled.change((d) => { d.slot = "#/b"; });
    // THE MEASURED STOP: one crossing, then nothing — A's cached verdict never read the allow back.
    expect(await serverSees(A, book.url, "#/b", 2_000), "a stale verdict carries nothing back").toBe(false);
  }, 30_000);

  test("CURE — the same flip WITH shareConfigChanged carries the puller's change to the server", async () => {
    const open: Verdict = { value: true };
    const { A, B } = await ford(open);
    const book = A.create<Doc>({ text: "salt: 12 · barley: 40" });
    const pulled = await B.find<Doc>(book.url);
    await deny(A, B, open, book.documentId);
    await allow(A, open, book.documentId);               // ← the refold reverdict, the whole cure
    pulled.change((d) => { d.slot = "#/b"; });
    expect(await serverSees(A, book.url, "#/b")).toBe(true);
  }, 30_000);

  test("CONTROL — a doc the verdict denies from the start never crosses at all", async () => {
    const open: Verdict = { value: false };
    const { A, B } = await ford(open);
    const book = A.create<Doc>({ text: "the count" });
    expect(await settle(B.find<Doc>(book.url).then((h) => h.doc()), 3_000)).not.toBe("ready");
  }, 30_000);

  test("CONTROL — a doc denied AFTER it crossed stops syncing (the RED is a stale verdict, not a dead wire)", async () => {
    const open: Verdict = { value: true };
    const { A, B } = await ford(open);
    const book = A.create<Doc>({ text: "the count" });
    const pulled = await B.find<Doc>(book.url);
    await deny(A, B, open, book.documentId);
    pulled.change((d) => { d.slot = "#/denied"; });
    expect(await serverSees(A, book.url, "#/denied", 2_000)).toBe(false);
  }, 30_000);
});
