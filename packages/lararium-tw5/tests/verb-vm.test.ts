import { describe, test, expect } from "vitest";
import type { CompositeStore, Verb, LarTiddlerRecord } from "@lararium/mesh";
import { OUTCOME_URI_PREFIX, VERB_RESULT_KEY, VERB_URI_PREFIX, buildVerb, parseVerb } from "@lararium/mesh";
import {
  boundOutcomeOutput,
  dispatchVerb,
  patchVerb,
  placeVerb,
  removeVerb,
  writeOutcome,
} from "../src/verb-vm.js";

type TiddlerFields = Record<string, unknown>;

class FakeTW5Engine {
  private readonly records = new Map<string, TiddlerFields>();

  readonly wiki = {
    addTiddler: (tiddler: { fields?: TiddlerFields } | TiddlerFields): void => {
      const fields = (tiddler && typeof tiddler === "object" && "fields" in tiddler && tiddler.fields)
        ? tiddler.fields
        : tiddler as TiddlerFields;
      const title = typeof fields.title === "string" ? fields.title : null;
      if (!title) throw new Error("title required");
      this.records.set(title, { ...fields });
    },
    getTiddler: (title: string): { fields: TiddlerFields } | undefined => {
      const fields = this.records.get(title);
      return fields ? { fields: { ...fields } } : undefined;
    },
    deleteTiddler: (title: string): void => {
      this.records.delete(title);
    },
  };

  readonly $tw = {
    Tiddler: class {
      fields: TiddlerFields;
      constructor(fields: TiddlerFields) { this.fields = fields; }
    },
    wiki: this.wiki,
  };
}

class FakeDaemonStore {
  readonly writes: LarTiddlerRecord[] = [];

  async put(record: LarTiddlerRecord): Promise<void> {
    this.writes.push(record);
  }
}

function makeInvocation(overrides: Partial<Verb> = {}): Verb {
  const fields = buildVerb({
    verb: "sync-wiki",
    args: { slug: "alpha" },
    requestedBy: "did:key:test",
    requestId: "req-test-1",
  });
  const parsed = parseVerb(fields);
  if (!parsed) throw new Error("failed to build test invocation");
  return { ...parsed, ...overrides };
}

describe("verb-vm", () => {
  test("placeVerb writes a pending volatile invocation into the VM wiki", () => {
    const tw5 = new FakeTW5Engine();

    const requestId = placeVerb(tw5 as never, {
      verb: "sync-wiki",
      args: { slug: "alpha" },
      requestedBy: "did:key:test",
      requestId: "req-place-1",
    });

    expect(requestId).toBe("req-place-1");
    const placed = tw5.wiki.getTiddler(`${VERB_URI_PREFIX}${requestId}`);
    expect(placed?.fields.status).toBe("pending");
  });

  test("patchVerb mutates the existing volatile invocation fields", () => {
    const tw5 = new FakeTW5Engine();
    const invocation = makeInvocation();
    tw5.wiki.addTiddler(invocation as unknown as TiddlerFields);

    patchVerb(tw5 as never, invocation.title, { status: "running", "started-at": "now" });

    const patched = tw5.wiki.getTiddler(invocation.title);
    expect(patched?.fields.status).toBe("running");
    expect(patched?.fields["started-at"]).toBe("now");
  });

  test("removeVerb tombstones the volatile invocation from the VM wiki", () => {
    const tw5 = new FakeTW5Engine();
    const invocation = makeInvocation();
    tw5.wiki.addTiddler(invocation as unknown as TiddlerFields);

    removeVerb(tw5 as never, invocation.title);

    expect(tw5.wiki.getTiddler(invocation.title)).toBeUndefined();
  });

  test("writeOutcome emits a durable summary outcome", async () => {
    const daemon = new FakeDaemonStore();
    const invocation = makeInvocation();

    await writeOutcome(daemon as unknown as CompositeStore, {
      invocation,
      status: "done",
      result: { recordsIngested: 3 },
    });

    expect(daemon.writes).toHaveLength(1);
    expect(daemon.writes[0]?.tiddler.title).toBe(`${OUTCOME_URI_PREFIX}${invocation.requestId}`);
    const results = JSON.parse(String(daemon.writes[0]?.tiddler.results ?? "{}")) as Record<string, { ok: boolean; output?: Record<string, unknown> }>;
    expect(results[VERB_RESULT_KEY]?.ok).toBe(true);
    expect(results[VERB_RESULT_KEY]?.output?.recordsIngested).toBe(3);
  });

  // ── audit-doc write-amplification cure (dd4da8481 class, new site: the outcome/audit bag) ────────
  describe("writeOutcome bounds an oversized per-carrier result array (the audit-doc OOM cure)", () => {
    const bigCarriers = (n: number): Array<Record<string, unknown>> =>
      Array.from({ length: n }, (_, i) => ({ uri: `lar:///ha.ka.ba/bags/x/carrier-${i}`, decision: i % 3 === 0 ? "add" : "tombstone" }));

    test("RED (pre-fix behavior, now GREEN): a 214-carrier ingest result stores a BOUNDED summary, not the full list", async () => {
      const daemon = new FakeDaemonStore();
      const invocation = makeInvocation();
      const carriers = bigCarriers(214);

      await writeOutcome(daemon as unknown as CompositeStore, {
        invocation, status: "done",
        result: { sourceUri: "lar:///ha.ka.ba/bags/x", toBag: "lar:///ha.ka.ba/bags/y", changeId: "c1", carriers },
      });

      const results = JSON.parse(String(daemon.writes[0]?.tiddler.results ?? "{}")) as
        Record<string, { ok: boolean; output?: Record<string, unknown> }>;
      const output = results[VERB_RESULT_KEY]?.output;
      // the stored field is NOT the 214-entry array — it's a bounded summary object
      expect(Array.isArray(output?.["carriers"])).toBe(false);
      const summary = output?.["carriers"] as { boundedArrayCount: number; tallies: Record<string, number>; sha256: string; sample: unknown[] };
      expect(summary.boundedArrayCount).toBe(214);
      expect(summary.tallies["add"]).toBe(Math.ceil(214 / 3));
      expect(summary.tallies["tombstone"]).toBe(214 - Math.ceil(214 / 3));
      expect(typeof summary.sha256).toBe("string");
      expect(summary.sha256.length).toBeGreaterThan(0);
      expect(summary.sample.length).toBeLessThanOrEqual(3);
      // the serialized doc body is now bounded, not proportional to N
      expect(String(daemon.writes[0]?.tiddler.results).length).toBeLessThan(2_000);
      // scalar sibling fields ride through untouched
      expect(output?.["sourceUri"]).toBe("lar:///ha.ka.ba/bags/x");
      expect(output?.["changeId"]).toBe("c1");
    });

    test("CONTROL — a small carrier list (at/under the cap) still records FAITHFULLY, full detail intact", async () => {
      const daemon = new FakeDaemonStore();
      const invocation = makeInvocation({ requestId: "req-small", title: `${VERB_URI_PREFIX}req-small` });
      const carriers = bigCarriers(5);

      await writeOutcome(daemon as unknown as CompositeStore, {
        invocation, status: "done",
        result: { sourceUri: "lar:///ha.ka.ba/bags/x", toBag: "lar:///ha.ka.ba/bags/y", changeId: "c2", carriers },
      });

      const results = JSON.parse(String(daemon.writes[0]?.tiddler.results ?? "{}")) as
        Record<string, { ok: boolean; output?: Record<string, unknown> }>;
      const output = results[VERB_RESULT_KEY]?.output;
      expect(Array.isArray(output?.["carriers"])).toBe(true);
      expect((output?.["carriers"] as unknown[]).length).toBe(5);
      expect((output?.["carriers"] as Array<{ uri: string }>)[0]?.uri).toBe(carriers[0]?.uri);
    });

    test("boundOutcomeOutput — pure unit: caps only arrays past the threshold, leaves the rest alone", () => {
      const small = boundOutcomeOutput({ items: [1, 2, 3], note: "x" }, 32);
      expect(small["items"]).toEqual([1, 2, 3]);
      const big = boundOutcomeOutput({ items: Array.from({ length: 33 }, (_, i) => i), note: "x" }, 32);
      expect(Array.isArray(big["items"])).toBe(false);
      expect((big["items"] as { boundedArrayCount: number }).boundedArrayCount).toBe(33);
      expect(big["note"]).toBe("x"); // non-array fields untouched
    });
  });

  test("dispatchVerb marks running, writes outcome, then removes the volatile invocation on success", async () => {
    const tw5 = new FakeTW5Engine();
    const daemon = new FakeDaemonStore();
    const invocation = makeInvocation();
    tw5.wiki.addTiddler(invocation as unknown as TiddlerFields);

    await dispatchVerb(
      tw5 as never,
      daemon as unknown as CompositeStore,
      invocation,
      async () => ({ status: "ok" }),
    );

    expect(tw5.wiki.getTiddler(invocation.title)).toBeUndefined();
    expect(daemon.writes).toHaveLength(1);
    const results = JSON.parse(String(daemon.writes[0]?.tiddler.results ?? "{}")) as Record<string, { ok: boolean; output?: Record<string, unknown> }>;
    expect(results[VERB_RESULT_KEY]?.ok).toBe(true);
    expect(results[VERB_RESULT_KEY]?.output?.status).toBe("ok");
  });

  test("dispatchVerb writes an error outcome and still removes the volatile invocation", async () => {
    const tw5 = new FakeTW5Engine();
    const daemon = new FakeDaemonStore();
    const invocation = makeInvocation({ requestId: "req-test-2", title: `${VERB_URI_PREFIX}req-test-2` });
    tw5.wiki.addTiddler(invocation as unknown as TiddlerFields);

    await dispatchVerb(
      tw5 as never,
      daemon as unknown as CompositeStore,
      invocation,
      async () => {
        throw new Error("boom");
      },
    );

    expect(tw5.wiki.getTiddler(invocation.title)).toBeUndefined();
    expect(daemon.writes).toHaveLength(1);
    expect(daemon.writes[0]?.tiddler.status).toBe("error");
    expect(daemon.writes[0]?.tiddler["error-message"]).toBe("boom");
  });
});
