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
import { describe, test, expect } from "vitest";
import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConnection } from "node:net";
import { Repo } from "@automerge/automerge-repo";
import { emptyLarDoc, concludeVerb, verbInputDigest, RECEIPT_FACT_URI_PREFIX, type LarDoc } from "@lararium/mesh";
import { startUdsChannel, type UdsChannel } from "../src/uds-channel.js";
import { claimStore, type StoreClaim } from "../src/owned-store.js";

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
      requestedBy: p.requestedBy, cause: "test-worker", batchMode: "best-effort",
      results: { summary: { ok: true } },
    });
    daemonHandle.change((doc) => { doc.tiddlers[outcome.tiddler.title] = outcome as unknown as LarDoc["tiddlers"][string]; });
  };
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
    readonly dir: string,
    readonly placeVerbImpl: (p: Placed, daemonHandle: ReturnType<Repo["create"]>) => void,
    readonly ring?: number,
  ) {}

  static async boot(opts: {
    placeVerbImpl: (p: Placed, daemonHandle: ReturnType<Repo["create"]>) => void;
    ring?: number;
    dir?: string;
    repo?: Repo;
    daemonHandle?: ReturnType<Repo["create"]>;
  }): Promise<Vessel> {
    const repo = opts.repo ?? new Repo({ sharePolicy: async () => true });
    const daemonHandle = opts.daemonHandle ?? repo.create<LarDoc>(emptyLarDoc());
    const dir = opts.dir ?? mkdtempSync(join(tmpdir(), "uds-receipt-ledger-"));
    const v = new Vessel(repo, daemonHandle, dir, opts.placeVerbImpl, opts.ring);
    await v.start();
    return v;
  }

  private async start(): Promise<void> {
    this.claim = await claimStore(this.dir, { holder: "vessel" });
    this.channel = startUdsChannel({
      daemonHandle: this.daemonHandle,
      placeVerb: (o) => this.placeVerbImpl(o as Placed, this.daemonHandle),
      claim: this.claim,
      repo: this.repo,
      ...(this.ring !== undefined && { ring: this.ring }),
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
      const workerDigest = await verbInputDigest({ verb, args, requestedBy });
      const outcome = concludeVerb({
        requestId, verb, status: "done", requestedBy, cause: "remote-summons", batchMode: "best-effort",
        results: { summary: { ok: true } }, inputDigest: workerDigest,
      });
      v.daemonHandle.change((doc) => { doc.tiddlers[outcome.tiddler.title] = outcome as unknown as LarDoc["tiddlers"][string]; });
      await new Promise((r) => setTimeout(r, 100)); // let the subscription mint the fact

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

      const receipt = await sendLine(v.socketPath, { op: "receipt", requestId: ids[0] });
      expect(receipt["state"]).toBe("evicted");

      const redispatch = await sendLine(v.socketPath, { verb: "nexus-kapae", args: { requestId: ids[0] }, requestedBy: "did:key:test", requestId: ids[0] });
      expect(counter.n).toBe(4); // no second run
      expect(redispatch["status"]).toBe("error");
      expect((redispatch["refusal"] as { reason?: string } | undefined)?.reason).toBe("retention-gap");

      // CONTROL: the 2nd/3rd/4th ids — still within the ring — read their outcomes exactly.
      for (const requestId of ids.slice(1)) {
        const receipt2 = await sendLine(v.socketPath, { op: "receipt", requestId });
        expect(receipt2["state"]).toBe("done");
      }
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
      const stored = v.daemonHandle.doc()!.tiddlers[`${RECEIPT_FACT_URI_PREFIX}${requestId}`]!.tiddler as Record<string, unknown>;
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

  test("an outcome that landed after the channel closed settles the fact `done` at the next boot, never `interrupted`", async () => {
    const counter = { n: 0 };
    const v = await Vessel.boot({ placeVerbImpl: () => { counter.n++; } });
    try {
      const requestId = "req-landed-unobserved";
      const inv = { verb: "nexus-kapae", args: {}, requestedBy: "did:key:test", requestId, timeoutMs: 100 };
      await dispatchAndStrand(v, counter, inv);
      await v.restart(() => {
        const outcome = concludeVerb({
          requestId, verb: inv.verb, status: "done", requestedBy: inv.requestedBy, cause: "test-worker",
          batchMode: "best-effort", results: { summary: { ok: true } },
        });
        v.daemonHandle.change((doc) => { doc.tiddlers[outcome.tiddler.title] = outcome as unknown as LarDoc["tiddlers"][string]; });
      });
      expect((await sendLine(v.socketPath, { op: "receipt", requestId }))["state"]).toBe("done");
      const stored = v.daemonHandle.doc()!.tiddlers[`${RECEIPT_FACT_URI_PREFIX}${requestId}`]!.tiddler as Record<string, unknown>;
      expect(stored["state"]).toBe("done");
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
      // Write a raw, torn receipt-fact tiddler directly into the daemon doc — a `committed` fact
      // (a non-`abandoned` state, which `parseReceiptFact`/ReceiptFactClaimed REQUIRES a digest
      // on) with NO `input-digest` at all. This models a record some other writer left unreadable
      // (never produced by this ledger itself, which always stamps a digest on a claimed state).
      v.daemonHandle.change((doc) => {
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
          requestedBy: p.requestedBy, cause: "effect-dedup", batchMode: "best-effort",
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
