/**
 * THE AI SEAT PROPOSES; THE OPERATOR'S HAND LIFTS. A session opened by the `seat` hand (a spirit: the MCP surface, an
 * agent) carries the `seat` profile, and the vessel refuses it every kahua row that pins, lifts or withdraws, before the
 * row runs and before any grant out of custody loads. A seat proposes and reads. The cryptographic split (a hand-only key
 * the AI cannot reach) stays owed to the operator; this gate refuses the declared hand.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage#/caps
 */
import { afterEach, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConnection, type Socket } from "node:net";
import { Repo } from "@automerge/automerge-repo";
import { AutomergeDocStore, CompositeStore, DAEMON_BAG_ID, emptyLarDoc, concludeVerb, wikiSlotUri,
  type LarDoc, type SessionFace } from "@lararium/mesh";
import { HAND_PROFILES } from "@lararium/mesh/session-contract";
import { KAHUA_OPERATOR_ROWS, PROMOTE_HAND_CODES } from "../src/store-door-verbs.js";
import { makeUdsSeat, serveUdsFront, type UdsSessionDoor } from "../src/uds-channel.js";
import { claimStore } from "../src/owned-store.js";

const KAHUA_ROWS = ["kahua-mint", "kahua-propose", "kahua-lift", "kahua-withdraw", "kahua-carry", "kahua-read",
  "promote-prepare", "promote-commit", "promote-drop", "promote-orphan", "promote-list", "kapae-raise", "kapae-lower", "kapae-flag"] as const;

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
  const dir = mkdtempSync(join(tmpdir(), "uds-seat-"));
  const claim = await claimStore(dir, { holder: "vessel" });
  const door: UdsSessionDoor = { anchorNow: async () => ({ kind: "nexus", aid: "nexus-one.synthetic" }), open: async ({ faceRef, hand }) => ({ ok: true, supply: {
    face: face(faceRef.replace(/^hint-/, "")), ordinal: Math.max(0, "abc".indexOf(faceRef.slice(-1))), profile: HAND_PROFILES[hand], presenter: `verified-${faceRef}`,
    anchor: { kind: "nexus", aid: "nexus-one.synthetic" }, mint: async () => ({ ok: true, signer: { drop() {} } }) } }) };
  const placed: Array<{ verb: string; requestId: string }> = [];
  const ran: Array<{ act: string; args: Record<string, unknown>; worn: unknown }> = [];
  const sessionActs = { names: new Set([...KAHUA_ROWS]), run: async (act: string, args: Record<string, unknown>, worn?: unknown) => {
    ran.push({ act, args, worn });
    return { verb: act, ran: true };
  } };
  const front = serveUdsFront({ claim });
  front.attach(makeUdsSeat({ daemonHandle, composite, claim, repo: { flush: (ids) => repo.flush(ids) }, sessions: door,
    switchActs: { write: async () => {} }, sessionVerbs: new Set([...KAHUA_ROWS]), handOnlyActs: new Set([...KAHUA_OPERATOR_ROWS, ...PROMOTE_HAND_CODES.keys()]), handOnlyCodes: PROMOTE_HAND_CODES,
    socketVerbs: new Set([...KAHUA_ROWS]), sessionActs: sessionActs as never,
    placeVerb: (o) => {
      // The old route: the island runs the row and its outcome body rests in the daemon document beside its requester.
      placed.push(o);
      const outcome = concludeVerb({ requestId: o.requestId, verb: o.verb, status: "done", cause: "test-worker",
        batchMode: "best-effort", results: { summary: { ok: true, output: {} } } });
      daemonHandle.change((doc) => { doc.tiddlers[outcome.tiddler.title] = outcome as unknown as LarDoc["tiddlers"][string]; });
    } }));
  const sock = createConnection(claim.socketPath);
  await new Promise<void>((resolve, reject) => { sock.once("connect", resolve); sock.once("error", reject); });
  const peer = new Peer(sock);
  cleanups.push(async () => { sock.end(); front.close(); await claim.release(); await repo.shutdown(); rmSync(dir, { recursive: true, force: true }); });
  /** Every record either daemon layer holds, as text: what a device the daemon document syncs to could read. */
  const synced = (): string[] => [daemonHandle, workingHandle].flatMap((h) =>
    Object.entries(h.doc()?.tiddlers ?? {}).map(([title, t]) => `${title} ${JSON.stringify(t)}`));
  const open = async (hint: string, hand: "cli" | "seat") => {
    const opened = await peer.ask({ op: "session:open", requestId: `open-${hint}-${hand}`, faceRef: hint, hand });
    return { ownerEpoch: opened["ownerEpoch"], sessionId: opened["sessionId"], generation: opened["generation"], faceRef: opened["faceRef"] };
  };
  return { peer, open, placed, ran, synced };
}


test("RED: a seat session's kahua lift, withdraw, carry and mint refuse beyond-profile and run nothing; CONTROL: the seat proposes and reads", async () => {
  const v = await stand();
  const env = await v.open("hint-a", "seat");
  for (const act of ["kahua-lift", "kahua-withdraw", "kahua-carry", "kahua-mint"]) {
    const reply = await v.peer.ask({ op: "session:act", ...env, requestId: `seat-${act}`, act, args: { title: "t", text: "x", taint: [] } });
    expect(reply).toMatchObject({ kind: "session:refused", refusal: "beyond-profile" });
  }
  expect(v.ran).toEqual([]);
  expect(await v.peer.ask({ op: "session:act", ...env, requestId: "seat-propose", act: "kahua-propose", args: { proposals: [] } }))
    .toMatchObject({ kind: "session:act-result", answer: { verb: "kahua-propose", ran: true } });
  expect(await v.peer.ask({ op: "session:act", ...env, requestId: "seat-read", act: "kahua-read", args: { action: "list" } }))
    .toMatchObject({ kind: "session:act-result", answer: { verb: "kahua-read", ran: true } });
  expect(v.ran.map((r) => r.act)).toEqual(["kahua-propose", "kahua-read"]);
});

test("CONTROL: the operator's hand (a cli session) runs the kahua lift row", async () => {
  const v = await stand();
  const env = await v.open("hint-a", "cli");
  expect(await v.peer.ask({ op: "session:act", ...env, requestId: "cli-lift", act: "kahua-lift", args: { title: "t", text: "x", taint: [] } }))
    .toMatchObject({ kind: "session:act-result", answer: { verb: "kahua-lift", ran: true } });
  expect(KAHUA_OPERATOR_ROWS).toEqual(new Set(["kahua-mint", "kahua-lift", "kahua-withdraw", "kahua-carry"]));
});

test("RED: a seat session's promote commit, drop and orphan refuse `promote-needs-hand`, its kapae raise and lower refuse `kapae-needs-hand`, and nothing runs; CONTROL: the seat prepares, flags and reads, and the kahua rows keep `beyond-profile`", async () => {
  const v = await stand();
  const env = await v.open("hint-a", "seat");
  for (const act of ["promote-commit", "promote-drop", "promote-orphan"]) {
    expect(await v.peer.ask({ op: "session:act", ...env, requestId: `seat-${act}`, act, args: { digest: "d".repeat(64) } }), act)
      .toMatchObject({ kind: "session:refused", refusal: "promote-needs-hand" });
  }
  for (const act of ["kapae-raise", "kapae-lower"]) {
    expect(await v.peer.ask({ op: "session:act", ...env, requestId: `seat-${act}`, act, args: { digest: "d".repeat(64) } }), act)
      .toMatchObject({ kind: "session:refused", refusal: "kapae-needs-hand" });
  }
  expect(await v.peer.ask({ op: "session:act", ...env, requestId: "seat-lift", act: "kahua-lift", args: { title: "t", text: "x", taint: [] } }))
    .toMatchObject({ kind: "session:refused", refusal: "beyond-profile" });
  expect(v.ran).toEqual([]);
  for (const act of ["promote-prepare", "kapae-flag", "promote-list"]) {
    expect(await v.peer.ask({ op: "session:act", ...env, requestId: `seat-${act}`, act, args: { digest: "d".repeat(64), why: "x" } }), act)
      .toMatchObject({ kind: "session:act-result", answer: { verb: act, ran: true } });
  }
});

test("CONTROL: the operator's hand (a cli session) runs the promote commit and the kapae raise", async () => {
  const v = await stand();
  const env = await v.open("hint-a", "cli");
  for (const act of ["promote-commit", "kapae-raise"]) {
    expect(await v.peer.ask({ op: "session:act", ...env, requestId: `cli-${act}`, act, args: { digest: "d".repeat(64) } }), act)
      .toMatchObject({ kind: "session:act-result", answer: { verb: act, ran: true } });
  }
  expect([...PROMOTE_HAND_CODES]).toEqual([["promote-commit", "promote-needs-hand"], ["promote-drop", "promote-needs-hand"], ["promote-orphan", "promote-needs-hand"], ["kapae-raise", "kapae-needs-hand"], ["kapae-lower", "kapae-needs-hand"]]);
});
