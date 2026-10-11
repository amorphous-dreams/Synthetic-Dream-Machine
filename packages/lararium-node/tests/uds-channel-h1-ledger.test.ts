/**
 * uds-channel — the H1 arbitration ledger: one winner per request id, receipts by id, the CLI
 * never retells a vessel's own impatience as a verdict on the act.
 *
 * PROVEN LIVE (gp25-episkopos1 §1, H1): a caller that gave up got its invocation dropped (logged,
 * never dispatched) — but nothing recorded the drop, so a LATER connection carrying the SAME
 * request id (a read-back, exactly what `act.ts` issues) met a vessel with no memory of the
 * refusal and dispatched it anyway. One request id, two "winners". This suite proves the ledger
 * this ships with it closes exactly that hole, plus the matched M2/M8 fixes riding beside it:
 *   - an abandoned id refuses a later dispatch attempt under the SAME id, by name, never running;
 *   - `{op:"receipt"}` reads the ledger + durable outcome WITHOUT ever calling `placeVerb`;
 *   - a reused id with CHANGED args refuses `request-id-reused-with-changed-input`, never runs
 *     under borrowed trust in the id alone;
 *   - the vessel's own wait-expiry rides back as `{status:"unknown"}`, never `{status:"error"}` (M2);
 *   - `{op:"cancel"}` withdraws an id before it is read, so it cannot be dispatched later (M8);
 *   - a set-back/set-forward `Date.now()` moves none of it — the ledger reads no clock at all.
 */
import { describe, test, expect } from "vitest";
import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConnection } from "node:net";
import { Repo } from "@automerge/automerge-repo";
import { emptyLarDoc, concludeVerb, type LarDoc } from "@lararium/mesh";
import { recordMineDuration, TIMEOUT_FLOOR_MS } from "@lararium/mempalace";
import { startUdsChannel } from "../src/uds-channel.js";
import { claimStore } from "../src/owned-store.js";

interface Placed { verb: string; args: Record<string, unknown>; requestedBy: string; requestId: string; }

/** Write one line and wait for the answer — the client's own writable side stays open until the
 *  answer arrives (never a premature half-close, which would itself read as abandonment). */
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

/** Open a connection, write the invocation line, then half-close immediately — the shape the
 *  episkopos probe measured: a caller that gave up the instant it finished writing. */
function writeThenHangUp(socketPath: string, inv: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const sock = createConnection(socketPath);
    sock.once("connect", () => { sock.end(JSON.stringify(inv) + "\n"); });
    sock.once("close", () => resolve());
    sock.once("error", reject);
  });
}

async function withChannel(
  placeVerbImpl: (o: Placed, daemonHandle: ReturnType<Repo["create"]>) => void,
  run: (ctx: { socketPath: string; placed: Placed[] }) => Promise<void>,
): Promise<void> {
  const repo = new Repo({ sharePolicy: async () => true });
  const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
  const dir = mkdtempSync(join(tmpdir(), "uds-h1-"));
  const claim = await claimStore(dir, { holder: "vessel" });
  const placed: Placed[] = [];
  const channel = startUdsChannel({
    daemonHandle,
    placeVerb: (o) => { const p = o as Placed; placed.push(p); placeVerbImpl(p, daemonHandle); },
    claim,
    repo,
    timeoutMs: 500, // short vessel-side budget so the M2 proof does not wait long
  });
  try {
    await waitForSocket(claim.socketPath);
    await run({ socketPath: claim.socketPath, placed });
  } finally {
    channel.close();
    await claim.release();
    rmSync(dir, { recursive: true, force: true });
  }
}

const doneWorker = (p: Placed, daemonHandle: ReturnType<Repo["create"]>) => {
  const outcome = concludeVerb({
    requestId: p.requestId, verb: p.verb, status: "done",
    requestedBy: p.requestedBy, cause: "test-worker", batchMode: "best-effort",
    results: { summary: { ok: true } },
  });
  daemonHandle.change((doc) => { doc.tiddlers[outcome.tiddler.title] = outcome as unknown as LarDoc["tiddlers"][string]; });
};

describe("uds-channel — H1 arbitration ledger", () => {
  test("RED→GREEN: a read-back under an ABANDONED request id never re-dispatches", async () => {
    await withChannel(() => { /* never actually dispatches in this test — see below */ }, async ({ socketPath, placed }) => {
      const inv = { verb: "nexus-kapae", args: { a: 1 }, requestedBy: "did:key:test", requestId: "req-h1-abandon" };
      await writeThenHangUp(socketPath, inv);
      // Give the server's deferred (double setImmediate) EOF check its turn.
      await new Promise((r) => setTimeout(r, 100));
      expect(placed).toHaveLength(0); // dropped, not dispatched — the control half of this proof

      // THE PROVEN BUG: a fresh connection carries the SAME request id as a "read-back".
      const retry = await sendLine(socketPath, inv);
      expect(placed).toHaveLength(0); // still never dispatched — this is the fix
      expect(retry["status"]).toBe("error");
      expect(String(retry["errorMessage"])).toMatch(/already refused request req-h1-abandon before commit/);
    });
  });

  test("{op:\"receipt\"} reads an abandoned id without ever calling placeVerb", async () => {
    await withChannel(() => { /* unused */ }, async ({ socketPath, placed }) => {
      const inv = { verb: "nexus-kapae", args: {}, requestedBy: "did:key:test", requestId: "req-h1-receipt-abandon" };
      await writeThenHangUp(socketPath, inv);
      await new Promise((r) => setTimeout(r, 100));
      expect(placed).toHaveLength(0);

      const receipt = await sendLine(socketPath, { op: "receipt", requestId: "req-h1-receipt-abandon" });
      expect(receipt).toEqual({ requestId: "req-h1-receipt-abandon", state: "abandoned" });
      expect(placed).toHaveLength(0); // the query itself never dispatched anything
    });
  });

  test("{op:\"receipt\"} on a never-seen id reads unknown, never error, never abandoned", async () => {
    await withChannel(() => { /* unused */ }, async ({ socketPath, placed }) => {
      const receipt = await sendLine(socketPath, { op: "receipt", requestId: "req-never-seen" });
      expect(receipt).toEqual({ requestId: "req-never-seen", state: "unknown" });
      expect(placed).toHaveLength(0);
    });
  });

  test("{op:\"receipt\"} on a committed, completed id reads the durable outcome", async () => {
    await withChannel(doneWorker, async ({ socketPath }) => {
      const inv = { verb: "nexus-kapae", args: {}, requestedBy: "did:key:test", requestId: "req-h1-done" };
      const first = await sendLine(socketPath, inv);
      expect(first["status"]).toBe("done");

      const receipt = await sendLine(socketPath, { op: "receipt", requestId: "req-h1-done" });
      expect(receipt["state"]).toBe("done");
    });
  });

  test("a reused request id with CHANGED args refuses by name — request-id-reused-with-changed-input", async () => {
    await withChannel(doneWorker, async ({ socketPath, placed }) => {
      const requestId = "req-h1-digest";
      const first = await sendLine(socketPath, { verb: "nexus-kapae", args: { a: 1 }, requestedBy: "did:key:test", requestId });
      expect(first["status"]).toBe("done");
      expect(placed).toHaveLength(1);

      // The SAME id, DIFFERENT args — never silently re-run under borrowed trust in the id alone.
      const second = await sendLine(socketPath, { verb: "nexus-kapae", args: { a: 2 }, requestedBy: "did:key:test", requestId });
      expect(placed).toHaveLength(1); // no second dispatch
      expect(second["status"]).toBe("error");
      expect(String(second["errorMessage"])).toMatch(/already used with different arguments/);
    });
  });

  test("a re-read of the SAME committed id (identical args) returns the same outcome, never a second dispatch", async () => {
    await withChannel(doneWorker, async ({ socketPath, placed }) => {
      const requestId = "req-h1-same-digest";
      const inv = { verb: "nexus-kapae", args: { a: 1 }, requestedBy: "did:key:test", requestId };
      const first  = await sendLine(socketPath, inv);
      const second = await sendLine(socketPath, inv);
      expect(first["status"]).toBe("done");
      expect(second["status"]).toBe("done");
      expect(placed).toHaveLength(1); // ONE dispatch answers both reads
    });
  });

  test("M2: the vessel's own wait-expiry rides back as {status:\"unknown\"}, never {status:\"error\"}", async () => {
    // A worker that never writes an outcome — this vessel's own budget expires while the act is (as
    // far as this vessel can tell) still running. The servo's own floor is TIMEOUT_FLOOR_MS (15s)
    // even fully warmed, so seed the EWMA for THIS test's own dedicated verb key to reach that floor
    // rather than the 120s cold-start exemption an unseen key would carry.
    const verb = "h1-ledger-m2-wait-probe";
    recordMineDuration(verb, 10); recordMineDuration(verb, 10); recordMineDuration(verb, 10);
    await withChannel(() => { /* never settles the outcome */ }, async ({ socketPath, placed }) => {
      const answer = await sendLine(socketPath, { verb, args: {}, requestedBy: "did:key:test", requestId: "req-h1-vessel-wait" });
      expect(placed).toHaveLength(1); // it WAS dispatched — this vessel's patience, not the act's verdict, ran out
      expect(answer["status"]).toBe("unknown");
      expect(answer["requestId"]).toBe("req-h1-vessel-wait");
      expect(answer["errorMessage"]).toBeUndefined(); // never told as an error
    });
  }, TIMEOUT_FLOOR_MS + 10_000);

  test("M8: {op:\"cancel\"} withdraws a request id before it is ever read — the later line never dispatches", async () => {
    await withChannel(() => { /* unused */ }, async ({ socketPath, placed }) => {
      const requestId = "req-h1-cancel";
      const cancelAnswer = await sendLine(socketPath, { op: "cancel", requestId });
      expect(cancelAnswer).toEqual({ requestId, state: "abandoned" });

      const retry = await sendLine(socketPath, { verb: "nexus-kapae", args: {}, requestedBy: "did:key:test", requestId });
      expect(placed).toHaveLength(0);
      expect(retry["status"]).toBe("error");
      expect(String(retry["errorMessage"])).toMatch(/already refused request req-h1-cancel before commit/);
    });
  });

  test("CLOCKLESS CONTROL: a set-back and a set-forward Date.now() leave the abandon-then-refuse verdict unchanged", async () => {
    for (const skewMs of [-10 * 365 * 24 * 3600 * 1000, 10 * 365 * 24 * 3600 * 1000]) {
      const realNow = Date.now;
      await withChannel(() => { /* unused */ }, async ({ socketPath, placed }) => {
        const inv = { verb: "nexus-kapae", args: {}, requestedBy: "did:key:test", requestId: `req-h1-skew-${skewMs}` };
        Date.now = () => realNow() + skewMs;
        try {
          await writeThenHangUp(socketPath, inv);
          await new Promise((r) => setTimeout(r, 100));
          expect(placed).toHaveLength(0);
          const retry = await sendLine(socketPath, inv);
          expect(placed).toHaveLength(0);
          expect(retry["status"]).toBe("error");
        } finally { Date.now = realNow; }
      });
    }
  });
});
