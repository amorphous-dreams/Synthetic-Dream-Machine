/**
 * wiki-island-custody-rest — A WIKI ISLAND RENDERS PAGES AND NEVER HOLDS A CUSTODY DOCUMENT, AT REST OR IN SYNC (the node's
 * island rest guard, every island store; the controller's ruling by canon and story).
 *
 *   W1  RED: the share verdict refuses a vessel-only document (the secret home, the control document and what it names) to a
 *       wiki island; CONTROL: the daemon island still syncs it, a relay peer never does, and a page document still reaches
 *       the wiki island.
 *   W2  a wiki island stands no store of its own, so no byte of any document rests in an island partition; CONTROL: the
 *       daemon island's own store rests no byte of a document the vessel holds sealed, and a page document rests there.
 *   W4  the pool marks every island it attaches (bare leg and session view) a wiki island serving its mount, and the browser and node verdicts
 *       read that mark.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/owed (V2)
 */
import { describe, expect, test } from "vitest";
import { generateAutomergeUrl, parseAutomergeUrl } from "@automerge/automerge-repo";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import { browserShareConfig } from "../src/open-browser-vessel.js";
import { browserIslandStorage } from "../src/browser-sovereign-island-model.js";

const SOURCES = import.meta.glob(["../../lararium-mesh/src/vessel-island-pool-core.ts", "../src/open-browser-vessel.ts", "../../lararium-node/src/open-node-vessel.ts"], { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const strip = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const docId = (): string => parseAutomergeUrl(generateAutomergeUrl()).documentId;

describe("a wiki island holds no custody document", () => {
  test("W1 — RED: the share verdict refuses a vessel-only document to a wiki island; CONTROL: the daemon island takes it, a page reaches the wiki", async () => {
    const secret = docId(), page = docId();
    const config = browserShareConfig(new Set(["relay"]), () => null, null,
      { has: (id) => id === secret }, { has: (p) => p === "daemon" || p === "wiki" }, { has: (p) => p === "wiki" });
    for (const hook of [config.announce, config.access]) {
      expect(await hook("wiki" as never, secret as never), "a wiki island never receives the secret home").toBe(false);
      expect(await hook("daemon" as never, secret as never), "CONTROL: the daemon island syncs it").toBe(true);
      expect(await hook("relay" as never, secret as never), "CONTROL: a relay peer never does").toBe(false);
      expect(await hook("wiki" as never, page as never), "CONTROL: a page document still reaches the wiki island").toBe(true);
    }
  });

  test("W2 — a wiki island stands no store; CONTROL: the daemon island's store rests no byte of a sealed document, and a page rests", async () => {
    const sealed = docId(), page = docId();
    expect(browserIslandStorage({ wikiUri: "lar:///ha.ka.ba/wikis/notes" } as never, async () => false), "a wiki island stands no store").toBeUndefined();
    const dbName = `daemon-island-rest-${crypto.randomUUID()}`;
    const store = browserIslandStorage({ wikiUri: "lar:///ha.ka.ba/bags/daemon", storage: { type: "idb", dbName } } as never, async (id) => id === sealed);
    if (!store) throw new Error("the daemon island stands no store of its own");
    const bytes = new Uint8Array([0x85, 0x6f, 0x4a, 0x83, 1, 2, 3]);
    await store.save([sealed, "incremental", "a"], bytes);
    await store.save([page, "incremental", "a"], bytes);
    const raw = new IndexedDBStorageAdapter(dbName);
    expect(await raw.loadRange([sealed]), "no byte of the sealed document rests in the daemon island's store").toEqual([]);
    expect((await raw.loadRange([page])).length, "CONTROL: the page document rests").toBe(1);
  });

  test("W4 — the pool marks every island it attaches a wiki island, and both vessels' verdicts read the mark", () => {
    const pool = strip(SOURCES["../../lararium-mesh/src/vessel-island-pool-core.ts"] ?? "");
    expect(pool).toMatch(/markWikiIslandPeer\(repo, view\.peerId, mount\)/);
    expect(pool).toMatch(/attachMessageChannelSync\(repo, mainPort, \(peerId\) => \{ markWikiIslandPeer\(repo, peerId, mount\);/);
    const browser = strip(SOURCES["../src/open-browser-vessel.ts"] ?? "");
    expect(browser).toMatch(/wikiIslands = wikiIslandPeersOf\(repo\)/);
    expect(browser).toMatch(/restsSealed: \(documentId\) => sealedRest\.restsSealed\(documentId\)/);
    const node = SOURCES["../../lararium-node/src/open-node-vessel.ts"] ?? "";
    // A wiki island receives no custody document; the one vessel-held class it mounts stands as the veil floor's own wiki slot.
    expect(node).toMatch(/houseIslands\.has\(p\) && \(!wikiIslands\.has\(p\) \|\| \(documentId !== undefined && deviceDocs\.floorWiki\(documentId\)\)\)/);
  });
});
