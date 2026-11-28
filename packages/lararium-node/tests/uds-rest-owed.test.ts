/**
 * uds-rest-owed — NO SILENT LOSS at the seat (sealed-store#/owed): a write verb's `done` answer carries the vessel's owed
 * band (`rest`), a read never asks the vessel for one, and a reading that fails answers owed by name, never a bare ok.
 * Canon: lar:///ha.ka.ba/kahua/memory/research/signer-refused
 */
import { memoryWorkOf } from "./work-store-fixture.js";
import { describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConnection, type Socket } from "node:net";
import { Repo } from "@automerge/automerge-repo";
import { AutomergeDocStore } from "@lararium/mesh/automerge-doc-store";
import { CompositeStore } from "@lararium/mesh/composite-store";
import { DAEMON_BAG_ID } from "@lararium/mesh/lar-uris";
import { emptyLarDoc, type LarDoc } from "@lararium/mesh/base-doc";
import { concludeVerb } from "@lararium/mesh/verb-tiddler";
import { wikiSlotUri } from "@lararium/mesh/wiki-recipe";
import type { SessionFace } from "@lararium/mesh/session-contract";
import { startUdsChannel, type UdsSessionDoor } from "../src/uds-channel.js";
import { claimStore } from "../src/owned-store.js";
import { watchCallTouches } from "@lararium/mesh/call-touches";
import { seatNodeCallScope } from "../src/node-call-scope.js";

/** The fixture door's mint: a signer the seat can drop, holding no key. */
const fixtureMint = async () => ({ ok: true as const, signer: {
  dropped: false, certificate: null,
  drop() { (this as { dropped: boolean }).dropped = true; },
  sign: async () => ({ refusal: "fixture-signer-signs-nothing" }),
} });

const face = (name: string): SessionFace => ({
  personaGroup: `group-${name}`, proofSubject: `proof-${name}`, admitRef: `admit-${name}`,
  causalRevision: `revision-${name}`,
  planes: { persona: `persona-${name}`, circles: `circles-${name}`, identities: `identities-${name}`,
    sessions: `sessions-${name}`, intents: `intents-${name}` },
});

class Peer {
  private buf = "";
  private readonly replies: Array<Record<string, unknown>> = [];
  private readonly waiters: Array<(reply: Record<string, unknown>) => void> = [];
  private constructor(readonly sock: Socket) {
    sock.setEncoding("utf8");
    sock.on("data", (chunk: string) => {
      this.buf += chunk;
      let nl: number;
      while ((nl = this.buf.indexOf("\n")) !== -1) {
        const reply = JSON.parse(this.buf.slice(0, nl)) as Record<string, unknown>;
        this.buf = this.buf.slice(nl + 1);
        const waiter = this.waiters.shift();
        if (waiter) waiter(reply); else this.replies.push(reply);
      }
    });
  }
  static async connect(path: string): Promise<Peer> {
    const sock = createConnection(path);
    await new Promise<void>((resolve, reject) => { sock.once("connect", resolve); sock.once("error", reject); });
    return new Peer(sock);
  }
  next(): Promise<Record<string, unknown>> {
    const reply = this.replies.shift();
    return reply ? Promise.resolve(reply) : new Promise((resolve) => this.waiters.push(resolve));
  }
  send(frame: Record<string, unknown>): void { this.sock.write(JSON.stringify(frame) + "\n"); }
  ask(frame: Record<string, unknown>): Promise<Record<string, unknown>> { const reply = this.next(); this.send(frame); return reply; }
}

describe("no silent loss at the UDS seat: one stamp for every call whose own changes wait", () => {
  test("a verb's island changes (its outcome's `touched`) and an act's own changes here read their rest; a call that changed nothing never asks", async () => {
    seatNodeCallScope();
    const repo = new Repo({ sharePolicy: async () => true });
    watchCallTouches(repo as never);
    const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
    const workingHandle = repo.create<LarDoc>(emptyLarDoc());
    const stageHandle = repo.create<{ rows?: Record<string, string> }>();   // the kahua stage's local canon
    const heldHandle = repo.create<{ n?: number }>();                        // a document another call left waiting
    const composite = new CompositeStore();
    composite.addLayer({ bagId: DAEMON_BAG_ID, store: new AutomergeDocStore(daemonHandle as never, DAEMON_BAG_ID), writable: true, defaultWritable: false });
    composite.addLayer({ bagId: wikiSlotUri("daemon", "working"), store: new AutomergeDocStore(workingHandle, wikiSlotUri("daemon", "working")), writable: true });
    const dir = mkdtempSync(join(tmpdir(), "uds-rest-owed-"));
    const claim = await claimStore(dir, { holder: "vessel" });
    const door: UdsSessionDoor = { anchorNow: async () => ({ kind: "place" as const, aid: "place-fixture", head: "place-head" }), open: async ({ faceRef }) => ({ ok: true, supply: {
      face: face(faceRef), ordinal: 0, profile: "seat", presenter: `verified-${faceRef}`, anchor: { kind: "place" as const, aid: "place-fixture", head: "place-head" }, mint: fixtureMint } }) };
    // The vessel's reading, as the real one answers: every document the call changed that the held set names waits.
    const waiting = new Set<string>([heldHandle.documentId, stageHandle.documentId, "island-doc"]);
    const asked: Array<string[]> = [];
    let throws = false;
    const channel = startUdsChannel({ stateHandle: daemonHandle, state: memoryWorkOf(daemonHandle), claim, repo, sessions: door,
      restOwed: {
        mark: () => 0,
        owed: async (_since, touches) => {
          const ids = Object.keys(touches ?? {});
          asked.push(ids);
          if (throws) throw new Error("flush threw");
          const docs = ids.filter((id) => waiting.has(id)).map((documentId) => ({ documentId, refusal: "save-unsealed", error: "record-refused", cause: "signer-refused" }));
          return docs.length > 0 ? { band: "owed" as const, documents: docs } : null;
        },
      },
      sessionActs: {
        names: new Set(["kahua-stage"]),
        // THE KAHUA STAGE'S SHAPE (kahua-door.ts): the act changes the local canon here and answers staged: true.
        run: async () => {
          await new Promise((r) => setTimeout(r, 1));
          stageHandle.change((d) => { d.rows = { ...(d.rows ?? {}), memo: "body" }; });
          return { status: "done", output: { title: "memo", staged: true } };
        },
      },
      placeVerb: (o) => {
        // A concurrent writer outside the call changes the held document while this verb runs: it never reads as this call's.
        setTimeout(() => heldHandle.change((d) => { d.n = (d.n ?? 0) + 1; }), 0);
        // The island reports every write's changes (even none); a path that reports nothing (here `rite-begin`, as a seat
        // that never carried the report would read) answers untracked. A read reports nothing and stays clean.
        const touched = o.verb === "tiddler-put" ? { touched: { "island-doc": ["aa"] } } : o.verb === "tiddler-delete" ? { touched: { "island-sealed": ["bb"] } }
          : o.verb === "kahua-propose" ? { touched: {} } : {};
        const outcome = concludeVerb({ requestId: o.requestId, verb: o.verb, status: "done", ...(o.face !== undefined && { face: o.face }),
          cause: "test-worker", batchMode: "best-effort", results: { summary: { ok: true, output: { decision: "put" } } }, ...touched });
        daemonHandle.change((doc) => { doc.tiddlers[outcome.tiddler.title] = outcome as unknown as LarDoc["tiddlers"][string]; });
      } });
    const a = await Peer.connect(claim.socketPath);
    try {
      const opened = await a.ask({ op: "session:open", requestId: "open-a", faceRef: "a", hand: "seat" });
      const env = { ownerEpoch: opened["ownerEpoch"], sessionId: opened["sessionId"], generation: opened["generation"], faceRef: opened["faceRef"] };
      const call = (requestId: string, verb: string) => ({ op: "session:call", ...env, requestId, verb, args: { recipe: "lares", title: "T" } });
      // A verb the island answered with its changed document: owed names that document alone, never the concurrent held one.
      const put = await a.ask(call("put-1", "tiddler-put"));
      expect(put).toMatchObject({ kind: "session:result", status: "done", rest: { band: "owed", documents: [{ documentId: "island-doc" }] } });
      expect(put).not.toHaveProperty("touched");
      expect(asked.at(-1)).toEqual(["island-doc"]);
      // A verb whose changes sealed answers bare; a verb that changed nothing never asks.
      expect(await a.ask(call("del-1", "tiddler-delete"))).not.toHaveProperty("rest");
      const n = asked.length;
      expect(await a.ask(call("get-1", "tiddler-get"))).not.toHaveProperty("rest");
      expect(asked.length).toBe(n);
      // FAIL-SAFE: a write verb whose answer carries no change report answers owed `untracked`, naming the verb; a write that
      // reported nothing changed answers bare.
      expect(await a.ask(call("rite-1", "rite-begin"))).toMatchObject({ rest: { band: "owed", documents: [{ documentId: "untracked", refusal: "untracked", error: expect.stringMatching(/^rite-begin: /) }] } });
      expect(await a.ask(call("prop-1", "kahua-propose"))).not.toHaveProperty("rest");
      // KAHUA-STAGE: the act answers staged: true over a held save today; the stamp names its own document.
      const staged = await a.ask({ op: "session:act", ...env, requestId: "stage-1", act: "kahua-stage", args: {} });
      expect(staged).toMatchObject({ kind: "session:act-result", answer: { output: { staged: true }, rest: { band: "owed", documents: [{ documentId: stageHandle.documentId }] } } });
      expect(asked.at(-1)).toEqual([stageHandle.documentId]);
      // A reading that fails answers owed by name for the call's own documents, never ok.
      throws = true;
      expect(await a.ask(call("put-2", "tiddler-put"))).toMatchObject({ rest: { band: "owed", documents: [{ documentId: "island-doc", refusal: "owed-unread", error: "flush threw" }] } });
    } finally {
      a.sock.destroy(); channel.close(); await claim.release(); rmSync(dir, { recursive: true, force: true });
    }
  });
});
