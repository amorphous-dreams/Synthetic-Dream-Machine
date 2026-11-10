/**
 * wiki-island-custody-rest — A WIKI ISLAND RENDERS PAGES AND NEVER HOLDS A CUSTODY DOCUMENT, AT REST OR IN SYNC (the node's
 * island rest guard, every island store; the controller's ruling by canon and story).
 *
 *   W1  RED: the share verdict refuses a vessel-only document (the secret home, the control document and what it names) to a
 *       wiki island; CONTROL: the daemon island still syncs it, a relay peer never does, and a page document still reaches
 *       the wiki island.
 *   W2  RED: a wiki island's own store rests no byte of a document the vessel holds sealed or held; CONTROL: a page document
 *       rests there as it did.
 *   W3  the pool answers a wiki island's `rest:ask` from the vessel's sealed rest; a pool with no rest answers unsealed, so
 *       no island waits on silence.
 *   W4  the pool marks every island it attaches (bare leg and session view) a wiki island, and the browser and node verdicts
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

  test("W2 — RED: a wiki island's store rests no byte of a sealed document; CONTROL: a page document rests", async () => {
    const wikiUri = `wiki-island-rest-${crypto.randomUUID()}`;
    const sealed = docId(), page = docId();
    const store = browserIslandStorage({ wikiUri } as never, async (id) => id === sealed);
    if (!store) throw new Error("a wiki island stands a store of its own");
    const bytes = new Uint8Array([0x85, 0x6f, 0x4a, 0x83, 1, 2, 3]);
    await store.save([sealed, "incremental", "a"], bytes);
    await store.save([page, "incremental", "a"], bytes);
    const raw = new IndexedDBStorageAdapter(wikiUri);
    expect(await raw.loadRange([sealed]), "no byte of the sealed document rests in the island's store").toEqual([]);
    expect((await raw.loadRange([page])).length, "CONTROL: the page document rests").toBe(1);
  });

  test("W3 — the pool answers a wiki island's rest ask from the vessel's rest; with none it answers unsealed", async () => {
    const { answerBrowserRestAsks } = await import("../src/browser-vessel-island-pool.js");
    const sealed = docId();
    const ask = async (restsSealed?: (id: string) => Promise<boolean>, documentId = sealed) => {
      const listeners = new Set<(m: unknown) => void>();
      const posted: unknown[] = [];
      const answered = new Promise<unknown>((resolve) => {
        answerBrowserRestAsks({ post: (m: unknown) => { posted.push(m); resolve(m); }, listen: (cb: (m: unknown) => void) => { listeners.add(cb); return () => listeners.delete(cb); } } as never, restsSealed);
      });
      for (const l of listeners) l({ type: "rest:ask", requestId: "r1", documentId });
      return answered;
    };
    expect(await ask(async (id) => id === sealed)).toEqual({ type: "rest:answer", requestId: "r1", sealed: true });
    expect(await ask(async (id) => id === sealed, docId())).toEqual({ type: "rest:answer", requestId: "r1", sealed: false });
    expect(await ask(undefined)).toEqual({ type: "rest:answer", requestId: "r1", sealed: false });
  });

  test("W4 — the pool marks every island it attaches a wiki island, and both vessels' verdicts read the mark", () => {
    const pool = strip(SOURCES["../../lararium-mesh/src/vessel-island-pool-core.ts"] ?? "");
    expect(pool).toMatch(/markWikiIslandPeer\(repo, view\.peerId\)/);
    expect(pool).toMatch(/attachMessageChannelSync\(repo, mainPort, \(peerId\) => \{ markWikiIslandPeer\(repo, peerId\);/);
    const browser = strip(SOURCES["../src/open-browser-vessel.ts"] ?? "");
    expect(browser).toMatch(/wikiIslands = wikiIslandPeersOf\(repo\)/);
    expect(browser).toMatch(/restsSealed: \(documentId\) => sealedRest\.restsSealed\(documentId\)/);
    const node = SOURCES["../../lararium-node/src/open-node-vessel.ts"] ?? "";
    expect(node).toMatch(/houseIslands\.has\(p\) && !wikiIslands\.has\(p\)/);
  });
});
