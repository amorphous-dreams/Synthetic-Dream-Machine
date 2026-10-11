/**
 * born-with-cap — CREATE registers a new bag's Keyhive Document under the lar:
 * BAG URL, the key the cap-gate's verify() (and boot-registration) share.
 *
 * The friction this pins: the cap-gate keys bag→doc on the lar: bag URL, but the
 * mint hands back an automerge CONTENT-doc url — a different object. Register the
 * new bag under the doc url and every follow-up write cap-denies ("bag not
 * registered") until a restart re-registers it by lar: URL. So `registerBag`
 * MUST receive `action.bag`, never `handle.url`.
 *
 * Meme: lar:///ha.ka.ba/lararium/api/residency-model
 */

import { describe, test, expect } from "vitest";
import { CompositeStore, emptyLarDoc } from "@lararium/mesh";
import type { Repo, DocHandle, LarDoc, Verb } from "@lararium/mesh";
import { makeActionReactorFor } from "../src/action-handler.js";
import type { VerbContext } from "../src/verb-dispatcher.js";

const CATALOG_URL = "automerge:catalog-doc";

/** Minimal Automerge Repo — a url→handle map. `create` mints a CONTENT doc under a
 *  recognizable `automerge:MINTED-*` url; `find` resolves the map. Enough for the
 *  real makeCatalogAccessor + AutomergeDocStore (doc/on/change) the reactor drives. */
function makeFakeRepo(): { repo: Repo; mintedUrls: string[] } {
  const docs = new Map<string, DocHandle<LarDoc>>();
  const mintedUrls: string[] = [];
  let counter = 0;
  const mkHandle = (url: string, doc: LarDoc): DocHandle<LarDoc> =>
    ({
      url,
      doc: () => doc,
      on: () => {},
      whenReady: async () => {},
      change: (fn: (d: LarDoc) => void) => fn(doc),
    } as unknown as DocHandle<LarDoc>);

  docs.set(CATALOG_URL, mkHandle(CATALOG_URL, { tiddlers: {} } as unknown as LarDoc));

  const repo = {
    create: (doc?: LarDoc) => {
      const url = `automerge:MINTED-${++counter}`;
      mintedUrls.push(url);
      const h = mkHandle(url, (doc ?? { tiddlers: {} }) as LarDoc);
      docs.set(url, h);
      return h;
    },
    find: async (url: string) => {
      const h = docs.get(url);
      if (!h) throw new Error(`fake-repo: no doc ${url}`);
      return h;
    },
  } as unknown as Repo;

  return { repo, mintedUrls };
}

function makeContext(): VerbContext {
  const invocation = { action: "CREATE", args: {}, requestId: "req-born-1", requestedBy: "did:key:test" } as unknown as Verb;
  return {
    daemon: new CompositeStore(),
    invocation,
    cap: async () => ({ ok: true }),
  };
}

describe("CREATE — born with its cap", () => {
  test("registers the new bag under the lar: BAG URL, never the minted doc url", async () => {
    const { repo, mintedUrls } = makeFakeRepo();
    const registered: string[] = [];
    const reactor = makeActionReactorFor("CREATE", {
      composite: new CompositeStore(),
      reach: { repo, catalogUrl: CATALOG_URL, oracleUrl: null },
      registerBag: async (bagUrl) => { registered.push(bagUrl); },
    });

    const bag = "lar:///ha.ka.ba/bags/newbag";
    const result = await reactor({ bag }, makeContext());

    expect(result.plane).toBe("catalog");
    // registerBag keyed on the lar: bag URL — the cap-gate's verify() key.
    expect(registered).toEqual([bag]);
    // NEVER the automerge content-doc url (the shipped regression).
    expect(mintedUrls.length).toBe(1);
    expect(registered[0]).not.toBe(mintedUrls[0]);
    expect(registered[0]!.startsWith("automerge:")).toBe(false);
  });

  test("a mint with no registerBag hook still writes the catalog entry (no-reach/test)", async () => {
    const { repo } = makeFakeRepo();
    const reactor = makeActionReactorFor("CREATE", {
      composite: new CompositeStore(),
      reach: { repo, catalogUrl: CATALOG_URL, oracleUrl: null },
      // registerBag absent — the mint proceeds, cap registration simply no-ops.
    });
    const result = await reactor({ bag: "lar:///ha.ka.ba/bags/nocap" }, makeContext());
    expect(result.plane).toBe("catalog");
    expect(typeof result.docUrl).toBe("string");
  });
});

describe("CREATE — declarative idempotency (bag state, never a request key)", () => {
  test("re-CREATE the same bag answers success with the SAME doc — never a double-mint", async () => {
    const { repo, mintedUrls } = makeFakeRepo();
    const registered: string[] = [];
    const reactor = makeActionReactorFor("CREATE", {
      composite: new CompositeStore(),
      reach: { repo, catalogUrl: CATALOG_URL, oracleUrl: null },
      registerBag: async (bagUrl) => { registered.push(bagUrl); },
    });

    const bag = "lar:///ha.ka.ba/bags/re-create-me";
    const first = await reactor({ bag }, makeContext());
    expect(first.alreadyStood).toBeUndefined();
    expect(mintedUrls.length).toBe(1);

    const second = await reactor({ bag }, makeContext());
    // Same doc, flagged alreadyStood — never a second mint, never a second register.
    expect(second.docUrl).toBe(first.docUrl);
    expect(second.alreadyStood).toBe(true);
    expect(second.bag).toBe(bag);
    expect(second.plane).toBe(first.plane);
    expect(mintedUrls.length).toBe(1);
    expect(registered).toEqual([bag]);

    // A third re-CREATE lands the identical answer — idempotency follows the
    // bag's STATE (registered or not), never a per-request change-id.
    const third = await reactor({ bag }, makeContext());
    expect(third.docUrl).toBe(first.docUrl);
    expect(third.alreadyStood).toBe(true);
    expect(mintedUrls.length).toBe(1);
  });

  test("CREATE → DROP (absent again) → CREATE mints a FRESH doc", async () => {
    const { repo, mintedUrls } = makeFakeRepo();
    const opts = {
      composite: new CompositeStore(),
      reach: { repo, catalogUrl: CATALOG_URL, oracleUrl: null },
    };
    const createReactor = makeActionReactorFor("CREATE", opts);
    const dropReactor = makeActionReactorFor("DROP", opts);

    const bag = "lar:///ha.ka.ba/bags/create-drop-create";
    const first = await createReactor({ bag }, makeContext());
    expect(first.alreadyStood).toBeUndefined();
    expect(mintedUrls.length).toBe(1);

    // Run the REAL DROP — never a hand-deleted registry row. DROP tombstones
    // the (empty) bag's contents and writes the `bag-retired` disposition
    // effect-record into the bag's OWN doc; the catalog registry row is left
    // standing, still pointing at the now-retired doc.
    const dropInvocation = { action: "DROP", args: {}, requestId: "req-drop-1", requestedBy: "did:key:test" } as unknown as Verb;
    await dropReactor({ bag }, { daemon: new CompositeStore(), invocation: dropInvocation, cap: async () => ({ ok: true }) });

    // CREATE reads the RETIRED doc as absent: a FRESH mint, re-pointing the
    // SAME registry row — never a double-mint, never a second row, never
    // `alreadyStood`.
    const second = await createReactor({ bag }, makeContext());
    expect(second.alreadyStood).toBeUndefined();
    expect(second.docUrl).not.toBe(first.docUrl);
    expect(mintedUrls.length).toBe(2);

    // The registry row now names the FRESH doc — a third CREATE answers
    // alreadyStood against the NEW doc, never the retired one.
    const third = await createReactor({ bag }, makeContext());
    expect(third.alreadyStood).toBe(true);
    expect(third.docUrl).toBe(second.docUrl);
    expect(mintedUrls.length).toBe(2);
  });
});
