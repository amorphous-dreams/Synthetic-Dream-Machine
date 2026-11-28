/**
 * uds-outcome-in-vessel-work — a CLI verb's answer reads off the outcome ledger where the island writes it: the vessel's
 * work store (`vessel-work`), which no recipe composes and no mirror names. The daemon wiki's working slot
 * (mirrored at `wikis/daemon-<F>`) and the daemon document rest no outcome body.
 *
 *   O1 — RED: the island lands the outcome in the work store a beat after the verb went out; the channel answers
 *        it, and neither the working slot nor the daemon document holds an outcome body
 *   O2 — CONTROL: an outcome that already stands answers a re-asked id with no second placement
 *   O3 — the main thread's own island ask (`askIslandVerb`) answers off the state store alike
 */
import { describe, test, expect } from "vitest";
import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConnection } from "node:net";
import { Repo } from "@automerge/automerge-repo";
import { emptyLarDoc, type LarDoc } from "@lararium/mesh/base-doc";
import { concludeVerb, OUTCOME_URI_PREFIX, RECEIPT_FACT_URI_PREFIX, type Verb } from "@lararium/mesh/verb-tiddler";
import { memoryWorkOf, reopenWorkOf } from "./work-store-fixture.js";
import { answerRingOf } from "@lararium/mesh/answer-ring";
import type { CompositeStore } from "@lararium/mesh/composite-store";
import type { CallTouches } from "@lararium/mesh/call-touches";
import { writeOutcome } from "@lararium/tw5";
import { startUdsChannel } from "../src/uds-channel.js";
import { askIslandVerb } from "../src/island-verb-ask.js";
import { claimStore } from "../src/owned-store.js";

function stand() {
  const repo = new Repo({ sharePolicy: async () => true });
  const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
  const workingHandle = repo.create<LarDoc>(emptyLarDoc());
  const stateHandle = repo.create<LarDoc>(emptyLarDoc());
  const state = memoryWorkOf(stateHandle);
  /** The island's write: the outcome lands in the state store, the work store. */
  const conclude = (requestId: string, verb: string, output: Record<string, unknown>): Promise<void> =>
    state.put(concludeVerb({ requestId, verb, status: "done", cause: "test-island", batchMode: "best-effort", results: { summary: { ok: true, output } } }),
      { kind: "lares-verb", requestId });
  return { repo, daemonHandle, workingHandle, stateHandle, state, conclude };
}

function send(socketPath: string, inv: unknown): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const sock = createConnection(socketPath);
    let buf = "";
    sock.setEncoding("utf8");
    sock.on("connect", () => sock.write(JSON.stringify(inv) + "\n"));
    sock.on("data", (chunk: string) => {
      buf += chunk;
      const nl = buf.indexOf("\n");
      if (nl !== -1) { const line = buf.slice(0, nl); sock.end(); resolve(JSON.parse(line)); }
    });
    sock.on("error", reject);
  });
}

async function socketAt(path: string): Promise<void> {
  for (let i = 0; i < 100; i++) { if (existsSync(path)) return; await new Promise((r) => setTimeout(r, 10)); }
  throw new Error(`socket never appeared at ${path}`);
}

const outcomeTitles = (handle: { doc(): LarDoc | undefined }): string[] =>
  Object.keys(handle.doc()?.tiddlers ?? {}).filter((t) => t.startsWith(OUTCOME_URI_PREFIX));

describe("a verb's answer reads off the outcome ledger in the work store", () => {
  test("O1/O2 — the channel answers an outcome the island lands in the work store late, and re-answers it with no second placement", async () => {
    const s = stand();
    const dir = mkdtempSync(join(tmpdir(), "uds-outcome-slot-"));
    const claim = await claimStore(dir, { holder: "vessel" });
    let placed = 0;
    const channel = startUdsChannel({
      stateHandle: s.stateHandle, state: s.state, claim, repo: s.repo, timeoutMs: 3_000,
      // The island answers a beat after the verb reached it, as a real verb does.
      placeVerb: (o) => { placed += 1; setTimeout(() => { void s.conclude(o.requestId, o.verb, { body: "private-heron" }); }, 50); },
    });
    try {
      await socketAt(claim.socketPath);
      const answer = await send(claim.socketPath, { verb: "get", args: {}, requestedBy: "did:key:test-operator", requestId: "req-slot-1" });
      expect(answer["status"], JSON.stringify(answer)).toBe("done");
      expect(JSON.stringify(answer["results"])).toContain("private-heron");
      expect((await s.state.listVisible()).filter(title => title.startsWith(OUTCOME_URI_PREFIX)), "the outcome rests in the work store").toEqual([`${OUTCOME_URI_PREFIX}req-slot-1`]);
      expect(outcomeTitles(s.workingHandle), "the mirrored working slot rests no outcome").toEqual([]);
      expect(outcomeTitles(s.daemonHandle), "the daemon document rests no outcome").toEqual([]);
      // O2 CONTROL: the stood outcome answers a re-asked id, and the verb never runs twice.
      const again = await send(claim.socketPath, { op: "receipt", requestId: "req-slot-1" });
      expect(JSON.stringify(again)).toContain("private-heron");
      expect(placed).toBe(1);
    } finally {
      channel.close();
      await claim.release();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("O3 — the main thread's own ask answers off the state store", async () => {
    const s = stand();
    const ask = askIslandVerb({
      state: s.state, verb: "seat-duties", args: {}, requestedBy: "0xvessel", requestId: "req-slot-ask",
      placeVerb: (o) => { setTimeout(() => { void s.conclude(o.requestId, o.verb, { ran: true }); }, 50); },
    });
    const out = await Promise.race([ask.answer, new Promise((_, reject) => setTimeout(() => reject(new Error("the ask never answered off the state store")), 3_000))]);
    expect(out).toEqual({ ran: true });
    expect(outcomeTitles(s.daemonHandle)).toEqual([]);
  });
});

// ── the outcome ledger diet (lar:///ha.ka.ba/kahua/memory/plan/outcome-ledger-diet, steps 1 and 2) ──────────────────
//
// These proofs run the island's own `writeOutcome` behind the door: the verdict row lands in the work store and
// the whole answer in the state store's answer ring, exactly as a vessel's island writes them.

type Placed = { requestId: string; verb: string; args: Record<string, unknown>; requestedBy: string; effectKey?: string; face?: string };
const invocationOf = (o: Placed): Verb => ({
  requestId: o.requestId, title: `lar:///lararium.local.vm/verbs/${o.requestId}`, action: o.verb, args: o.args, targets: [],
  batchMode: "best-effort", status: "pending", requestedBy: o.requestedBy, requestedAt: "t",
  ...(o.effectKey !== undefined ? { effectKey: o.effectKey } : {}), ...(o.face !== undefined ? { face: o.face } : {}),
} as unknown as Verb);
/** The island concludes one placed verb as done, with `result` and the change report `touched` (empty: it changed nothing). */
const islandConcludes = (state: CompositeStore, o: Placed, result: Record<string, unknown>, touched: CallTouches = {}): Promise<void> =>
  writeOutcome(state, { invocation: invocationOf(o), status: "done", result, touched });
const titlesUnder = async (store: CompositeStore, prefix: string): Promise<string[]> =>
  (await store.listVisible()).filter(title => title.startsWith(prefix));
const eventually = async (what: () => boolean, label: string): Promise<void> => {
  for (let i = 0; i < 200; i++) { if (what()) return; await new Promise((r) => setTimeout(r, 10)); }
  throw new Error(`never: ${label}`);
};

async function doorOver(s: ReturnType<typeof stand>, state: CompositeStore, island: (o: Placed) => void, dir = mkdtempSync(join(tmpdir(), "uds-ledger-diet-"))) {
  const claim = await claimStore(dir, { holder: "vessel" });
  const lines: string[] = [];
  const channel = startUdsChannel({
    stateHandle: s.stateHandle, state, claim, repo: s.repo, timeoutMs: 3_000, onLog: (line) => lines.push(line),
    placeVerb: (o) => island(o as unknown as Placed),
  });
  await socketAt(claim.socketPath);
  return { dir, lines, socketPath: claim.socketPath, close: async (keepDir = false) => { await channel.close(); await claim.release(); if (!keepDir) rmSync(dir, { recursive: true, force: true }); } };
}

describe("step 1 — reads leave the ledger alone", () => {
  test("RED: a read leaves no fact and no outcome row; the same id with the same input answers the held answer and places nothing; a changed input refuses by name", async () => {
    const s = stand();
    let placed = 0;
    const door = await doorOver(s, s.state, (o) => { placed += 1; setTimeout(() => { void islandConcludes(s.state, o, { now: "heron-day" }); }, 20); });
    try {
      const read = { verb: "ddate", args: { of: "today" }, requestedBy: "did:key:test-operator", requestId: "read-1" };
      const first = await send(door.socketPath, read);
      expect(first["status"], JSON.stringify(first)).toBe("done");
      expect(JSON.stringify(first["results"])).toContain("heron-day");
      expect(await titlesUnder(s.state, RECEIPT_FACT_URI_PREFIX), "no receipt fact").toEqual([]);
      expect(await titlesUnder(s.state, OUTCOME_URI_PREFIX), "no outcome row").toEqual([]);
      // SAME ID, SAME DIGEST: the held answer reads back; the island hears nothing.
      const again = await send(door.socketPath, read);
      expect(again["status"]).toBe("done");
      expect(JSON.stringify(again["results"])).toContain("heron-day");
      expect(placed, "placeVerb called once").toBe(1);
      // SAME ID, CHANGED DIGEST: refused by name, with its cure, and nothing runs.
      const changed = await send(door.socketPath, { ...read, args: { of: "tomorrow" } });
      expect(changed["status"]).toBe("error");
      expect(changed["refusal"]).toEqual({ reason: "request-id-reused-with-changed-input" });
      expect(String(changed["errorMessage"])).toContain("mint a fresh request id");
      expect(placed).toBe(1);
      expect(await titlesUnder(s.state, RECEIPT_FACT_URI_PREFIX), "the re-asks wrote no fact either").toEqual([]);
      // A receipt for the read answers from the ring too.
      const receipt = await send(door.socketPath, { op: "receipt", requestId: "read-1" });
      expect(receipt["state"]).toBe("done");
      expect(JSON.stringify(receipt)).toContain("heron-day");
      // PAST THE RING the read runs afresh, which changes nothing.
      answerRingOf(s.state).clear();
      const afresh = await send(door.socketPath, read);
      expect(afresh["status"]).toBe("done");
      expect(placed).toBe(2);
    } finally { await door.close(); }
  });

  test("RED: a same-id read asked while the first runs joins its wait: one placement, two answers", async () => {
    const s = stand();
    let placed = 0;
    const door = await doorOver(s, s.state, (o) => { placed += 1; setTimeout(() => { void islandConcludes(s.state, o, { now: "slow-heron" }); }, 150); });
    try {
      const read = { verb: "ddate", args: {}, requestedBy: "did:key:test-operator", requestId: "read-join" };
      const [a, b] = await Promise.all([send(door.socketPath, read), new Promise((r) => setTimeout(r, 40)).then(() => send(door.socketPath, read))]);
      expect(a["status"]).toBe("done");
      expect(b["status"]).toBe("done");
      expect(JSON.stringify(b["results"])).toContain("slow-heron");
      expect(placed).toBe(1);
    } finally { await door.close(); }
  });

  test("RED: a visit's body answers its caller once; a same-id re-ask reads it withheld from the ring", async () => {
    const s = stand();
    let placed = 0;
    const door = await doorOver(s, s.state, (o) => { placed += 1; setTimeout(() => { void islandConcludes(s.state, o, { visit: true, face: 1, tiddler: { text: "sibling-secret" } }); }, 20); });
    try {
      const read = { verb: "ddate", args: { of: "a-sibling" }, requestedBy: "did:key:test-operator", requestId: "read-visit" };
      expect(JSON.stringify(await send(door.socketPath, read))).toContain("sibling-secret");
      const again = await send(door.socketPath, read);
      expect(again["status"]).toBe("done");
      expect(again["visit"]).toEqual({ withheld: true });
      expect(JSON.stringify(again)).not.toContain("sibling-secret");
      expect(JSON.stringify(await send(door.socketPath, { op: "receipt", requestId: "read-visit" }))).not.toContain("sibling-secret");
      expect(placed).toBe(1);
    } finally { await door.close(); }
  });

  test("RED: a read whose change report comes back non-empty lands a verdict row and a done fact after the fact, and the seat says read-verb-wrote; CONTROL: a write keeps its fact and its row", async () => {
    const s = stand();
    const door = await doorOver(s, s.state, (o) => { setTimeout(() => { void islandConcludes(s.state, o, { now: "x" }, o.verb === "ddate" ? { "doc-it-wrote": ["head-1"] } : {}); }, 20); });
    try {
      const wrote = await send(door.socketPath, { verb: "ddate", args: {}, requestedBy: "did:key:test-operator", requestId: "read-wrote" });
      expect(wrote["status"]).toBe("done");
      expect(await titlesUnder(s.state, OUTCOME_URI_PREFIX)).toEqual([`${OUTCOME_URI_PREFIX}read-wrote`]);
      expect(door.lines.some((line) => line.includes("read-verb-wrote") && line.includes("ddate"))).toBe(true);
      await eventually(() => await titlesUnder(s.state, RECEIPT_FACT_URI_PREFIX).includes(`${RECEIPT_FACT_URI_PREFIX}read-wrote`), "the done fact minted after the fact");
      // CONTROL: a verb outside the read set rides the ledger as before.
      const write = await send(door.socketPath, { verb: "get", args: {}, requestedBy: "did:key:test-operator", requestId: "write-1" });
      expect(write["status"]).toBe("done");
      expect(await titlesUnder(s.state, RECEIPT_FACT_URI_PREFIX)).toContain(`${RECEIPT_FACT_URI_PREFIX}write-1`);
      expect(await titlesUnder(s.state, OUTCOME_URI_PREFIX)).toContain(`${OUTCOME_URI_PREFIX}write-1`);
    } finally { await door.close(); }
  });
});

describe("step 2 — the verdict row rests, the answer rides the ring", () => {
  const rowOf = (s: ReturnType<typeof stand>, requestId: string): Record<string, unknown> =>
    JSON.parse(JSON.stringify(s.stateHandle.doc()?.tiddlers[`${OUTCOME_URI_PREFIX}${requestId}`] ?? null)) as Record<string, unknown>;

  test("RED: the durable row holds no results and the live answer rides whole; a re-ask over a fresh channel on the same document answers done + result-sha256 + a released body and places nothing", async () => {
    const s = stand();
    let placed = 0;
    const island = (state: CompositeStore) => (o: Placed) => { placed += 1; setTimeout(() => { void islandConcludes(state, o, { body: "private-heron" }, { "doc-a": ["h1"] }); }, 20); };
    const write = { verb: "get", args: { n: 1 }, requestedBy: "did:key:test-operator", requestId: "diet-1" };
    const door = await doorOver(s, s.state, island(s.state));
    let sha = "";
    try {
      const live = await send(door.socketPath, write);
      expect(live["status"], JSON.stringify(live)).toBe("done");
      expect(JSON.stringify(live["results"]), "the live answer rides whole").toContain("private-heron");
      const stored = JSON.stringify(rowOf(s, "diet-1"));
      expect(stored, "the work store rests no body").not.toContain("private-heron");
      expect(stored).not.toContain("results");
      expect(stored).not.toContain("touched");
      expect(stored).not.toContain("\"cause\"");
      expect(stored).toContain("result-sha256");
      sha = String((await s.state.get(`${OUTCOME_URI_PREFIX}diet-1`))?.tiddler["result-sha256"]);
      expect(sha).toMatch(/^[0-9a-f]{64}$/);
      // Inside the same vessel life a re-ask reads the ring: the body whole, no second placement.
      const again = await send(door.socketPath, write);
      expect(JSON.stringify(again["results"])).toContain("private-heron");
      expect(placed).toBe(1);
    } finally { await door.close(true); }
    // A RESTART: a fresh state store over the same document, so a fresh, empty answer ring.
    const control2 = reopenWorkOf(s.stateHandle);
    const door2 = await doorOver(s, control2, island(control2), door.dir);
    try {
      const reasked = await send(door2.socketPath, write);
      expect(reasked["status"], JSON.stringify(reasked)).toBe("done");
      expect(reasked["results"]).toBeUndefined();
      expect(reasked["body"]).toMatchObject({ released: true, sha256: sha });
      expect(typeof (reasked["body"] as { bytes?: unknown }).bytes).toBe("number");
      expect(String((reasked["body"] as { cure?: unknown }).cure)).toContain("run the ingest again");
      const receipt = await send(door2.socketPath, { op: "receipt", requestId: "diet-1" });
      expect(receipt["state"]).toBe("done");
      expect(receipt["body"]).toMatchObject({ released: true, sha256: sha });
      expect(placed, "nothing placed across the restart").toBe(1);
    } finally { await door2.close(); }
  });

  test("RED: a visit's verdict row carries the flag and no body: across a restart the re-ask reads withheld, never a released hash", async () => {
    const s = stand();
    const island = (state: CompositeStore) => (o: Placed) => { setTimeout(() => { void islandConcludes(state, o, { visit: true, face: 1, tiddler: { text: "sibling-secret" } }); }, 20); };
    const visit = { verb: "get", args: { target: 1 }, requestedBy: "did:key:test-operator", requestId: "diet-visit" };
    const door = await doorOver(s, s.state, island(s.state));
    try { expect(JSON.stringify(await send(door.socketPath, visit))).toContain("sibling-secret"); } finally { await door.close(true); }
    expect(JSON.stringify(rowOf(s, "diet-visit"))).not.toContain("sibling-secret");
    const control2 = reopenWorkOf(s.stateHandle);
    const door2 = await doorOver(s, control2, island(control2), door.dir);
    try {
      const reasked = await send(door2.socketPath, visit);
      expect(reasked["status"]).toBe("done");
      expect(reasked["visit"]).toEqual({ withheld: true });
      expect(reasked["body"]).toBeUndefined();
      expect(JSON.stringify(reasked)).not.toContain("sibling-secret");
    } finally { await door2.close(); }
  });

  test("RED: the main thread's own ask (`askIslandVerb`) settles on the answer in the ring: a ledgered verb past its bare verdict row, and a read that lands no row at all", async () => {
    const s = stand();
    const within = <T,>(p: Promise<T>): Promise<T> => Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("the ask never settled on the answer")), 3_000))]);
    const ledgered = askIslandVerb({
      state: s.state, verb: "seat-duties", args: {}, requestedBy: "0xvessel", requestId: "ask-ledgered",
      placeVerb: (o) => { setTimeout(() => { void islandConcludes(s.state, o as Placed, { ran: true }); }, 20); },
    });
    expect(await within(ledgered.answer)).toEqual({ ran: true });
    expect(await titlesUnder(s.state, OUTCOME_URI_PREFIX)).toEqual([`${OUTCOME_URI_PREFIX}ask-ledgered`]);
    const read = askIslandVerb({
      state: s.state, verb: "wiki-status", args: {}, requestedBy: "0xvessel", requestId: "ask-read",
      placeVerb: (o) => { setTimeout(() => { void islandConcludes(s.state, o as Placed, { wikis: 3 }); }, 20); },
    });
    expect(await within(read.answer)).toEqual({ wikis: 3 });
    expect(await titlesUnder(s.state, OUTCOME_URI_PREFIX), "the read landed no row").toEqual([`${OUTCOME_URI_PREFIX}ask-ledgered`]);
  });
});
