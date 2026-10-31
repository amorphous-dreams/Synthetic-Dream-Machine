/**
 * K20: A FACE ROW'S ANSWER RIDES THE SOCKET ALONE. A session's face row (`STORE_DOOR_FACE_ROWS`: `cabal-face`,
 * `cabal-vouch`, `edge-partial` and their kin) answers in the `session:act` shape: the door runs it as the face the
 * session wears (its ordinal and the presenter the door verified), the answer returns on this socket, and the one
 * record it leaves names the act and the face, never an argument or the answer. So no synced record pairs the face's
 * atom with the per-Nexus key the row answers. The `session:call` path, whose outcome body rests in the daemon
 * document beside its requester, refuses a face row and places nothing.
 */
import { afterEach, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConnection, type Socket } from "node:net";
import { Repo } from "@automerge/automerge-repo";
import { AutomergeDocStore, CompositeStore, DAEMON_BAG_ID, emptyLarDoc, RECEIPT_FACT_URI_PREFIX, concludeVerb, wikiSlotUri,
  type LarDoc, type SessionFace } from "@lararium/mesh";
import { makeUdsSeat, serveUdsFront, type UdsSessionDoor } from "../src/uds-channel.js";
import { claimStore } from "../src/owned-store.js";

const LEAF = "1eaf".repeat(16);                     // the per-Nexus key the row answers
const REALM = "c1ab".repeat(16);

const face = (name: string): SessionFace => ({
  personaGroup: `group-${name}`, proofSubject: `proof-${name}`, admitRef: `admit-${name}`, causalRevision: `revision-${name}`,
  planes: { persona: `persona-${name}`, circles: `circles-${name}`, identities: `identities-${name}`, sessions: `sessions-${name}`, intents: `intents-${name}` },
});

class Peer {
  private buf = "";
  private readonly waiters: Array<(reply: Record<string, unknown>) => void> = [];
  constructor(readonly sock: Socket) {
    sock.setEncoding("utf8");
    sock.on("data", (chunk: string) => {
      this.buf += chunk;
      let nl: number;
      while ((nl = this.buf.indexOf("\n")) !== -1) {
        const reply = JSON.parse(this.buf.slice(0, nl)) as Record<string, unknown>;
        this.buf = this.buf.slice(nl + 1);
        this.waiters.shift()?.(reply);
      }
    });
  }
  ask(frame: Record<string, unknown>): Promise<Record<string, unknown>> {
    const reply = new Promise<Record<string, unknown>>((resolve) => this.waiters.push(resolve));
    this.sock.write(JSON.stringify(frame) + "\n");
    return reply;
  }
}

const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => { for (const c of cleanups.splice(0).reverse()) await c(); });

async function stand() {
  const repo = new Repo({ sharePolicy: async () => true });
  const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
  const workingHandle = repo.create<LarDoc>(emptyLarDoc());
  const composite = new CompositeStore();
  composite.addLayer({ bagId: DAEMON_BAG_ID, store: new AutomergeDocStore(daemonHandle as never, DAEMON_BAG_ID), writable: true, defaultWritable: false });
  composite.addLayer({ bagId: wikiSlotUri("daemon", "working"), store: new AutomergeDocStore(workingHandle, wikiSlotUri("daemon", "working")), writable: true });
  const dir = mkdtempSync(join(tmpdir(), "uds-face-row-"));
  const claim = await claimStore(dir, { holder: "vessel" });
  const door: UdsSessionDoor = { anchorNow: async () => ({ kind: "nexus", aid: "nexus-one.synthetic" }), open: async ({ faceRef }) => ({ ok: true, supply: {
    face: face(faceRef.replace(/^hint-/, "")), ordinal: Math.max(0, "abc".indexOf(faceRef.slice(-1))), profile: "seat", presenter: `verified-${faceRef}`,
    anchor: { kind: "nexus", aid: "nexus-one.synthetic" }, mint: async () => ({ ok: true, signer: { drop() {} } }) } }) };
  const placed: Array<{ verb: string; requestId: string }> = [];
  const ran: Array<{ act: string; args: Record<string, unknown>; worn: unknown }> = [];
  const sessionActs = { names: new Set(["cabal-face"]), run: async (act: string, args: Record<string, unknown>, worn?: unknown) => {
    ran.push({ act, args, worn });
    return { verb: act, realm: args["realm"], nexusAid: "nexus-one.synthetic", face: LEAF };
  } };
  const front = serveUdsFront({ claim });
  front.attach(makeUdsSeat({ daemonHandle, composite, claim, repo: { flush: (ids) => repo.flush(ids) }, sessions: door,
    switchActs: { write: async () => {} }, sessionVerbs: new Set(["cabal-face"]), sessionActs: sessionActs as never,
    placeVerb: (o) => {
      // The old route: the island runs the row and its outcome body rests in the daemon document beside its requester.
      placed.push(o);
      const outcome = concludeVerb({ requestId: o.requestId, verb: o.verb, status: "done", requestedBy: o.requestedBy, cause: "test-worker",
        batchMode: "best-effort", results: { summary: { ok: true, output: { face: LEAF } } } });
      daemonHandle.change((doc) => { doc.tiddlers[outcome.tiddler.title] = outcome as unknown as LarDoc["tiddlers"][string]; });
    } }));
  const sock = createConnection(claim.socketPath);
  await new Promise<void>((resolve, reject) => { sock.once("connect", resolve); sock.once("error", reject); });
  const peer = new Peer(sock);
  cleanups.push(async () => { sock.end(); front.close(); await claim.release(); await repo.shutdown(); rmSync(dir, { recursive: true, force: true }); });
  /** Every record either daemon layer holds, as text: what a device the daemon document syncs to could read. */
  const synced = (): string[] => [daemonHandle, workingHandle].flatMap((h) =>
    Object.entries(h.doc()?.tiddlers ?? {}).map(([title, t]) => `${title} ${JSON.stringify(t)}`));
  const open = async (hint: string) => {
    const opened = await peer.ask({ op: "session:open", requestId: `open-${hint}`, faceRef: hint, hand: "cli" });
    return { ownerEpoch: opened["ownerEpoch"], sessionId: opened["sessionId"], generation: opened["generation"], faceRef: opened["faceRef"] };
  };
  return { peer, open, placed, ran, synced };
}

test("RED: a face row on session:act runs as the session's face, its answer rides the socket alone, and its one record names the act and the face; CONTROL: that record stands", async () => {
  const v = await stand();
  const env = await v.open("hint-b");
  const reply = await v.peer.ask({ op: "session:act", ...env, requestId: "face-1", act: "cabal-face", args: { realm: REALM } });
  expect(reply).toMatchObject({ kind: "session:act-result", requestId: "face-1", answer: { verb: "cabal-face", face: LEAF } });
  // The row runs as the face the session wears: its ordinal, and the presenter the door verified.
  expect(v.ran).toEqual([{ act: "cabal-face", args: { realm: REALM, face: 1 }, worn: { ordinal: 1, presenter: "verified-hint-b" } }]);
  expect(v.placed).toEqual([]);
  // No record either layer holds carries the leaf or the realm the row named.
  expect(v.synced().filter((r) => r.includes(LEAF) || r.includes(REALM))).toEqual([]);
  // CONTROL: the receipt stands, naming the act and the face.
  const receipts = v.synced().filter((r) => r.startsWith(RECEIPT_FACT_URI_PREFIX));
  expect(receipts).toHaveLength(1);
  expect(receipts[0]).toMatch(/act:cabal-face/);
  expect(receipts[0]).toMatch(/proof-b/);
});

test("RED: a face row on session:call refuses face-row-answers-on-the-socket and places nothing; CONTROL: a place verb on session:call still places", async () => {
  const v = await stand();
  const env = await v.open("hint-b");
  expect(await v.peer.ask({ op: "session:call", ...env, requestId: "call-1", verb: "cabal-face", args: { realm: REALM } }))
    .toMatchObject({ kind: "session:refused", refusal: "face-row-answers-on-the-socket" });
  expect(v.placed).toEqual([]);
  expect(v.synced().filter((r) => r.includes(LEAF))).toEqual([]);
  await v.peer.ask({ op: "session:call", ...env, requestId: "call-2", verb: "load", args: {} });
  expect(v.placed.map((p) => p.verb)).toEqual(["load"]);
});
