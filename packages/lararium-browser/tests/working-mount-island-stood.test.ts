/**
 * working-mount-island-stood — THE HOST MOUNTS THE WORKING DOCUMENT ITS OWN ISLAND STOOD, WHATEVER ARRIVES FIRST.
 *
 * A browser vessel's lares wiki mounts through two repos: the island (the daemon worker) answers the binding, and the host
 * (the vessel worker) lays the layers (`mountWikiSlot`). Under a face the working slot reads the wiki's realm workbench at a
 * DERIVED address, and the island stands it through `materializeSharedLarDoc`, which first asks every peer, the host among them.
 * The host holds nothing yet, so it answers unavailable and remembers that answer. The island then imports the blank board and
 * pushes it to the host, but the binding reply travels another port: when the reply wins, the host's find met its own cached
 * `unavailable` and the boot died `[document-unavailable] lar:///ha.ka.ba/wikis/lares/working (working layer)` (held-out
 * browser-weld W1, the pure local boot: card, bind-first). The document stood; the host refused it only for arriving second.
 *
 *   R1  RED: the island stands the face's workbench (asking the host first), names it at once, and the host mounts it as the
 *       working layer, the default writable, with no refusal.
 *   C1  CONTROL: the faceless floor names no working document, and the host mounts the wiki with no working layer and no
 *       default writable (the faceless floor's own boot, `no-face`).
 *   C2  CONTROL: an address nobody stood and nobody asked about refuses by name at once, as before.
 *   C3  CONTROL: an address the island asked about but never stood refuses by name at the bound; the wait never becomes a
 *       blank document.
 *
 * Canon: lar:///ha.ka.ba/lares/docs/pono/cabal-realm#/the-workbench
 */
import { afterEach, describe, expect, test } from "vitest";
import { Repo, generateAutomergeUrl } from "@automerge/automerge-repo";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";
import {
  CompositeStore, emptyLarDoc, findOrThrow, materializeSharedLarDoc, mountWikiSlot, privateCabalRealmId, realmWorkbenchDocUrl,
  wikiBagUri, wikiSlotUri, WorkingDocumentUnavailableRefusal, type LarDoc,
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

/** The host's mount of the lares wiki, over the island's binding answer. */
async function hostMount(host: Repo, island: Repo, working: () => Promise<string | null>): Promise<CompositeStore> {
  const wikiHandle = host.create<LarDoc>(emptyLarDoc());
  const draft = island.create<LarDoc>(emptyLarDoc());
  await island.flush([draft.documentId]);
  const composite = new CompositeStore();
  const keel = {
    repo: host,
    catalogHandle: host.create<LarDoc>(emptyLarDoc()),
    waitHandle: async <T>(url: string) => host.find(url as never) as unknown as Promise<T>,
    tempStore: () => new MemoryTiddlerStore(),
  } as never;
  await mountWikiSlot(keel, composite,
    { wikiSlug: "lares", wikiKey: wikiHandle.url, wikiBagId: wikiBagUri("lares"), draftBagId: wikiSlotUri("lares", "draft") },
    async () => draft.url, working, wikiHandle);
  return composite;
}

describe("the host mounts the working document its own island stood", () => {
  test("R1 RED: the face's workbench, stood by the island after it asked the host, mounts as the working layer", async () => {
    const { host, island } = await vesselPair();
    const face = "ab".repeat(16);
    const url = realmWorkbenchDocUrl(privateCabalRealmId(face, "lares"), "lares");
    // The island's binding answer, as the slot resolver gives it: stand the workbench, then name it at once.
    const composite = await hostMount(host, island, async () => (await materializeSharedLarDoc(island, url, "board:workbench")).url);
    expect(composite.defaultWritableBagId()).toBe(wikiSlotUri("lares", "working"));
  }, 30_000);

  test("C1 CONTROL: the faceless floor names no working document and mounts with no default writable", async () => {
    const { host, island } = await vesselPair();
    const composite = await hostMount(host, island, async () => null);
    expect(composite.hasBag(wikiSlotUri("lares", "working"))).toBe(false);
    expect(composite.defaultWritableBagId()).toBeNull();
  }, 30_000);

  test("C2 CONTROL: an address nobody stood and nobody asked about refuses by name at once", async () => {
    const { host } = await vesselPair();
    const nobody = generateAutomergeUrl();
    await expect(findOrThrow(host, nobody, `${wikiSlotUri("lares", "working")} (working layer)`, {
      refusal: WorkingDocumentUnavailableRefusal, timeoutMs: 400, islandNamed: true,
    })).rejects.toMatchObject({ name: "WorkingDocumentUnavailableRefusal", waitedMs: null });
  }, 30_000);

  test("C3 CONTROL: an address the island asked about but never stood refuses by name at the bound", async () => {
    const { host, island } = await vesselPair();
    const nobody = generateAutomergeUrl();
    // The island asks; the host answers unavailable and keeps that answer; nothing is ever stood.
    await new Promise<void>((resolve) => {
      const progress = island.findWithProgress(nobody);
      const unsub = progress.subscribe((s) => { if (s.state === "unavailable") { unsub(); resolve(); } });
    });
    await expect(findOrThrow(host, nobody, `${wikiSlotUri("lares", "working")} (working layer)`, {
      refusal: WorkingDocumentUnavailableRefusal, timeoutMs: 400, islandNamed: true,
    })).rejects.toMatchObject({ name: "WorkingDocumentUnavailableRefusal", waitedMs: 400 });
  }, 30_000);
});
