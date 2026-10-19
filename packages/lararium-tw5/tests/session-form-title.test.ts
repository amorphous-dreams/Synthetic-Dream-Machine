/**
 * A SESSION-FORM URI NEVER STANDS AS A TITLE — through `meme put`, through ingest, through LOAD, and
 * through the wiki shore.
 *
 * The law binds the TITLE SLOT alone (`lar:///ha.ka.ba/lares/api/pono/lar-uri#/security`): a userinfo in a
 * record's text reads lawful and crosses untouched. The store's write door holds it (`@lararium/mesh`
 * `title-law.ts`), so no verb carries a check of its own: each door below refuses by the same name because
 * each one writes through that door. A refusal reports and never drops in silence.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { createRequire } from "node:module";
import {
  AutomergeDocStore, CompositeStore, bagUri, emptyLarDoc, isEffectRecordUri, isVerbRefusal, recipeUri, wikiSlotUri,
  type CapabilityAccess, type CapabilityVerifyResult, type LarDoc, type LarTiddlerRecord, type LarTiddlerStore, type Repo as RepoType, type Verb, type VerbContext,
} from "@lararium/mesh";
import { carrierHash } from "@lararium/mesh/crypto";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { makeMemePutReactor, makeMemeGetReactor, makeMemeDeleteReactor, type MemeVerbOptions } from "../src/meme-verbs.js";
import { LOAD_YIELD_QUANTUM, registerActionReactors, makeTw5Deserializer } from "../src/action-handler.js";
import { VerbTable } from "../src/verb-dispatcher.js";
import type { TW5Engine } from "../src/tw5-vm.js";
import { bootTestWiki, wikiSkip, skipNote } from "./test-wiki.js";

const meshRequire = createRequire(import.meta.resolve("@lararium/mesh"));
const Repo = meshRequire("@automerge/automerge-repo").Repo as new (options: { network: unknown[] }) => RepoType;

const BAD_URI = "lar://mara:operator@crossroads/t.title.banned/one";
const OK_URI = "lar://crossroads/t.title.allowed/one";
const CODE = "session-form-title";

const framed = (uri: string, body: string): string =>
  `<<^ code="&#x0001;" from="?" -> to="${uri}">>\n<<^ code="&#x0002;">>\n\n\`\`\`toml meta\nuri-path = "t.title.context/capture"\n\`\`\`\n\n${body}\n\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to="?">>\n`;

/** A captured exchange: an aim, a quoted link and a fenced yield, each carrying a speaker's URI in the BODY. */
const CAPTURE_BODY =
  `<<~ lares aim from="lar://mara:operator@crossroads/operator.asks.the-cost" -> to="lar://compita:agent@crossroads/clerk.reads.the-record">>\n\n` +
  `A quoted link: lar://alias:grant@host/some.path.here\n\n` +
  "```\n<<~ lares yield from=\"lar://compita:agent@crossroads/clerk.named.the-source\" -> to=\"?\">>\n```";

const verbCtx = (requestId = "r1"): VerbContext => ({
  daemon: {} as CompositeStore,
  invocation: { requestId } as VerbContext["invocation"],
  cap: async () => ({ ok: true }),
});

const STORES: ReadonlyArray<readonly [string, (bag: string) => LarTiddlerStore]> = [
  ["an Automerge document", (bag) => new AutomergeDocStore(new Repo({ network: [] }).create<LarDoc>(emptyLarDoc()), bag)],
  ["a memory store", (bag) => new MemoryTiddlerStore(bag)],
];

function wikiWithWorkingLayer(slug: string, storeOf: (bag: string) => LarTiddlerStore): { opts: MemeVerbOptions; working: LarTiddlerStore } {
  const workingBag = wikiSlotUri(slug, "working");
  const working = storeOf(workingBag);
  const recipes = new Map<string, LarTiddlerRecord>();
  recipes.set(recipeUri("catalog", slug), { tiddler: { title: recipeUri("catalog", slug), "bag-stack": bagUri("lares"), "writable-bag": workingBag } });
  const opts: MemeVerbOptions = {
    composite: new CompositeStore(),
    tw5: { $tw: { wiki: {} } } as unknown as MemeVerbOptions["tw5"],
    recipeOf: async (s) => recipes.get(recipeUri("catalog", s)) ?? null,
    reach: async (): Promise<LarTiddlerStore | null> => null,
    slotStore: async (s, kind): Promise<LarTiddlerStore | null> => (s === slug && kind === "working" ? working : null),
  };
  return { opts, working };
}

describe("meme put: the title law through the verb path", () => {
  for (const [storeName, storeOf] of STORES) {
    test(`A: a session-form title refuses by name over ${storeName}, and nothing lands`, async () => {
      const { opts, working } = wikiWithWorkingLayer("lares", storeOf);
      // A bare body, and a framed carrier whose head names the session-form address.
      const headed = framed(BAD_URI, "framed prose").replace('uri-path = "t.title.context/capture"', 'role = "a carrier under a session-form head"');
      for (const text of ["a body\n", headed]) {
        const refusal = await makeMemePutReactor(opts)({ recipe: "lares", uri: BAD_URI, text }, verbCtx()).catch((e: unknown) => e);
        expect(isVerbRefusal(refusal)).toBe(true);
        expect((refusal as { reason: string }).reason).toBe(CODE);
        expect((refusal as Error).message).toContain(BAD_URI);
        expect(await working.listVisible()).toEqual([]);
      }
      // The read finds no record under the title: the refusal preserved nothing in the store, and said so.
      expect((await makeMemeGetReactor(opts)({ recipe: "lares", uri: BAD_URI }, verbCtx("r2")))["meme"]).toBeNull();
    });

    test(`B: a userinfo in the BODY passes untouched over ${storeName}`, async () => {
      const { opts } = wikiWithWorkingLayer("lares", storeOf);
      const uri = "lar:///t.title.context/capture";
      const receipt = await makeMemePutReactor(opts)({ recipe: "lares", uri, text: framed(uri, CAPTURE_BODY) }, verbCtx());
      expect(receipt["decision"]).toBe("ingest");
      const meme = (await makeMemeGetReactor(opts)({ recipe: "lares", uri }, verbCtx("r2")))["meme"] as { text: string };
      // Three speaker URIs and one quoted link went in; all four read back.
      expect(meme.text.match(/lar:\/\/[a-z]+:[a-z]+@[a-z.]+/g)).toEqual([
        "lar://mara:operator@crossroads", "lar://compita:agent@crossroads", "lar://alias:grant@host", "lar://compita:agent@crossroads",
      ]);
    });

    test(`C: the permitted hostful title lands and reads back over ${storeName}`, async () => {
      const { opts } = wikiWithWorkingLayer("lares", storeOf);
      const receipt = await makeMemePutReactor(opts)({ recipe: "lares", uri: OK_URI, text: "a permitted body\n" }, verbCtx());
      expect(receipt["decision"]).toBe("ingest");
      const meme = (await makeMemeGetReactor(opts)({ recipe: "lares", uri: OK_URI }, verbCtx("r2")))["meme"] as { text: string };
      expect(meme.text).toBe("a permitted body\n");
    });

    test(`a delete of a session-form title nothing holds answers absent over ${storeName}, and mints no key`, async () => {
      const { opts, working } = wikiWithWorkingLayer("lares", storeOf);
      expect((await makeMemeDeleteReactor(opts)({ recipe: "lares", uri: BAD_URI }, verbCtx()))["decision"]).toBe("absent");
      expect(await working.get(BAD_URI)).toBeNull();
    });
  }
});

describe("every store that holds a title holds the law", () => {
  for (const [storeName, storeOf] of STORES) {
    test(`${storeName}: a put and a tombstone of a session-form title refuse, and the store stays empty`, async () => {
      const store = storeOf("lar:///ha.ka.ba/bags/title-door");
      const origin = { kind: "lares-verb", requestId: "r" } as const;
      await expect(store.put({ tiddler: { title: BAD_URI, text: "x" } }, origin)).rejects.toMatchObject({ reason: CODE });
      await expect(store.tombstone(BAD_URI, origin)).rejects.toMatchObject({ reason: CODE });
      expect(await store.listVisible()).toEqual([]);
      expect(await store.get(BAD_URI)).toBeNull();
      // CONTROL: the hostful title lands and tombstones.
      await store.put({ tiddler: { title: OK_URI, text: "x" } }, origin);
      await store.tombstone(OK_URI, origin);
      expect((await store.get(OK_URI))?.meta?.deleted).toBe(true);
    });
  }
});

const allowCap = async (_a: CapabilityAccess, _b: string): Promise<CapabilityVerifyResult> => ({ ok: true });
function actionCtx(composite: CompositeStore, action: "INGEST" | "LOAD", args: Record<string, unknown>): VerbContext {
  const invocation: Verb = {
    requestId: "req-title", title: "lar:///lararium.local.vm/verbs/req-title",
    action, args, targets: [], batchMode: "best-effort",
    status: "pending", requestedBy: "operator-test", requestedAt: "2026-10-13T00:00:00Z",
  };
  return { daemon: composite, invocation, cap: allowCap };
}

describe.skipIf(wikiSkip)(`ingest and LOAD: the title law through the residency verbs${skipNote}`, () => {
  const BAG = "lar:///ha.ka.ba/bags/title";
  const GOOD = "lar:///ha.ka.ba/t/title/good";
  const FILE_URI = "lar:///ha.ka.ba/t/title/carried";
  /** A `.tid` whose own header names a session-form title: the registry titles the record by it. */
  const TID = `title: ${BAD_URI}\ntype: text/vnd.tiddlywiki\n\na body under a session-form title\n`;
  /** A carrier whose head names a session-form address; LOAD with no carrier title reads the head. */
  const HEADED = framed(BAD_URI, "prose").replace('uri-path = "t.title.context/capture"', 'role = "a carrier under a session-form head"');
  let engine: TW5Engine;
  beforeAll(async () => { engine = await bootTestWiki(); }, 60_000);

  function rig(storeOf: (bag: string) => LarTiddlerStore) {
    const composite = new CompositeStore();
    const store = storeOf(BAG);
    composite.addLayer({ bagId: BAG, store, writable: true });
    const table = new VerbTable();
    registerActionReactors(table, { composite, tw5: makeTw5Deserializer(engine) });
    const carriersIn = async () => (await store.listVisible()).filter((t) => !isEffectRecordUri(t)).sort();
    return { composite, store, table, carriersIn };
  }

  for (const [storeName, storeOf] of STORES) {
    test(`INGEST names the refusal in that carrier's row over ${storeName}, and its sibling lands`, async () => {
      const r = rig(storeOf);
      const good = "a lawful note\n";
      const args = {
        "source-uri": "file:///scratch", "to-bag": BAG, "seed-door": "founding", "change-id": "chg-title",
        carriers: [
          { uri: FILE_URI, file: "/scratch/carried.tid", text: TID, diskHash: carrierHash(TID), syncedHash: null, ext: ".tid" },
          { uri: GOOD, file: "/scratch/good.md", text: good, diskHash: carrierHash(good), syncedHash: null, ext: ".md" },
        ],
      };
      const rows = (await r.table.get("INGEST")!(args, actionCtx(r.composite, "INGEST", args)) as Record<string, unknown>)["carriers"] as Array<Record<string, unknown>>;
      const refused = rows.find((row) => row["uri"] === FILE_URI)!;
      expect(refused["decision"]).toBe("refuse");
      expect(refused["code"]).toBe(CODE);
      expect((refused["warnings"] as string[])[0]).toContain(BAD_URI);
      expect(rows.find((row) => row["uri"] === GOOD)!["decision"]).toBe("ingest");
      expect(await r.carriersIn()).toEqual([GOOD]);
    });

    test(`LOAD refuses the whole wave by name over ${storeName}, ahead of its first slice`, async () => {
      const r = rig(storeOf);
      for (const bad of [{ text: TID, ext: ".tid" }, { text: HEADED, ext: ".mem" }]) {
        const args = {
          "source-uri": "file:///scratch", "to-bag": BAG, "seed-door": "founding", "change-id": "chg-title",
          carriers: [{ title: GOOD, text: "a lawful note\n", ext: ".md" }, bad],
        };
        const refusal = await (r.table.get("LOAD")!(args, actionCtx(r.composite, "LOAD", args)) as Promise<unknown>).catch((e: unknown) => e);
        expect(isVerbRefusal(refusal), bad.ext).toBe(true);
        expect((refusal as { reason: string }).reason).toBe(CODE);
        expect(await r.carriersIn(), bad.ext).toEqual([]);
      }
    });
  }

  test("INGEST refuses a carrier whose OWN address carries a userinfo ahead of every write path: a skinny handle, a rename target", async () => {
    const r = rig(STORES[0]![1]);
    const lawful = "a lawful note\n";
    const args = {
      "source-uri": "file:///scratch", "to-bag": BAG, "seed-door": "founding", "change-id": "chg-title",
      carriers: [
        // A skinny handle lands before any parse: the row must refuse it first.
        { uri: BAD_URI, textCid: "ab".repeat(32), skinny: true, size: 9, diskHash: "sha256:" + "ab".repeat(32), syncedHash: null, ext: ".png" },
        // A carrier the delete gate would pair as a rename target, under a second session-form address.
        { uri: "lar://mara:operator@crossroads/t.title.banned/two", text: lawful, diskHash: carrierHash(lawful), syncedHash: null, ext: ".md" },
        { uri: GOOD, text: lawful + "x", diskHash: carrierHash(lawful + "x"), syncedHash: null, ext: ".md" },
      ],
      deletions: [{ uri: "lar:///ha.ka.ba/t/title/gone", syncedHash: carrierHash(lawful) }],
    };
    // A live source for the rename the gate would pair.
    await r.store.put({ tiddler: { title: "lar:///ha.ka.ba/t/title/gone", type: "text/x-markdown", text: lawful } }, { kind: "lares-verb", requestId: "seed" });
    const result = await r.table.get("INGEST")!(args, actionCtx(r.composite, "INGEST", args)) as Record<string, unknown>;
    const rows = result["carriers"] as Array<Record<string, unknown>>;
    for (const uri of [BAD_URI, "lar://mara:operator@crossroads/t.title.banned/two"]) {
      const row = rows.find((x) => x["uri"] === uri)!;
      expect(row["decision"], uri).toBe("refuse");
      expect(row["code"], uri).toBe(CODE);
    }
    expect(rows.find((x) => x["uri"] === GOOD)!["decision"]).toBe("ingest");
    expect((result["deletions"] as { renames: unknown[] }).renames).toEqual([]);
    expect((await r.carriersIn()).some((t) => t.includes("@"))).toBe(false);
  });

  test("CREATE refuses a session-form bag address ahead of any mint", async () => {
    const r = rig(STORES[0]![1]);
    let created = 0;
    const table = new VerbTable();
    registerActionReactors(table, {
      composite: r.composite, tw5: makeTw5Deserializer(engine),
      reach: { repo: { create: () => { created++; throw new Error("a mint ran"); } }, catalogUrl: "automerge:catalog", oracleUrl: "automerge:oracle" } as never,
    });
    const args = { bag: "lar://mara:operator@crossroads/ha.ka.ba/bags/x", plane: "catalog" };
    const refusal = await (table.get("CREATE")!(args, actionCtx(r.composite, "CREATE" as never, args)) as Promise<unknown>).catch((e: unknown) => e);
    expect((refusal as { reason?: string }).reason).toBe(CODE);
    expect(created).toBe(0);
  });

  test("LOAD past its slice quantum still lands nothing: the refusal rides ahead of the first slice", async () => {
    const r = rig(STORES[0]![1]);
    const lawful = Array.from({ length: LOAD_YIELD_QUANTUM + 3 }, (_, i) => ({ title: `lar:///ha.ka.ba/t/title/lawful-${i}`, text: `note ${i}\n`, ext: ".md" }));
    const args = { "source-uri": "file:///scratch", "to-bag": BAG, "seed-door": "founding", "change-id": "chg-title", carriers: [...lawful, { text: TID, ext: ".tid" }] };
    const refusal = await (r.table.get("LOAD")!(args, actionCtx(r.composite, "LOAD", args)) as Promise<unknown>).catch((e: unknown) => e);
    expect((refusal as { reason: string }).reason).toBe(CODE);
    expect(await r.carriersIn()).toEqual([]);
    // CONTROL: the same wave without the session-form carrier lands every lawful one.
    const clean = { ...args, carriers: lawful };
    await r.table.get("LOAD")!(clean, actionCtx(r.composite, "LOAD", clean));
    expect((await r.carriersIn()).length).toBe(lawful.length);
  });

  test("CONTROL: INGEST and LOAD land a carrier whose TEXT carries a userinfo, byte for byte", async () => {
    const r = rig(STORES[0]![1]);
    const text = `${CAPTURE_BODY}\n`;
    const args = { "source-uri": "file:///scratch", "to-bag": BAG, "seed-door": "founding", "change-id": "chg-title", carriers: [{ uri: GOOD, text, diskHash: carrierHash(text), syncedHash: null, ext: ".md" }] };
    const rows = (await r.table.get("INGEST")!(args, actionCtx(r.composite, "INGEST", args)) as Record<string, unknown>)["carriers"] as Array<Record<string, unknown>>;
    expect(rows[0]!["decision"]).toBe("ingest");
    expect((await r.store.get(GOOD))?.tiddler["text"]).toBe(text);
  });
});
