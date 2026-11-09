/**
 * uds-outcome-in-control-home — a CLI verb's answer reads off the outcome ledger where the island writes it: the vessel's
 * control document (`control-home`), which no recipe composes and no mirror names. The daemon wiki's working slot
 * (mirrored at `wikis/daemon-<F>`) and the daemon document rest no outcome body.
 *
 *   O1 — RED: the island lands the outcome in the control document a beat after the verb went out; the channel answers
 *        it, and neither the working slot nor the daemon document holds an outcome body
 *   O2 — CONTROL: an outcome that already stands answers a re-asked id with no second placement
 *   O3 — the main thread's own island ask (`askIslandVerb`) answers off the control store alike
 */
import { describe, test, expect } from "vitest";
import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConnection } from "node:net";
import { Repo } from "@automerge/automerge-repo";
import {
  emptyLarDoc, concludeVerb, OUTCOME_URI_PREFIX, controlStoreOf, type LarDoc,
} from "@lararium/mesh";
import { startUdsChannel } from "../src/uds-channel.js";
import { askIslandVerb } from "../src/island-verb-ask.js";
import { claimStore } from "../src/owned-store.js";

function stand() {
  const repo = new Repo({ sharePolicy: async () => true });
  const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
  const workingHandle = repo.create<LarDoc>(emptyLarDoc());
  const controlHandle = repo.create<LarDoc>(emptyLarDoc());
  const control = controlStoreOf(controlHandle);
  /** The island's write: the outcome lands in the control store, the control document. */
  const conclude = (requestId: string, verb: string, output: Record<string, unknown>): Promise<void> =>
    control.put(concludeVerb({ requestId, verb, status: "done", cause: "test-island", batchMode: "best-effort", results: { summary: { ok: true, output } } }),
      { kind: "lares-verb", requestId });
  return { repo, daemonHandle, workingHandle, controlHandle, control, conclude };
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

describe("a verb's answer reads off the outcome ledger in the control document", () => {
  test("O1/O2 — the channel answers an outcome the island lands in the control document late, and re-answers it with no second placement", async () => {
    const s = stand();
    const dir = mkdtempSync(join(tmpdir(), "uds-outcome-slot-"));
    const claim = await claimStore(dir, { holder: "vessel" });
    let placed = 0;
    const channel = startUdsChannel({
      controlHandle: s.controlHandle, control: s.control, claim, repo: s.repo, timeoutMs: 3_000,
      // The island answers a beat after the verb reached it, as a real verb does.
      placeVerb: (o) => { placed += 1; setTimeout(() => { void s.conclude(o.requestId, o.verb, { body: "private-heron" }); }, 50); },
    });
    try {
      await socketAt(claim.socketPath);
      const answer = await send(claim.socketPath, { verb: "get", args: {}, requestedBy: "did:key:test-operator", requestId: "req-slot-1" });
      expect(answer["status"], JSON.stringify(answer)).toBe("done");
      expect(JSON.stringify(answer["results"])).toContain("private-heron");
      expect(outcomeTitles(s.controlHandle), "the outcome rests in the control document").toEqual([`${OUTCOME_URI_PREFIX}req-slot-1`]);
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

  test("O3 — the main thread's own ask answers off the control store", async () => {
    const s = stand();
    const ask = askIslandVerb({
      control: s.control, verb: "seat-duties", args: {}, requestedBy: "0xvessel", requestId: "req-slot-ask",
      placeVerb: (o) => { setTimeout(() => { void s.conclude(o.requestId, o.verb, { ran: true }); }, 50); },
    });
    const out = await Promise.race([ask.answer, new Promise((_, reject) => setTimeout(() => reject(new Error("the ask never answered off the control store")), 3_000))]);
    expect(out).toEqual({ ran: true });
    expect(outcomeTitles(s.daemonHandle)).toEqual([]);
  });
});
