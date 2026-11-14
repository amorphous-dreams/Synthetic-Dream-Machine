/**
 * move-slot-refuses · the residency verbs read the one family law (wiki-surface-scout #/meme-aware-actions).
 *
 * `groupOf` once drew a carrier's group by title prefix: a MOVE naming a slot moved that slot alone and
 * landed it rootless, and a MOVE naming a root swept every `root/path` title with it. Now a slot subject
 * refuses `slot-without-root` (the caller names the root), a root carries its component slots, and a path
 * child stands as its own meme and stays. A re-link re-homes a family whole: each slot's parent edge follows
 * its root to the new address.
 */
import { describe, expect, test } from "vitest";
import { Repo } from "./wiki-shore-rig.js";
import { AutomergeDocStore, CompositeStore, emptyLarDoc, type CapabilityAccess, type CapabilityVerifyResult, type Verb } from "@lararium/mesh";
import { carrierHash } from "@lararium/mesh/crypto";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { makeActionReactorFor, registerActionReactors } from "../src/action-handler.js";
import { VerbTable, type VerbContext } from "../src/verb-dispatcher.js";

const CARRIER = "text/memetic-wikitext+tiddlywiki";
const canonBag = "lar:///ha.ka.ba/bags/probe";
const workingBag = "lar:///ha.ka.ba/wikis/probe/working";
const hand = { kind: "tw-local", instanceId: "test" } as const;
const ROOT = "lar:///ha.ka.ba/probe/docs/family";
const SLOT = `${ROOT}#/a`;
const DEEP = `${ROOT}#/a/deep`;
const PATH_CHILD = `${ROOT}/path`;
const RECORDS = [
  { tiddler: { title: ROOT, type: CARRIER, text: "intro\n\n<<~ kahea ahu slot=`#/a`>>\n" }, meta: { changeId: "c-root" } },
  { tiddler: { title: SLOT, type: CARRIER, text: "a body\n\n<<~ kahea ahu slot=`#/a/deep`>>\n", "$fragment-parent": ROOT, "$slot": "#/a" }, meta: { changeId: "c-a" } },
  { tiddler: { title: DEEP, type: CARRIER, text: "deep body", "$fragment-parent": SLOT, "$slot": "#/a/deep" }, meta: { changeId: "c-deep" } },
  { tiddler: { title: PATH_CHILD, type: CARRIER, text: "its own meme" }, meta: { changeId: "c-path" } },
];
const ALL = RECORDS.map((r) => r.tiddler.title);

async function rig(verb: "MOVE" | "COPY") {
  const repo = new Repo({ network: [] });
  const stores = new Map<string, AutomergeDocStore>();
  const composite = new CompositeStore();
  for (const bag of [canonBag, workingBag]) {
    const store = new AutomergeDocStore(repo.create(emptyLarDoc()), bag);
    stores.set(bag, store);
    composite.addLayer({ bagId: bag, store, writable: true, defaultWritable: bag === workingBag });
  }
  for (const record of RECORDS) await stores.get(workingBag)!.put(record, hand);
  const reactor = makeActionReactorFor(verb, { composite });
  const run = async (args: Record<string, unknown>) => {
    const invocation = { requestId: "move-request", title: "move", action: verb, args: {}, targets: [], batchMode: "best-effort", status: "pending", requestedBy: "test", requestedAt: "2026-11-14" } as unknown as Verb;
    const ctx = { daemon: composite, invocation, cap: async () => ({ ok: true }) } as unknown as VerbContext;
    return reactor({ "from-bag": workingBag, "to-bag": canonBag, "change-id": "promote", ...args }, ctx);
  };
  const holds = async (bag: string): Promise<string[]> => {
    const out: string[] = [];
    for (const t of ALL) { const rec = await stores.get(bag)!.get(t); if (rec !== null && !rec.meta?.deleted) out.push(t); }
    return out;
  };
  return { run, holds, stop: () => repo.shutdown() };
}

describe("move-slot-refuses", () => {
  test("★ a MOVE naming a slot refuses `slot-without-root` and moves nothing ★", async () => {
    const r = await rig("MOVE");
    await expect(r.run({ title: SLOT })).rejects.toThrow(/slot-without-root/);
    await expect(r.run({ title: SLOT })).rejects.toThrow(ROOT);
    expect(await r.holds(canonBag)).toEqual([]);
    expect(await r.holds(workingBag)).toEqual(ALL);
    await r.stop();
  });

  test("★ a COPY naming a slot refuses the same way ★", async () => {
    const r = await rig("COPY");
    await expect(r.run({ title: SLOT })).rejects.toThrow(/slot-without-root/);
    expect(await r.holds(canonBag)).toEqual([]);
    await r.stop();
  });

  test("control: a root MOVE carries the family, at every depth, and leaves the path child where it stands", async () => {
    const r = await rig("MOVE");
    const result = await r.run({ title: ROOT });
    expect(result).toMatchObject({ title: ROOT, moved: 3 });
    expect(await r.holds(canonBag)).toEqual([ROOT, SLOT, DEEP]);
    expect(await r.holds(workingBag)).toEqual([PATH_CHILD]);
    await r.stop();
  });
});

describe("a re-link re-homes a family whole", () => {
  const URI = "lar:///t.relink.family/arrived";
  const FROM = "lar:///t.relink.family/gone";
  const BAG = "lar:///ha.ka.ba/wikis/relink-family/working";
  const framed =
    `<<^ code=\`&#x0001;\` from=\`?\` to=\`${URI}\`>>\n<<^ code=\`&#x0002;\`>>\n\n` +
    "```toml meta\nuri-path = \"t.relink.family/arrived\"\n```\n\n" +
    "the prose\n\n<<^ code=`&#x0003;`>>\n\n<<^ code=`&#x0004;` to=`?`>>\n";
  const allowCap = async (_a: CapabilityAccess, _b: string): Promise<CapabilityVerifyResult> => ({ ok: true });

  test("★ rename-root-carries-family at the bag: each slot's parent edge follows its root to the new address ★", async () => {
    const composite = new CompositeStore();
    composite.addLayer({ bagId: BAG, store: new MemoryTiddlerStore(BAG), writable: true });
    const seed = { kind: "lares-verb", requestId: "seed" } as const;
    await composite.put({ tiddler: { title: FROM, type: CARRIER, text: "root\n\n<<~ kahea ahu slot=`#/a`>>\n" }, meta: { changeId: "c-root" } }, seed, { bag: BAG });
    await composite.put({ tiddler: { title: `${FROM}#/a`, type: CARRIER, text: "a body", "uri-path": "t.relink.family/gone#/a", "$fragment-parent": FROM, "$slot": "#/a" }, meta: { changeId: "c-a" } }, seed, { bag: BAG });
    await composite.put({ tiddler: { title: `${FROM}#/a/deep`, type: CARRIER, text: "deep body", "$fragment-parent": `${FROM}#/a`, "$slot": "#/a/deep" }, meta: { changeId: "c-deep" } }, seed, { bag: BAG });
    await composite.put({ tiddler: { title: `${FROM}/path`, type: CARRIER, text: "its own meme" }, meta: { changeId: "c-path" } }, seed, { bag: BAG });

    const table = new VerbTable();
    registerActionReactors(table, { composite });
    const args = {
      "source-uri": "file:///scratch", "to-bag": BAG, "change-id": "chg-rename",
      carriers: [{ uri: URI, text: framed, diskHash: carrierHash(framed), syncedHash: null, ext: ".mem" }],
      deletions: [{ uri: FROM, syncedHash: carrierHash(framed) }],
    };
    const invocation: Verb = {
      requestId: "req-rename", title: "lar:///lararium.local.vm/verbs/req-rename", action: "INGEST", args, targets: [], batchMode: "best-effort",
      status: "pending", requestedBy: "operator-test", requestedAt: "2026-11-14T00:00:00Z",
    };
    const result = await table.get("INGEST")!(args, { daemon: composite, invocation, cap: allowCap }) as Record<string, unknown>;
    const rows = result["carriers"] as Array<Record<string, unknown>>;
    expect(rows.find((r) => r["decision"] === "rename")?.["relinked"]).toBe(3);

    expect((await composite.get(`${URI}#/a`))?.tiddler["$fragment-parent"]).toBe(URI);
    expect((await composite.get(`${URI}#/a`))?.tiddler["uri-path"]).toBe("t.relink.family/arrived#/a");
    expect((await composite.get(`${URI}#/a/deep`))?.tiddler["$fragment-parent"]).toBe(`${URI}#/a`);
    expect((await composite.get(`${URI}#/a/deep`))?.meta?.changeId, "identity survives the move").toBe("c-deep");
    expect(await composite.get(`${FROM}#/a`)).toBeNull();
    // A path child stands as its own meme: the re-link leaves it under its own address.
    expect((await composite.get(`${FROM}/path`))?.tiddler["text"]).toBe("its own meme");
    expect(await composite.get(`${URI}/path`)).toBeNull();
  });
});
