import { describe, expect, test, vi } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { AutomergeDocStore } from "../src/automerge-doc-store.js";
import { CompositeStore } from "../src/composite-store.js";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";
import type { ChangeOrigin, LarTiddlerChange, LarTiddlerRecord, LarTiddlerStore } from "../src/tiddler-store.js";

const origin: ChangeOrigin = { kind: "tw-local", instanceId: "landed-composite" };
const title = "lar:///landed/composite";
const rec: LarTiddlerRecord = { tiddler: { title, text: "record" } };

class PlainStore implements LarTiddlerStore {
  protected records = new Map<string, LarTiddlerRecord>();
  async listVisible() { return [...this.records.keys()]; }
  async get(key: string) { return this.records.get(key) ?? null; }
  async put(record: LarTiddlerRecord) { this.records.set(record.tiddler.title, record); }
  async tombstone(key: string) { this.records.delete(key); }
  async remove(key: string) { this.records.delete(key); }
  subscribe() { return () => {}; }
}

describe("landed composite laws", () => {
  test("F2: a base follows a named bag only when that bag is the write target", async () => {
    const repo = new Repo({ network: [] });
    const readHandle = repo.create<LarDoc>(emptyLarDoc());
    const writeHandle = repo.create<LarDoc>(emptyLarDoc());
    const readOnly = new AutomergeDocStore(readHandle, "readonly");
    const writable = new AutomergeDocStore(writeHandle, "working");
    const composite = new CompositeStore();
    composite.addLayer({ bagId: "readonly", store: readOnly, writable: false });
    composite.addLayer({ bagId: "working", store: writable, writable: true });
    await readOnly.put(rec, origin);
    const foreignBase = await readOnly.getHeads();
    await expect(composite.put({ tiddler: { title, text: "copy" } }, origin, { bag: "readonly", base: foreignBase! })).resolves.toBeUndefined();
    expect((await writable.get(title))?.tiddler.text).toBe("copy");

    await writable.put({ tiddler: { title, text: "base writable" } }, origin);
    const ownBase = await writable.getHeads();
    await writable.put({ tiddler: { title, text: "intervening" } }, origin);
    const changeAt = vi.spyOn((writable as any).handle, "changeAt");
    await composite.put({ tiddler: { title, text: "based writable" } }, origin, { bag: "working", base: ownBase! });
    expect(changeAt).toHaveBeenCalledOnce();
    await composite.tombstoneInBag("working", title, origin, { base: ownBase! });
    expect(changeAt).toHaveBeenCalledTimes(2);

    await expect(composite.put(rec, origin, { base: ownBase! })).rejects.toThrow(/base.*bag|bag.*base/i);
  });

  test("F3: synthetic add and removal envelopes name the answering bag and matching heads", async () => {
    class HeadedMemory extends PlainStore {
      constructor(private readonly heads: readonly string[]) { super(); }
      readNow(t: string) { const record = this.records.get(t) ?? null; return record ? { record, heads: this.heads } : { record: null }; }
    }
    const lower = new HeadedMemory(["low-head"]);
    const upper = new HeadedMemory(["high-head"]);
    await lower.put(rec, origin);
    await upper.put(rec, origin);
    const composite = new CompositeStore();
    const seen: LarTiddlerChange[] = [];
    composite.subscribe((change) => seen.push(change));
    composite.addLayer({ bagId: "low", store: lower, writable: false });
    composite.addLayer({ bagId: "high", store: upper, writable: false });
    await Promise.resolve();
    await Promise.resolve();
    const added = seen.find((change) => change.bag === "high");
    expect(added?.heads).toEqual(["high-head"]);

    seen.length = 0;
    await composite.removeLayerLive("high");
    expect(seen).toHaveLength(1);
    expect(seen[0]?.bag).toBe("low");
    expect(seen[0]?.heads).toEqual(["low-head"]);
    expect(seen[0]?.record).toEqual(await lower.get(title));

    const emptyComposite = new CompositeStore();
    const lone = new HeadedMemory(["lone-head"]);
    await lone.put(rec, origin);
    const loneSeen: LarTiddlerChange[] = [];
    emptyComposite.subscribe((change) => loneSeen.push(change));
    emptyComposite.addLayer({ bagId: "lone", store: lone, writable: true });
    await Promise.resolve();
    await Promise.resolve();
    expect(loneSeen[0]?.bag).toBe("lone");
    expect(loneSeen[0]?.heads).toEqual(["lone-head"]);
  });

  test("F3 pairing: a synthetic envelope's record is the record AT its heads, though the layer moves while the composite reads", async () => {
    // A headed layer that keeps every version. Its asynchronous `get` answers the NEWEST record, and a
    // write lands while that read is in flight: a composite that awaited `get` and then took heads
    // would pair one version's record with another's heads. The layer's synchronous `readNow` answers both at once.
    class Versioned extends PlainStore {
      private version = 0;
      private readonly at = new Map<string, LarTiddlerRecord>();
      readNow(t: string): { record: LarTiddlerRecord | null; heads?: readonly string[] } {
        const record = this.records.get(t) ?? null;
        return record ? { record, heads: [`v${this.version}`] } : { record: null };
      }
      getAt(_t: string, heads: readonly string[]): LarTiddlerRecord | null { return this.at.get(heads[0]!) ?? null; }
      write(text: string): void {
        this.version++;
        const record = { tiddler: { title, text } } as LarTiddlerRecord;
        this.at.set(`v${this.version}`, record);
        this.records.set(title, record);
      }
      override async get(t: string): Promise<LarTiddlerRecord | null> {
        await Promise.resolve();
        this.write("moved while the read was in flight");
        return this.records.get(t) ?? null;
      }
    }
    const layer = new Versioned();
    layer.write("as first read");
    const composite = new CompositeStore();
    const seen: LarTiddlerChange[] = [];
    composite.subscribe((change) => seen.push(change));
    composite.addLayer({ bagId: "versioned", store: layer, writable: false });
    for (let i = 0; i < 6; i++) await Promise.resolve();
    expect(seen).toHaveLength(1);
    expect(seen[0]!.record).toEqual(layer.getAt(title, seen[0]!.heads!));

    const upper = new PlainStore();
    await upper.put(rec, origin);
    composite.addLayer({ bagId: "upper", store: upper, writable: false });
    for (let i = 0; i < 6; i++) await Promise.resolve();
    seen.length = 0;
    await composite.removeLayerLive("upper");
    expect(seen).toHaveLength(1);
    expect(seen[0]!.bag).toBe("versioned");
    expect(seen[0]!.record).toEqual(layer.getAt(title, seen[0]!.heads!));
  });

  test("F3 absence after removing the last answer names the removed bag and no heads", async () => {
    const composite = new CompositeStore();
    const layer = new PlainStore();
    await layer.put(rec, origin);
    composite.addLayer({ bagId: "last", store: layer, writable: false });
    const seen: LarTiddlerChange[] = [];
    composite.subscribe((change) => seen.push(change));
    await composite.removeLayerLive("last");
    expect(seen).toHaveLength(1);
    expect(seen[0]?.record).toBeNull();
    expect(seen[0]?.bag).toBe("last");
    expect(seen[0]?.heads).toBeUndefined();
  });
});
