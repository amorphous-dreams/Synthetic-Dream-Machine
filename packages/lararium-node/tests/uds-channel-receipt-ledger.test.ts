/**
 * uds-channel-receipt-ledger — the DURABLE single-writer request ledger (D1, P2.5 iter 4).
 *
 * Closes, live over a real Unix-domain socket crossing a REAL vessel-channel restart:
 *   - H1R: a same-id, same-args reuse re-running after a restart (it must answer the stored
 *     receipt, never dispatch a second time);
 *   - H4: a cancelled id's abandonment not surviving a restart;
 *   - M1: the receipt ring — past its bound, the oldest id evicts to `retention-gap`, never a
 *     silent re-run and never a bare "unknown";
 *   - M3″: a direct re-run of an abandoned/evicted id answers an ADDITIVE `refusal:{reason}`
 *     beside the existing `{status:"error"}` shape.
 *
 * "Restart" here means: close this channel's claim (as `main.ts`'s shutdown does), release the
 * rendezvous name, then claim + start a FRESH channel — a brand-new in-memory `FactLedger`, with
 * NOTHING carried over except the same Automerge `Repo`/`daemonHandle` (the durable floor this
 * design banks on) and the same on-disk store directory. Anything the second channel answers
 * correctly, it answers from the FACT, never from memory the first channel happened to keep warm.
 */
import { describe, test, expect, onTestFinished } from "vitest";
import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConnection } from "node:net";
import { Repo, type DocHandle } from "@automerge/automerge-repo";
import { emptyLarDoc, NoWorkingLayerRefusal, buildReceiptFact, concludeVerb, verbInputDigest, RECEIPT_FACT_URI_PREFIX, OUTCOME_URI_PREFIX, DAEMON_BAG_ID, AutomergeDocStore, CompositeStore, wikiSlotUri, type LarDoc } from "@lararium/mesh";
import { FactLedger, startUdsChannel, type UdsChannel } from "../src/uds-channel.js";
import { claimStore, type StoreClaim } from "../src/owned-store.js";
import { plainRecord, outcomeBytesOf } from "@lararium/mesh";
import { arrival } from "../../lararium-mesh/tests/handshake.js";

interface Placed { verb: string; args: Record<string, unknown>; requestedBy: string; requestId: string; effectKey?: string; }

function sendLine(socketPath: string, line: unknown): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const sock = createConnection(socketPath);
    let buf = "";
    sock.setEncoding("utf8");
    sock.on("connect", () => { sock.write(JSON.stringify(line) + "\n"); });
    sock.on("data", (chunk: string) => {
      buf += chunk;
      const nl = buf.indexOf("\n");
      if (nl !== -1) { const l = buf.slice(0, nl); sock.end(); resolve(JSON.parse(l)); }
    });
    sock.on("error", reject);
  });
}

async function waitForSocket(path: string): Promise<void> {
  for (let i = 0; i < 100; i++) {
    if (existsSync(path)) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error(`socket never appeared at ${path}`);
}

/** A worker that always lands a `done` outcome, echoing the dispatcher's own lifecycle closely
 *  enough for this suite: write the durable outcome straight into the daemon doc. */
function doneWorker(counter: { n: number }) {
  return (p: Placed, daemonHandle: ReturnType<Repo["create"]>) => {
    counter.n++;
    const outcome = concludeVerb({
      requestId: p.requestId, verb: p.verb, status: "done",
      cause: "test-worker", batchMode: "best-effort",
      results: { summary: { ok: true } },
    });
    daemonHandle.change((doc) => { doc.tiddlers[outcome.tiddler.title] = outcome as unknown as LarDoc["tiddlers"][string]; });
  };
}

/** A worker that lands a `done` outcome whose results carry a body of `bodyOf(requestId)` bytes. */
function bodyWorker(counter: { n: number }, bodyOf: (requestId: string) => number) {
  return (p: Placed, daemonHandle: ReturnType<Repo["create"]>) => {
    counter.n++;
    const outcome = concludeVerb({
      requestId: p.requestId, verb: p.verb, status: "done",
      cause: "test-worker", batchMode: "best-effort",
      results: { summary: { ok: true }, body: "b".repeat(bodyOf(p.requestId)) },
    });
    daemonHandle.change((doc) => { doc.tiddlers[outcome.tiddler.title] = outcome as unknown as LarDoc["tiddlers"][string]; });
  };
}

/** The measure of the outcome record a vessel holds for `requestId`, read off the store. */
function storedOutcomeBytes(v: { daemonHandle: ReturnType<Repo["create"]> }, requestId: string): number {
  return outcomeBytesOf(plainRecord((v.daemonHandle.doc() as LarDoc).tiddlers[`${OUTCOME_URI_PREFIX}${requestId}`]!).tiddler as Record<string, unknown>);
}

/** A fixture carrying what a real vessel carries across a restart: the Automerge repo/doc + the
 *  on-disk store dir. Only the CLAIM and the CHANNEL are torn down and re-made — the shape of an
 *  orderly `main.ts` shutdown + reboot, never a bare in-memory reset. */
class Vessel {
  claim!: StoreClaim & { readonly holder: "vessel" };
  channel!: UdsChannel;
  constructor(
    readonly repo: Repo,
    readonly daemonHandle: ReturnType<Repo["create"]>,
    readonly workingHandle: ReturnType<Repo["create"]>,
    readonly dir: string,
    readonly placeVerbImpl: (p: Placed, daemonHandle: ReturnType<Repo["create"]>) => void,
    readonly ring?: number,
    readonly ringBytes?: number,
  ) {}

  compositeForBoot(): CompositeStore {
    const composite = new CompositeStore();
    composite.addLayer({ bagId: DAEMON_BAG_ID, store: new AutomergeDocStore(this.daemonHandle as never, DAEMON_BAG_ID), writable: true, defaultWritable: false });
    composite.addLayer({ bagId: wikiSlotUri("daemon", "working"), store: new AutomergeDocStore(this.workingHandle as never, wikiSlotUri("daemon", "working")), writable: true });
    return composite;
  }

  static async boot(opts: {
    placeVerbImpl: (p: Placed, daemonHandle: ReturnType<Repo["create"]>) => void;
    ring?: number;
    ringBytes?: number;
    dir?: string;
    repo?: Repo;
    daemonHandle?: ReturnType<Repo["create"]>;
  }): Promise<Vessel> {
    const repo = opts.repo ?? new Repo({ sharePolicy: async () => true });
    const daemonHandle = opts.daemonHandle ?? repo.create<LarDoc>(emptyLarDoc());
    const workingHandle = repo.create<LarDoc>(emptyLarDoc());
    const dir = opts.dir ?? mkdtempSync(join(tmpdir(), "uds-receipt-ledger-"));
    const v = new Vessel(repo, daemonHandle, workingHandle, dir, opts.placeVerbImpl, opts.ring, opts.ringBytes);
    await v.start();
    return v;
  }

  static async restore(opts: {
    repo: Repo;
    daemonHandle: DocHandle<LarDoc>;
    workingHandle: DocHandle<LarDoc>;
    placeVerbImpl: (p: Placed, daemonHandle: ReturnType<Repo["create"]>) => void;
    ring?: number;
    dir: string;
  }): Promise<Vessel> {
    const vessel = new Vessel(opts.repo, opts.daemonHandle, opts.workingHandle, opts.dir, opts.placeVerbImpl, opts.ring);
    await vessel.start();
    return vessel;
  }

  private async start(): Promise<void> {
    this.claim = await claimStore(this.dir, { holder: "vessel" });
    this.channel = startUdsChannel({
      daemonHandle: this.daemonHandle,
      composite: this.compositeForBoot(),
      placeVerb: (o) => this.placeVerbImpl(o as Placed, this.daemonHandle),
      claim: this.claim,
      repo: this.repo,
      ...(this.ring !== undefined && { ring: this.ring }),
      ...(this.ringBytes !== undefined && { ringBytes: this.ringBytes }),
      timeoutMs: 1_000,
    });
    await waitForSocket(this.claim.socketPath);
  }

  get socketPath(): string { return this.claim.socketPath; }

  /** Orderly shutdown + reboot — a FRESH channel/ledger, nothing in-memory carried over except
   *  the repo/doc and the store dir (the durable floor this whole lane exists to prove). */
  async restart(whileDown?: () => void): Promise<void> {
    this.channel.close();
    await this.claim.release();
    whileDown?.();
    await this.start();
  }

  async teardown(): Promise<void> {
    this.channel.close();
    await this.claim.release();
    rmSync(this.dir, { recursive: true, force: true });
  }
}

/** Dispatch `inv` to a worker that never lands an outcome, and return once the worker holds it: the
 *  fact is `committed` and flushed. The caller's wait stays open (its budget is the verb's own
 *  adaptive bound), so the test ends this boot instead of waiting it out. */
async function dispatchAndStrand(v: Vessel, counter: { n: number }, inv: Record<string, unknown>): Promise<void> {
  void sendLine(v.socketPath, inv).catch(() => { /* the boot ends under it */ });
  for (let i = 0; i < 500 && counter.n === 0; i++) await new Promise((r) => setTimeout(r, 10));
  expect(counter.n).toBe(1);
}

describe("uds-channel — the DURABLE receipt-fact ledger (D1, H1R+H4+M1+M3″)", () => {
  test("a fresh Repo and fresh stores seed working-layer facts in sequence order", async () => {
    const counter = { n: 0 };
    const first = await Vessel.boot({ placeVerbImpl: doneWorker(counter), ring: 8 });
    let second: Vessel | undefined;
    let secondRepo: Repo | undefined;
    try {
      const ids = ["fresh-repo-1", "fresh-repo-2", "fresh-repo-3"];
      for (const requestId of ids) {
        const answer = await sendLine(first.socketPath, { verb: "nexus-kapae", args: {}, requestedBy: "did:key:test", requestId });
        expect(answer["status"]).toBe("done");
      }
      const daemonBytes = await first.repo.export(first.daemonHandle.url);
      const workingBytes = await first.repo.export(first.workingHandle.url);
      expect(daemonBytes).toBeTruthy();
      expect(workingBytes).toBeTruthy();
      first.channel.close();
      await first.claim.release();
      await first.repo.shutdown();

      secondRepo = new Repo({ sharePolicy: async () => true });
      const daemonHandle = secondRepo.import<LarDoc>(daemonBytes!);
      const workingHandle = secondRepo.import<LarDoc>(workingBytes!);
      second = await Vessel.restore({ repo: secondRepo, daemonHandle, workingHandle, placeVerbImpl: doneWorker(counter), ring: 8, dir: first.dir });
      const ledger = new FactLedger(second.compositeForBoot(), secondRepo, 8, second.claim.bootEpoch);
      const facts = await Promise.all(ids.map((requestId) => ledger.get(requestId)));
      expect(facts.map((fact) => fact && fact !== "torn" ? fact.seq : null)).toEqual([0, 1, 2]);
      for (const requestId of ids) {
        expect((await sendLine(second.socketPath, { op: "receipt", requestId }))["state"]).toBe("done");
      }
      expect(counter.n).toBe(3);
    } finally {
      if (second) await second.teardown();
      else rmSync(first.dir, { recursive: true, force: true });
      if (secondRepo) await secondRepo.shutdown();
    }
  });

  test("a missing working default refuses before dispatch and records nothing", async () => {
    const repo = new Repo({ sharePolicy: async () => true });
    const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
    const composite = new CompositeStore();
    composite.addLayer({ bagId: DAEMON_BAG_ID, store: new AutomergeDocStore(daemonHandle, DAEMON_BAG_ID), writable: true, defaultWritable: false });
    const dir = mkdtempSync(join(tmpdir(), "uds-no-working-"));
    const claim = await claimStore(dir, { holder: "vessel" });
    try {
      expect(() => startUdsChannel({ daemonHandle, composite, claim, repo, placeVerb: () => {} }))
        .toThrow(NoWorkingLayerRefusal);
      expect(Object.keys(daemonHandle.doc()!.tiddlers)).toEqual([]);
    } finally {
      await claim.release();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("cancel → restart → a dispatch under the SAME id refuses `abandoned`, with the additive refusal reason", async () => {
    const counter = { n: 0 };
    const v = await Vessel.boot({ placeVerbImpl: doneWorker(counter) });
    try {
      const requestId = "req-cancel-restart";
      const cancelAnswer = await sendLine(v.socketPath, { op: "cancel", requestId });
      expect(cancelAnswer).toEqual({ requestId, state: "abandoned" });

      await v.restart();

      const retry = await sendLine(v.socketPath, { verb: "nexus-kapae", args: {}, requestedBy: "did:key:test", requestId });
      expect(counter.n).toBe(0); // never dispatched, before or after the restart
      expect(retry["status"]).toBe("error");
      expect(String(retry["errorMessage"])).toMatch(/already refused request req-cancel-restart before commit/);
      expect((retry["refusal"] as { reason?: string } | undefined)?.reason).toBe("abandoned");
    } finally { await v.teardown(); }
  });

  test("an abandoned (EOF-dropped) id reused with CHANGED args → restart → still refuses `abandoned`, on state alone", async () => {
    const counter = { n: 0 };
    const v = await Vessel.boot({ placeVerbImpl: doneWorker(counter) });
    try {
      const requestId = "req-changed-args-restart";
      // An explicit cancel before dispatch — records an `abandoned` fact with NO digest at all
      // ({@link FactLedger.cancel}), matching the drop-then-reuse shape M3″/H4 cover.
      await sendLine(v.socketPath, { op: "cancel", requestId });

      // Reach the EOF-drop path directly: a live drop records the invocation's own digest (unlike
      // `cancel`, which records none), so a fresh id proves `abandoned` refuses on STATE ALONE
      // even when a fact-bearing digest is in play and the retry's own args differ from it.
      const dropId = "req-eof-drop-digest";
      const sock = createConnection(v.socketPath);
      await new Promise<void>((resolve, reject) => { sock.once("connect", resolve); sock.once("error", reject); });
      sock.end(JSON.stringify({ verb: "nexus-kapae", args: { a: 1 }, requestedBy: "did:key:test", requestId: dropId }) + "\n");
      await new Promise<void>((resolve) => sock.once("close", resolve));
      await new Promise((r) => setTimeout(r, 100));
      expect(counter.n).toBe(0);

      await v.restart();

      const changed = await sendLine(v.socketPath, { verb: "nexus-kapae", args: { a: 2 }, requestedBy: "did:key:test", requestId: dropId });
      expect(counter.n).toBe(0);
      expect(changed["status"]).toBe("error");
      expect(String(changed["errorMessage"])).toMatch(/already refused request req-eof-drop-digest before commit/);
      expect((changed["refusal"] as { reason?: string } | undefined)?.reason).toBe("abandoned");

      // CONTROL: the SAME-digest reuse of a genuinely content-mismatched, still-live (non-abandoned)
      // id still refuses by digest name — proven by the ring/done-reuse tests elsewhere in this file
      // exercising the `already-committed` and `done` paths, which never touch this `abandoned` branch.
    } finally { await v.teardown(); }
  });

  test("a summons-shaped outcome (a remote peer's own digest, never arbitrated by this channel) + a same-args UDS dispatch answers the outcome, with NO false refusal", async () => {
    const counter = { n: 0 };
    const v = await Vessel.boot({ placeVerbImpl: doneWorker(counter) });
    try {
      const requestId = "req-summons-shaped";
      const verb = "nexus-kapae";
      const args = { a: 1 };
      const requestedBy = "did:key:test";
      // A remote peer's own summons landed straight in the durable doc — this channel never
      // arbitrated it (no `committed` fact exists for this id), only OBSERVES it via the
      // outcome-prefix subscription, which mints a fresh fact seeded with the WORKER's own
      // stamped digest (the worker's `verbInputDigest` formula, computed independently here to
      // model a remote peer doing the same).
      const workerDigest = await verbInputDigest({ verb, args });
      const outcome = concludeVerb({
        requestId, verb, status: "done", cause: "remote-summons", batchMode: "best-effort",
        results: { summary: { ok: true } }, inputDigest: workerDigest,
      });
      // The ledger's own write carries the wait: the subscription has minted the fact once the working layer
      // holds it. The listener stands before the outcome lands, so no change slips past it.
      const minted = arrival<void>(`the ledger minting a fact for ${requestId} in the working layer`);
      const factTitle = `${RECEIPT_FACT_URI_PREFIX}${requestId}`;
      const onWorking = (): void => { if (v.workingHandle.doc()!.tiddlers[factTitle] !== undefined) minted.arrive(); };
      v.workingHandle.on("change", onWorking);
      v.daemonHandle.change((doc) => { doc.tiddlers[outcome.tiddler.title] = outcome as unknown as LarDoc["tiddlers"][string]; });
      try { await minted.arrived; } finally { v.workingHandle.off("change", onWorking); }

      // A same-args UDS dispatch under the SAME id computes the IDENTICAL digest — `arbitrate`
      // finds the minted fact's digest matches, refuses `already-committed` (never a changed-input
      // refusal), and answers the ALREADY-LANDED outcome rather than running the handler.
      const answer = await sendLine(v.socketPath, { verb, args, requestedBy, requestId });
      expect(counter.n).toBe(0); // never dispatched — the outcome already existed
      expect(answer["status"]).toBe("done");
      expect(answer["refusal"]).toBeUndefined();
    } finally { await v.teardown(); }
  });

  test("`done` → restart → a same-args reuse answers the STORED receipt, with NO re-dispatch", async () => {
    const counter = { n: 0 };
    const v = await Vessel.boot({ placeVerbImpl: doneWorker(counter) });
    try {
      const requestId = "req-done-restart-reuse";
      const inv = { verb: "nexus-kapae", args: { a: 1 }, requestedBy: "did:key:test", requestId };
      const first = await sendLine(v.socketPath, inv);
      expect(first["status"]).toBe("done");
      expect(counter.n).toBe(1);

      await v.restart();

      const second = await sendLine(v.socketPath, inv);
      expect(second["status"]).toBe("done");
      expect(counter.n).toBe(1); // the counting handler proves NO re-dispatch across the restart

      const receipt = await sendLine(v.socketPath, { op: "receipt", requestId });
      expect(receipt["state"]).toBe("done");
    } finally { await v.teardown(); }
  });

  test("a fresh ledger reads receipts only from its working layer", async () => {
    const v = await Vessel.boot({ placeVerbImpl: () => {} });
    try {
      const requestId = "receipt-in-the-daemon-bag";
      const daemonBagReceipt = buildReceiptFact({ requestId, state: "done", seq: 41, inputDigest: "old-digest", outcomeBytes: 0 });
      v.daemonHandle.change((doc) => { doc.tiddlers[daemonBagReceipt.tiddler.title] = daemonBagReceipt as unknown as LarDoc["tiddlers"][string]; });
      await v.repo.flush();
      expect(v.daemonHandle.doc()!.tiddlers[daemonBagReceipt.tiddler.title]).toBeDefined();
      await v.restart();

      const answer = await sendLine(v.socketPath, { op: "receipt", requestId });
      expect(answer["state"]).toBe("unknown");
      expect(v.workingHandle.doc()!.tiddlers[daemonBagReceipt.tiddler.title]).toBeUndefined();
    } finally { await v.teardown(); }
  });

  test("ring N=3: the 4th outcome evicts the 1st — its receipt reads `retention-gap`, and a same-id dispatch answers `retention-gap` with no run", async () => {
    const counter = { n: 0 };
    const v = await Vessel.boot({ placeVerbImpl: doneWorker(counter), ring: 3 });
    try {
      const ids = ["req-ring-1", "req-ring-2", "req-ring-3", "req-ring-4"];
      for (const requestId of ids) {
        const answer = await sendLine(v.socketPath, { verb: "nexus-kapae", args: { requestId }, requestedBy: "did:key:test", requestId });
        expect(answer["status"]).toBe("done");
      }
      expect(counter.n).toBe(4);

      // Bagless receipt facts follow the default working layer. The dispatcher outcome keeps its explicit daemon destination.
      expect(v.workingHandle.doc()!.tiddlers[`${RECEIPT_FACT_URI_PREFIX}${ids[0]}`]).toBeDefined();
      expect(v.daemonHandle.doc()!.tiddlers[`${RECEIPT_FACT_URI_PREFIX}${ids[0]}`]).toBeUndefined();
      expect(v.daemonHandle.doc()!.tiddlers[`${OUTCOME_URI_PREFIX}${ids[0]}`]).toBeDefined();

      const receipt = await sendLine(v.socketPath, { op: "receipt", requestId: ids[0] });
      expect(receipt["state"]).toBe("evicted");
      const liveOutcome = v.daemonHandle.doc()!.tiddlers[`${OUTCOME_URI_PREFIX}${ids[0]}`];
      expect(liveOutcome?.meta?.deleted).toBe(true);
      expect(v.workingHandle.doc()!.tiddlers[`${OUTCOME_URI_PREFIX}${ids[0]}`]).toBeUndefined();
      expect(await v.compositeForBoot().getLive(`${OUTCOME_URI_PREFIX}${ids[0]}`)).toBeNull();

      const redispatch = await sendLine(v.socketPath, { verb: "nexus-kapae", args: { requestId: ids[0] }, requestedBy: "did:key:test", requestId: ids[0] });
      expect(counter.n).toBe(4); // no second run
      expect(redispatch["status"]).toBe("error");
      expect((redispatch["refusal"] as { reason?: string } | undefined)?.reason).toBe("retention-gap");

      // CONTROL: the 2nd/3rd/4th ids — still within the ring — read their outcomes exactly.
      for (const requestId of ids.slice(1)) {
        const receipt2 = await sendLine(v.socketPath, { op: "receipt", requestId });
        expect(receipt2["state"]).toBe("done");
      }
      await v.restart();
      const seqs = ids.map((id) => Number((plainRecord(v.workingHandle.doc()!.tiddlers[`${RECEIPT_FACT_URI_PREFIX}${id}`]!).tiddler as Record<string, unknown>)["seq"]));
      expect(seqs).toEqual([0, 1, 2, 3]);
      expect((await sendLine(v.socketPath, { op: "receipt", requestId: ids[0] }))["state"]).toBe("evicted");
    } finally { await v.teardown(); }
  });

  test("CLOCKLESS CONTROL: a set-back and a set-forward Date.now() leave the cancel→abandon→refuse verdict unchanged", async () => {
    for (const skewMs of [-10 * 365 * 24 * 3600 * 1000, 10 * 365 * 24 * 3600 * 1000]) {
      const counter = { n: 0 };
      const v = await Vessel.boot({ placeVerbImpl: doneWorker(counter) });
      const realNow = Date.now;
      try {
        const requestId = `req-skew-${skewMs}`;
        Date.now = () => realNow() + skewMs;
        try {
          await sendLine(v.socketPath, { op: "cancel", requestId });
          await v.restart();
          const retry = await sendLine(v.socketPath, { verb: "nexus-kapae", args: {}, requestedBy: "did:key:test", requestId });
          expect(counter.n).toBe(0);
          expect(retry["status"]).toBe("error");
          expect((retry["refusal"] as { reason?: string } | undefined)?.reason).toBe("abandoned");
        } finally { Date.now = realNow; }
      } finally { await v.teardown(); }
    }
  });

  test("a request committed by a boot that ended with no outcome reads `interrupted` after the next boot, and refuses a same-id dispatch without waiting", async () => {
    const counter = { n: 0 };
    const v = await Vessel.boot({ placeVerbImpl: () => { counter.n++; } }); // never lands an outcome
    try {
      const requestId = "req-interrupted";
      const inv = { verb: "nexus-kapae", args: { a: 1 }, requestedBy: "did:key:test", requestId, timeoutMs: 100 };
      await dispatchAndStrand(v, counter, inv);
      // CONTROL: the same boot still reads `committed`.
      expect((await sendLine(v.socketPath, { op: "receipt", requestId }))["state"]).toBe("committed");
      const firstEpoch = v.claim.bootEpoch;

      await v.restart();
      expect(v.claim.bootEpoch).toBeGreaterThan(firstEpoch);

      expect((await sendLine(v.socketPath, { op: "receipt", requestId }))["state"]).toBe("interrupted");
      const stored = plainRecord(v.workingHandle.doc()!.tiddlers[`${RECEIPT_FACT_URI_PREFIX}${requestId}`]!).tiddler as Record<string, unknown>;
      expect(stored["state"]).toBe("interrupted");
      expect(stored["boot-epoch"]).toBe(String(firstEpoch));

      const t0 = performance.now();
      const retry = await sendLine(v.socketPath, { ...inv, timeoutMs: 5_000 });
      expect(performance.now() - t0).toBeLessThan(1_000);
      expect(counter.n).toBe(1);
      expect(retry["status"]).toBe("error");
      expect((retry["refusal"] as { reason?: string } | undefined)?.reason).toBe("interrupted");

      // CONTROL: a fresh id after the restart runs once.
      void sendLine(v.socketPath, { ...inv, requestId: "req-interrupted-fresh" }).catch(() => { /* the boot ends under it */ });
      for (let i = 0; i < 500 && counter.n < 2; i++) await new Promise((r) => setTimeout(r, 10));
      expect(counter.n).toBe(2);
    } finally { await v.teardown(); }
  });

  test("a second channel over the SAME claim (same boot epoch) leaves this boot's `committed` fact `committed`", async () => {
    const counter = { n: 0 };
    const v = await Vessel.boot({ placeVerbImpl: () => { counter.n++; } });
    try {
      const requestId = "req-same-claim";
      const inv = { verb: "nexus-kapae", args: {}, requestedBy: "did:key:test", requestId, timeoutMs: 100 };
      await dispatchAndStrand(v, counter, inv);
      // Only the channel closes; the claim (and so the boot epoch) stays. A fact whose epoch EQUALS
      // the seeding channel's epoch belongs to this boot and never settles.
      v.channel.close();
      v.channel = startUdsChannel({
        daemonHandle: v.daemonHandle, placeVerb: (o) => v.placeVerbImpl(o as Placed, v.daemonHandle),
        composite: v.compositeForBoot(),
        claim: v.claim, repo: v.repo, timeoutMs: 1_000,
      });
      await waitForSocket(v.claim.socketPath);
      expect((await sendLine(v.socketPath, { op: "receipt", requestId }))["state"]).toBe("committed");
      const stored = plainRecord(v.workingHandle.doc()!.tiddlers[`${RECEIPT_FACT_URI_PREFIX}${requestId}`]!).tiddler as Record<string, unknown>;
      expect(stored["state"]).toBe("committed");
    } finally { await v.teardown(); }
  });

  test("the seed settle flushes the repo when it settled a fact, and not when it settled none", async () => {
    const counter = { n: 0 };
    const v = await Vessel.boot({ placeVerbImpl: () => { counter.n++; } });
    try {
      const inv = { verb: "nexus-kapae", args: {}, requestedBy: "did:key:test", requestId: "req-flush-spy", timeoutMs: 100 };
      await dispatchAndStrand(v, counter, inv);
      let flushes = 0;
      const realFlush = v.repo.flush.bind(v.repo);
      v.repo.flush = ((...a: Parameters<Repo["flush"]>) => { flushes++; return realFlush(...a); }) as Repo["flush"];

      await v.restart(); // settles req-flush-spy to `interrupted`
      expect((await sendLine(v.socketPath, { op: "receipt", requestId: "req-flush-spy" }))["state"]).toBe("interrupted");
      expect(flushes).toBeGreaterThanOrEqual(1);

      // CONTROL: a further restart finds nothing `committed` of an earlier boot, so it settles none.
      flushes = 0;
      await v.restart();
      expect((await sendLine(v.socketPath, { op: "receipt", requestId: "req-flush-spy" }))["state"]).toBe("interrupted");
      expect(flushes).toBe(0);
    } finally { await v.teardown(); }
  });

  test("an outcome that landed after the channel closed settles the fact `done` at the next boot, never `interrupted`", async () => {
    const counter = { n: 0 };
    const v = await Vessel.boot({ placeVerbImpl: () => { counter.n++; } });
    try {
      const requestId = "req-landed-unobserved";
      const inv = { verb: "nexus-kapae", args: {}, requestedBy: "did:key:test", requestId, timeoutMs: 100 };
      await dispatchAndStrand(v, counter, inv);
      await v.restart(() => {
        const outcome = concludeVerb({
          requestId, verb: inv.verb, status: "done", cause: "test-worker",
          batchMode: "best-effort", results: { summary: { ok: true } },
        });
        v.daemonHandle.change((doc) => { doc.tiddlers[outcome.tiddler.title] = outcome as unknown as LarDoc["tiddlers"][string]; });
      });
      expect((await sendLine(v.socketPath, { op: "receipt", requestId }))["state"]).toBe("done");
      const stored = plainRecord(v.workingHandle.doc()!.tiddlers[`${RECEIPT_FACT_URI_PREFIX}${requestId}`]!).tiddler as Record<string, unknown>;
      expect(stored["state"]).toBe("done");
      // The seed's settle measures the outcome it found, as a live observation does.
      expect(stored["outcome-bytes"]).toBe(String(storedOutcomeBytes(v, requestId)));
    } finally { await v.teardown(); }
  });

  test("CONTROL: a fresh id runs exactly once, undisturbed by any of the above", async () => {
    const counter = { n: 0 };
    const v = await Vessel.boot({ placeVerbImpl: doneWorker(counter) });
    try {
      const answer = await sendLine(v.socketPath, { verb: "nexus-kapae", args: {}, requestedBy: "did:key:test", requestId: "req-fresh-control" });
      expect(answer["status"]).toBe("done");
      expect(counter.n).toBe(1);
    } finally { await v.teardown(); }
  });

  test("a TORN receipt fact (no input-digest on a non-abandoned record) refuses `receipt-fact-torn`, by name, with NO run — and is never written over", async () => {
    const counter = { n: 0 };
    const v = await Vessel.boot({ placeVerbImpl: doneWorker(counter) });
    try {
      const requestId = "req-torn-committed";
      // Write a raw, torn receipt-fact tiddler directly into the working doc — a `committed` fact
      // (a non-`abandoned` state, which `parseReceiptFact`/ReceiptFactClaimed REQUIRES a digest
      // on) with NO `input-digest` at all. This models a record some other writer left unreadable
      // (never produced by this ledger itself, which always stamps a digest on a claimed state).
      v.workingHandle.change((doc) => {
        const title = `${RECEIPT_FACT_URI_PREFIX}${requestId}`;
        doc.tiddlers[title] = {
          title, "request-id": requestId, state: "committed", seq: "0",
        } as unknown as LarDoc["tiddlers"][string];
      });

      await v.restart(); // a fresh FactLedger must re-seed and still read this as TORN, not absent

      const dispatch = await sendLine(v.socketPath, { verb: "nexus-kapae", args: {}, requestedBy: "did:key:test", requestId });
      expect(counter.n).toBe(0); // never dispatched
      expect(dispatch["status"]).toBe("error");
      expect(String(dispatch["errorMessage"])).toMatch(/receipt for request req-torn-committed is unreadable/);
      expect((dispatch["refusal"] as { reason?: string } | undefined)?.reason).toBe("receipt-fact-torn");

      // A later mint under a FRESH id still works — the torn record never corrupts the seq
      // counter or the ledger's ability to arbitrate anything else.
      const fresh = await sendLine(v.socketPath, { verb: "nexus-kapae", args: {}, requestedBy: "did:key:test", requestId: "req-after-torn" });
      expect(fresh["status"]).toBe("done");
      expect(counter.n).toBe(1);

      // CONTROL: an absent id (never written at all) runs normally — proves the torn check
      // never swallows a genuinely fresh id.
      const control = await sendLine(v.socketPath, { verb: "nexus-kapae", args: {}, requestedBy: "did:key:test", requestId: "req-torn-control-absent" });
      expect(control["status"]).toBe("done");
      expect(counter.n).toBe(2);
    } finally { await v.teardown(); }
  });

  test("`effectOf` rides the terminal outcome's answer — a dedup copy carries the prior requestId, a fresh run carries none", async () => {
    const v = await Vessel.boot({
      placeVerbImpl: (p, daemonHandle) => {
        // The dispatcher's own effect-dedup shape: this outcome is a COPY of a PRIOR attempt
        // (`req-effect-prior`), so it stamps `effectOf` naming that prior requestId rather than
        // running the handler fresh.
        const outcome = concludeVerb({
          requestId: p.requestId, verb: p.verb, status: "done",
          cause: "effect-dedup", batchMode: "best-effort",
          results: { summary: { ok: true } }, effectOf: "req-effect-prior",
        });
        daemonHandle.change((doc) => { doc.tiddlers[outcome.tiddler.title] = outcome as unknown as LarDoc["tiddlers"][string]; });
      },
    });
    try {
      const dedup = await sendLine(v.socketPath, { verb: "nexus-kapae", args: {}, requestedBy: "did:key:test", requestId: "req-effect-copy" });
      expect(dedup["status"]).toBe("done");
      expect(dedup["effectOf"]).toBe("req-effect-prior");

      // CONTROL: a fresh (non-dedup) outcome carries no `effectOf` at all.
      const v2 = await Vessel.boot({ placeVerbImpl: doneWorker({ n: 0 }) });
      try {
        const fresh = await sendLine(v2.socketPath, { verb: "nexus-kapae", args: {}, requestedBy: "did:key:test", requestId: "req-effect-fresh" });
        expect(fresh["status"]).toBe("done");
        expect(fresh["effectOf"]).toBeUndefined();
      } finally { await v2.teardown(); }
    } finally { await v.teardown(); }
  });

  test("effectKey rides from the wire Invocation to `placeVerb` unchanged (D1 commit 4/4) — the one link the worker-side effect index (commit 2) depends on", async () => {
    const placed: Placed[] = [];
    const v = await Vessel.boot({
      placeVerbImpl: (p, daemonHandle) => { placed.push(p); doneWorker({ n: 0 })(p, daemonHandle); },
    });
    try {
      await sendLine(v.socketPath, {
        verb: "nexus-kapae", args: {}, requestedBy: "did:key:test",
        requestId: "req-effectkey-a", effectKey: "sha256:effect-a",
      });
      expect(placed).toHaveLength(1);
      expect(placed[0]!.effectKey).toBe("sha256:effect-a");

      // CONTROL: an invocation carrying no effectKey forwards none (never a fabricated one).
      await sendLine(v.socketPath, { verb: "nexus-kapae", args: {}, requestedBy: "did:key:test", requestId: "req-effectkey-b" });
      expect(placed).toHaveLength(2);
      expect(placed[1]!.effectKey).toBeUndefined();
    } finally { await v.teardown(); }
  });
});

describe("the receipt ring bounds BYTES as well as count", () => {
  const ORIGIN = { kind: "lares-verb", requestId: "bytes-fixture" } as const;
  const ID = (n: number): string => `req-bytes-${n}`;
  const DIGEST = (n: number): string => `sha256:${String(n).padStart(64, "0")}`;
  const BODY = 600;

  /** The stores a ledger reads and writes, and a fresh ledger over them per boot: the durable floor a restart keeps. */
  function stores() {
    const repo = new Repo({ sharePolicy: async () => true });
    const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
    const workingHandle = repo.create<LarDoc>(emptyLarDoc());
    const composite = (): CompositeStore => {
      const c = new CompositeStore();
      c.addLayer({ bagId: DAEMON_BAG_ID, store: new AutomergeDocStore(daemonHandle as never, DAEMON_BAG_ID), writable: true, defaultWritable: false });
      c.addLayer({ bagId: wikiSlotUri("daemon", "working"), store: new AutomergeDocStore(workingHandle as never, wikiSlotUri("daemon", "working")), writable: true });
      return c;
    };
    let boot = 0;
    const ledgerAt = (ringBytes: number, ring = 100) => {
      const c = composite();
      const faults: string[] = [];
      return { ledger: new FactLedger(c, repo, ring, ++boot, ringBytes, (line) => faults.push(line)), composite: c, faults };
    };
    return { repo, daemonHandle, workingHandle, ledgerAt };
  }
  type Booted = ReturnType<ReturnType<typeof stores>["ledgerAt"]>;

  /** The outcome a worker lands for request `n`, with a body of `body` bytes. Ids of one length weigh the same. */
  const outcomeOf = (n: number, body = BODY) => concludeVerb({
    requestId: ID(n), verb: "nexus-kapae", status: "done", cause: "test-worker",
    batchMode: "best-effort", results: { summary: { ok: true }, body: "b".repeat(body) },
  });
  const WEIGHT = outcomeBytesOf(outcomeOf(1).tiddler as Record<string, unknown>);

  /** One request, whole: the ledger commits it, the worker's outcome lands in the daemon bag, the ledger observes it. */
  async function land(b: Booted, n: number, body = BODY): Promise<void> {
    expect((await b.ledger.arbitrate(ID(n), DIGEST(n))).verdict).toBe("run");
    const outcome = outcomeOf(n, body);
    await b.composite.put(outcome, ORIGIN, { bag: DAEMON_BAG_ID });
    await b.ledger.observeOutcome(ID(n), "done", DIGEST(n), outcomeBytesOf(outcome.tiddler as Record<string, unknown>));
  }
  const stateOf = async (b: Booted, n: number): Promise<string> => {
    const fact = await b.ledger.get(ID(n));
    return fact === null ? "absent" : fact === "torn" ? "torn" : fact.state;
  };
  const keptOutcome = async (b: Booted, n: number): Promise<boolean> => (await b.composite.getLive(`${OUTCOME_URI_PREFIX}${ID(n)}`)) !== null;

  test("★ an outcome that pushes the kept bodies past the bound evicts the oldest body, and never itself ★", async () => {
    expect(WEIGHT).toBeGreaterThan(BODY);
    const s = stores();
    const b = s.ledgerAt(Math.floor(WEIGHT * 2.5));           // room for two bodies and half a third
    await land(b, 1);
    await land(b, 2);
    expect([await stateOf(b, 1), await stateOf(b, 2)]).toEqual(["done", "done"]);   // two bodies fit
    await land(b, 3);
    expect([await stateOf(b, 1), await stateOf(b, 2), await stateOf(b, 3)]).toEqual(["evicted", "done", "done"]);
    // The evicted body left the store; its fact keeps the claim and its terminal, and drops the measure.
    expect([await keptOutcome(b, 1), await keptOutcome(b, 2), await keptOutcome(b, 3)]).toEqual([false, true, true]);
    const evicted = plainRecord(s.workingHandle.doc()!.tiddlers[`${RECEIPT_FACT_URI_PREFIX}${ID(1)}`]!).tiddler as Record<string, unknown>;
    expect(evicted["terminal"]).toBe("done");
    expect(evicted["input-digest"]).toBe(DIGEST(1));
    expect(evicted["outcome-bytes"]).toBeUndefined();
    const kept = plainRecord(s.workingHandle.doc()!.tiddlers[`${RECEIPT_FACT_URI_PREFIX}${ID(3)}`]!).tiddler as Record<string, unknown>;
    expect(kept["outcome-bytes"]).toBe(String(WEIGHT));
    // A same-id dispatch of the evicted request answers the gap.
    expect(await b.ledger.arbitrate(ID(1), DIGEST(1))).toEqual({ verdict: "refuse", reason: "retention-gap" });
    // The next body pushes the next-oldest out: the ring keeps moving.
    await land(b, 4);
    expect([await stateOf(b, 2), await stateOf(b, 3), await stateOf(b, 4)]).toEqual(["evicted", "done", "done"]);
    await s.repo.shutdown();
  });

  test("CONTROL: the same four outcomes under a bound that holds them all evict nothing; one byte less evicts one", async () => {
    const s = stores();
    const b = s.ledgerAt(WEIGHT * 4);
    for (const n of [1, 2, 3, 4]) await land(b, n);
    expect(await Promise.all([1, 2, 3, 4].map((n) => stateOf(b, n)))).toEqual(["done", "done", "done", "done"]);
    await s.repo.shutdown();
    const t = stores();
    const tight = t.ledgerAt(WEIGHT * 4 - 1);
    for (const n of [1, 2, 3, 4]) await land(tight, n);
    expect(await Promise.all([1, 2, 3, 4].map((n) => stateOf(tight, n)))).toEqual(["evicted", "done", "done", "done"]);
    await t.repo.shutdown();
  });

  test("a heavy outcome spends many slots: it pushes out every older body it must, and a light one pushes out none", async () => {
    const s = stores();
    const b = s.ledgerAt(WEIGHT * 4);
    for (const n of [1, 2, 3]) await land(b, n);
    await land(b, 4, BODY + WEIGHT * 2);                      // three bodies' weight in one
    expect(await Promise.all([1, 2, 3, 4].map((n) => stateOf(b, n)))).toEqual(["evicted", "evicted", "done", "done"]);
    await land(b, 5, 0);                                      // CONTROL: a bare receipt fits beside them
    expect(await Promise.all([3, 4, 5].map((n) => stateOf(b, n)))).toEqual(["evicted", "done", "done"]);
    await s.repo.shutdown();
  });

  test("a lone outcome heavier than the whole bound stays for its caller, and leaves when the next body lands", async () => {
    const s = stores();
    const b = s.ledgerAt(Math.floor(WEIGHT / 2));
    await land(b, 1);
    expect(await stateOf(b, 1)).toBe("done");                 // never evicted on arrival
    expect(await keptOutcome(b, 1)).toBe(true);
    await land(b, 2);
    expect([await stateOf(b, 1), await stateOf(b, 2)]).toEqual(["evicted", "done"]);
    await s.repo.shutdown();
  });

  test("★ the tally survives a restart: a fresh ledger reads what the kept bodies weigh off their facts ★", async () => {
    const s = stores();
    const first = s.ledgerAt(Math.floor(WEIGHT * 2.5));
    await land(first, 1);
    await land(first, 2);
    const second = s.ledgerAt(Math.floor(WEIGHT * 2.5));       // a fresh ledger over the same stores
    expect([await stateOf(second, 1), await stateOf(second, 2)]).toEqual(["done", "done"]);   // CONTROL: a restart alone evicts nothing
    await land(second, 3);
    expect([await stateOf(second, 1), await stateOf(second, 2), await stateOf(second, 3)]).toEqual(["evicted", "done", "done"]);
    await s.repo.shutdown();
  });

  test("a boot under a tighter bound brings the kept bodies down to it, oldest first, before it answers", async () => {
    const s = stores();
    const wide = s.ledgerAt(WEIGHT * 10);
    for (const n of [1, 2, 3]) await land(wide, n);
    const tight = s.ledgerAt(Math.floor(WEIGHT * 1.5));
    expect(await Promise.all([1, 2, 3].map((n) => stateOf(tight, n)))).toEqual(["evicted", "evicted", "done"]);
    expect(await Promise.all([1, 2, 3].map((n) => keptOutcome(tight, n)))).toEqual([false, false, true]);
    await s.repo.shutdown();
  });

  test("byte pressure drops BODIES: a request still in flight weighs nothing and keeps its fact", async () => {
    const s = stores();
    const b = s.ledgerAt(Math.floor(WEIGHT * 1.5));
    expect((await b.ledger.arbitrate(ID(1), DIGEST(1))).verdict).toBe("run");   // committed; its outcome never lands
    await land(b, 2);
    await land(b, 3);
    expect(await Promise.all([1, 2, 3].map((n) => stateOf(b, n)))).toEqual(["committed", "evicted", "done"]);
    // An outcome that lands late for the oldest request counts from then on, and its own body stays this pass.
    const late = outcomeOf(1);
    await b.composite.put(late, ORIGIN, { bag: DAEMON_BAG_ID });
    await b.ledger.observeOutcome(ID(1), "done", DIGEST(1), WEIGHT);
    expect(await Promise.all([1, 2, 3].map((n) => stateOf(b, n)))).toEqual(["done", "evicted", "evicted"]);
    await s.repo.shutdown();
  });

  test("a body that landed late leaves by its request's place in the order, never by when it landed", async () => {
    const s = stores();
    const b = s.ledgerAt(Math.floor(WEIGHT * 2.5));
    expect((await b.ledger.arbitrate(ID(1), DIGEST(1))).verdict).toBe("run");   // the oldest request, still in flight
    await land(b, 2);
    const late = outcomeOf(1);
    await b.composite.put(late, ORIGIN, { bag: DAEMON_BAG_ID });
    await b.ledger.observeOutcome(ID(1), "done", DIGEST(1), WEIGHT);            // two bodies fit: nothing leaves
    expect([await stateOf(b, 1), await stateOf(b, 2)]).toEqual(["done", "done"]);
    await land(b, 3);
    // The oldest REQUEST's body leaves, though it landed after the second's.
    expect(await Promise.all([1, 2, 3].map((n) => stateOf(b, n)))).toEqual(["evicted", "done", "done"]);
    await s.repo.shutdown();
  });

  test("an outcome that lands again under another verdict counts once, at its latest measure", async () => {
    const s = stores();
    const b = s.ledgerAt(Math.floor(WEIGHT * 2.5));
    await land(b, 1);
    await b.ledger.observeOutcome(ID(1), "error", DIGEST(1), WEIGHT);           // the same request, a second verdict
    expect(await stateOf(b, 1)).toBe("error");
    await land(b, 2);
    expect([await stateOf(b, 1), await stateOf(b, 2)]).toEqual(["error", "done"]);   // two bodies' weight, and two fit
    await land(b, 3);
    expect(await Promise.all([1, 2, 3].map((n) => stateOf(b, n)))).toEqual(["evicted", "done", "done"]);   // CONTROL: a third does not
    await s.repo.shutdown();
  });

  test("a body re-written under the same verdict gets measured again: the tally reads what the store holds", async () => {
    const s = stores();
    const b = s.ledgerAt(Math.floor(WEIGHT * 2.5));
    await land(b, 1);
    const heavier = outcomeOf(1, BODY + WEIGHT * 2);
    await b.composite.put(heavier, ORIGIN, { bag: DAEMON_BAG_ID });
    await b.ledger.observeOutcome(ID(1), "done", DIGEST(1), outcomeBytesOf(heavier.tiddler as Record<string, unknown>));
    const fact = plainRecord(s.workingHandle.doc()!.tiddlers[`${RECEIPT_FACT_URI_PREFIX}${ID(1)}`]!).tiddler as Record<string, unknown>;
    expect(fact["outcome-bytes"]).toBe(String(WEIGHT * 3));
    expect(await stateOf(b, 1)).toBe("done");                 // it just landed: it stays this pass
    await land(b, 2);
    expect([await stateOf(b, 1), await stateOf(b, 2)]).toEqual(["evicted", "done"]);   // three bodies' weight leaves for one
    // CONTROL: the same two requests at one body's weight each both stay.
    const t = stores();
    const c = t.ledgerAt(Math.floor(WEIGHT * 2.5));
    await land(c, 1);
    await c.ledger.observeOutcome(ID(1), "done", DIGEST(1), WEIGHT);
    await land(c, 2);
    expect([await stateOf(c, 1), await stateOf(c, 2)]).toEqual(["done", "done"]);
    await s.repo.shutdown(); await t.repo.shutdown();
  });

  test("★ acts that arrive together take turns: the facts, the bodies and the tally agree, and a fresh ledger reads the same ★", async () => {
    const s = stores();
    const b = s.ledgerAt(Math.floor(WEIGHT * 1.5));
    // Five requests commit and land with no act awaited before the next begins.
    await Promise.all([1, 2, 3, 4, 5].map((n) => land(b, n)));
    const states = await Promise.all([1, 2, 3, 4, 5].map((n) => stateOf(b, n)));
    const kept = await Promise.all([1, 2, 3, 4, 5].map((n) => keptOutcome(b, n)));
    // Exactly one body fits the bound. Every fact that reads landed keeps its body, and every evicted one lost it.
    expect(states.filter((state) => state === "done")).toHaveLength(1);
    expect(states.filter((state) => state === "evicted")).toHaveLength(4);
    expect(kept).toEqual(states.map((state) => state === "done"));
    // The store says what the ledger's own cache says: a ledger that seeds from it answers the same.
    const again = s.ledgerAt(Math.floor(WEIGHT * 1.5));
    expect(await Promise.all([1, 2, 3, 4, 5].map((n) => stateOf(again, n)))).toEqual(states);
    // And two dispatches of one id that arrive together read one winner.
    const twice = await Promise.all([b.ledger.arbitrate(ID(9), DIGEST(9)), b.ledger.arbitrate(ID(9), DIGEST(9))]);
    expect(twice.map((v) => v.verdict).sort()).toEqual(["refuse", "run"]);
    await s.repo.shutdown();
  });

  test("a stop between the body's leaving and its fact's flip leaves a landed fact the next pass finishes", async () => {
    const s = stores();
    const first = s.ledgerAt(Math.floor(WEIGHT * 2.5));
    await land(first, 1);
    await land(first, 2);
    // The stop: the oldest body left the store, and its fact still reads landed.
    await first.composite.tombstoneInBag(DAEMON_BAG_ID, `${OUTCOME_URI_PREFIX}${ID(1)}`, ORIGIN);
    const second = s.ledgerAt(Math.floor(WEIGHT * 2.5));
    expect(await stateOf(second, 1)).toBe("done");            // its receipt still answers its verdict
    expect(await keptOutcome(second, 1)).toBe(false);
    await land(second, 3);                                    // the pass reaches it, and finishes the eviction
    expect(await Promise.all([1, 2, 3].map((n) => stateOf(second, n)))).toEqual(["evicted", "done", "done"]);
    expect(await second.ledger.arbitrate(ID(1), DIGEST(1))).toEqual({ verdict: "refuse", reason: "retention-gap" });
    await s.repo.shutdown();
  });

  test("★ no fact reads evicted while its body still stands: an eviction that fails at the body leaves the fact landed ★", async () => {
    const s = stores();
    const b = s.ledgerAt(Math.floor(WEIGHT * 2.5));
    await land(b, 1);
    await land(b, 2);
    // The store refuses the body's removal once.
    const tombstone = b.composite.tombstoneInBag.bind(b.composite);
    let refused = 0;
    b.composite.tombstoneInBag = async (...args: Parameters<typeof tombstone>) => {
      if (refused++ === 0) throw new Error("a synthetic store fault");
      return tombstone(...args);
    };
    // The pass fails at the body. The act that started it stands: the third request landed, and the fault got said.
    await land(b, 3);
    expect(refused).toBe(1);
    expect(b.faults).toHaveLength(1);
    expect(b.faults[0]).toContain("a synthetic store fault");
    expect(await stateOf(b, 3)).toBe("done");
    // The oldest body still stands, so its fact still reads landed, in the store as in the ledger.
    expect(await keptOutcome(b, 1)).toBe(true);
    const stored = plainRecord(s.workingHandle.doc()!.tiddlers[`${RECEIPT_FACT_URI_PREFIX}${ID(1)}`]!).tiddler as Record<string, unknown>;
    expect(stored["state"]).toBe("done");
    expect(await stateOf(b, 1)).toBe("done");
    // The next act's pass finishes the eviction, and says nothing more.
    await land(b, 4);
    expect(b.faults).toHaveLength(1);
    expect(await Promise.all([1, 2, 3, 4].map((n) => stateOf(b, n)))).toEqual(["evicted", "evicted", "done", "done"]);
    expect(await Promise.all([1, 2, 3, 4].map((n) => keptOutcome(b, n)))).toEqual([false, false, true, true]);
    await s.repo.shutdown();
  });

  test("the count bound takes a failed eviction up again: the victim stays at the ring's head until it left whole", async () => {
    const s = stores();
    const b = s.ledgerAt(WEIGHT * 100, 2);                    // bytes wide, count two
    await land(b, 1);
    await land(b, 2);
    const tombstone = b.composite.tombstoneInBag.bind(b.composite);
    let refused = 0;
    b.composite.tombstoneInBag = async (...args: Parameters<typeof tombstone>) => {
      if (refused++ === 0) throw new Error("a synthetic store fault");
      return tombstone(...args);
    };
    // The third request commits, and the count pass it starts fails at the oldest body. THE COMMIT STANDS AND ITS
    // CALLER HEARS "run": a ring fault never refuses an act whose fact already landed.
    expect(await b.ledger.arbitrate(ID(3), DIGEST(3))).toEqual({ verdict: "run" });
    expect(b.faults).toHaveLength(1);
    expect([await stateOf(b, 1), await keptOutcome(b, 1)]).toEqual(["done", true]);
    // The next act's pass takes the same victim up, and the ring comes down to its count.
    expect((await b.ledger.arbitrate(ID(4), DIGEST(4))).verdict).toBe("run");
    expect(await Promise.all([1, 2, 3, 4].map((n) => stateOf(b, n)))).toEqual(["evicted", "evicted", "committed", "committed"]);
    expect([await keptOutcome(b, 1), await keptOutcome(b, 2)]).toEqual([false, false]);
    await s.repo.shutdown();
  });

  test("a boot whose first pass fails still stands: the ledger seeds, answers, and takes the pass up at its next act", async () => {
    const s = stores();
    const wide = s.ledgerAt(WEIGHT * 10);
    for (const n of [1, 2, 3]) await land(wide, n);
    const tight = s.ledgerAt(Math.floor(WEIGHT * 1.5));
    const tombstone = tight.composite.tombstoneInBag.bind(tight.composite);
    let refused = 0;
    tight.composite.tombstoneInBag = async (...args: Parameters<typeof tombstone>) => {
      if (refused++ === 0) throw new Error("a synthetic store fault");
      return tombstone(...args);
    };
    // The seed's own pass fails. The ledger reads every fact as it stood, and refuses nothing for it.
    expect(await Promise.all([1, 2, 3].map((n) => stateOf(tight, n)))).toEqual(["done", "done", "done"]);
    expect(tight.faults).toHaveLength(1);
    expect((await tight.ledger.arbitrate(ID(4), DIGEST(4))).verdict).toBe("run");   // and the next act's pass brings it down
    expect(await Promise.all([1, 2, 3, 4].map((n) => stateOf(tight, n)))).toEqual(["evicted", "evicted", "done", "committed"]);
    expect(tight.faults).toHaveLength(1);
    await s.repo.shutdown();
  });

  test("an outcome this ledger never arbitrated (a summons from another vessel) weighs as any other", async () => {
    const s = stores();
    const b = s.ledgerAt(Math.floor(WEIGHT * 1.5));
    for (const n of [1, 2]) {
      const outcome = outcomeOf(n);
      await b.composite.put(outcome, ORIGIN, { bag: DAEMON_BAG_ID });
      await b.ledger.observeOutcome(ID(n), "done", DIGEST(n), outcomeBytesOf(outcome.tiddler as Record<string, unknown>));
    }
    expect([await stateOf(b, 1), await stateOf(b, 2)]).toEqual(["evicted", "done"]);
    expect([await keptOutcome(b, 1), await keptOutcome(b, 2)]).toEqual([false, true]);
    await s.repo.shutdown();
  });

  test("the count bound still holds beside the byte bound, and each evicts by its own measure", async () => {
    const s = stores();
    const b = s.ledgerAt(WEIGHT * 100, 2);                    // bytes wide, count two
    for (const n of [1, 2, 3]) await land(b, n);
    expect(await Promise.all([1, 2, 3].map((n) => stateOf(b, n)))).toEqual(["evicted", "done", "done"]);
    await s.repo.shutdown();
  });

  test("a landed fact that names no measure reads torn; CONTROL: the same fact with its measure reads landed", async () => {
    const s = stores();
    const measured = buildReceiptFact({ requestId: ID(1), state: "done", terminal: "done", seq: 0, inputDigest: DIGEST(1), outcomeBytes: 0 });
    const { "outcome-bytes": _measure, ...unmeasuredFields } = measured.tiddler as Record<string, unknown>;
    const unmeasured = { ...measured, tiddler: { ...unmeasuredFields, title: `${RECEIPT_FACT_URI_PREFIX}${ID(2)}`, "request-id": ID(2), seq: "1" } };
    const seed = s.ledgerAt(WEIGHT * 10);
    await seed.composite.put(measured, ORIGIN);
    await seed.composite.put(unmeasured as never, ORIGIN);
    const b = s.ledgerAt(WEIGHT * 10);
    expect(await stateOf(b, 1)).toBe("done");
    expect(await stateOf(b, 2)).toBe("torn");
    expect(await b.ledger.arbitrate(ID(2), DIGEST(2))).toEqual({ verdict: "refuse", reason: "receipt-fact-torn" });
    expect(await b.ledger.arbitrate(ID(1), DIGEST(1))).toEqual({ verdict: "refuse", reason: "already-committed" });
    await s.repo.shutdown();
  });

  test("★ over the socket: the channel measures the outcome it observes, and an evicted body leaves the vessel's store ★", async () => {
    /** Resolve once the working doc's fact for `requestId` reads `state`: a handshake on the doc's own change. */
    const factReads = (v: Vessel, requestId: string, state: string): Promise<Record<string, unknown>> => new Promise((resolve) => {
      const read = (): boolean => {
        const stored = v.workingHandle.doc()!.tiddlers[`${RECEIPT_FACT_URI_PREFIX}${requestId}`];
        const fields = stored ? plainRecord(stored).tiddler as Record<string, unknown> : null;
        if (fields?.["state"] !== state) return false;
        v.workingHandle.off("change", onChange);
        resolve(fields);
        return true;
      };
      const onChange = (): void => { read(); };
      v.workingHandle.on("change", onChange);
      read();
    });
    const inv = (requestId: string) => ({ verb: "nexus-kapae", args: {}, requestedBy: "did:key:test", requestId });
    const counter = { n: 0 };
    const v = await Vessel.boot({ placeVerbImpl: bodyWorker(counter, () => BODY), ring: 100, ringBytes: Math.floor(WEIGHT * 1.5) });
    // The runner tears the vessel down, whatever ends the test: a handshake that never answers must not hold the suite open.
    onTestFinished(() => v.teardown());
    expect((await sendLine(v.socketPath, inv(ID(1))))["status"]).toBe("done");
    const first = await factReads(v, ID(1), "done");
    expect(first["outcome-bytes"]).toBe(String(storedOutcomeBytes(v, ID(1))));
    expect(Number(first["outcome-bytes"])).toBeGreaterThan(BODY);
    expect((await sendLine(v.socketPath, inv(ID(2))))["status"]).toBe("done");
    await factReads(v, ID(1), "evicted");
    expect((await sendLine(v.socketPath, { op: "receipt", requestId: ID(1) }))["state"]).toBe("evicted");
    expect(v.daemonHandle.doc()!.tiddlers[`${OUTCOME_URI_PREFIX}${ID(1)}`]?.meta?.deleted).toBe(true);
    expect((await factReads(v, ID(2), "done"))["outcome-bytes"]).toBe(String(storedOutcomeBytes(v, ID(2))));
    const again = await sendLine(v.socketPath, inv(ID(1)));
    expect((again["refusal"] as { reason?: string } | undefined)?.reason).toBe("retention-gap");
    expect(counter.n).toBe(2);
  });
});

describe("a cancel's answer carries the vessel's outcome, never the caller's abandonment retold", () => {
  const INV = (requestId: string) => ({ verb: "nexus-kapae", args: {}, requestedBy: "did:key:test", requestId });

  test("★ a cancel that lost to a commit answers `committed`, and the act it met runs on ★", async () => {
    const counter = { n: 0 };
    let land: (() => void) | undefined;
    const done = doneWorker({ n: 0 });
    // The worker holds the verb until the test lets it land: the handshake that pins "a fact stands, no outcome yet".
    const v = await Vessel.boot({ placeVerbImpl: (p, h) => { counter.n++; land = () => done(p, h); } });
    try {
      const requestId = "req-cancel-lost";
      const asked = sendLine(v.socketPath, INV(requestId));
      for (let i = 0; i < 500 && counter.n === 0; i++) await new Promise((r) => setTimeout(r, 10));
      expect(counter.n).toBe(1);

      expect(await sendLine(v.socketPath, { op: "cancel", requestId })).toEqual({ requestId, state: "committed" });

      land!();
      expect((await asked)["status"]).toBe("done");          // the cancel un-dispatched nothing
      expect(counter.n).toBe(1);
    } finally { await v.teardown(); }
  });

  test("a cancel of a landed request answers its verdict and its results, as a receipt read would", async () => {
    const counter = { n: 0 };
    const v = await Vessel.boot({ placeVerbImpl: doneWorker(counter) });
    try {
      const requestId = "req-cancel-after-done";
      expect((await sendLine(v.socketPath, INV(requestId)))["status"]).toBe("done");
      const cancelled = await sendLine(v.socketPath, { op: "cancel", requestId });
      expect(cancelled).toEqual(await sendLine(v.socketPath, { op: "receipt", requestId }));
      expect(cancelled["state"]).toBe("done");
    } finally { await v.teardown(); }
  });

  test("a cancel of an id the ring evicted answers `evicted`", async () => {
    const counter = { n: 0 };
    const v = await Vessel.boot({ placeVerbImpl: doneWorker(counter), ring: 1 });
    try {
      expect((await sendLine(v.socketPath, INV("req-cancel-ring-1")))["status"]).toBe("done");
      expect((await sendLine(v.socketPath, INV("req-cancel-ring-2")))["status"]).toBe("done");
      expect(await sendLine(v.socketPath, { op: "cancel", requestId: "req-cancel-ring-1" })).toEqual({ requestId: "req-cancel-ring-1", state: "evicted" });
    } finally { await v.teardown(); }
  });

  test("★ an outcome that stands under an abandoned id answers both doors: the record says the act ran ★", async () => {
    const counter = { n: 0 };
    const v = await Vessel.boot({ placeVerbImpl: doneWorker(counter) });
    try {
      const requestId = "req-cancel-then-summoned";
      expect(await sendLine(v.socketPath, { op: "cancel", requestId })).toEqual({ requestId, state: "abandoned" });
      // Another road ran the id. Its record names no digest, so the fact keeps reading `abandoned` and the answer
      // below comes from the record alone, whatever the observer did.
      const outcome = concludeVerb({ requestId, verb: "nexus-kapae", status: "done", cause: "summons", batchMode: "best-effort", results: { summary: { ok: true } } });
      v.daemonHandle.change((doc) => { doc.tiddlers[outcome.tiddler.title] = outcome as unknown as LarDoc["tiddlers"][string]; });
      expect((await sendLine(v.socketPath, { op: "receipt", requestId }))["state"]).toBe("done");
      expect((await sendLine(v.socketPath, { op: "cancel", requestId }))["state"]).toBe("done");
      expect(counter.n).toBe(0);
    } finally { await v.teardown(); }
  });

  test("CONTROL: a cancel that reaches the ledger before any fact stands answers `abandoned`, twice over", async () => {
    const counter = { n: 0 };
    const v = await Vessel.boot({ placeVerbImpl: doneWorker(counter) });
    try {
      const requestId = "req-cancel-won";
      expect(await sendLine(v.socketPath, { op: "cancel", requestId })).toEqual({ requestId, state: "abandoned" });
      expect(await sendLine(v.socketPath, { op: "cancel", requestId })).toEqual({ requestId, state: "abandoned" });
      expect(counter.n).toBe(0);
    } finally { await v.teardown(); }
  });
});

describe("a cancelled id leaves the ring as every other fact does", () => {
  const ORIGIN = { kind: "lares-verb", requestId: "cancel-ring-fixture" } as const;
  const WORKING = wikiSlotUri("daemon", "working");

  function stores() {
    const repo = new Repo({ sharePolicy: async () => true });
    const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
    const workingHandle = repo.create<LarDoc>(emptyLarDoc());
    let boot = 0;
    const ledgerAt = (ring: number) => {
      const c = new CompositeStore();
      c.addLayer({ bagId: DAEMON_BAG_ID, store: new AutomergeDocStore(daemonHandle as never, DAEMON_BAG_ID), writable: true, defaultWritable: false });
      c.addLayer({ bagId: WORKING, store: new AutomergeDocStore(workingHandle as never, WORKING), writable: true });
      return { ledger: new FactLedger(c, repo, ring, ++boot), composite: c };
    };
    /** The fields of the fact the store holds for `id`, as a later boot would read them. */
    const stored = (id: string): Record<string, unknown> =>
      plainRecord((workingHandle.doc() as LarDoc).tiddlers[`${RECEIPT_FACT_URI_PREFIX}${id}`]!).tiddler as Record<string, unknown>;
    return { repo, ledgerAt, stored };
  }
  const IDS = ["req-c1", "req-c2", "req-c3", "req-c4", "req-c5"];

  test("★ ring 2, five cancels: three facts read `evicted`, and at most the ring's count keep a standing verdict ★", async () => {
    const s = stores();
    const b = s.ledgerAt(2);
    for (const id of IDS) await b.ledger.cancel(id);
    expect(IDS.map((id) => s.stored(id)["state"])).toEqual(["evicted", "evicted", "evicted", "abandoned", "abandoned"]);
    // What a stored record holds once a cancelled id left the ring: its id, its place in the order, its state.
    expect(Object.keys(s.stored("req-c1")).sort()).toEqual(["disk-projection", "request-id", "seq", "state", "title"]);
    expect(await b.ledger.arbitrate("req-c1", "sha256:any")).toEqual({ verdict: "refuse", reason: "retention-gap" });
    expect(await b.ledger.arbitrate("req-c5", "sha256:any")).toEqual({ verdict: "refuse", reason: "abandoned" });
    await s.repo.shutdown();
  });

  test("a later boot reads the same: the digest-less evicted fact parses, and never as torn", async () => {
    const s = stores();
    const first = s.ledgerAt(2);
    for (const id of IDS) await first.ledger.cancel(id);
    const second = s.ledgerAt(2);
    const read = await second.ledger.get("req-c1");
    expect(read).not.toBe("torn");
    expect(read).toMatchObject({ requestId: "req-c1", state: "evicted", seq: 0 });
    expect(await second.ledger.arbitrate("req-c1", "sha256:any")).toEqual({ verdict: "refuse", reason: "retention-gap" });
    await s.repo.shutdown();
  });

  test("an outcome record that stands under a cancelled id leaves with it", async () => {
    const s = stores();
    const b = s.ledgerAt(1);
    await b.ledger.cancel("req-c1");
    // A record no digest names: the ledger promotes nothing from it, and the cancelled fact keeps its verdict.
    const outcome = concludeVerb({ requestId: "req-c1", verb: "nexus-kapae", status: "done", cause: "test-worker", batchMode: "best-effort" });
    await b.composite.put(outcome, ORIGIN, { bag: DAEMON_BAG_ID });
    await b.ledger.observeOutcome("req-c1", "done", undefined, outcomeBytesOf(outcome.tiddler as Record<string, unknown>));
    expect(s.stored("req-c1")["state"]).toBe("abandoned");
    await b.ledger.cancel("req-c2");
    expect(s.stored("req-c1")["state"]).toBe("evicted");
    expect(await b.composite.getLive(`${OUTCOME_URI_PREFIX}req-c1`)).toBeNull();
    await s.repo.shutdown();
  });

  test("CONTROL: a fact that names a digest and no state but `evicted` or `abandoned` may stand without one", async () => {
    const s = stores();
    const b = s.ledgerAt(8);
    // An abandoned id that carries its digest (a caller that hung up before the read) evicts with the digest kept.
    await b.ledger.abandonDrop("req-d1", "sha256:d1");
    const tight = s.ledgerAt(0);
    expect(await tight.ledger.get("req-d1")).toMatchObject({ state: "evicted", inputDigest: "sha256:d1" });
    // A landed fact with no digest still reads torn.
    await tight.composite.put({ tiddler: { title: `${RECEIPT_FACT_URI_PREFIX}req-t1`, "request-id": "req-t1", state: "done", seq: "9", "outcome-bytes": "1" }, meta: {} } as never, ORIGIN);
    expect(await s.ledgerAt(8).ledger.get("req-t1")).toBe("torn");
    await s.repo.shutdown();
  });
});
