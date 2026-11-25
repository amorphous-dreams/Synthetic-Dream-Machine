/**
 * uds-rest-owed — NO SILENT LOSS at the seat (sealed-store#/owed): a write verb's `done` answer carries the vessel's owed
 * band (`rest`), a read never asks the vessel for one, and a reading that fails answers owed by name, never a bare ok.
 * Canon: lar:///ha.ka.ba/kahua/memory/research/signer-refused
 */
import { controlStoreOf } from "@lararium/mesh/control-home";
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

/** The fixture door's mint: a signer the seat can drop, holding no key. */
const fixtureMint = async () => ({ ok: true as const, signer: { dropped: false, drop() { (this as { dropped: boolean }).dropped = true; } } });

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

describe("no silent loss at the UDS seat: a write verb's done answer carries the owed band", () => {
  test("a write stamps `rest` from the vessel's reading; a read never asks it; a reading that fails still answers owed", async () => {
    const repo = new Repo({ sharePolicy: async () => true });
    const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
    const workingHandle = repo.create<LarDoc>(emptyLarDoc());
    const composite = new CompositeStore();
    composite.addLayer({ bagId: DAEMON_BAG_ID, store: new AutomergeDocStore(daemonHandle as never, DAEMON_BAG_ID), writable: true, defaultWritable: false });
    composite.addLayer({ bagId: wikiSlotUri("daemon", "working"), store: new AutomergeDocStore(workingHandle, wikiSlotUri("daemon", "working")), writable: true });
    const dir = mkdtempSync(join(tmpdir(), "uds-rest-owed-"));
    const claim = await claimStore(dir, { holder: "vessel" });
    const door: UdsSessionDoor = { anchorNow: async () => ({ kind: "place" as const, aid: "place-fixture", head: "place-head" }), open: async ({ faceRef }) => ({ ok: true, supply: {
      face: face(faceRef), ordinal: 0, profile: "seat", presenter: `verified-${faceRef}`, anchor: { kind: "place" as const, aid: "place-fixture", head: "place-head" }, mint: fixtureMint } }) };
    const band = { band: "owed" as const, documents: [{ documentId: "2hUgpNYoRGAkCcCXTgZGecaQBXsp", refusal: "save-unsealed", error: "record-refused", cause: "signer-refused" }] };
    const marks: string[] = [];
    let reading: "band" | "none" | "throws" = "band";
    const channel = startUdsChannel({ controlHandle: daemonHandle, control: controlStoreOf(daemonHandle), claim, repo, sessions: door,
      restOwed: {
        mark: () => { marks.push("mark"); return { at: marks.length }; },
        owed: async () => { if (reading === "throws") throw new Error("flush threw"); return reading === "band" ? band : null; },
      },
      placeVerb: (o) => {
        const outcome = concludeVerb({ requestId: o.requestId, verb: o.verb, status: "done", ...(o.face !== undefined && { face: o.face }),
          cause: "test-worker", batchMode: "best-effort", results: { summary: { ok: true, output: { decision: "put" } } } });
        daemonHandle.change((doc) => { doc.tiddlers[outcome.tiddler.title] = outcome as unknown as LarDoc["tiddlers"][string]; });
      } });
    const a = await Peer.connect(claim.socketPath);
    try {
      const opened = await a.ask({ op: "session:open", requestId: "open-a", faceRef: "a", hand: "seat" });
      const env = { ownerEpoch: opened["ownerEpoch"], sessionId: opened["sessionId"], generation: opened["generation"], faceRef: opened["faceRef"] };
      const call = (requestId: string, verb: string) => ({ op: "session:call", ...env, requestId, verb, args: { recipe: "lares", title: "T" } });
      expect(await a.ask(call("put-1", "tiddler-put"))).toMatchObject({ kind: "session:result", status: "done", rest: band });
      expect(marks).toEqual(["mark"]);
      const read = await a.ask(call("get-1", "tiddler-get"));
      expect(read).toMatchObject({ kind: "session:result", status: "done" });
      expect(read).not.toHaveProperty("rest");
      expect(marks).toEqual(["mark"]);
      reading = "none";
      expect(await a.ask(call("put-2", "tiddler-put"))).not.toHaveProperty("rest");
      reading = "throws";
      expect(await a.ask(call("put-3", "meme-delete"))).toMatchObject({ rest: { band: "owed", documents: [{ refusal: "owed-unread", error: "flush threw" }] } });
    } finally {
      a.sock.destroy(); channel.close(); await claim.release(); rmSync(dir, { recursive: true, force: true });
    }
  });
});
