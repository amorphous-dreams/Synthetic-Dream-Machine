/**
 * outcome-ledger-growth-witness — A THOUSAND DOOR CALLS LEAVE THE CONTROL DOCUMENT'S BYTES NEAR WHERE THEY STOOD.
 *
 * The growth witness of the outcome ledger diet (lar:///ha.ka.ba/kahua/memory/plan/outcome-ledger-diet, step 0). It
 * stands a scratch vessel fixture (a storage-less Repo, a control document, the verb door over a scratch store claim,
 * and the island's own `writeOutcome` behind it), drives 1,000 mixed door calls through the socket, and reads the
 * control document's saved bytes (`A.save`) before and after.
 *
 * Before the diet every call, a read included, wrote two receipt facts and an outcome row that carried its whole result
 * body, so the document grew by every body it ever answered. The bars below hold after it:
 *
 *   G1 — 800 READS GROW THE DOCUMENT BY ZERO BYTES: a read writes no fact and no row.
 *   G2 — 200 WRITES GROW IT BY THE VERDICT ROWS ALONE: each write answers a 8 KiB body that will not compress, and the
 *        document takes less than `ROW_BAR` bytes for it (two fact writes, a verdict row, an effect row).
 *   G3 — NO BODY RESTS: the saved bytes carry no byte of any answered body.
 *
 * The witness prints what it measured, so the floor reads the true per-write weight (the plan's risk R1 holds an
 * estimate of about 1.3 KB). `ROW_BAR` stands at half a body: wide enough for the rows, far too narrow for a body.
 * No clock decides anything here: every bar counts bytes.
 */
import { describe, test, expect } from "vitest";
import { createHash } from "node:crypto";
import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConnection } from "node:net";
import * as A from "@automerge/automerge";
import { Repo } from "@automerge/automerge-repo";
import { emptyLarDoc, type LarDoc } from "@lararium/mesh/base-doc";
import { OUTCOME_URI_PREFIX, RECEIPT_FACT_URI_PREFIX, type Verb } from "@lararium/mesh/verb-tiddler";
import { controlStoreOf } from "@lararium/mesh/control-home";
import { writeOutcome } from "@lararium/tw5";
import { startUdsChannel } from "../src/uds-channel.js";
import { claimStore } from "../src/owned-store.js";

const READS = 800;
const WRITES = 200;
const READ_BODY_BYTES = 2 * 1024;
const WRITE_BODY_BYTES = 8 * 1024;
/** What one ledgered write may add to the control document's saved bytes: half its body. */
const ROW_BAR = WRITE_BODY_BYTES / 2;

/** `bytes` of hex that will not compress, the same for the same seed. */
function body(seed: string, bytes: number): string {
  let out = "";
  for (let i = 0; out.length < bytes; i++) out += createHash("sha256").update(`${seed}:${i}`).digest("hex");
  return out.slice(0, bytes);
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

type Placed = { requestId: string; verb: string; args: Record<string, unknown>; requestedBy: string; effectKey?: string };

describe("the control document stops growing with every door call", () => {
  test("G1/G2/G3 — 1,000 mixed door calls: reads add zero bytes, a write adds its verdict rows alone, and no body rests", async () => {
    const repo = new Repo({ sharePolicy: async () => true });
    const controlHandle = repo.create<LarDoc>(emptyLarDoc());
    const control = controlStoreOf(controlHandle);
    const saved = (): number => A.save(controlHandle.doc() as A.Doc<LarDoc>).length;
    const dir = mkdtempSync(join(tmpdir(), "ledger-growth-witness-"));
    const claim = await claimStore(dir, { holder: "vessel" });
    // The island: its own `writeOutcome` concludes each placed verb with the body its args name, and an empty change report.
    const channel = startUdsChannel({
      controlHandle, control, claim, repo, timeoutMs: 10_000,
      placeVerb: (o) => {
        const p = o as unknown as Placed;
        const invocation = {
          requestId: p.requestId, title: `lar:///lararium.local.vm/verbs/${p.requestId}`, action: p.verb, args: p.args, targets: [],
          batchMode: "best-effort", status: "pending", requestedBy: p.requestedBy, requestedAt: "t",
          ...(p.effectKey !== undefined ? { effectKey: p.effectKey } : {}),
        } as unknown as Verb;
        const bytes = p.verb === "ddate" ? READ_BODY_BYTES : WRITE_BODY_BYTES;
        void writeOutcome(control, { invocation, status: "done", result: { body: body(p.requestId, bytes) }, touched: {} });
      },
    });
    try {
      for (let i = 0; i < 100 && !existsSync(claim.socketPath); i++) await new Promise((r) => setTimeout(r, 10));
      const before = saved();

      // G1: the reads. Mixed in with them, every fourth read re-asks an id already answered, as a retrying client does.
      for (let i = 0; i < READS; i++) {
        const id = i % 4 === 3 ? `read-${i - 1}` : `read-${i}`;
        const args = i % 4 === 3 ? { n: i - 1 } : { n: i };
        const answer = await send(claim.socketPath, { verb: "ddate", args, requestedBy: "did:key:witness", requestId: id });
        if (answer["status"] !== "done") throw new Error(`read ${id} answered ${JSON.stringify(answer).slice(0, 300)}`);
        if (!JSON.stringify(answer["results"]).includes(body(id, 64))) throw new Error(`read ${id} answered without its body`);
      }
      const afterReads = saved();
      const titles = Object.keys(controlHandle.doc()?.tiddlers ?? {});
      expect(titles.filter((t) => t.startsWith(RECEIPT_FACT_URI_PREFIX)), "G1: a read writes no receipt fact").toEqual([]);
      expect(titles.filter((t) => t.startsWith(OUTCOME_URI_PREFIX)), "G1: a read writes no outcome row").toEqual([]);
      expect(afterReads - before, `G1: ${READS} reads grew the control document by ${afterReads - before} bytes`).toBe(0);

      // G2: the writes, each under its own request id and effect key, as `lares` mints them for a submitted mutation.
      for (let i = 0; i < WRITES; i++) {
        const id = `write-${i}`;
        const answer = await send(claim.socketPath, { verb: "get", args: { n: i }, requestedBy: "did:key:witness", requestId: id, effectKey: `effect-${i}` });
        if (answer["status"] !== "done") throw new Error(`write ${id} answered ${JSON.stringify(answer).slice(0, 300)}`);
        if (!JSON.stringify(answer["results"]).includes(body(id, 64))) throw new Error(`write ${id} answered without its body`);
      }
      // The last write's `done` fact lands a beat after its answer: wait for the ledger to settle before the measure.
      for (let i = 0; i < 300; i++) {
        const last = controlHandle.doc()?.tiddlers[`${RECEIPT_FACT_URI_PREFIX}write-${WRITES - 1}`];
        if (JSON.stringify(last ?? null).includes("done")) break;
        await new Promise((r) => setTimeout(r, 10));
      }
      const afterWrites = saved();
      const perWrite = (afterWrites - afterReads) / WRITES;
      // The measure, for the floor to read: the plan estimated about 1.3 KB of rows per ledgered write.
      console.log(`[ledger-growth-witness] control document saved bytes: before ${before}, after ${READS} reads ${afterReads} (+${afterReads - before}), after ${WRITES} writes ${afterWrites} (+${afterWrites - afterReads}, ${Math.round(perWrite)} bytes a write against an ${WRITE_BODY_BYTES}-byte body)`);
      expect(perWrite, `G2: each write added ${Math.round(perWrite)} bytes; its verdict rows fit under ${ROW_BAR}`).toBeLessThan(ROW_BAR);

      // G3: no body rests. The document's records name a hash and a byte count for each body, and none of its bytes.
      const records = JSON.stringify(controlHandle.doc()?.tiddlers ?? {});
      for (const id of ["read-0", "read-401", "write-0", `write-${WRITES - 1}`]) {
        expect(records.includes(body(id, 64)), `G3: the body of ${id} rests in the control document`).toBe(false);
      }
      expect(records).not.toContain("\"results\"");
    } finally {
      channel.close();
      await claim.release();
      rmSync(dir, { recursive: true, force: true });
    }
  }, 180_000);
});
