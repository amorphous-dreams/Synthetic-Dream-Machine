/**
 * working-mount-island-stood — THE STOOD WORKING DOCUMENT CROSSES WITH ITS NAME, SO THE HOST MOUNTS WHAT ITS ISLAND STOOD.
 *
 * A browser vessel's lares wiki mounts through two repos: the island (the daemon worker) answers the binding, and the host
 * (the vessel worker) lays the layers (`mountWikiSlot`). Under a face the working slot reads the wiki's realm workbench at a
 * DERIVED address, and the island stands it through `materializeSharedLarDoc`, which first asks every peer, the host among them.
 * The host holds nothing yet, answers `unavailable`, and keeps that verdict; the island's push of the stood board travels one
 * port, its binding answer another. When the answer landed first, the host's find met its own verdict and the boot died
 * `[document-unavailable] lar:///ha.ka.ba/wikis/lares/working (working layer)` (held-out browser-weld W1: card, bind-first).
 *
 * The ordering now rides the answer itself, never a clock: the island's answer carries the stood document's bytes beside its
 * name (`workingDoc`, `stoodDocumentBytes`), and the host lands them at that url (`landBindingDocuments`, the same call the
 * vessel core makes when the answer settles) before the mount reads it.
 *
 *   M0  MEASURE: the name alone, the push still in flight: the host's mount refuses `document-unavailable` (the weld's red).
 *   R1  RED: the answer carries the stood bytes; the host lands them and mounts the workbench as its working layer, the
 *       default writable, holding what the island stood.
 *   C1  CONTROL: the faceless floor names no working document and carries none; the host mounts with no default writable.
 *   C2  CONTROL: a landing over a copy that already synced merges, never forks: the document keeps one history.
 *
 * Canon: lar:///ha.ka.ba/lares/docs/pono/cabal-realm#/the-workbench
 */
import { afterEach, describe, expect, test } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";
import * as A from "@automerge/automerge";
import {
  CompositeStore, emptyLarDoc, landBindingDocuments, materializeSharedLarDoc, mkDaemonResolveBindingResult, mountWikiSlot,
  privateCabalRealmId, realmWorkbenchDocUrl, stoodDocumentBytes, wikiBagUri, wikiSlotUri, type LarDoc,
} from "@lararium/mesh";
import { MemoryTiddlerStore } from "@lararium/tw5";

const leaving: Array<() => Promise<void> | void> = [];
afterEach(async () => { while (leaving.length) await leaving.pop()!(); });

/** The vessel's two repos, the host and its island, joined by one port as the browser joins them; each shares with the other. */
async function vesselPair(): Promise<{ host: Repo; island: Repo }> {
  const { port1, port2 } = new MessageChannel();
  const host = new Repo({ network: [new MessageChannelNetworkAdapter(port1)], peerId: "host" as never, sharePolicy: async () => true });
  const island = new Repo({ network: [new MessageChannelNetworkAdapter(port2)], peerId: "island" as never, sharePolicy: async () => true });
  leaving.push(() => { port1.close(); port2.close(); });
  await new Promise<void>((resolve) => {
    const seen = () => { if (host.peers.length > 0 && island.peers.length > 0) resolve(); else setTimeout(seen, 5); };
    seen();
  });
  return { host, island };
}

/** The island's answer under a face: stand the lares workbench (asking the host first), mark it, and name it. */
async function islandAnswer(island: Repo, carry: boolean) {
  const url = realmWorkbenchDocUrl(privateCabalRealmId("ab".repeat(16), "lares"), "lares");
  const stood = await materializeSharedLarDoc(island, url, "board:workbench");
  stood.change((doc) => { doc.tiddlers["lar:///weld/stood"] = { tiddler: { title: "lar:///weld/stood", text: "the island stood it" } } as never; });
  const draft = island.create<LarDoc>(emptyLarDoc());
  return mkDaemonResolveBindingResult({
    requestId: "r1", personalUrl: draft.url, draftUrl: draft.url, workingUrl: url,
    ...(carry ? { workingDoc: stoodDocumentBytes(stood) } : {}),
  });
}

/** The host's mount of the lares wiki over a settled answer, as the vessel core settles it (`landBindingDocuments` first). */
async function hostMount(host: Repo, answer: ReturnType<typeof mkDaemonResolveBindingResult>): Promise<CompositeStore> {
  landBindingDocuments(host, answer);
  const wikiHandle = host.create<LarDoc>(emptyLarDoc());
  const draftHandle = host.create<LarDoc>(emptyLarDoc());
  const composite = new CompositeStore();
  const keel = {
    repo: host,
    catalogHandle: host.create<LarDoc>(emptyLarDoc()),
    waitHandle: async () => draftHandle,
    tempStore: () => new MemoryTiddlerStore(),
  } as never;
  await mountWikiSlot(keel, composite,
    { wikiSlug: "lares", wikiKey: wikiHandle.url, wikiBagId: wikiBagUri("lares"), draftBagId: wikiSlotUri("lares", "draft") },
    async () => draftHandle.url, async () => answer.workingUrl ?? null, wikiHandle);
  return composite;
}

describe("the stood working document crosses with its name", () => {
  test("M0 MEASURE: the name alone, its push still in flight, refuses document-unavailable", async () => {
    const { host, island } = await vesselPair();
    await expect(hostMount(host, await islandAnswer(island, false))).rejects.toMatchObject({ name: "WorkingDocumentUnavailableRefusal" });
  }, 30_000);

  test("R1 RED: the answer carries the stood bytes; the host lands them and mounts the workbench as its working layer", async () => {
    const { host, island } = await vesselPair();
    const composite = await hostMount(host, await islandAnswer(island, true));
    const working = wikiSlotUri("lares", "working");
    expect(composite.defaultWritableBagId()).toBe(working);
    expect((await composite.storeForBag(working)!.get("lar:///weld/stood"))?.tiddler.text).toBe("the island stood it");
  }, 30_000);

  test("C1 CONTROL: the faceless floor names and carries no working document, and mounts with no default writable", async () => {
    const { host, island } = await vesselPair();
    const draft = island.create<LarDoc>(emptyLarDoc());
    const answer = mkDaemonResolveBindingResult({ requestId: "r0", personalUrl: draft.url, draftUrl: draft.url });
    expect(answer.workingDoc).toBeUndefined();
    const composite = await hostMount(host, answer);
    expect(composite.hasBag(wikiSlotUri("lares", "working"))).toBe(false);
    expect(composite.defaultWritableBagId()).toBeNull();
  }, 30_000);

  test("C2 CONTROL: a landing over a copy that already synced merges, never forks", async () => {
    const { host, island } = await vesselPair();
    const answer = await islandAnswer(island, true);
    const first = await hostMount(host, answer);
    expect(first.defaultWritableBagId()).toBe(wikiSlotUri("lares", "working"));
    landBindingDocuments(host, answer);
    const held = await host.find<LarDoc>(answer.workingUrl as never);
    const islandHeads = A.getHeads((await island.find<LarDoc>(answer.workingUrl as never)).doc()!);
    expect(A.getHeads(held.doc()!)).toEqual(islandHeads);
  }, 30_000);
});
