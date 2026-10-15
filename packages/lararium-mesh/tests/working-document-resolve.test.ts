/**
 * working-document-resolve — a wiki's working slot mounts the NAMED document or refuses by name.
 *
 * Driven over real Repos. A document that arrives late over a network adapter still mounts at its named
 * url; a document no peer holds refuses with WorkingDocumentUnavailableRefusal, and no other document is
 * created in its place.
 */
import { describe, expect, test } from "vitest";
import { MessageChannel } from "node:worker_threads";
import { Repo, parseAutomergeUrl } from "@automerge/automerge-repo";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";
import { CompositeStore } from "../src/composite-store.js";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";
import { mountWikiSlot } from "../src/open-vessel-core.js";
import { DocumentUnavailableRefusal, findOrThrow, WorkingDocumentUnavailableRefusal } from "../src/find-or-throw.js";
import { wikiBagUri, wikiSlotUri } from "../src/wiki-recipe.js";
import { MemoryTiddlerStore } from "../../lararium-tw5/src/memory-store.js";

const catalogIds = new WeakMap<Repo, string>();
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function keelOver(repo: Repo) {
  const catalogHandle = repo.create<LarDoc>(emptyLarDoc());
  catalogIds.set(repo, parseAutomergeUrl(catalogHandle.url).documentId as string);
  return {
    repo,
    catalogHandle,
    waitHandle: async <T>(url: string) => repo.find(url as never) as unknown as Promise<T>,
    tempStore: () => new MemoryTiddlerStore(),
  } as never;
}

describe("a working slot resolves its named document", () => {
  test("a document that arrives late over a network still mounts at its named url, and mints no substitute", async () => {
    const holder = new Repo({ network: [] });
    const working = holder.create<LarDoc>(emptyLarDoc());
    working.change((doc) => { doc.tiddlers["lar:///late/seed"] = { tiddler: { title: "lar:///late/seed", text: "from the holder" } } as never; });
    const { port1, port2 } = new MessageChannel();
    // The holder's replies cross a slow link: the document arrives after the mount has begun waiting.
    class SlowAdapter extends MessageChannelNetworkAdapter {
      override send(message: Parameters<MessageChannelNetworkAdapter["send"]>[0]): void { setTimeout(() => super.send(message), 400); }
    }
    holder.networkSubsystem.addNetworkAdapter(new SlowAdapter(port2 as never));
    const mounter = new Repo({ network: [new MessageChannelNetworkAdapter(port1 as never)] });
    const wiki = mounter.create<LarDoc>(emptyLarDoc());
    const draft = mounter.create<LarDoc>(emptyLarDoc());
    const composite = new CompositeStore();
    const named = new Set([working.url, wiki.url, draft.url].map((url) => parseAutomergeUrl(url).documentId as string));
    const mounting = mountWikiSlot(
      keelOver(mounter), composite,
      { wikiSlug: "late", wikiKey: wiki.url, wikiBagId: wikiBagUri("late"), draftBagId: wikiSlotUri("late", "draft") },
      async () => draft.url, async () => working.url, wiki,
    );
    await pause(100);
    expect(composite.hasBag(wikiSlotUri("late", "working")), "the slot mounted before its document arrived").toBe(false);
    await mounting;
    const store = composite.storeForBag(wikiSlotUri("late", "working"));
    expect((await store!.get("lar:///late/seed"))?.tiddler.text).toBe("from the holder");
    const strangers = Object.keys(mounter.handles).filter((id) => !named.has(id) && id !== (catalogIds.get(mounter)));
    expect(strangers, "a document beyond the named ones stands").toEqual([]);
    await mounter.shutdown(); await holder.shutdown();
  }, 30_000);

  test("a document no peer holds refuses by name and creates no document", async () => {
    const origin = new Repo({ network: [] });
    const missing = origin.create<LarDoc>(emptyLarDoc()).url;
    const lone = new Repo({ network: [] });
    const wiki = lone.create<LarDoc>(emptyLarDoc());
    const draft = lone.create<LarDoc>(emptyLarDoc());
    const composite = new CompositeStore();
    const handlesBefore = new Set(Object.keys(lone.handles));
    await expect(mountWikiSlot(
      keelOver(lone), composite,
      { wikiSlug: "gone", wikiKey: wiki.url, wikiBagId: wikiBagUri("gone"), draftBagId: wikiSlotUri("gone", "draft") },
      async () => draft.url, async () => missing, wiki,
    )).rejects.toBeInstanceOf(WorkingDocumentUnavailableRefusal);
    expect(composite.hasBag(wikiSlotUri("gone", "working"))).toBe(false);
    const created = Object.keys(lone.handles).filter((id) => !handlesBefore.has(id));
    // The only handle beyond the booted ones is the one the resolve asked for; no blank document stands.
    expect(created.filter((id) => id !== parseAutomergeUrl(missing).documentId && id !== catalogIds.get(lone))).toEqual([]);
    await lone.shutdown(); await origin.shutdown();
  }, 30_000);

  test("a peer that stays silent cannot hang the resolve: the bound elapses and the document refuses by name", async () => {
    const silent = { find: () => new Promise<never>(() => {}) } as unknown as Repo;
    const refusal = await findOrThrow(silent, "automerge:silent", "a silent document", { timeoutMs: 30 }).catch((e: unknown) => e);
    expect(refusal).toBeInstanceOf(DocumentUnavailableRefusal);
    expect((refusal as DocumentUnavailableRefusal).waitedMs).toBe(30);
  });
});
