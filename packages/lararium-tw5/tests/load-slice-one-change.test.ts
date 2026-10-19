/**
 * A LOAD SLICE LANDS AS ONE STORE CHANGE, AND A FAMILY NEVER SPLITS ACROSS TWO.
 *
 * LOAD lands a slice of whole carriers in one `writeFamily`: one Automerge change a peer receives whole.
 * A slice closes at the first carrier boundary at or past `LOAD_YIELD_QUANTUM` records, so a carrier's
 * root and its ahu children always ride one change, and LOAD still yields to the host between slices.
 *
 * Control: the same LOAD against a store that holds no family write (one `put` per record) lands every
 * record, in the same order, with the same receipt.
 */
import { describe, expect, test } from "vitest";
import { createRequire } from "node:module";
import { AutomergeDocStore, CompositeStore, emptyLarDoc, plainEntries, type CapabilityAccess, type CapabilityVerifyResult, type LarDoc, type Repo as RepoType, type Verb, type VerbContext } from "@lararium/mesh";
import { LOAD_YIELD_QUANTUM, registerActionReactors } from "../src/action-handler.js";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { VerbTable } from "../src/verb-dispatcher.js";

// The CRDT engine resolves through the mesh package, which holds it: this package names no engine of its own.
const meshRequire = createRequire(import.meta.resolve("@lararium/mesh"));
const Repo = meshRequire("@automerge/automerge-repo").Repo as new (options: { network: unknown[] }) => RepoType;
const A = meshRequire("@automerge/automerge") as {
  init<T>(): T;
  save(doc: unknown): Uint8Array;
  load<T>(bytes: Uint8Array): T;
  getAllChanges(doc: unknown): Uint8Array[];
  applyChanges<T>(doc: T, changes: Uint8Array[]): [T];
};

const BAG = "lar:///ha.ka.ba/bags/load-slice";
const allowCap = async (_access: CapabilityAccess, _bag: string): Promise<CapabilityVerifyResult> => ({ ok: true });

function context(composite: CompositeStore): VerbContext {
  const invocation: Verb = {
    requestId: "req-load-slice", title: "lar:///lararium.local.vm/verbs/req-load-slice",
    action: "LOAD", args: {}, targets: [], batchMode: "best-effort", status: "pending",
    requestedBy: "operator-test", requestedAt: "2026-10-12T00:00:00Z",
  } as Verb;
  return { daemon: composite, invocation, cap: allowCap };
}

const SLOTS = ["one", "two", "three", "four", "five", "six"] as const;
/** A memetic carrier that decomposes into a root and one child per slot: a family of 1 + SLOTS.length. */
const meme = (i: number): { title: string; text: string } => {
  const uri = `lar:///t/load-slice/meme-${i}`;
  return {
    title: uri,
    text: `<<^ code="&#x0001;" from="?" -> to="${uri}">>\n<<^ code="&#x0002;">>\n\n\`\`\`toml meta\nuri-path = "t/load-slice/meme-${i}"\n\`\`\`\n\n` +
      SLOTS.map((s) => `<<~ ahu #/${s}>>\n\n! ${s} of ${i}\n\n<<~/ahu>>\n`).join("\n") +
      `\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to="?">>\n`,
  };
};

const CARRIERS = Array.from({ length: 30 }, (_, i) => meme(i));

async function load(store: AutomergeDocStore | MemoryTiddlerStore, yieldHostTask: () => Promise<void>): Promise<Record<string, unknown>> {
  const composite = new CompositeStore();
  composite.addLayer({ bagId: BAG, store, writable: true });
  const table = new VerbTable();
  registerActionReactors(table, { composite, yieldHostTask });
  return table.get("LOAD")!({ "to-bag": BAG, "source-uri": "file:///load", "change-id": "load-slice", "seed-door": "founding", carriers: CARRIERS }, context(composite));
}

describe("a LOAD slice lands as one store change", () => {
  test("30 carriers of several records each land in a handful of changes, each family whole in one", async () => {
    const repo = new Repo({ network: [] });
    const handle = repo.create<LarDoc>(emptyLarDoc());
    const store = new AutomergeDocStore(handle, BAG);
    const before = A.getAllChanges(handle.doc()).length;
    let yields = 0;
    const receipt = await load(store, async () => { yields++; });

    const titles = receipt["titles"] as string[];
    const perFamily = titles.length / CARRIERS.length;
    expect(Number.isInteger(perFamily), "every carrier decomposes alike").toBe(true);
    expect(perFamily, "the carrier decomposes into a family, never one record").toBeGreaterThan(1);

    // The store holds every record the receipt names.
    const held = new Set(plainEntries(handle.doc().tiddlers).map(([title]) => title));
    for (const title of titles) expect(held.has(title), title).toBe(true);

    // One change per slice: a slice closes at the first carrier boundary at or past the quantum.
    const familiesPerSlice = Math.ceil(LOAD_YIELD_QUANTUM / perFamily);
    const slices = Math.ceil(CARRIERS.length / familiesPerSlice);
    // The verb's own effect record rides one change of its own, after the last slice.
    const effects = [...held].filter((t) => !titles.includes(t));
    expect(effects).toHaveLength(1);
    expect(A.getAllChanges(handle.doc()).slice(before)).toHaveLength(slices + effects.length);
    expect(yields).toBe(slices - 1);

    // No family splits: walk the document's history one change at a time and read which titles each added.
    let seen = new Set<string>();
    let doc = A.load<LarDoc>(A.save(A.init<LarDoc>()));
    for (const change of A.getAllChanges(handle.doc())) {
      [doc] = A.applyChanges(doc, [change]);
      const now = new Set(Object.keys(doc.tiddlers ?? {}));
      const added = [...now].filter((t) => !seen.has(t));
      const roots = new Set(added.map((t) => t.split("#")[0]!));
      for (const root of roots) {
        const members = titles.filter((t) => t === root || t.startsWith(`${root}#`));
        for (const member of members) expect(now.has(member), `${member} rides the change that carries ${root}`).toBe(true);
      }
      seen = now;
    }
    expect(seen.size).toBe(titles.length + effects.length);
  });

  test("CONTROL: a store with no family write takes one put per record and answers the same receipt", async () => {
    const repo = new Repo({ network: [] });
    const whole = await load(new AutomergeDocStore(repo.create<LarDoc>(emptyLarDoc()), BAG), async () => {});
    const plain = new MemoryTiddlerStore();
    const receipt = await load(plain, async () => {});
    expect(receipt).toEqual(whole);
    for (const title of receipt["titles"] as string[]) expect(await plain.get(title), title).not.toBeNull();
  });
});
