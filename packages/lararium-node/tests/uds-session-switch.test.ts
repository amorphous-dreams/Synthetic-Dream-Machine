import { describe, expect, test, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConnection, type Socket } from "node:net";
import { Repo } from "@automerge/automerge-repo";
import { AutomergeDocStore, CompositeStore, DAEMON_BAG_ID, emptyLarDoc, RECEIPT_FACT_URI_PREFIX, type SwitchIntent, type SwitchOutcome, concludeVerb, wikiSlotUri,
  type LarDoc, type SessionFace } from "@lararium/mesh";
import { FactLedger, makeUdsSeat, serveUdsFront, type SessionAnchor, type UdsSessionDoor } from "../src/uds-channel.js";
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
  ask(frame: Record<string, unknown>): Promise<Record<string, unknown>> {
    const reply = this.next();
    this.sock.write(JSON.stringify(frame) + "\n");
    return reply;
  }
  end(): void { this.sock.end(); }
}

/** A signer the seat holds, named by the face and the mint that drew it, so a test reads which one dropped. */
interface Drawn { readonly face: string; readonly n: number; dropped: boolean; drop(): void }

async function stand(label: string, opts: {
  refuse?: (faceRef: string) => string | null; refuseMint?: (n: number) => boolean;
  /** Hold the door's answer for this hint until the test lets it go. */
  hold?: { hint: string; until: Promise<void> };
  /** Fail the Repo's flush while this reads true. */
  failFlush?: () => boolean;
  /** The door throws for this hint, as a torn row would. */
  throwOn?: string;
  /** The Nexus each hint's proof stands at; every proof stands at one Nexus where unnamed. */
  nexusOf?: (faceRef: string) => string;
  /** Where the vessel stands now; each proof stands there where `nexusOf` names none. */
  anchor?: () => SessionAnchor;
  /** A sealed act runs only once this lets go. */
  actHold?: Promise<void>;
  /** The ledger's flush waits on this before it runs, as a slow disk would. */
  flushGate?: Promise<void>;
  /** A sealed act throws once running, as a torn custody row would. */
  actThrows?: boolean;
} = {}) {
  const standing = (): SessionAnchor => opts.anchor?.() ?? { kind: "nexus", aid: "nexus-one.synthetic" };
  const repo = new Repo({ sharePolicy: async () => true });
  const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
  const workingHandle = repo.create<LarDoc>(emptyLarDoc());
  const composite = new CompositeStore();
  composite.addLayer({ bagId: DAEMON_BAG_ID, store: new AutomergeDocStore(daemonHandle as never, DAEMON_BAG_ID), writable: true, defaultWritable: false });
  composite.addLayer({ bagId: wikiSlotUri("daemon", "working"), store: new AutomergeDocStore(workingHandle, wikiSlotUri("daemon", "working")), writable: true });
  const dir = mkdtempSync(join(tmpdir(), `uds-switch-${label}-`));
  const claim = await claimStore(dir, { holder: "vessel" });
  const placed: Array<{ requestedBy: string; face?: string; requestId: string }> = [];
  const drawn: Drawn[] = [];
  const door: UdsSessionDoor = { anchorNow: async () => standing(), open: async ({ faceRef }) => {
    if (opts.hold && faceRef === opts.hold.hint) await opts.hold.until;
    if (faceRef === opts.throwOn) throw new Error("face abcd1234 rests unopened at /secret/identity");
    const refusal = opts.refuse?.(faceRef) ?? null;
    if (refusal) return { ok: false, refusal };
    const name = faceRef.replace(/^hint-/, "");
    return { ok: true, supply: { face: face(name), ordinal: Math.max(0, "abc".indexOf(faceRef.slice(-1))), profile: "seat", presenter: `verified-${faceRef}`,
      anchor: opts.nexusOf ? { kind: "nexus", aid: opts.nexusOf(faceRef) } : standing(), mint: async ({ session }) => {
      const n = drawn.length;
      if (opts.refuseMint?.(n)) return { ok: false, refusal: "dial-refused" };
      const signer: Drawn = { face: session.face.proofSubject, n, dropped: false, drop() { signer.dropped = true; } };
      drawn.push(signer);
      return { ok: true, signer };
    } } };
  } };
  const flushing = { flush: async (ids?: Parameters<Repo["flush"]>[0]) => { if (opts.flushGate) await opts.flushGate; if (opts.failFlush?.()) throw new Error("disk full at /secret/path"); return repo.flush(ids); } };
  const logged: Array<SwitchIntent | SwitchOutcome> = [];
  const switchActs = { write: async (act: SwitchIntent | SwitchOutcome) => {
    if (opts.failFlush?.()) throw new Error("disk full at /secret/path");
    logged.push(act);
  } };
  const ran: Array<{ act: string; args: Record<string, unknown> }> = [];
  let ranStarted!: () => void;
  const ranFirst = new Promise<void>((resolve) => { ranStarted = resolve; });
  const sessionActs = { names: new Set(["host.roll", "carriage.accept"]), run: async (act: string, args: Record<string, unknown>) => {
    ran.push({ act, args });
    ranStarted();
    if (opts.actHold) await opts.actHold;
    if (opts.actThrows) throw new Error("the custody row at /secret/row reads torn");
    return { op: "act", act, result: { epoch: "e".repeat(64) } };
  } };
  // The front and its seat stand apart, so a test can unseat the seat and read what it waits out.
  const front = serveUdsFront({ claim });
  const channel = { close: () => front.close(), detach: () => front.detach() };
  front.attach(makeUdsSeat({ daemonHandle, composite, claim, repo: flushing, sessions: door, switchActs, sessionVerbs: new Set(["face-row"]), sessionActs,
    placeVerb: (o) => {
      placed.push(o);
      const outcome = concludeVerb({ requestId: o.requestId, verb: o.verb, status: "done",
        requestedBy: o.requestedBy, cause: "test-worker", batchMode: "best-effort", results: { summary: { ok: true } } });
      daemonHandle.change((doc) => { doc.tiddlers[outcome.tiddler.title] = outcome as unknown as LarDoc["tiddlers"][string]; });
    },
  }));
  const peers: Peer[] = [];
  const connect = async () => { const p = await Peer.connect(claim.socketPath); peers.push(p); return p; };
  const done = async () => { for (const p of peers) p.end(); channel.close(); await claim.release(); rmSync(dir, { recursive: true, force: true }); };
  /** Count the switch acts that land from here on. */
  /** Every write that lands in any layer of the composite from here on, and every act the vessel's log keeps. */
  const watchActs = () => {
    const seen: string[] = [];
    const from = logged.length;
    const stop = composite.subscribe((change) => { seen.push(change.title); });
    return { seen, stop, acts: () => logged.slice(from) };
  };
  /** A known write into the composite's working layer, so a watcher proves it hears. */
  const probe = (title: string) => composite.put({ tiddler: { title, text: "probe" } }, { kind: "tw-local", instanceId: "probe" },
    { bag: wikiSlotUri("daemon", "working") });
  return { placed, drawn, connect, done, watchActs, probe, ran, ranFirst, composite, channel };
}

const envOf = (opened: Record<string, unknown>) =>
  ({ ownerEpoch: opened["ownerEpoch"], sessionId: opened["sessionId"], generation: opened["generation"], faceRef: opened["faceRef"] });
const call = (env: Record<string, unknown>, requestId: string) => ({ op: "session:call", ...env, requestId, verb: "load", args: {} });
const switchTo = (env: Record<string, unknown>, faceRef: string, requestId: string) =>
  ({ op: "session:switch", ...env, target: faceRef, expectedGeneration: env["generation"], requestId });

describe("UDS session switch", () => {
  test("RED: a switch advances its own session alone; a sibling socket of the same face keeps its generation, face and signer", async () => {
    const v = await stand("sibling");
    try {
      const [a, b] = [await v.connect(), await v.connect()];
      const envA = envOf(await a.ask({ op: "session:open", requestId: "open-a", faceRef: "hint-a", hand: "seat" }));
      const envB = envOf(await b.ask({ op: "session:open", requestId: "open-b", faceRef: "hint-a", hand: "seat" }));
      const switched = await a.ask(switchTo(envA, "hint-c", "switch-a"));
      expect(switched).toMatchObject({ kind: "session:switch-result", requestId: "switch-a", outcome: "switched", generation: 1, faceRef: "proof-c",
        sessionId: envA.sessionId, ownerEpoch: envA.ownerEpoch });
      expect(await b.ask(call(envB, "b-after"))).toMatchObject({ kind: "session:result", status: "done" });
      expect(v.placed.at(-1)).toMatchObject({ face: "proof-a", requestedBy: "verified-hint-a" });
      expect(await a.ask(call(envOf(switched), "a-after"))).toMatchObject({ kind: "session:result", status: "done" });
      expect(v.placed.at(-1)).toMatchObject({ face: "proof-c", requestedBy: "verified-hint-c" });
      expect(v.drawn.map((s) => [s.face, s.dropped])).toEqual([["proof-a", true], ["proof-a", false], ["proof-c", false]]);
    } finally { await v.done(); }
  });

  test("RED: the old generation acts and signs nothing after the switch", async () => {
    const v = await stand("old-gen");
    try {
      const a = await v.connect();
      const envA = envOf(await a.ask({ op: "session:open", requestId: "open-a", faceRef: "hint-a", hand: "seat" }));
      const old = v.drawn[0]!;
      await a.ask(switchTo(envA, "hint-b", "switch-a"));
      const before = v.placed.length;
      expect(await a.ask(call(envA, "old-envelope"))).toMatchObject({ kind: "session:refused", refusal: "stale-generation" });
      expect(await a.ask(call({ ...envA, generation: 1 }, "old-face"))).toMatchObject({ kind: "session:refused", refusal: "wrong-face" });
      expect(v.placed).toHaveLength(before);
      expect(old.dropped).toBe(true);
      expect(await a.ask(switchTo(envA, "hint-c", "switch-stale"))).toMatchObject({ kind: "session:refused", refusal: "stale-generation" });
    } finally { await v.done(); }
  });

  test("CONTROL: re-wearing the worn face answers unchanged, keeps the generation and the signer, and writes no act", async () => {
    const v = await stand("same");
    try {
      const a = await v.connect();
      const envA = envOf(await a.ask({ op: "session:open", requestId: "open-a", faceRef: "hint-a", hand: "seat" }));
      const acts = v.watchActs();
      expect(await a.ask(switchTo(envA, "hint-a", "same"))).toMatchObject({ kind: "session:switch-result", outcome: "unchanged", generation: 0, faceRef: "proof-a" });
      acts.stop();
      expect(await a.ask(call(envA, "still"))).toMatchObject({ kind: "session:result", status: "done" });
      expect(v.drawn.map((s) => s.dropped)).toEqual([false]);
      expect(acts.acts()).toEqual([]);
    } finally { await v.done(); }
  });

  test("RED: a switch act lands in no document: no layer of the composite, the face's working layer with it, hears of it", async () => {
    const v = await stand("acts");
    try {
      const a = await v.connect();
      const envA = envOf(await a.ask({ op: "session:open", requestId: "open-a", faceRef: "hint-a", hand: "seat" }));
      const { seen, stop, acts } = v.watchActs();
      await a.ask(switchTo(envA, "hint-b", "switch-a"));
      // POSITIVE: the watcher hears a known write into the working layer, so its silence about the switch reads true.
      await v.probe("probe-after-switch");
      stop();
      expect(seen).toContain("probe-after-switch");
      seen.splice(seen.indexOf("probe-after-switch"), 1);
      // The daemon's working layer is a face bag its PersonaGroup holds admin over: whatever lands there reaches every
      // device of the outgoing face. A switch act names the incoming face too, so it lands in the vessel's own log alone.
      expect(seen).toEqual([]);
      expect(acts().map((x) => ("outcome" in x ? x.outcome : "intent"))).toEqual(["intent", "switched"]);
      expect(acts()[1]).toMatchObject({ outgoing: "proof-a", incoming: "proof-b", generation: 0 });
      expect(JSON.stringify(acts())).not.toContain(String(envA.sessionId));
    } finally { await v.done(); }
  });

  test("a refused preflight leaves the session live at its generation; a refused commit closes this session alone", async () => {
    const v = await stand("refusals", { refuse: (f) => (f === "hint-locked" ? "face-locked" : null), refuseMint: (n) => n === 2 });
    try {
      const [a, b] = [await v.connect(), await v.connect()];
      const envA = envOf(await a.ask({ op: "session:open", requestId: "open-a", faceRef: "hint-a", hand: "seat" }));
      const envB = envOf(await b.ask({ op: "session:open", requestId: "open-b", faceRef: "hint-a", hand: "seat" }));
      expect(await a.ask(switchTo(envA, "hint-locked", "locked"))).toMatchObject({ kind: "session:refused", refusal: "face-locked" });
      expect(await a.ask(call(envA, "after-locked"))).toMatchObject({ kind: "session:result", status: "done" });
      expect(await a.ask(switchTo(envA, "hint-b", "dial"))).toMatchObject({ kind: "session:refused", refusal: "dial-refused", closed: true });
      expect(v.drawn[0]!.dropped).toBe(true);
      expect(await b.ask(call(envB, "sibling"))).toMatchObject({ kind: "session:result", status: "done" });
    } finally { await v.done(); }
  });

  test("RED: a door that throws at open answers a fixed code under the frame's requestId, and no fault text reaches the wire", async () => {
    const v = await stand("door-throws", { throwOn: "hint-torn" });
    try {
      const a = await v.connect();
      const reply = await a.ask({ op: "session:open", requestId: "open-torn", faceRef: "hint-torn", hand: "seat" });
      expect(reply).toEqual({ kind: "session:refused", requestId: "open-torn", refusal: "door-failed" });
      expect(JSON.stringify(reply)).not.toContain("secret");
      // CONTROL: the same socket opens on a face the door reads.
      expect(await a.ask({ op: "session:open", requestId: "open-a", faceRef: "hint-a", hand: "seat" })).toMatchObject({ kind: "session:opened", requestId: "open-a" });
    } finally { await v.done(); }
  });

  test("RED: one session binds one (face, anchor): a switch whose proof stands at another Nexus refuses anchor-moved and leaves the session live", async () => {
    const v = await stand("anchor-moved", { nexusOf: (f) => (f === "hint-far" ? "nexus-two.synthetic" : "nexus-one.synthetic") });
    try {
      const a = await v.connect();
      const envA = envOf(await a.ask({ op: "session:open", requestId: "open-a", faceRef: "hint-a", hand: "seat" }));
      expect(await a.ask(switchTo(envA, "hint-far", "far"))).toMatchObject({ kind: "session:refused", requestId: "far", refusal: "anchor-moved" });
      expect(await a.ask(call(envA, "still-a"))).toMatchObject({ kind: "session:result", status: "done" });
      // CONTROL: a face proven at the session's own Nexus switches.
      expect(await a.ask(switchTo(envA, "hint-b", "near"))).toMatchObject({ kind: "session:switch-result", outcome: "switched", generation: 1 });
    } finally { await v.done(); }
  });

  test("a switch whose expected generation differs from its envelope's refuses malformed and changes nothing", async () => {
    const v = await stand("expected");
    try {
      const a = await v.connect();
      const envA = envOf(await a.ask({ op: "session:open", requestId: "open-a", faceRef: "hint-a", hand: "seat" }));
      expect(await a.ask({ ...switchTo(envA, "hint-b", "skew"), expectedGeneration: 1 })).toMatchObject({ kind: "session:refused", refusal: "malformed-message" });
      expect(await a.ask(call(envA, "after"))).toMatchObject({ kind: "session:result", status: "done" });
      expect(v.drawn.map((s) => s.dropped)).toEqual([false]);
    } finally { await v.done(); }
  });

  test("a socket that closes mid-switch drops every signer it held and leaves its sibling acting", async () => {
    let release!: () => void;
    const until = new Promise<void>((resolve) => { release = resolve; });
    const v = await stand("mid-close", { hold: { hint: "hint-b", until } });
    try {
      const [a, b] = [await v.connect(), await v.connect()];
      const envA = envOf(await a.ask({ op: "session:open", requestId: "open-a", faceRef: "hint-a", hand: "seat" }));
      const envB = envOf(await b.ask({ op: "session:open", requestId: "open-b", faceRef: "hint-a", hand: "seat" }));
      a.sock.write(JSON.stringify(switchTo(envA, "hint-b", "switch-a")) + "\n");
      await new Promise((resolve) => setImmediate(resolve));
      a.sock.destroy();
      await new Promise((resolve) => a.sock.once("close", resolve));
      release();
      expect(await b.ask(call(envB, "sibling"))).toMatchObject({ kind: "session:result", status: "done" });
      expect(v.drawn.filter((s) => !s.dropped).map((s) => s.n)).toEqual([1]);
    } finally { await v.done(); }
  });

  test("a flush that fails under the intent thaws the session live, names a code alone, and its signer signs on", async () => {
    let failing = false;
    const v = await stand("flush", { failFlush: () => failing });
    try {
      const a = await v.connect();
      const envA = envOf(await a.ask({ op: "session:open", requestId: "open-a", faceRef: "hint-a", hand: "seat" }));
      failing = true;
      const refused = await a.ask(switchTo(envA, "hint-b", "flush"));
      failing = false;
      expect(refused).toEqual({ kind: "session:refused", requestId: "flush", refusal: "intent-unwritten" });
      expect(await a.ask(call(envA, "after"))).toMatchObject({ kind: "session:result", status: "done" });
      expect(v.drawn.map((s) => s.dropped)).toEqual([false]);
    } finally { await v.done(); }
  });

  test("RED: a face with no Nexus opens a session at the place anchor, and a command rides it", async () => {
    const v = await stand("place-anchor", { anchor: () => ({ kind: "place", aid: "place-prefix.synthetic", head: "place-head.synthetic" }) });
    try {
      const a = await v.connect();
      const envA = envOf(await a.ask({ op: "session:open", requestId: "open-a", faceRef: "hint-a", hand: "seat" }));
      expect(await a.ask(call(envA, "rides"))).toMatchObject({ kind: "session:result", requestId: "rides", status: "done" });
      expect(v.placed.map((p) => p.requestedBy)).toEqual(["verified-hint-a"]);
    } finally { await v.done(); }
  });

  test("RED: a session opened at the place anchor refuses anchor-moved once a dial pin moves the vessel to a Nexus; CONTROL: the same face at the anchor it stands at opens again", async () => {
    let at: SessionAnchor = { kind: "place", aid: "place-prefix.synthetic", head: "place-head.synthetic" };
    const v = await stand("place-moved", { anchor: () => at });
    try {
      const a = await v.connect();
      const envA = envOf(await a.ask({ op: "session:open", requestId: "open-a", faceRef: "hint-a", hand: "seat" }));
      // CONTROL first: a second open of the same face at the same anchor opens cleanly beside it.
      const b = await v.connect();
      const envB = envOf(await b.ask({ op: "session:open", requestId: "open-b", faceRef: "hint-a", hand: "seat" }));
      expect(await b.ask(call(envB, "same-anchor"))).toMatchObject({ kind: "session:result", status: "done" });
      at = { kind: "nexus", aid: "nexus-one.synthetic" };
      expect(await a.ask(call(envA, "after-pin"))).toEqual({ kind: "session:refused", requestId: "after-pin", refusal: "anchor-moved", closed: true });
      expect(v.drawn[0]!.dropped).toBe(true);
      expect(v.placed.map((p) => p.requestId)).not.toContain(expect.stringContaining("after-pin"));
      // The same face opens afresh at the anchor the vessel stands at now.
      const c = await v.connect();
      const envC = envOf(await c.ask({ op: "session:open", requestId: "open-c", faceRef: "hint-a", hand: "seat" }));
      expect(await c.ask(call(envC, "at-nexus"))).toMatchObject({ kind: "session:result", status: "done" });
    } finally { await v.done(); }
  });

  test("RED: a failed re-dial leaves the vessel at its place anchor, and a session opened at the old Nexus refuses anchor-moved", async () => {
    let at: SessionAnchor = { kind: "nexus", aid: "nexus-one.synthetic" };
    const v = await stand("redial-failed", { anchor: () => at });
    try {
      const a = await v.connect();
      const envA = envOf(await a.ask({ op: "session:open", requestId: "open-a", faceRef: "hint-a", hand: "seat" }));
      at = { kind: "place", aid: "place-prefix.synthetic", head: "place-head.synthetic" };
      expect(await a.ask(switchTo(envA, "hint-c", "switch-after"))).toEqual({ kind: "session:refused", requestId: "switch-after", refusal: "anchor-moved", closed: true });
    } finally { await v.done(); }
  });

  test("RED: a row that acts as a face never rides the maintenance frame; CONTROL: it rides a session, and a row of the place rides the frame", async () => {
    const v = await stand("face-row");
    try {
      const frame = await v.connect();
      expect(await frame.ask({ verb: "face-row", args: {}, requestedBy: "did:place", requestId: "one-shot" }))
        .toMatchObject({ status: "error", refusal: { reason: "face-row-rides-a-session" } });
      expect(v.placed).toEqual([]);
      const place = await v.connect();
      expect(await place.ask({ verb: "load", args: {}, requestedBy: "did:place", requestId: "place-row" })).toMatchObject({ status: "done" });
      const a = await v.connect();
      const envA = envOf(await a.ask({ op: "session:open", requestId: "open-a", faceRef: "hint-a", hand: "seat" }));
      expect(await a.ask({ op: "session:call", ...envA, requestId: "on-session", verb: "face-row", args: {} })).toMatchObject({ kind: "session:result", status: "done" });
    } finally { await v.done(); }
  });
  test("RED: a session's face binds the face row it carries: a row naming another face, or face and handleIndex disagreeing, refuses face-row-other-face and nothing runs", async () => {
    const v = await stand("face-bound");
    try {
      const a = await v.connect();
      const envA = envOf(await a.ask({ op: "session:open", requestId: "open-a", faceRef: "hint-a", hand: "seat" }));   // the face h0
      const row = (requestId: string, args: Record<string, unknown>) => a.ask({ op: "session:call", ...envA, requestId, verb: "face-row", args });
      for (const [id, args] of [["other-face", { face: 1 }], ["other-handle", { handleIndex: 1 }], ["split", { face: 0, handleIndex: 1 }]] as const) {
        expect(await row(id, args)).toEqual({ kind: "session:refused", requestId: id, refusal: "face-row-other-face" });
      }
      expect(v.placed).toEqual([]);                                             // nothing reached the worker
      // CONTROL: a row naming the session's face, or none, acts as that face under both keys.
      expect(await row("named", { face: 0 })).toMatchObject({ kind: "session:result", status: "done" });
      expect(await row("unnamed", { glamour: "x" })).toMatchObject({ kind: "session:result", status: "done" });
      expect(v.placed.map((p) => (p as { args?: unknown }).args)).toEqual([{ face: 0, handleIndex: 0 }, { glamour: "x", face: 0, handleIndex: 0 }]);
      // A row of the place carries its arguments as they came.
      expect(await a.ask({ op: "session:call", ...envA, requestId: "place-row", verb: "load", args: { face: 1 } })).toMatchObject({ kind: "session:result" });
      expect((v.placed[2] as { args?: unknown }).args).toEqual({ face: 1 });
    } finally { await v.done(); }
  });
  test("RED: a sealed act that acts as a face rides the session as its face, and its receipt names the act and the face alone", async () => {
    const v = await stand("session-act");
    try {
      const a = await v.connect();
      const envA = envOf(await a.ask({ op: "session:open", requestId: "open-a", faceRef: "hint-a", hand: "seat" }));   // the face h0
      const act = (requestId: string, name: string, args: Record<string, unknown>) => a.ask({ op: "session:act", ...envA, requestId, act: name, args });
      expect(await act("other", "host.roll", { cap: 5, face: 1 })).toEqual({ kind: "session:refused", requestId: "other", refusal: "face-row-other-face" });
      expect(await act("place", "persona.roots", {})).toEqual({ kind: "session:refused", requestId: "place", refusal: "act-rides-the-custody-door" });
      expect(v.ran).toEqual([]);
      // CONTROL: the act runs as the session's face, and answers on this socket alone.
      expect(await act("roll", "host.roll", { cap: 5 })).toEqual({ kind: "session:act-result", requestId: "roll",
        answer: { op: "act", act: "host.roll", result: { epoch: "e".repeat(64) } } });
      expect(v.ran).toEqual([{ act: "host.roll", args: { cap: 5, face: 0 } }]);
      const receipt = await a.ask({ op: "session:receipt", ...envA, requestId: "roll" });
      expect(receipt).toMatchObject({ kind: "session:receipt", receipt: { state: "done", face: "proof-a" } });
      // The receipt fact carries the act and the face, and no argument or answer.
      const titles = (await v.composite.listVisible()).filter((t) => t.startsWith(RECEIPT_FACT_URI_PREFIX));
      const facts = (await Promise.all(titles.map((t) => v.composite.get(t)))).filter((r) => r !== null);
      expect(facts.map((r) => r.tiddler["action"])).toEqual(["act:host.roll"]);
      const fact = JSON.stringify(facts);
      expect(fact.includes("cap")).toBe(false);
      expect(fact.includes("eeee")).toBe(false);
      // CONTROL: the same search reads red over a fact that carried the argument or the answer.
      expect(JSON.stringify([{ ...facts[0]!.tiddler, args: { cap: 5 } }]).includes("cap")).toBe(true);
      expect(JSON.stringify([{ ...facts[0]!.tiddler, answer: { epoch: "e".repeat(64) } }]).includes("eeee")).toBe(true);
    } finally { await v.done(); }
  });
  test("RED: a retried act reads the receipt of the act that ran under its requestId, whatever arguments it carries, and never runs twice", async () => {
    const v = await stand("session-act-retry");
    try {
      const a = await v.connect();
      const envA = envOf(await a.ask({ op: "session:open", requestId: "open-a", faceRef: "hint-a", hand: "seat" }));
      const act = (requestId: string, args: Record<string, unknown>) => a.ask({ op: "session:act", ...envA, requestId, act: "host.roll", args });
      expect(await act("roll", { cap: 5 })).toMatchObject({ kind: "session:act-result", requestId: "roll" });
      // The retry, the same arguments or others, answers the first run's receipt; its answer body rode the first reply alone.
      for (const args of [{ cap: 5 }, { cap: 9 }]) {
        const retry = await act("roll", args);
        expect(retry).toMatchObject({ kind: "session:receipt", requestId: "roll", receipt: { action: "act:host.roll", face: "proof-a", state: "done" } });
        expect(JSON.stringify(retry).includes("eeee")).toBe(false);
      }
      expect(v.ran).toEqual([{ act: "host.roll", args: { cap: 5, face: 0 } }]);
      // CONTROL: a fresh requestId runs the act afresh.
      expect(await act("roll-2", { cap: 9 })).toMatchObject({ kind: "session:act-result", requestId: "roll-2" });
      expect(v.ran).toHaveLength(2);
    } finally { await v.done(); }
  });
  test("RED: an act that throws once running answers its own error act-faulted and its receipt reads error; the fault's text stays off the wire", async () => {
    const v = await stand("session-act-fault", { actThrows: true });
    try {
      const a = await v.connect();
      const envA = envOf(await a.ask({ op: "session:open", requestId: "open-a", faceRef: "hint-a", hand: "seat" }));
      const reply = await a.ask({ op: "session:act", ...envA, requestId: "torn", act: "host.roll", args: {} });
      expect(reply).toEqual({ kind: "session:act-result", requestId: "torn", answer: { status: "error", reason: "act-faulted" } });
      expect(await a.ask({ op: "session:receipt", ...envA, requestId: "torn" })).toMatchObject({ receipt: { action: "act:host.roll", state: "error" } });
      // CONTROL: the session stands and answers its next frame.
      expect(await a.ask({ op: "session:call", ...envA, requestId: "after", verb: "load", args: {} })).toMatchObject({ kind: "session:result", status: "done" });
    } finally { await v.done(); }
  });
  test("RED: a ledger that fails to record an act's outcome after it ran answers act-faulted with the receipt, never session-fault, and a retry reads the outcome, never pending", async () => {
    let ran: unknown[] = [];
    let tripped = false;
    // The flush faults once, and only once the act has run: the outcome's record is what fails.
    const v = await stand("session-act-unrecorded", { failFlush: () => (!tripped && ran.length > 0 ? (tripped = true) : false) });
    ran = v.ran;
    try {
      const a = await v.connect();
      const envA = envOf(await a.ask({ op: "session:open", requestId: "open-a", faceRef: "hint-a", hand: "seat" }));
      const reply = await a.ask({ op: "session:act", ...envA, requestId: "ran", act: "host.roll", args: {} });
      expect(tripped, "the fault struck after the run").toBe(true);
      expect(reply).toMatchObject({ kind: "session:act-result", requestId: "ran", answer: { status: "error", reason: "act-faulted" },
        receipt: { action: "act:host.roll", face: "proof-a", state: "done" } });
      expect(JSON.stringify(reply).includes("secret/path"), "the fault's text stays off the wire").toBe(false);
      // The retry under the same id reads the outcome and never runs the act twice.
      expect(await a.ask({ op: "session:act", ...envA, requestId: "ran", act: "host.roll", args: {} }))
        .toMatchObject({ kind: "session:receipt", requestId: "ran", receipt: { state: "done" } });
      expect(await a.ask({ op: "session:receipt", ...envA, requestId: "ran" })).toMatchObject({ receipt: { state: "done" } });
      expect(v.ran).toHaveLength(1);
    } finally { await v.done(); }
  });
  test("a faulted act receipt survives a failed ledger read", async () => {
    const v = await stand("session-act-read-fault");
    const get = FactLedger.prototype.get;
    const observe = vi.spyOn(FactLedger.prototype, "observeOutcome").mockRejectedValue(new Error("record failed"));
    const read = vi.spyOn(FactLedger.prototype, "get").mockImplementation(function (this: FactLedger, id) {
      if (v.ran.length) return Promise.reject(new Error("read failed"));
      return get.call(this, id);
    });
    try {
      const a = await v.connect();
      const env = envOf(await a.ask({ op: "session:open", requestId: "open", faceRef: "hint-a", hand: "seat" }));
      expect(await a.ask({ op: "session:act", ...env, requestId: "ran", act: "host.roll", args: {} }))
        .toMatchObject({ kind: "session:act-result", answer: { reason: "act-faulted" }, receipt: { state: "done" } });
      expect(await a.ask({ op: "session:receipt", ...env, requestId: "ran" })).toMatchObject({ receipt: { state: "done" } });
    } finally { read.mockRestore(); observe.mockRestore(); await v.done(); }
  });
  test("CONTROL (it stands on the parent too): a ledger that fails before an act runs answers session-fault and runs nothing", async () => {
    let failing = false;
    const v = await stand("session-act-ledger", { failFlush: () => failing });
    try {
      const a = await v.connect();
      const envA = envOf(await a.ask({ op: "session:open", requestId: "open-a", faceRef: "hint-a", hand: "seat" }));
      failing = true;
      expect(await a.ask({ op: "session:act", ...envA, requestId: "unledgered", act: "host.roll", args: {} }))
        .toEqual({ kind: "session:refused", requestId: "unledgered", refusal: "session-fault" });
      failing = false;
      expect(v.ran).toEqual([]);
      // CONTROL: once the flush stands, the act runs.
      expect(await a.ask({ op: "session:act", ...envA, requestId: "ledgered", act: "host.roll", args: {} })).toMatchObject({ kind: "session:act-result" });
      expect(v.ran).toHaveLength(1);
    } finally { await v.done(); }
  });
  test("RED: a seat that closes waits out an act still running", async () => {
    let letGo!: () => void;
    const v = await stand("session-act-drain", { actHold: new Promise<void>((resolve) => { letGo = resolve; }) });
    try {
      const a = await v.connect();
      const envA = envOf(await a.ask({ op: "session:open", requestId: "open-a", faceRef: "hint-a", hand: "seat" }));
      a.sock.write(JSON.stringify({ op: "session:act", ...envA, requestId: "long", act: "host.roll", args: {} }) + "\n");
      await v.ranFirst;                                                      // the act's own start
      expect(v.ran).toHaveLength(1);                                         // the act runs, held
      let closed = false;
      const closing = v.channel.detach().then(() => { closed = true; });
      for (let n = 0; n < 20; n++) await new Promise((resolve) => setImmediate(resolve));
      expect(closed).toBe(false);                                            // the seat waits the act out
      letGo();
      await closing;
      expect(closed).toBe(true);
    } finally { letGo(); await v.done(); }
  });
  test("RED: a seat that closes waits out an act behind a slow ledger flush, and the test waits on the act's own start; CONTROL: the held act has not run before the flush lets go", async () => {
    let letGo!: () => void, flushed!: () => void;
    const v = await stand("session-act-slow-flush", {
      actHold: new Promise<void>((resolve) => { letGo = resolve; }),
      flushGate: new Promise<void>((resolve) => { flushed = resolve; }),
    });
    try {
      const a = await v.connect();
      const envA = envOf(await a.ask({ op: "session:open", requestId: "open-a", faceRef: "hint-a", hand: "seat" }));
      a.sock.write(JSON.stringify({ op: "session:act", ...envA, requestId: "long", act: "host.roll", args: {} }) + "\n");
      for (let n = 0; n < 200; n++) await new Promise((resolve) => setImmediate(resolve));
      expect(v.ran).toHaveLength(0);                                         // CONTROL: the slow flush holds the act back
      flushed();
      await v.ranFirst;                                                      // the act's own start, not a count of turns
      expect(v.ran).toHaveLength(1);
      let closed = false;
      const closing = v.channel.detach().then(() => { closed = true; });
      for (let n = 0; n < 20; n++) await new Promise((resolve) => setImmediate(resolve));
      expect(closed).toBe(false);
      letGo();
      await closing;
      expect(closed).toBe(true);
    } finally { flushed(); letGo(); await v.done(); }
  });
  test("RED: an act naming its face by handleIndex binds to the session's face: another face refuses face-row-other-face, and the act carries handleIndex alone", async () => {
    const v = await stand("session-act-handle");
    try {
      const a = await v.connect();
      const envA = envOf(await a.ask({ op: "session:open", requestId: "open-a", faceRef: "hint-a", hand: "seat" }));   // the face h0
      const act = (requestId: string, args: Record<string, unknown>) => a.ask({ op: "session:act", ...envA, requestId, act: "carriage.accept", args });
      expect(await act("other", { handleIndex: 1 })).toEqual({ kind: "session:refused", requestId: "other", refusal: "face-row-other-face" });
      expect(await act("split", { handleIndex: 0, face: 1 })).toEqual({ kind: "session:refused", requestId: "split", refusal: "face-row-other-face" });
      expect(v.ran).toEqual([]);
      // CONTROL: naming the session's face, the act runs with the key it named and no other.
      expect(await act("own", { handleIndex: 0, aid: "x" })).toMatchObject({ kind: "session:act-result", requestId: "own" });
      expect(v.ran).toEqual([{ act: "carriage.accept", args: { handleIndex: 0, aid: "x" } }]);
    } finally { await v.done(); }
  });
  test("RED: a rotation of the place mid-session ends its session anchor-moved; a read of the place that fails once refuses that frame anchor-unread and the session stands", async () => {
    let head = "place-head.one";
    let failOnce = false;
    const v = await stand("place-rotation", { anchor: () => {
      if (failOnce) { failOnce = false; throw new Error("the place KEL at /secret/kel reads torn"); }
      return { kind: "place", aid: "place-prefix.synthetic", head };
    } });
    try {
      const a = await v.connect();
      const envA = envOf(await a.ask({ op: "session:open", requestId: "open-a", faceRef: "hint-a", hand: "seat" }));
      failOnce = true;
      expect(await a.ask(call(envA, "blip"))).toEqual({ kind: "session:refused", requestId: "blip", refusal: "anchor-unread" });
      // CONTROL: the read recovers, and the same session serves.
      expect(await a.ask(call(envA, "after-blip"))).toMatchObject({ kind: "session:result", requestId: "after-blip", status: "done" });
      head = "place-head.two";                                               // the place rotates
      expect(await a.ask(call(envA, "rotated"))).toEqual({ kind: "session:refused", requestId: "rotated", refusal: "anchor-moved", closed: true });
      expect(v.drawn.map((d) => d.dropped)).toEqual([true]);
      // CONTROL: the same face opens again at the head the place stands at.
      const b = await v.connect();
      expect(await b.ask({ op: "session:open", requestId: "open-b", faceRef: "hint-a", hand: "seat" })).toMatchObject({ kind: "session:opened" });
    } finally { await v.done(); }
  });
});
