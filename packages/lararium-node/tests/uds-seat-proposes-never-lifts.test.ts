/**
 * THE AI SEAT PROPOSES; THE OPERATOR'S HAND LIFTS. A session opened by the `seat` hand (a spirit: the MCP surface, an
 * agent) carries the `seat` profile, and the vessel refuses it every kahua row that pins, lifts or withdraws, before the
 * row runs and before any grant out of custody loads. A seat proposes and reads. The cryptographic split (a hand-only key
 * the AI cannot reach) stays owed to the operator; this gate refuses the declared hand.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage#/caps
 */
import { controlStoreOf } from "@lararium/mesh/control-home";
import { afterEach, expect, test } from "vitest";
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
import { type SessionFace } from "@lararium/mesh/session-contract";
import { HAND_PROFILES } from "@lararium/mesh/session-contract";
import { KAHUA_OPERATOR_VERBS, PROMOTE_HAND_CODES, STORE_DOOR_HAND_CODES, STORE_DOOR_HAND_ONLY_ACTS } from "../src/store-door-verbs.js";
import { makeUdsSeat, serveUdsFront, type UdsSessionDoor } from "../src/uds-channel.js";
import { shoreHandCode, stampUnattendedIngest } from "../src/shore-verb.js";
import { claimStore } from "../src/owned-store.js";

const KAHUA_ROWS = ["kahua-mint", "kahua-propose", "kahua-lift", "kahua-withdraw", "kahua-carry", "kahua-read",
  "promote-prepare", "promote-commit", "promote-drop", "promote-orphan", "promote-list", "kapae-raise", "kapae-lower", "kapae-flag",
  "swarm-show", "swarm-cap-set", "swarm-share-set", "swarm-lei-kui", "swarm-lei-unstring", "swarm-lei-restring",
  "rite-land", "rite-abandon"] as const;

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
  const placed: Array<{ verb: string; requestId: string; args?: unknown }> = [];
  const ran: Array<{ act: string; args: Record<string, unknown>; worn: unknown }> = [];
  const settled: Array<{ act: string; args: Record<string, unknown> }> = [];
  const sessionActs = { names: new Set([...KAHUA_ROWS]), settled: (act: string, args: Record<string, unknown>) => { settled.push({ act, args }); }, run: async (act: string, args: Record<string, unknown>, worn?: unknown) => {
    ran.push({ act, args, worn });
    return { verb: act, ran: true };
  } };
  const front = serveUdsFront({ claim });
  front.attach(makeUdsSeat({ controlHandle: daemonHandle, control: controlStoreOf(daemonHandle), claim, repo: { flush: (ids) => repo.flush(ids) }, sessions: door,
    switchActs: { write: async () => {} }, sessionVerbs: new Set([...KAHUA_ROWS]), handOnlyActs: STORE_DOOR_HAND_ONLY_ACTS, handOnlyCodes: STORE_DOOR_HAND_CODES, handOnlyOp: shoreHandCode, unattendedIngest: stampUnattendedIngest,
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
  /** A fresh connection that writes one-shot lines (a session's socket carries session frames alone). */
  const line = async (): Promise<Peer> => {
    const other = createConnection(claim.socketPath);
    await new Promise<void>((resolve, reject) => { other.once("connect", resolve); other.once("error", reject); });
    cleanups.push(() => { other.destroy(); });
    return new Peer(other);
  };
  return { peer, open, placed, ran, synced, settled, line };
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
  expect(KAHUA_OPERATOR_VERBS).toEqual(new Set(["kahua-mint", "kahua-lift", "kahua-withdraw", "kahua-carry"]));
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

test("RED: a seat session's swarm cap-set, share-set and lei-kui refuse `swarm-needs-hand` and run nothing; CONTROL: the seat reads swarm-show, and the cli hand runs all four", async () => {
  const v = await stand();
  const seat = await v.open("hint-a", "seat");
  for (const act of ["swarm-cap-set", "swarm-share-set", "swarm-lei-kui", "swarm-lei-unstring", "swarm-lei-restring"]) {
    expect(await v.peer.ask({ op: "session:act", ...seat, requestId: `seat-${act}`, act, args: { value: 1 } }), act)
      .toMatchObject({ kind: "session:refused", refusal: "swarm-needs-hand" });
  }
  expect(v.ran).toEqual([]);
  expect(await v.peer.ask({ op: "session:act", ...seat, requestId: "seat-swarm-show", act: "swarm-show", args: {} }))
    .toMatchObject({ kind: "session:act-result", answer: { verb: "swarm-show", ran: true } });
  const w = await stand();
  const cli = await w.open("hint-a", "cli");
  for (const act of ["swarm-cap-set", "swarm-share-set", "swarm-lei-kui", "swarm-lei-unstring", "swarm-lei-restring", "swarm-show"]) {
    expect(await w.peer.ask({ op: "session:act", ...cli, requestId: `cli-${act}`, act, args: { value: 1 } }), act)
      .toMatchObject({ kind: "session:act-result", answer: { verb: act, ran: true } });
  }
});

test("RED: a seat session's rite abandon refuses `hand-act-only` and runs nothing (setting a begun half down stays the hand's act); CONTROL: the seat still lands a rite, and the cli hand runs the abandon", async () => {
  const v = await stand();
  const seat = await v.open("hint-a", "seat");
  const tessera = { tessera: "c".repeat(64) };
  expect(await v.peer.ask({ op: "session:act", ...seat, requestId: "seat-rite-abandon", act: "rite-abandon", args: tessera }))
    .toMatchObject({ kind: "session:refused", refusal: "hand-act-only" });
  expect(v.ran).toEqual([]);
  expect(STORE_DOOR_HAND_CODES.get("rite-abandon")).toBe("hand-act-only");
  expect(await v.peer.ask({ op: "session:act", ...seat, requestId: "seat-rite-land", act: "rite-land", args: { ...tessera, head: "a".repeat(40) } }))
    .toMatchObject({ kind: "session:act-result", answer: { verb: "rite-land", ran: true } });
  const w = await stand();
  const cli = await w.open("hint-a", "cli");
  expect(await w.peer.ask({ op: "session:act", ...cli, requestId: "cli-rite-abandon", act: "rite-abandon", args: tessera }))
    .toMatchObject({ kind: "session:act-result", answer: { verb: "rite-abandon", ran: true } });
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

test("RED: the session act's `settled` hook fires once per RUN act, after its reply is written, with the very args `run` took; CONTROL: a refused act runs nothing and settles nothing", async () => {
  const v = await stand();
  const env = await v.open("hint-a", "cli");
  const reply = await v.peer.ask({ op: "session:act", ...env, requestId: "cli-settle", act: "kapae-raise", args: { digest: "d".repeat(64) } });
  expect(reply).toMatchObject({ kind: "session:act-result" });
  await new Promise((r) => setTimeout(r, 50));
  expect(v.settled.map((s) => s.act)).toEqual(["kapae-raise"]);
  expect(v.settled[0]!.args, "the same object `run` took").toBe(v.ran.find((r) => r.act === "kapae-raise")!.args);
  const seat = await v.open("hint-a", "seat");
  await v.peer.ask({ op: "session:act", ...seat, requestId: "seat-settle", act: "kapae-raise", args: { digest: "d".repeat(64) } });
  await new Promise((r) => setTimeout(r, 50));
  expect(v.settled.map((s) => s.act), "a refusal ran nothing, so nothing settles").toEqual(["kapae-raise"]);
});

test("RED: a seat session's `retire-wiki` call refuses `retire-needs-hand` and places nothing; CONTROL: a cli session's call places it", async () => {
  expect(STORE_DOOR_HAND_CODES.get("retire-wiki")).toBe("retire-needs-hand");
  expect(STORE_DOOR_HAND_ONLY_ACTS.has("retire-wiki")).toBe(true);
  const v = await stand();
  const seat = await v.open("hint-a", "seat");
  expect(await v.peer.ask({ op: "session:call", ...seat, requestId: "seat-retire", verb: "retire-wiki", args: { slug: "s" } }))
    .toMatchObject({ kind: "session:refused", refusal: "retire-needs-hand" });
  expect(v.placed).toEqual([]);
  const w = await stand();
  const cli = await w.open("hint-a", "cli");
  await w.peer.ask({ op: "session:call", ...cli, requestId: "cli-retire", verb: "retire-wiki", args: { slug: "s" } });
  expect(w.placed.map((p) => p.verb)).toEqual(["retire-wiki"]);
});

test("RED: a seat's `true-floor` refuses `true-floor-needs-hand` at the socket, on a session call and a one-shot line, and places nothing; CONTROL: a cli session's call places it", async () => {
  expect(STORE_DOOR_HAND_CODES.get("true-floor")).toBe("true-floor-needs-hand");
  expect(STORE_DOOR_HAND_ONLY_ACTS.has("true-floor")).toBe(true);
  const v = await stand();
  const seat = await v.open("hint-a", "seat");
  expect(await v.peer.ask({ op: "session:call", ...seat, requestId: "seat-true-floor", verb: "true-floor", args: { slug: "s" } }))
    .toMatchObject({ kind: "session:refused", refusal: "true-floor-needs-hand" });
  const line = await (await v.line()).ask({ verb: "true-floor", requestedBy: "seat-line", requestId: "seat-true-floor-line", seat: "ai", args: { slug: "s" } });
  expect(JSON.stringify(line)).toContain("true-floor-needs-hand");
  expect(v.placed).toEqual([]);
  const w = await stand();
  const cli = await w.open("hint-a", "cli");
  await w.peer.ask({ op: "session:call", ...cli, requestId: "cli-true-floor", verb: "true-floor", args: { slug: "s" } });
  expect(w.placed.map((p) => p.verb)).toEqual(["true-floor"]);
});

test("RED: a seat's `share-apply` and `share-set` refuse `share-needs-hand` at the socket, on a session call and a one-shot line, and place nothing; CONTROL: a cli session's call places it", async () => {
  for (const verb of ["share-apply", "share-set"]) {
    expect(STORE_DOOR_HAND_CODES.get(verb)).toBe("share-needs-hand");
    expect(STORE_DOOR_HAND_ONLY_ACTS.has(verb)).toBe(true);
  }
  const v = await stand();
  const seat = await v.open("hint-a", "seat");
  expect(await v.peer.ask({ op: "session:call", ...seat, requestId: "seat-share", verb: "share-apply", args: { faces: [] } }))
    .toMatchObject({ kind: "session:refused", refusal: "share-needs-hand" });
  const line = await (await v.line()).ask({ verb: "share-set", requestedBy: "seat-line", requestId: "seat-share-line", seat: "ai", args: { slug: "s", kind: "wiki", read: [], write: [] } });
  expect(JSON.stringify(line)).toContain("share-needs-hand");
  expect(v.placed).toEqual([]);
  const w = await stand();
  const cli = await w.open("hint-a", "cli");
  await w.peer.ask({ op: "session:call", ...cli, requestId: "cli-share", verb: "share-apply", args: { faces: [] } });
  expect(w.placed.map((p) => p.verb)).toEqual(["share-apply"]);
});

test("RED: a seat's `wiki-render-out` refuses `render-output-needs-hand` at the socket, on a session call and a one-shot line, and places nothing; CONTROL: a cli session's call places it", async () => {
  expect(STORE_DOOR_HAND_CODES.get("wiki-render-out")).toBe("render-output-needs-hand");
  const v = await stand();
  const seat = await v.open("hint-a", "seat");
  expect(await v.peer.ask({ op: "session:call", ...seat, requestId: "seat-render", verb: "wiki-render-out", args: { recipe: "notes", output: "workbench", filter: "[all[]]" } }))
    .toMatchObject({ kind: "session:refused", refusal: "render-output-needs-hand" });
  const line = await (await v.line()).ask({ verb: "wiki-render-out", requestedBy: "seat-line", requestId: "seat-render-line", seat: "ai", args: { recipe: "notes", output: "workbench", filter: "[all[]]" } });
  expect(JSON.stringify(line)).toContain("render-output-needs-hand");
  expect(v.placed).toEqual([]);
  const w = await stand();
  const cli = await w.open("hint-a", "cli");
  await w.peer.ask({ op: "session:call", ...cli, requestId: "cli-render", verb: "wiki-render-out", args: { recipe: "notes", output: "workbench", filter: "[all[]]" } });
  expect(w.placed.map((p) => p.verb)).toEqual(["wiki-render-out"]);
});

test("RED: a seat-marked one-shot line's shore take-records, restore and remove refuse `hand-act-only` and place nothing, on the shore verb and through wiki-act; a seat session's call refuses the same; CONTROL: the seat lists, and a cli session's remove places", async () => {
  const v = await stand();
  for (const op of ["take-records", "restore", "remove"]) {
    for (const [verb, args] of [["shore", { op, uri: "lar:///a.b.c/x", key: "k" }], ["wiki-act", { verb: "shore", args: { op, uri: "lar:///a.b.c/x", key: "k" } }]] as const) {
      const reply = await (await v.line()).ask({ verb, requestedBy: "seat-line", requestId: `seat-${verb}-${op}`, seat: "ai", args });
      expect(JSON.stringify(reply), `${verb} ${op}`).toContain("hand-act-only");
    }
  }
  const env = await v.open("hint-a", "seat");
  expect(await v.peer.ask({ op: "session:call", ...env, requestId: "seat-call-remove", verb: "shore", args: { op: "remove", uris: ["lar:///a.b.c/x"] } }))
    .toMatchObject({ kind: "session:refused", refusal: "hand-act-only" });
  expect(v.placed).toEqual([]);
  await (await v.line()).ask({ verb: "shore", requestedBy: "seat-line", requestId: "seat-list", seat: "ai", args: { op: "list" } });
  expect(v.placed.map((p) => p.verb)).toEqual(["shore"]);
  const w = await stand();
  const cli = await w.open("hint-a", "cli");
  await w.peer.ask({ op: "session:call", ...cli, requestId: "cli-remove", verb: "shore", args: { op: "remove", uris: ["lar:///a.b.c/x"] } });
  expect(w.placed.map((p) => p.verb)).toEqual(["shore"]);
});

test("RED H1: an inner verb wrapped in an array never slips the gate: a seat's wiki-act naming `verb: [\"shore\"]` for remove or take-records refuses on a one-shot line and on a session call, and places nothing", async () => {
  const v = await stand();
  for (const op of ["remove", "take-records"]) {
    const args = { verb: ["shore"], args: { op, uri: "lar:///a.b.c/x", uris: ["lar:///a.b.c/x"], key: "k" } };
    const reply = await (await v.line()).ask({ verb: "wiki-act", requestedBy: "seat-line", requestId: `seat-wrapped-${op}`, seat: "ai", args });
    expect(reply["status"], op).toBe("error");
    expect(JSON.stringify(reply), op).toMatch(/hand-act-only|routing-arg-malformed/);
  }
  const env = await v.open("hint-a", "seat");
  for (const op of ["remove", "take-records"]) {
    expect(await v.peer.ask({ op: "session:call", ...env, requestId: `seat-call-wrapped-${op}`, verb: "wiki-act", args: { verb: ["shore"], args: { op, uris: ["lar:///a.b.c/x"], key: "k" } } }), op)
      .toMatchObject({ kind: "session:refused" });
  }
  expect(v.placed).toEqual([]);
});

test("RED M2: an INGEST a seat sends places unattended, whatever it claims, on a one-shot line (direct and through wiki-act) and on a session call; CONTROL: a cli session's wave keeps its own claim", async () => {
  const v = await stand();
  const wave = { "to-bag": "lar:///ha.ka.ba/wikis/probe/working", carriers: [], unattended: false };
  await (await v.line()).ask({ verb: "INGEST", requestedBy: "seat-line", requestId: "seat-ingest", seat: "ai", args: wave });
  await (await v.line()).ask({ verb: "wiki-act", requestedBy: "seat-line", requestId: "seat-ingest-act", seat: "ai", args: { verb: "INGEST", args: wave } });
  const env = await v.open("hint-a", "seat");
  await v.peer.ask({ op: "session:call", ...env, requestId: "seat-call-ingest", verb: "wiki-act", args: { verb: "INGEST", args: wave } });
  const inner = (p: { verb: string; args?: unknown }) => (p.verb === "INGEST" ? p.args : (p.args as { args?: unknown }).args) as Record<string, unknown>;
  expect(v.placed.length).toBe(3);
  for (const p of v.placed) expect(inner(p)["unattended"], p.requestId).toBe(true);
  // CONTROL: a cli session's wave claims nothing (an attended claim reads malformed, `ingest-seat-unattended` U2) and stays so.
  const { unattended: _claim, ...plain } = wave;
  const w = await stand();
  const cli = await w.open("hint-a", "cli");
  await w.peer.ask({ op: "session:call", ...cli, requestId: "cli-ingest", verb: "wiki-act", args: { verb: "INGEST", args: plain } });
  expect(inner(w.placed[0]!)["unattended"]).toBeUndefined();
});

test("RED L3: a session opened with hand cli but marked by a seat (`seat: \"ai\"`) wears the seat's profile, as its one-shot line does: its shore remove refuses", async () => {
  const v = await stand();
  const opened = await v.peer.ask({ op: "session:open", requestId: "open-marked", faceRef: "hint-a", hand: "cli", seat: "ai" });
  const env = { ownerEpoch: opened["ownerEpoch"], sessionId: opened["sessionId"], generation: opened["generation"], faceRef: opened["faceRef"] };
  expect(await v.peer.ask({ op: "session:call", ...env, requestId: "marked-remove", verb: "shore", args: { op: "remove", uris: ["lar:///a.b.c/x"] } }))
    .toMatchObject({ kind: "session:refused", refusal: "hand-act-only" });
  expect(v.placed).toEqual([]);
});

test("RED H1b: case and nesting never slip the gate: a seat's `SHORE`/`Remove`, and a wiki-act nested in a wiki-act, refuse and place nothing", async () => {
  const v = await stand();
  const asks: Array<[string, Record<string, unknown>]> = [
    ["SHORE", { op: "remove", uris: ["lar:///a.b.c/x"] }],
    ["wiki-act", { verb: "Shore", args: { op: "Remove", uris: ["lar:///a.b.c/x"] } }],
    ["wiki-act", { verb: "wiki-act", args: { verb: "shore", args: { op: "remove", uris: ["lar:///a.b.c/x"] } } }],
  ];
  for (const [verb, args] of asks) {
    const reply = await (await v.line()).ask({ verb, requestedBy: "seat-line", requestId: `seat-${verb}-${JSON.stringify(args).length}`, seat: "ai", args });
    expect(reply["status"], JSON.stringify(args)).toBe("error");
  }
  expect(v.placed).toEqual([]);
});

