/**
 * meme-realm-grant.test — a bag the REALM carries answers by the realm's grant, never by this vessel's own registry.
 *
 * A member reads a book another operator keeps through the realm that registers it; the member's Keyhive never
 * registered that book, since the book is nobody's local layer here. So `meme get --bag <book> --realm <id>` reads
 * the registration's doc on the realm's grant (its counted, steward-signed registration at the read tier), and a
 * steward's `meme put --bag <book> --realm <id>` writes on the steward check alone. A bag reached any other way
 * still asks this vessel's own cap.
 */
import { describe, test, expect } from "vitest";
import { createRequire } from "node:module";
import {
  CompositeStore, REALM_BAG_DOMAIN, REALM_ID_TIDDLER, bagUri, deterministicDocUrl, emptyLarDoc, materializeSharedLarDoc,
  realmDocPointer, realmDocUrl, realmStewardPointer, storedLarRecord, writeRealmStanding,
  type LarDoc, type LarTiddlerStore, type RealmBagRegistration, type Repo as RepoType,
} from "@lararium/mesh";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { makeMemePutReactor, makeMemeGetReactor, memeVerbOptions, type MemeVerbOptions } from "../src/meme-verbs.js";

const Repo = createRequire(import.meta.resolve("@lararium/mesh"))("@automerge/automerge-repo").Repo as new (options: { network: unknown[] }) => RepoType;
import type { VerbContext } from "../src/verb-dispatcher.js";

const URI = "lar:///t/ford";
const BOOK = bagUri("ford-book");
const REALM = "c".repeat(64);
const meme = (slot: string): string =>
  `<<^ code="&#x0001;" from="?" -> to="${URI}">>\n` +
  `<<^ code="&#x0002;">>\n\n\`\`\`toml meta\nuri-path = "t/ford"\n\`\`\`\n\n<<~ ahu #${slot}>>\n\n! ${slot}\n\n<<~/ahu>>\n\n` +
  `<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to="?">>\n`;

/** This vessel's own registry knows no realm-carried book: every cap ask refuses as the vessel's Keyhive does. */
const unregistered = (): VerbContext => ({
  daemon: {} as CompositeStore,
  invocation: { requestId: "r1" } as VerbContext["invocation"],
  cap: async (_access, bag) => ({ ok: false, reason: `bag not registered: ${bag}` }),
});

function rig() {
  const realmDoc = new MemoryTiddlerStore(BOOK);
  const own = new MemoryTiddlerStore(BOOK);
  const composite = new CompositeStore();
  composite.addLayer({ bagId: BOOK, store: own, writable: true });
  const opts: MemeVerbOptions = {
    composite,
    tw5: { $tw: { wiki: { getTiddlerText: () => "" } } } as unknown as MemeVerbOptions["tw5"],
    reach: async (key, _bag, realm): Promise<LarTiddlerStore | null> => (key === BOOK && realm === REALM ? realmDoc : null),
    realmWritable: async (bag, realm): Promise<LarTiddlerStore | null> => (bag === BOOK && realm === REALM ? realmDoc : null),
  };
  return { opts, realmDoc, own };
}

describe("a realm-carried bag answers by the realm's grant", () => {
  test("a member's get through the named realm reads the registration's doc with no local registration", async () => {
    const r = rig();
    const placed = await makeMemePutReactor(r.opts)({ uri: URI, bag: "ford-book", realm: REALM, text: meme("/a") }, unregistered());
    expect(placed["decision"]).toBe("ingest");
    const got = await makeMemeGetReactor(r.opts)({ uri: URI, bag: "ford-book", realm: REALM }, unregistered());
    expect(String((got["meme"] as { text?: unknown } | undefined)?.text ?? "")).toContain("! /a");
    expect(await r.own.get(URI)).toBeNull();
  });

  test("CONTROL: the same bag reached without a realm still asks this vessel's own cap", async () => {
    const r = rig();
    const said = await makeMemeGetReactor(r.opts)({ uri: URI, bag: "ford-book" }, unregistered()).then(() => "(read)", (e: Error) => e.message);
    expect(said).toContain("cap-denied: read on");
    const put = await makeMemePutReactor(r.opts)({ uri: URI, bag: "ford-book", text: meme("/a") }, unregistered()).then(() => "(landed)", (e: Error) => e.message);
    expect(put).toContain("cap-denied: admin on");
  });
});

/** A vessel's own island over the production reach: the realms it pins, the standing each pinned realm carries. */
async function vessel(pins: ReadonlyArray<{ realm: string; doc: string; book?: string; steward?: string; pinDoc?: boolean }>) {
  const repo = new Repo({ network: [] });
  for (const p of pins) await materializeSharedLarDoc(repo, p.doc as never, "book");
  const catalog = repo.create<LarDoc>(emptyLarDoc());
  catalog.change((d) => {
    d.tiddlers[REALM_ID_TIDDLER] = storedLarRecord(REALM_ID_TIDDLER, { text: "charter-own" }, "vessel-boot");
    for (const p of pins) {
      if (p.pinDoc !== false) d.tiddlers[realmDocPointer(p.realm)] = storedLarRecord(realmDocPointer(p.realm), { text: realmDocUrl(p.realm) }, "vessel-boot");
      const reg: RealmBagRegistration = { kind: REALM_BAG_DOMAIN, realmId: p.realm, bagUri: p.book ?? BOOK, docUrl: p.doc, keptBy: [p.steward ?? "nobody"], readTier: "contract", signatures: [] };
      writeRealmStanding(d, p.realm, new Map([[reg.bagUri, reg]]));
      if (p.steward) d.tiddlers[realmStewardPointer(p.realm)] = storedLarRecord(realmStewardPointer(p.realm), { text: p.steward }, "realm-bag");
    }
  });
  return memeVerbOptions({ composite: new CompositeStore(), tw5: { $tw: { wiki: { getTiddlerText: () => "" } } } as never, repo, catalogUrl: catalog.url, oracleUrl: null }, async () => null);
}

describe("the realm's grant reaches only a member of that realm, by the production reach", () => {
  const DOC = deterministicDocUrl("realm-grant-book");
  const read = (opts: MemeVerbOptions, realm: string) =>
    makeMemeGetReactor(opts)({ uri: URI, bag: "ford-book", realm }, unregistered()).then((r) => ({ read: r }), (e: Error) => ({ refused: e.message }));

  test("a member whose realm counts the book reads it; a vessel outside every realm, one naming a realm it never pinned, and one whose realm counts no such book each refuse and read nothing", async () => {
    const steward = await vessel([{ realm: REALM, doc: DOC, steward: "hand-a" }]);
    const placed = await makeMemePutReactor(steward)({ uri: URI, bag: "ford-book", realm: REALM, text: meme("/a") }, unregistered());
    expect(placed["decision"]).toBe("ingest");
    const member = await read(steward, REALM);
    expect("read" in member, JSON.stringify(member)).toBe(true);

    const outside = await read(await vessel([]), REALM);
    const unpinned = await read(await vessel([{ realm: REALM, doc: DOC, pinDoc: false }]), REALM);
    const otherBook = await read(await vessel([{ realm: REALM, doc: DOC, book: bagUri("another-book") }]), REALM);
    for (const answer of [outside, unpinned, otherBook]) {
      expect("refused" in answer, JSON.stringify(answer)).toBe(true);
      expect((answer as { refused: string }).refused).toContain(`in realm ${REALM}`);
    }
  });
});
