import { describe, expect, test } from "vitest";
import { buildVerb, parseVerb, verbInputDigest, VERB_URI_PREFIX, type CompositeStore, type LarTiddlerRecord } from "@lararium/mesh";
import { placeVerb, writeOutcome } from "../src/verb-vm.js";

class Wiki {
  readonly fields = new Map<string, Record<string, unknown>>();
  readonly $tw = {
    Tiddler: class { fields: Record<string, unknown>; constructor(fields: Record<string, unknown>) { this.fields = fields; } },
    wiki: {
      addTiddler: (t: { fields: Record<string, unknown> }) => { this.fields.set(String(t.fields["title"]), t.fields); },
      getTiddler: (title: string) => { const fields = this.fields.get(title); return fields ? { fields } : undefined; },
    },
  };
}
class Store {
  readonly writes: LarTiddlerRecord[] = [];
  async put(record: LarTiddlerRecord): Promise<void> { this.writes.push(record); }
}

describe("face on a volatile verb and its outcome", () => {
  test("placement carries the face and the digest follows it rather than the display name", async () => {
    const wiki = new Wiki();
    const id = placeVerb(wiki as never, { verb: "load", args: { x: 1 }, requestedBy: "presenter-a",
      face: "proof-a", requestId: "face-1" });
    const placed = wiki.fields.get(`${VERB_URI_PREFIX}${id}`);
    if (!placed) throw new Error("placement did not land");
    expect(placed["face"]).toBe("proof-a");
    const invocation = parseVerb(placed);
    expect(invocation?.face).toBe("proof-a");
    if (!invocation) throw new Error("placement did not parse");
    const store = new Store();
    await writeOutcome(store as unknown as CompositeStore, { invocation, status: "done", result: { ok: true } });
    const digest = store.writes[0]?.tiddler["input-digest"];
    const otherDisplay = new Store();
    await writeOutcome(otherDisplay as unknown as CompositeStore,
      { invocation: { ...invocation, requestedBy: "another-display" }, status: "done", result: { ok: true } });
    expect(otherDisplay.writes[0]?.tiddler["input-digest"]).toBe(digest);
    expect(digest).toBe(await verbInputDigest({ verb: "load", args: { x: 1 }, face: "proof-a" }));
    expect(digest).not.toBe(await verbInputDigest({ verb: "load", args: { x: 1 }, face: "proof-b" }));
  });
  test("a face-less placement keeps the empty-face digest", async () => {
    const invocation = parseVerb(buildVerb({ verb: "load", args: {}, requestedBy: "display", requestId: "face-less" }));
    if (!invocation) throw new Error("placement did not parse");
    const store = new Store();
    await writeOutcome(store as unknown as CompositeStore, { invocation, status: "done", result: {} });
    expect(store.writes[0]?.tiddler["input-digest"]).toBe(await verbInputDigest({ verb: "load", args: {} }));
  });
});
