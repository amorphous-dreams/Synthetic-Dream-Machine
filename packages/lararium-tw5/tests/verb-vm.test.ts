import { describe, test, expect } from "vitest";
import { VerbRefusal } from "@lararium/mesh/verb-refusal";
import type { CompositeStore } from "@lararium/mesh/composite-store";
import type { Verb } from "@lararium/mesh/verb-tiddler";
import type { LarTiddlerRecord } from "@lararium/mesh/tiddler-store";
import { OUTCOME_ERROR_BOUND, OUTCOME_URI_PREFIX, VERB_RESULT_KEY, VERB_URI_PREFIX, buildVerb, parseVerb, verbInputDigest, verdictRowOf } from "@lararium/mesh/verb-tiddler";
import { answerRingOf } from "@lararium/mesh/control-home";
import { addCallTouches } from "@lararium/mesh/call-touches";
import { canonicalJsonBytes, sha256HexBytesSync } from "@lararium/mesh/crypto";
import {
  AUDIT_ARRAY_CAP,
  boundOutcomeOutput,
  copyEffectOutcome,
  dispatchVerb,
  EFFECT_URI_PREFIX,
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

/** The whole answer's stored `results` text: it rides the control store's answer ring, memory alone, and rests in no row. */
const answerResults = (daemon: object, requestId: string): string =>
  String(answerRingOf(daemon).get(requestId)?.tiddler["results"]);
/** The whole answer's results map, parsed. */
const resultsOf = (daemon: object, requestId: string): Record<string, { ok: boolean; output?: Record<string, unknown> }> =>
  JSON.parse(String(answerRingOf(daemon).get(requestId)?.tiddler["results"] ?? "{}")) as Record<string, { ok: boolean; output?: Record<string, unknown> }>;

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

  test("writeOutcome rests a verdict row and hands the whole answer to the ring", async () => {
    const daemon = new FakeDaemonStore();
    const invocation = makeInvocation();

    await writeOutcome(daemon as unknown as CompositeStore, {
      invocation,
      status: "done",
      result: { recordsIngested: 3 },
    });

    expect(daemon.writes).toHaveLength(1);
    expect(daemon.writes[0]?.tiddler.title).toBe(`${OUTCOME_URI_PREFIX}${invocation.requestId}`);
    expect(daemon.writes[0]?.tiddler.results, "the durable row rests no body").toBeUndefined();
    const results = resultsOf(daemon, invocation.requestId);
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

      const results = resultsOf(daemon, invocation.requestId);
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
      // the answer's serialized body stays bounded, never proportional to N
      expect(answerResults(daemon, invocation.requestId).length).toBeLessThan(2_000);
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

      const results = resultsOf(daemon, invocation.requestId);
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

    // ── A ROW A PERSON MUST ACT ON STAYS NAMED ──────────────────────────────────────────────────────
    type Summary = { boundedArrayCount: number; tallies: Record<string, number>; held: Array<Record<string, unknown>>; heldMore: number; sample: unknown[] };
    const row = (i: number, decision: string): Record<string, unknown> =>
      ({ uri: `lar:///ha.ka.ba/bags/x/carrier-${i}`, decision, ...(decision === "refuse" ? { warnings: [`carrier-${i}: torn frame refused`] } : {}) });

    test("a summary HOLDS every refuse and conflict row whole, and says it left none unnamed", () => {
      const rows = Array.from({ length: 214 }, (_, i) => row(i, i === 7 || i === 150 ? "refuse" : i === 90 ? "conflict" : "ingest"));
      const summary = boundOutcomeOutput({ carriers: rows })["carriers"] as Summary;
      expect(summary.boundedArrayCount).toBe(214);
      expect(summary.tallies).toEqual({ ingest: 211, refuse: 2, conflict: 1 });
      expect(summary.held).toEqual([rows[7], rows[90], rows[150]]);
      expect(summary.heldMore).toBe(0);
      // The landed rows stay behind: the summary names no `ingest` row beyond its sample.
      expect(summary.held.some((r) => r["decision"] === "ingest")).toBe(false);
    });

    test("past the cap of held rows the summary states how many it leaves unnamed, never silence", () => {
      const rows = Array.from({ length: 100 }, (_, i) => row(i, i < 50 ? "refuse" : "ingest"));
      const summary = boundOutcomeOutput({ carriers: rows })["carriers"] as Summary;
      expect(summary.held.length).toBe(AUDIT_ARRAY_CAP);
      expect(summary.held).toEqual(rows.slice(0, AUDIT_ARRAY_CAP));
      expect(summary.heldMore).toBe(50 - AUDIT_ARRAY_CAP);
      expect(summary.tallies).toEqual({ refuse: 50, ingest: 50 });
    });

    test("CONTROL: a wave where nothing asks for a hand holds no row", () => {
      const summary = boundOutcomeOutput({ carriers: Array.from({ length: 40 }, (_, i) => row(i, i % 2 ? "ingest" : "noop")) })["carriers"] as Summary;
      expect(summary.held).toEqual([]);
      expect(summary.heldMore).toBe(0);
    });

    test("an array whose rows carry no decision tallies nothing: LOAD's titles never read `unknown`", () => {
      const titles = Array.from({ length: 40 }, (_, i) => `lar:///ha.ka.ba/bags/x/title-${i}`);
      const summary = boundOutcomeOutput({ titles, count: 40 })["titles"] as Summary;
      expect(summary.boundedArrayCount).toBe(40);
      expect(summary.tallies).toEqual({});
      expect(summary.held).toEqual([]);
      expect(summary.heldMore).toBe(0);
      expect(summary.sample).toEqual(titles.slice(0, 3));
      // A mixed array tallies the rows that carry a decision and invents none for the rest.
      const mixed = boundOutcomeOutput({ items: [...titles, { decision: "ingest" }, { nothing: 1 }, null] })["items"] as Summary;
      expect(mixed.tallies).toEqual({ ingest: 1 });
      expect(mixed.boundedArrayCount).toBe(43);
    });

    test("the stored outcome stays bounded whatever the wave refuses", async () => {
      const daemon = new FakeDaemonStore();
      const carriers = Array.from({ length: 2000 }, (_, i) => row(i, "refuse"));
      await writeOutcome(daemon as unknown as CompositeStore, { invocation: makeInvocation(), status: "done", result: { carriers } });
      const stored = answerResults(daemon, "req-test-1");
      const output = (JSON.parse(stored) as Record<string, { output?: Record<string, unknown> }>)[VERB_RESULT_KEY]?.output;
      expect((output?.["carriers"] as Summary).held.length).toBe(AUDIT_ARRAY_CAP);
      expect((output?.["carriers"] as Summary).heldMore).toBe(2000 - AUDIT_ARRAY_CAP);
      // Bounded by the cap, never by the wave: the same store size as a wave of 200 refusals.
      const daemon2 = new FakeDaemonStore();
      await writeOutcome(daemon2 as unknown as CompositeStore, { invocation: makeInvocation(), status: "done", result: { carriers: carriers.slice(0, 200) } });
      expect(Math.abs(stored.length - answerResults(daemon2, "req-test-1").length)).toBeLessThan(64);
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
    const results = resultsOf(daemon, invocation.requestId);
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

  test("a reactor that throws a VerbRefusal concludes with its machine reason; a plain Error carries none", async () => {
    const conclude = async (thrown: Error): Promise<Record<string, unknown>> => {
      const tw5 = new FakeTW5Engine();
      const daemon = new FakeDaemonStore();
      const invocation = makeInvocation({ requestId: "req-refusal", title: `${VERB_URI_PREFIX}req-refusal` });
      tw5.wiki.addTiddler(invocation as unknown as TiddlerFields);
      await dispatchVerb(tw5 as never, daemon as unknown as CompositeStore, invocation, async () => { throw thrown; });
      return daemon.writes[0]!.tiddler as Record<string, unknown>;
    };
    const refused = await conclude(new VerbRefusal("bag-retired", "bag-retired: CLEAR of x refused"));
    expect(refused["status"]).toBe("error");
    expect(refused["refusal"]).toBe("bag-retired");
    expect(refused["error-message"]).toBe("bag-retired: CLEAR of x refused");
    // CONTROL: a plain Error stamps no reason, even when its prose names one.
    const plain = await conclude(new Error("bag-retired: CLEAR of x refused"));
    expect(plain["status"]).toBe("error");
    expect(plain["refusal"]).toBeUndefined();
  });

  // ── digest-on-outcome + the effect index (D1, P2.5 iter 4) ─────────────────────────────────
  describe("writeOutcome stamps digest-on-outcome and writes the effect index", () => {
    test("a DONE outcome with no effectKey stamps input-digest, but writes no effect index (one write only)", async () => {
      const daemon = new FakeDaemonStore();
      const invocation = makeInvocation();

      await writeOutcome(daemon as unknown as CompositeStore, {
        invocation, status: "done", result: { ok: true },
      });

      expect(daemon.writes).toHaveLength(1);
      const stamped = daemon.writes[0]?.tiddler["input-digest"];
      expect(typeof stamped).toBe("string");
      expect((stamped as string).length).toBeGreaterThan(0);
      expect(daemon.writes[0]?.tiddler["effect-key"]).toBeUndefined();

      // The digest matches the SAME computation the dispatcher re-derives for arbitration —
      // a stale/duplicated formula here would silently desync the two readers.
      const expected = await verbInputDigest({
        verb: invocation.action, args: invocation.args, face: invocation.face,
      });
      expect(stamped).toBe(expected);
    });

    test("a DONE outcome WITH an effectKey writes the outcome AND the effect index (single writer, two records)", async () => {
      const daemon = new FakeDaemonStore();
      const invocation = makeInvocation({ effectKey: "eff-vm-1" });

      await writeOutcome(daemon as unknown as CompositeStore, {
        invocation, status: "done", result: { ok: true },
      });

      expect(daemon.writes).toHaveLength(2);
      const outcome = daemon.writes.find((w) => w.tiddler.title === `${OUTCOME_URI_PREFIX}${invocation.requestId}`);
      expect(outcome?.tiddler["effect-key"]).toBe("eff-vm-1");
      const fact = daemon.writes.find((w) => w.tiddler.title === `${EFFECT_URI_PREFIX}eff-vm-1`);
      expect(fact?.tiddler["effect-key"]).toBe("eff-vm-1");
      expect(fact?.tiddler["request-id"]).toBe(invocation.requestId);
      // THE EFFECT ROW ANSWERS A DEDUP BY ITSELF: it names its attempt's digest and the measure of the body it left.
      expect(fact?.tiddler["input-digest"]).toBe(outcome?.tiddler["input-digest"]);
      expect(fact?.tiddler["result-sha256"]).toBe(outcome?.tiddler["result-sha256"]);
      expect(fact?.tiddler["result-bytes"]).toBe(outcome?.tiddler["result-bytes"]);
      expect(typeof fact?.tiddler["result-sha256"]).toBe("string");
    });

    test("MUTATION — an ERROR outcome with an effectKey stamps the outcome but indexes NOTHING (a failed effect stays retryable)", async () => {
      const daemon = new FakeDaemonStore();
      const invocation = makeInvocation({ effectKey: "eff-vm-2" });

      await writeOutcome(daemon as unknown as CompositeStore, {
        invocation, status: "error", errorMessage: "boom",
      });

      expect(daemon.writes).toHaveLength(1); // outcome only — no effect index for an error
      expect(daemon.writes[0]?.tiddler.status).toBe("error");
      expect(daemon.writes[0]?.tiddler["effect-key"]).toBe("eff-vm-2");
    });
  });

  describe("copyEffectOutcome — the effect-dedup shortcut write (D1, P2.5 iter 4)", () => {
    test("writes a DONE outcome carrying effect-of + the prior results, and removes the volatile invocation", async () => {
      const tw5 = new FakeTW5Engine();
      const daemon = new FakeDaemonStore();
      const invocation = makeInvocation({
        requestId: "req-copy-1", title: `${VERB_URI_PREFIX}req-copy-1`, effectKey: "eff-copy",
      });
      tw5.wiki.addTiddler(invocation as unknown as TiddlerFields);

      const priorResults = { [VERB_RESULT_KEY]: { ok: true, output: { recordsIngested: 3 } } };
      await copyEffectOutcome(tw5 as never, daemon as unknown as CompositeStore, invocation, {
        priorRequestId: "req-copy-0", priorResults, inputDigest: "sha256:deadbeef",
      });

      expect(tw5.wiki.getTiddler(invocation.title)).toBeUndefined(); // tombstoned, same as dispatchVerb
      expect(daemon.writes).toHaveLength(1);
      const written = daemon.writes[0];
      expect(written?.tiddler.title).toBe(`${OUTCOME_URI_PREFIX}req-copy-1`);
      expect(written?.tiddler.status).toBe("done");
      expect(written?.tiddler["effect-of"]).toBe("req-copy-0");
      expect(written?.tiddler["effect-key"]).toBe("eff-copy");
      expect(written?.tiddler["input-digest"]).toBe("sha256:deadbeef");
      expect(written?.tiddler.results, "the copy's row rests no body").toBeUndefined();
      expect(written?.tiddler["result-sha256"]).toBe(sha256HexBytesSync(canonicalJsonBytes(priorResults)));
      expect(resultsOf(daemon, "req-copy-1")[VERB_RESULT_KEY]?.output?.recordsIngested).toBe(3);
    });

    test("RED (step 2): a copy whose prior body left answers effect-of beside the measure the effect row kept, and carries no results", async () => {
      const tw5 = new FakeTW5Engine();
      const daemon = new FakeDaemonStore();
      const invocation = makeInvocation({ requestId: "req-copy-2", title: `${VERB_URI_PREFIX}req-copy-2`, effectKey: "eff-copy" });
      tw5.wiki.addTiddler(invocation as unknown as TiddlerFields);
      await copyEffectOutcome(tw5 as never, daemon as unknown as CompositeStore, invocation, {
        priorRequestId: "req-copy-0", priorResults: null, inputDigest: "sha256:deadbeef", resultSha256: "abc123", resultBytes: "42",
      });
      const row = daemon.writes[0]?.tiddler as Record<string, unknown>;
      expect(row["effect-of"]).toBe("req-copy-0");
      expect(row["result-sha256"]).toBe("abc123");
      expect(row["result-bytes"]).toBe("42");
      expect(row["results"]).toBeUndefined();
      const answer = answerRingOf(daemon).get("req-copy-2")?.tiddler as Record<string, unknown>;
      expect(answer["results"], "an answer whose body left names no results").toBeUndefined();
      expect(answer["result-sha256"]).toBe("abc123");
      expect(answer["touched"], "a copy ran nothing and reports an empty tally").toBe("{}");
    });
  });

  // ── the outcome ledger diet (lar:///ha.ka.ba/kahua/memory/plan/outcome-ledger-diet) ─────────────────
  describe("step 2 — the verdict row: what an outcome rests as", () => {
    test("RED: the durable row keeps the verdict fields and the body's measure, and rests no results, touched, cause or batch mode", async () => {
      const daemon = new FakeDaemonStore();
      const invocation = makeInvocation({ requestId: "req-row-1", title: `${VERB_URI_PREFIX}req-row-1`, effectKey: "eff-row", face: "0xface" });
      const mark = { acting: 1, asker: "cli", session: null } as never;
      await writeOutcome(daemon as unknown as CompositeStore, { invocation, status: "done", result: { landed: "heron-body" }, touched: { "doc-a": ["h1"] }, chore: mark });
      const row = daemon.writes.find((w) => w.tiddler.title === `${OUTCOME_URI_PREFIX}req-row-1`)?.tiddler as Record<string, unknown>;
      expect(Object.keys(row).sort()).toEqual(["chore", "effect-key", "face", "input-digest", "request-id", "result-bytes", "result-sha256", "status", "tags", "title", "verb"]);
      expect(JSON.stringify(row)).not.toContain("heron-body");
      for (const gone of ["results", "touched", "cause", "batch-mode", "completed-at"]) expect(row[gone], gone).toBeUndefined();
      // The measure covers the canonical bytes of the bounded results map the answer carries.
      const results = resultsOf(daemon, "req-row-1");
      const bytes = canonicalJsonBytes(results);
      expect(row["result-sha256"]).toBe(sha256HexBytesSync(bytes));
      expect(row["result-bytes"]).toBe(String(bytes.length));
      // The whole answer rides the ring with everything the row dropped.
      const answer = answerRingOf(daemon).get("req-row-1")?.tiddler as Record<string, unknown>;
      expect(JSON.stringify(answer)).toContain("heron-body");
      expect(answer["touched"]).toBe(JSON.stringify({ "doc-a": ["h1"] }));
      expect(answer["cause"]).toBe(invocation.title);
    });

    test("RED: an error message past 1 KiB rests cut on the row with error-sha256 naming the whole; the answer carries it whole", async () => {
      const daemon = new FakeDaemonStore();
      const invocation = makeInvocation({ requestId: "req-row-err", title: `${VERB_URI_PREFIX}req-row-err` });
      const long = "é".repeat(OUTCOME_ERROR_BOUND);   // two bytes a character: twice the bound
      await writeOutcome(daemon as unknown as CompositeStore, { invocation, status: "error", errorMessage: long, refusal: "bag-retired" });
      const row = daemon.writes[0]?.tiddler as Record<string, unknown>;
      expect(new TextEncoder().encode(String(row["error-message"])).length).toBeLessThanOrEqual(OUTCOME_ERROR_BOUND);
      expect(long.startsWith(String(row["error-message"])), "cut on a character's edge").toBe(true);
      expect(row["error-sha256"]).toBe(sha256HexBytesSync(new TextEncoder().encode(long)));
      expect(row["refusal"]).toBe("bag-retired");
      expect(answerRingOf(daemon).get("req-row-err")?.tiddler["error-message"]).toBe(long);
      // CONTROL: a short message rests whole and names no hash.
      const short = verdictRowOf({ tiddler: { title: `${OUTCOME_URI_PREFIX}x`, status: "error", "error-message": "boom" } } as never).tiddler as Record<string, unknown>;
      expect(short["error-message"]).toBe("boom");
      expect(short["error-sha256"]).toBeUndefined();
    });

    test("RED: a visit's row carries the visit flag and no body", async () => {
      const daemon = new FakeDaemonStore();
      const invocation = makeInvocation({ requestId: "req-row-visit", title: `${VERB_URI_PREFIX}req-row-visit`, action: "tiddler-get", effectKey: "eff-visit-row" });
      await writeOutcome(daemon as unknown as CompositeStore, { invocation, status: "done", result: { visit: true, face: 1, tiddler: { text: "sibling-secret" } }, touched: {} });
      expect(daemon.writes, "a visit indexes no effect").toHaveLength(1);
      const row = daemon.writes[0]?.tiddler as Record<string, unknown>;
      expect(row["visit"]).toBe("true");
      expect(JSON.stringify(row)).not.toContain("sibling-secret");
    });
  });

  describe("step 1 — a read leaves the ledger alone", () => {
    test("RED: a READ verb with no effect key writes no row; its whole answer rides the ring", async () => {
      const daemon = new FakeDaemonStore();
      const invocation = makeInvocation({ requestId: "req-read-1", title: `${VERB_URI_PREFIX}req-read-1`, action: "tiddler-get" });
      await writeOutcome(daemon as unknown as CompositeStore, { invocation, status: "done", result: { tiddler: { text: "read-body" } }, touched: {} });
      expect(daemon.writes, "no outcome row, no effect row").toEqual([]);
      const answer = answerRingOf(daemon).get("req-read-1")?.tiddler as Record<string, unknown>;
      expect(JSON.stringify(answer)).toContain("read-body");
      expect(typeof answer["input-digest"], "the answer names the digest a same-id re-ask compares").toBe("string");
      // An error answers the same way: a refused read leaves nothing behind either.
      const refused = makeInvocation({ requestId: "req-read-err", title: `${VERB_URI_PREFIX}req-read-err`, action: "tiddler-get" });
      await writeOutcome(daemon as unknown as CompositeStore, { invocation: refused, status: "error", errorMessage: "no such title", touched: {} });
      expect(daemon.writes).toEqual([]);
      expect(answerRingOf(daemon).get("req-read-err")?.tiddler["status"]).toBe("error");
    });

    test("CONTROL: a READ verb asked WITH an effect key keeps the ledger's road, row and effect index both", async () => {
      const daemon = new FakeDaemonStore();
      const invocation = makeInvocation({ requestId: "req-read-eff", title: `${VERB_URI_PREFIX}req-read-eff`, action: "tiddler-get", effectKey: "eff-read" });
      await writeOutcome(daemon as unknown as CompositeStore, { invocation, status: "done", result: { tiddler: { text: "x" } }, touched: {} });
      expect(daemon.writes.map((w) => w.tiddler.title)).toEqual([`${OUTCOME_URI_PREFIX}req-read-eff`, `${EFFECT_URI_PREFIX}eff-read`]);
    });

    test("RED: a read whose change report comes back non-empty lands its verdict row after the fact (read-verb-wrote)", async () => {
      const tw5 = new FakeTW5Engine();
      const daemon = new FakeDaemonStore();
      const warned: string[] = [];
      const warn = console.warn;
      console.warn = (...args: unknown[]) => { warned.push(args.map(String).join(" ")); };
      try {
        const invocation = makeInvocation({ requestId: "req-read-wrote", title: `${VERB_URI_PREFIX}req-read-wrote`, action: "wiki-status" });
        tw5.wiki.addTiddler(invocation as unknown as TiddlerFields);
        // The handler's call changes a document: the island's report for this call names it.
        await dispatchVerb(tw5 as never, daemon as unknown as CompositeStore, invocation, async () => {
          addCallTouches("req-read-wrote", { "doc-written": ["head-1"] });
          return { status: "read" };
        });
        expect(daemon.writes.map((w) => w.tiddler.title)).toEqual([`${OUTCOME_URI_PREFIX}req-read-wrote`]);
        expect(daemon.writes[0]?.tiddler.status).toBe("done");
        expect(daemon.writes[0]?.tiddler.results).toBeUndefined();
        expect(warned.some((line) => line.includes("read-verb-wrote") && line.includes("wiki-status"))).toBe(true);
        // CONTROL: the same read with an empty report lands nothing and warns nothing.
        warned.length = 0;
        const clean = makeInvocation({ requestId: "req-read-clean", title: `${VERB_URI_PREFIX}req-read-clean`, action: "wiki-status" });
        tw5.wiki.addTiddler(clean as unknown as TiddlerFields);
        await dispatchVerb(tw5 as never, daemon as unknown as CompositeStore, clean, async () => ({ status: "read" }));
        expect(daemon.writes).toHaveLength(1);
        expect(warned).toEqual([]);
      } finally { console.warn = warn; }
    });
  });
});
