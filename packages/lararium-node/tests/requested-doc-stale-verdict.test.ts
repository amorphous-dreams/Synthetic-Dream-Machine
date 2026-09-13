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

type Doc = { text?: string; slot?: string };

/** Two repos over one channel. A holds the book; B pulls it by id. `open` is the live realm verdict. */
async function ford(open: { value: boolean }) {
  const { port1, port2 } = new MessageChannel();
  const A = new Repo({
    network: [new MessageChannelNetworkAdapter(port1)],
    peerId: "A" as PeerId,
    shareConfig: shareConfigOf(async (_p: PeerId, documentId?: DocumentId) => documentId !== undefined && open.value),
  });
  const B = new Repo({ network: [new MessageChannelNetworkAdapter(port2)], peerId: "B" as PeerId });
  await Promise.all([A.networkSubsystem.whenReady(), B.networkSubsystem.whenReady()]);
  return { A, B };
}

const settle = async (p: Promise<unknown>, ms: number): Promise<"ready" | "unavailable" | "timeout"> =>
  Promise.race([
    p.then(() => "ready" as const, () => "unavailable" as const),
    new Promise<"timeout">((r) => setTimeout(() => r("timeout"), ms)),
  ]);

/** Poll A's own replica for the puller's slot — the only honest read of "did the change cross back". */
async function serverSees(A: Repo, url: string, slot: string, ms = 3_000): Promise<boolean> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const h = await A.find<Doc>(url as never);
    if (h.doc()?.slot === slot) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
}

describe("a book pulled by request keeps syncing only while the verdict is re-read", () => {
  test("THE STOP, PINNED — the verdict flips deny→allow with no re-read and the puller's change never lands", async () => {
    const open = { value: true };
    const { A, B } = await ford(open);
    const book = A.create<Doc>({ text: "salt: 12 · barley: 40" });
    const pulled = await B.find<Doc>(book.url);
    expect(pulled.doc()?.text, "the book crosses ONCE on B's request").toBe("salt: 12 · barley: 40");

    // The fold drops the bag (a proposal replaces the counted record) and A reverdicts.
    open.value = false;
    A.shareConfigChanged();
    await new Promise((r) => setTimeout(r, 200));

    // The co-sign lands and A's realm plane refolds — but nothing asks the Repo to re-read.
    open.value = true;
    pulled.change((d) => { d.slot = "#/b"; });
    // THE MEASURED STOP: one crossing, then nothing — A's cached verdict never read the allow back.
    expect(await serverSees(A, book.url, "#/b", 2_000), "a stale verdict carries nothing back").toBe(false);
  }, 30_000);

  test("CURE — the same flip WITH shareConfigChanged carries the puller's change to the server", async () => {
    const open = { value: true };
    const { A, B } = await ford(open);
    const book = A.create<Doc>({ text: "salt: 12 · barley: 40" });
    const pulled = await B.find<Doc>(book.url);
    open.value = false; A.shareConfigChanged();
    await new Promise((r) => setTimeout(r, 200));
    open.value = true;  A.shareConfigChanged();          // ← the refold reverdict, the whole cure
    await new Promise((r) => setTimeout(r, 200));
    pulled.change((d) => { d.slot = "#/b"; });
    expect(await serverSees(A, book.url, "#/b")).toBe(true);
  }, 30_000);

  test("CONTROL — a doc the verdict denies from the start never crosses at all", async () => {
    const open = { value: false };
    const { A, B } = await ford(open);
    const book = A.create<Doc>({ text: "the count" });
    expect(await settle(B.find<Doc>(book.url).then((h) => h.doc()), 3_000)).not.toBe("ready");
  }, 30_000);

  test("CONTROL — a doc denied AFTER it crossed stops syncing (the RED is a stale verdict, not a dead wire)", async () => {
    const open = { value: true };
    const { A, B } = await ford(open);
    const book = A.create<Doc>({ text: "the count" });
    const pulled = await B.find<Doc>(book.url);
    open.value = false; A.shareConfigChanged();
    await new Promise((r) => setTimeout(r, 200));
    pulled.change((d) => { d.slot = "#/denied"; });
    expect(await serverSees(A, book.url, "#/denied", 2_000)).toBe(false);
  }, 30_000);
});
