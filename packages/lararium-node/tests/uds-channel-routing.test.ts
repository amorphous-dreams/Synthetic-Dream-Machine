/**
 * uds-channel-routing — the co-located content bypass.
 *
 * The routing law (project_dreamnet_resolution_design, operator 2026-07-20): a
 * co-located `lares` invocation hands its carriers to the daemon worker over the
 * DIRECT channel (placeVerb → postMessage); the daemon Automerge doc receives
 * ONLY the durable outcome/receipt, NEVER the carrier content. This test drives a
 * real UDS socket with a spy placeVerb standing in for the worker (it lands the
 * carriers in a TARGET bag doc + writes the outcome to daemon, exactly as the
 * dispatcher does) and asserts the content never touches daemon.
 */

import { describe, test, expect } from "vitest";
import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConnection } from "node:net";
import { Repo } from "@automerge/automerge-repo";
import {
  emptyLarDoc, mutableLarRecord, concludeVerb,
  SUMMONS_URI_PREFIX, OUTCOME_URI_PREFIX, DAEMON_BAG_ID, AutomergeDocStore, CompositeStore, wikiSlotUri, type LarDoc,
} from "@lararium/mesh";
import { startUdsChannel } from "../src/uds-channel.js";
import { claimStore, StoreHeld } from "../src/owned-store.js";

interface Placed { verb: string; args: Record<string, unknown>; requestedBy: string; requestId: string; }

function daemonComposite(repo: Repo, daemonHandle: ReturnType<Repo["create"]>): CompositeStore {
  const composite = new CompositeStore();
  const working = repo.create<LarDoc>(emptyLarDoc());
  composite.addLayer({ bagId: DAEMON_BAG_ID, store: new AutomergeDocStore(daemonHandle as never, DAEMON_BAG_ID), writable: true, defaultWritable: false });
  composite.addLayer({ bagId: wikiSlotUri("daemon", "working"), store: new AutomergeDocStore(working, wikiSlotUri("daemon", "working")), writable: true });
  return composite;
}

function sendInvocation(socketPath: string, inv: unknown): Promise<Record<string, unknown>> {
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

async function waitForSocket(path: string): Promise<void> {
  for (let i = 0; i < 100; i++) {
    if (existsSync(path)) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error(`socket never appeared at ${path}`);
}

describe("uds-channel — carriers bypass the daemon doc (co-located routing)", () => {
  test("content rides placeVerb to the target bag; daemon holds only the outcome", async () => {
    const repo = new Repo({ sharePolicy: async () => true });
    const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
    const targetHandle = repo.create<LarDoc>(emptyLarDoc());

    const dir = mkdtempSync(join(tmpdir(), "uds-routing-"));
    const claim = await claimStore(dir, { holder: "vessel" });
    const socketPath = claim.socketPath;

    const CARRIER_URI = "lar:///ha.ka.ba/bags/target/doc/manifesto";
    const CARRIER_BODY = "THE-WHOLE-CARRIER-BODY-that-must-never-touch-daemon";
    const placed: Placed[] = [];

    const channel = startUdsChannel({
      daemonHandle,
      composite: daemonComposite(repo, daemonHandle),
      // Stand in for the daemon worker: land the carriers in the TARGET bag (as the
      // dispatcher's executeIngest does via access.write(destBag)), then write the
      // durable outcome into daemon — the ONLY thing daemon's doc ever sees.
      placeVerb: (o) => {
        placed.push(o as Placed);
        const carriers = (o.args["carriers"] as Array<{ uri: string; text: string }> | undefined) ?? [];
        targetHandle.change((doc) => {
          for (const c of carriers) {
            doc.tiddlers[c.uri] = mutableLarRecord(c.uri, { text: c.text }, "lares-verb");
          }
        });
        const outcome = concludeVerb({
          requestId: o.requestId, verb: o.verb, status: "done",
          requestedBy: o.requestedBy, cause: "test-worker", batchMode: "best-effort",
          results: { summary: { ok: true, output: { toBag: String(o.args["toBag"]) } } },
        });
        daemonHandle.change((doc) => { doc.tiddlers[outcome.tiddler.title] = outcome as unknown as LarDoc["tiddlers"][string]; });
      },
      claim,
      repo,
    });

    try {
      await waitForSocket(socketPath);

      const outcome = await sendInvocation(socketPath, {
        verb: "act",
        args: { toBag: targetHandle.url, carriers: [{ uri: CARRIER_URI, text: CARRIER_BODY }] },
        requestedBy: "did:key:test-operator",
        requestId: "req-routing-1",
      });

      // The invocation completed via the durable outcome.
      expect(outcome["status"]).toBe("done");

      // The carrier CONTENT reached the worker channel (never serialized into a summons).
      expect(placed).toHaveLength(1);
      expect((placed[0].args["carriers"] as Array<{ text: string }>)[0].text).toBe(CARRIER_BODY);

      // daemon's doc carries the outcome/receipt — and NO summons.
      const daemonTitles = Object.keys(daemonHandle.doc().tiddlers);
      expect(daemonTitles.some((t) => t.startsWith(SUMMONS_URI_PREFIX))).toBe(false);
      expect(daemonTitles.some((t) => t.startsWith(OUTCOME_URI_PREFIX))).toBe(true);

      // The whole daemon doc — history included via the live doc — carries ZERO carrier content.
      expect(JSON.stringify(daemonHandle.doc())).not.toContain(CARRIER_BODY);

      // The carrier landed in the TARGET bag exactly.
      const landed = targetHandle.doc().tiddlers[CARRIER_URI] as { tiddler: { text?: string } } | undefined;
      expect(landed?.tiddler.text).toBe(CARRIER_BODY);
    } finally {
      channel.close();
      await claim.release();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("H1′ RED: a peer that already hung up before this vessel could dispatch never runs the verb", async () => {
    // gp3-episkopos H1′: `serve`'s data handler dispatched `runVerb` the INSTANT a line parsed, with
    // no check for a peer that had already hung up (or a frozen vessel that only got around to
    // reading the line long after the caller gave up and destroyed its own end — `probe-h1.sh
    // livefreeze`, live). This models the cooperative half of that shape: a caller that writes its
    // line and ends in the SAME breath, before this vessel's deferred dispatch ever gets its turn.
    const repo = new Repo({ sharePolicy: async () => true });
    const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
    const dir = mkdtempSync(join(tmpdir(), "uds-routing-"));
    const claim = await claimStore(dir, { holder: "vessel" });
    const placed: Placed[] = [];
    const channel = startUdsChannel({ daemonHandle, composite: daemonComposite(repo, daemonHandle), placeVerb: (o) => { placed.push(o as Placed); }, claim, repo });
    try {
      await waitForSocket(claim.socketPath);
      const sock = createConnection(claim.socketPath);
      await new Promise<void>((resolve, reject) => { sock.once("connect", resolve); sock.once("error", reject); });
      sock.end(JSON.stringify({ verb: "nexus-kapae", args: {}, requestedBy: "did:key:test" }) + "\n");
      await new Promise<void>((resolve) => sock.once("close", resolve));
      // Real time, not a bare tick: the SERVER side's own `end`/`close` notification for a half-closed
      // real socket rides its own kernel I/O callback, which can land a poll cycle behind the client's
      // own `close` — a bare `setImmediate` raced ahead of it and false-reddened this exact assertion.
      await new Promise((r) => setTimeout(r, 100));
      expect(placed).toHaveLength(0);               // the verb handler NEVER ran — no ghost write
    } finally {
      channel.close();
      await claim.release();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("CLOCKLESS CONTROL: deadlineAt is dead wire vocabulary — a line carrying a past one still dispatches", async () => {
    // P2.5 S1: `deadlineAt` is retired from the dispatch-time gate entirely (`uds-channel.ts`). This
    // test used to assert the OPPOSITE — that a past `deadlineAt` refused the line by name. Retiring the
    // field means the only thing that may still decide run-or-drop here is the CAUSAL EOF check above
    // (H1′), never a stamped instant. A stray `deadlineAt` on the wire (an older caller, a replay) must
    // now read as unknown JSON noise and change nothing.
    const repo = new Repo({ sharePolicy: async () => true });
    const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
    const dir = mkdtempSync(join(tmpdir(), "uds-routing-"));
    const claim = await claimStore(dir, { holder: "vessel" });
    const placed: Placed[] = [];
    const channel = startUdsChannel({
      daemonHandle,
      composite: daemonComposite(repo, daemonHandle),
      placeVerb: (o) => {
        placed.push(o as Placed);
        const outcome = concludeVerb({
          requestId: o.requestId, verb: o.verb, status: "done",
          requestedBy: o.requestedBy, cause: "test-worker", batchMode: "best-effort",
          results: { summary: { ok: true } },
        });
        daemonHandle.change((doc) => { doc.tiddlers[outcome.tiddler.title] = outcome as unknown as LarDoc["tiddlers"][string]; });
      },
      claim,
      repo,
    });
    try {
      await waitForSocket(claim.socketPath);
      const answer = await sendInvocation(claim.socketPath, {
        verb: "nexus-kapae", args: {}, requestedBy: "did:key:test", requestId: "req-deadline-ignored",
        deadlineAt: Date.now() - 1_000, // a stale wall-clock stamp an old/foreign caller might still send
      });
      expect(answer["status"]).toBe("done");
      expect(placed).toHaveLength(1);
    } finally {
      channel.close();
      await claim.release();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("CLOCKLESS MUTATION: a set-back and a set-forward Date.now() leave the EOF verdict unchanged", async () => {
    // The only run-or-drop decision left at this boundary is the causal EOF check (H1′, above). A
    // device clock set back or forward around that decision must not move it either way — proof against
    // the law's own adversarial-clock premise, not merely a once-ignored field.
    for (const skewMs of [-10 * 365 * 24 * 3600 * 1000, 10 * 365 * 24 * 3600 * 1000]) {
      const realNow = Date.now;
      const repo = new Repo({ sharePolicy: async () => true });
      const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
      const dir = mkdtempSync(join(tmpdir(), "uds-routing-"));
      const claim = await claimStore(dir, { holder: "vessel" });
      const placed: Placed[] = [];
      const channel = startUdsChannel({ daemonHandle, composite: daemonComposite(repo, daemonHandle), placeVerb: (o) => { placed.push(o as Placed); }, claim, repo });
      try {
        await waitForSocket(claim.socketPath);
        Date.now = () => realNow() + skewMs; // a set-back or a set-forward device clock
        const sock = createConnection(claim.socketPath);
        await new Promise<void>((resolve, reject) => { sock.once("connect", resolve); sock.once("error", reject); });
        sock.end(JSON.stringify({ verb: "nexus-kapae", args: {}, requestedBy: "did:key:test" }) + "\n");
        await new Promise<void>((resolve) => sock.once("close", resolve));
        await new Promise((r) => setTimeout(r, 100));
        expect(placed).toHaveLength(0); // the hang-up-before-dispatch verdict, unmoved by either clock skew
      } finally {
        Date.now = realNow;
        channel.close();
        await claim.release();
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  test("a closed channel keeps its vessel's claim: callers hear the stop by name, and no direct holder binds beside it", async () => {
    const repo = new Repo({ sharePolicy: async () => true });
    const dir = mkdtempSync(join(tmpdir(), "uds-routing-"));
    const claim = await claimStore(dir, { holder: "vessel" });
    try {
      const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
      const channel = startUdsChannel({ daemonHandle, composite: daemonComposite(repo, daemonHandle), placeVerb: () => { /* none */ }, claim, repo });
      channel.close();
      const answer = await sendInvocation(claim.socketPath, { verb: "act", args: {}, requestedBy: "did:key:test-operator" });
      expect(answer["status"]).toBe("error");
      expect(String(answer["errorMessage"])).toMatch(/on this store stops/);
      await expect(claimStore(dir)).rejects.toBeInstanceOf(StoreHeld);
    } finally {
      await claim.release();
      rmSync(dir, { recursive: true, force: true });
    }
    expect(existsSync(claim.socketPath)).toBe(false);
  });
});
