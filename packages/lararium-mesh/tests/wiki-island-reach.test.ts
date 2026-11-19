/**
 * wiki-island-reach — A WIKI ISLAND RECEIVES THE DOCUMENTS ITS OWN MOUNT NAMES, NEVER ANOTHER WIKI'S OR A FACE'S PRIVATE ONES.
 *
 * The vessel's in-process islands share as house members. A wiki island renders one wiki, and its own store rests what it
 * receives, so a document it never mounts (another wiki's personal margin or draft, the daemon document whose binding rows
 * name every face's margins, a face plane carrying that face's registrations) has no business reaching it. The pool marks
 * each wiki island's peer with the mount it serves (`markWikiIslandPeer`), and the vessel's verdict withholds every
 * document the vessel files under a bag that mount does not name (`wikiIslandWithholds`). A document the vessel files under
 * no bag (the engine, the catalog, the oracle) still reaches it as before.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/owed
 */
import { afterEach, describe, expect, it } from "vitest";
import { Repo, type AutomergeUrl, type PeerId } from "@automerge/automerge-repo";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";
import { attachMessageChannelSync, markWikiIslandPeer, wikiIslandPeersOf } from "../src/island-repo.js";
import { shareConfigOf } from "../src/federation-gate.js";
import { vesselDocBags, wikiIslandWithholds } from "../src/wiki-island-reach.js";
import { expandRecipe, wikiBagUri, wikiSlotUri } from "../src/wiki-recipe.js";
import { DAEMON_BAG_ID } from "../src/lar-uris.js";
import { personaScopedBagIds } from "../src/persona-scope.js";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";
import { storedLarRecord } from "../src/stored-record.js";

const ports: MessagePort[] = [];
const repos: Repo[] = [];
afterEach(async () => {
  while (ports.length) ports.pop()!.close();
  while (repos.length) await repos.pop()!.shutdown().catch(() => undefined);
});

const reaches = async (repo: Repo, url: string): Promise<boolean> => {
  const found = repo.find(url as AutomergeUrl).then(() => true, () => false);
  const bound = new Promise<boolean>((done) => setTimeout(() => done(false), 1500));
  return Promise.race([found, bound]);
};

describe("a wiki island receives what its own mount names", () => {
  it("the island serving `lares` reaches its own margin and its library, and never notes' margin, the daemon document or a face plane", async () => {
    const vesselSide = new MessageChannel();
    ports.push(vesselSide.port1, vesselSide.port2);
    const recipe = { wikiSlug: "lares", libraryBags: [wikiBagUri("library-garden")] } as never;
    const mount = { slug: "lares", bags: expandRecipe(recipe) };
    // The vessel's files: each document by the bag it stands under (the resolver's names, the catalog's rows).
    const slotDocs = new Map<string, Set<string>>();
    let catalog: LarDoc = emptyLarDoc();
    let repo!: Repo;
    const bagOf = (documentId: string) => vesselDocBags({ slotDocs, catalog: () => catalog })(documentId);
    repo = new Repo({
      network: [],
      peerId: "vessel" as PeerId,
      shareConfig: shareConfigOf(async (peerId, documentId) => {
        const island = wikiIslandPeersOf(repo).mountOf(peerId);
        if (island && documentId !== undefined && wikiIslandWithholds(island, bagOf(String(documentId)))) return false;
        return true;
      }),
    });
    repos.push(repo);
    attachMessageChannelSync(repo, vesselSide.port1, (peerId) => { markWikiIslandPeer(repo, peerId, mount); });
    const island = new Repo({ network: [new MessageChannelNetworkAdapter(vesselSide.port2)], peerId: "island-lares" as PeerId });
    repos.push(island);

    const doc = (note: string) => { const h = repo.create<{ note: string }>({ note }); return h; };
    const ownMargin = doc("lares margin"), notesMargin = doc("notes margin"), notesDraft = doc("notes draft");
    const daemon = doc("binding rows"), plane = doc("face registrations"), library = doc("garden library"), engine = doc("engine bytes");
    const file = (bagId: string, documentId: string) => { const s = slotDocs.get(bagId) ?? new Set<string>(); s.add(documentId); slotDocs.set(bagId, s); };
    file(wikiSlotUri("lares", "personal"), ownMargin.documentId);
    file(wikiSlotUri("notes", "personal"), notesMargin.documentId);
    file(wikiSlotUri("notes", "draft"), notesDraft.documentId);
    const planeBag = personaScopedBagIds("a".repeat(64)).persona;
    const rows = emptyLarDoc();
    rows.tiddlers[DAEMON_BAG_ID] = storedLarRecord(DAEMON_BAG_ID, { text: daemon.url }, "test");
    rows.tiddlers[planeBag] = storedLarRecord(planeBag, { text: plane.url }, "test");
    rows.tiddlers[wikiBagUri("library-garden")] = storedLarRecord(wikiBagUri("library-garden"), { text: library.url }, "test");
    catalog = rows;

    expect(await reaches(island, ownMargin.url), "its own margin").toBe(true);
    expect(await reaches(island, library.url), "a library its recipe names").toBe(true);
    expect(await reaches(island, engine.url), "a document the vessel files under no bag").toBe(true);
    expect(await reaches(island, notesMargin.url), "another wiki's margin").toBe(false);
    expect(await reaches(island, notesDraft.url), "another wiki's draft").toBe(false);
    expect(await reaches(island, daemon.url), "the daemon document").toBe(false);
    expect(await reaches(island, plane.url), "a face plane").toBe(false);
  });

  it("CONTROL: an island the pool did not mark as a wiki island (the daemon island) reaches every document", async () => {
    const mount = { slug: "lares", bags: expandRecipe({ wikiSlug: "lares" } as never) };
    expect(wikiIslandWithholds(mount, null)).toBe(false);
    expect(wikiIslandWithholds(mount, wikiSlotUri("lares", "draft"))).toBe(false);
    expect(wikiIslandWithholds(mount, wikiSlotUri("notes", "working"))).toBe(true);
    expect(wikiIslandWithholds(mount, DAEMON_BAG_ID)).toBe(true);
    const repo = new Repo({ network: [] });
    repos.push(repo);
    expect(wikiIslandPeersOf(repo).mountOf("daemon-island")).toBeNull();
  });
});
