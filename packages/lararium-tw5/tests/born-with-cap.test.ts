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
import { CompositeStore, emptyLarDoc, AutomergeDocStore, effectRecordUri, isVerbRefusal } from "@lararium/mesh";
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

describe("CREATE — designates only after the cap stands", () => {
  const bag = "lar:///ha.ka.ba/bags/cap-first";
  const registryRow = async (repo: Repo): Promise<unknown> =>
    (await repo.find(CATALOG_URL)).doc()!.tiddlers[bag];

  test("a registerBag that throws leaves no registry row, and the caller reads the cap's own error", async () => {
    const { repo } = makeFakeRepo();
    const reactor = makeActionReactorFor("CREATE", {
      composite: new CompositeStore(),
      reach: { repo, catalogUrl: CATALOG_URL, oracleUrl: null },
      registerBag: async () => { throw new Error("cap-register-refused"); },
    });
    await expect(reactor({ bag }, makeContext())).rejects.toThrow(/cap-register-refused/);
    expect(await registryRow(repo)).toBeUndefined();
  });

  test("a re-run after the refusal mints again and stands one row, not alreadyStood", async () => {
    const { repo } = makeFakeRepo();
    let calls = 0;
    const reactor = makeActionReactorFor("CREATE", {
      composite: new CompositeStore(),
      reach: { repo, catalogUrl: CATALOG_URL, oracleUrl: null },
      registerBag: async () => { if (++calls === 1) throw new Error("cap-register-refused"); },
    });
    await expect(reactor({ bag }, makeContext())).rejects.toThrow(/cap-register-refused/);
    const ok = await reactor({ bag }, makeContext());
    expect(ok.alreadyStood).toBeUndefined();
    expect(await registryRow(repo)).toBeDefined();
  });

  test("registerBag runs before the registry row stands", async () => {
    const { repo } = makeFakeRepo();
    const seen: unknown[] = [];
    const reactor = makeActionReactorFor("CREATE", {
      composite: new CompositeStore(),
      reach: { repo, catalogUrl: CATALOG_URL, oracleUrl: null },
      registerBag: async () => { seen.push(await registryRow(repo)); },
    });
    await reactor({ bag }, makeContext());
    expect(seen).toEqual([undefined]);
    expect(await registryRow(repo)).toBeDefined();
  });

  test("a fresh bag counts zero, live and dry-run", async () => {
    const { repo } = makeFakeRepo();
    const reactor = makeActionReactorFor("CREATE", {
      composite: new CompositeStore(),
      reach: { repo, catalogUrl: CATALOG_URL, oracleUrl: null },
    });
    const dry = await reactor({ bag, "dry-run": true }, makeContext());
    expect(dry.dryRun).toBe(true);
    expect(dry.count).toBe(0);
    expect(await registryRow(repo)).toBeUndefined();
    const live = await reactor({ bag }, makeContext());
    expect(live.count).toBe(0);
  });

  test("a CREATE cap denial is a VerbRefusal named cap-denied", async () => {
    const { repo } = makeFakeRepo();
    const reactor = makeActionReactorFor("CREATE", {
      composite: new CompositeStore(),
      reach: { repo, catalogUrl: CATALOG_URL, oracleUrl: null },
    });
    const ctx = { ...makeContext(), cap: async () => ({ ok: false, reason: "no" }) } as VerbContext;
    const err = await reactor({ bag }, ctx).then(() => null, (e: unknown) => e);
    expect(isVerbRefusal(err)).toBe(true);
    expect((err as { reason: string }).reason).toBe("cap-denied");
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

describe("M13 — a retired bag refuses writes by name and CREATE strands nothing", () => {
  const ctxFor = (action: string, id: string): VerbContext => ({
    daemon: new CompositeStore(),
    invocation: { action, args: {}, requestId: id, requestedBy: "did:key:test" } as unknown as Verb,
    cap: async () => ({ ok: true }),
  });

  async function stage() {
    const { repo, mintedUrls } = makeFakeRepo();
    const opts = { composite: new CompositeStore(), reach: { repo, catalogUrl: CATALOG_URL, oracleUrl: null } };
    const r = (v: "CREATE" | "DROP" | "COPY" | "CLEAR") => makeActionReactorFor(v, opts);
    const src = "lar:///ha.ka.ba/bags/m13-src";
    const dst = "lar:///ha.ka.ba/bags/m13-dst";
    await r("CREATE")({ bag: src }, ctxFor("CREATE", "c1"));
    const first = await r("CREATE")({ bag: dst }, ctxFor("CREATE", "c2"));
    const srcHandle = await repo.find(String((await (await repo.find(CATALOG_URL)).doc()!.tiddlers[src]!.tiddler as any).text) as any);
    await new AutomergeDocStore(srcHandle as any, src).put(
      { tiddler: { title: "carrier", text: "body" }, meta: {} } as any, { kind: "lares-verb", requestId: "seed" } as any);
    return { repo, opts, r, src, dst, first, mintedUrls };
  }

  test("CREATE -> DROP -> COPY --to the dropped bag REFUSES by name; CREATE then mints fresh; nothing stranded", async () => {
    const { repo, r, src, dst, first, mintedUrls } = await stage();
    const args = { "from-bag": src, "to-bag": dst, title: "carrier", "change-id": "c-1" };
    // CONTROL: a standing bag takes the COPY.
    await r("COPY")(args, ctxFor("COPY", "k1"));

    await r("DROP")({ bag: dst }, ctxFor("DROP", "d1"));
    // RED before the fix: this answered ok:true and landed in the retired doc.
    await expect(r("COPY")(args, ctxFor("COPY", "k2"))).rejects.toThrow(/bag-retired: COPY into .*m13-dst.*CREATE/);

    // The refusal landed nothing in the retired doc: its only live content is the tombstoned one.
    const retiredDoc = (await repo.find(first.docUrl as string)).doc()!;
    const accessions = Object.values(retiredDoc.tiddlers).filter((t: any) => t.tiddler?.["archival-verb"] === "accession");
    expect(accessions.length).toBe(1); // the CONTROL copy only

    const fresh = await r("CREATE")({ bag: dst }, ctxFor("CREATE", "c3"));
    expect(fresh.alreadyStood).toBeUndefined();
    expect(fresh.docUrl).not.toBe(first.docUrl);
    expect(mintedUrls.length).toBe(3);

    // The fresh bag takes the write, and it lands in the FRESH doc, visible to the bag's surface.
    await r("COPY")(args, ctxFor("COPY", "k3"));
    const cleared = await r("CLEAR")({ bag: dst }, ctxFor("CLEAR", "x1"));
    expect(cleared.clearedCount).toBe(1);
  });

  test("the marker is ONE keyed read at a fixed title; a standing bag carries none", async () => {
    const { repo, r, dst, first } = await stage();
    const marker = effectRecordUri(dst, "retired");
    expect((await repo.find(first.docUrl as string)).doc()!.tiddlers[marker]).toBeUndefined();
    await r("DROP")({ bag: dst }, ctxFor("DROP", "d1"));
    const rec: any = (await repo.find(first.docUrl as string)).doc()!.tiddlers[marker];
    expect(rec.tiddler.disposition).toBe("bag-retired");
    // A second DROP keeps the FIRST retirement record.
    await r("DROP")({ bag: dst }, ctxFor("DROP", "d2"));
    const again: any = (await repo.find(first.docUrl as string)).doc()!.tiddlers[marker];
    expect(again.tiddler["request-id"]).toBe(rec.tiddler["request-id"]);
  });

  test("alreadyStood stamps a TRUTHFUL count (content titles, ledger excluded)", async () => {
    const { r, src, dst } = await stage();
    const empty = await r("CREATE")({ bag: dst }, ctxFor("CREATE", "a1"));
    expect(empty.alreadyStood).toBe(true);
    expect(empty.count).toBe(0);
    const full = await r("CREATE")({ bag: src }, ctxFor("CREATE", "a2"));
    expect(full.alreadyStood).toBe(true);
    expect(full.count).toBe(1);
  });
});
