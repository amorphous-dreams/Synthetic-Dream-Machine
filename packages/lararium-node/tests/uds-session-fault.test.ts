/**
 * uds-session-fault — a frame that throws past the session door answers the fixed `session-fault` under the frame's own
 * requestId, so the caller's waiter matches it, and the fault's text (a path, a face) stays in the vessel's log.
 * Two paths: a frame whose processing throws (`queueSession`: a receipt whose durable settle fails) and a reply whose
 * settle throws (`settleOne`: a call's terminal answer). Each RED carries a CONTROL: the same frame answers whole once
 * the flush stands again, and the log holds the detail the wire never carried.
 * The harness borrows uds-session-switch.test.ts's.
 */
import { describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConnection, type Socket } from "node:net";
import { Repo } from "@automerge/automerge-repo";
import { AutomergeDocStore, CompositeStore, DAEMON_BAG_ID, emptyLarDoc, type SwitchIntent, type SwitchOutcome, concludeVerb, wikiSlotUri,
  type LarDoc, type SessionFace } from "@lararium/mesh";
import { startUdsChannel, type SessionAnchor, type UdsSessionDoor } from "../src/uds-channel.js";
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
  /** Fail the Repo's flush while this reads true; it reads the documents the flush names (none: the whole Repo). */
  failFlush?: (ids?: readonly unknown[]) => boolean;
  /** The door throws for this hint, as a torn row would. */
  throwOn?: string;
  /** The Nexus each hint's proof stands at; every proof stands at one Nexus where unnamed. */
  nexusOf?: (faceRef: string) => string;
  /** Where the vessel stands now; each proof stands there where `nexusOf` names none. */
  anchor?: () => SessionAnchor;
} = {}) {
  const standing = (): SessionAnchor => opts.anchor?.() ?? { kind: "nexus", aid: "nexus-one.synthetic" };
  const repo = new Repo({ sharePolicy: async () => true });
  const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
  const workingHandle = repo.create<LarDoc>(emptyLarDoc());
  const composite = new CompositeStore();
  composite.addLayer({ bagId: DAEMON_BAG_ID, store: new AutomergeDocStore(daemonHandle as never, DAEMON_BAG_ID), writable: true, defaultWritable: false });
  composite.addLayer({ bagId: wikiSlotUri("daemon", "working"), store: new AutomergeDocStore(workingHandle, wikiSlotUri("daemon", "working")), writable: true });
  const dir = mkdtempSync(join(tmpdir(), `uds-fault-${label}-`));
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
  const flushing = { flush: (ids?: Parameters<Repo["flush"]>[0]) => (opts.failFlush?.(ids) ? Promise.reject(new Error("disk full at /secret/path")) : repo.flush(ids)) };
  const logged: Array<SwitchIntent | SwitchOutcome> = [];
  const switchActs = { write: async (act: SwitchIntent | SwitchOutcome) => {
    if (opts.failFlush?.()) throw new Error("disk full at /secret/path");
    logged.push(act);
  } };
  const lines: string[] = [];
  const channel = startUdsChannel({ daemonHandle, composite, claim, repo: flushing, sessions: door, switchActs, sessionVerbs: new Set(["face-row"]),
    onLog: (line) => { lines.push(line); },
    placeVerb: (o) => {
      placed.push(o);
      // The outcome names its face, as the worker's does, so the session's receipt reads it terminal.
      const outcome = concludeVerb({ requestId: o.requestId, verb: o.verb, status: "done", ...(o.face !== undefined ? { face: o.face } : {}),
        requestedBy: o.requestedBy, cause: "test-worker", batchMode: "best-effort", results: { summary: { ok: true } } });
      daemonHandle.change((doc) => { doc.tiddlers[outcome.tiddler.title] = outcome as unknown as LarDoc["tiddlers"][string]; });
    },
  });
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
  return { placed, drawn, connect, done, watchActs, probe, lines };
}

const envOf = (opened: Record<string, unknown>) =>
  ({ ownerEpoch: opened["ownerEpoch"], sessionId: opened["sessionId"], generation: opened["generation"], faceRef: opened["faceRef"] });
const call = (env: Record<string, unknown>, requestId: string) => ({ op: "session:call", ...env, requestId, verb: "load", args: {} });
const switchTo = (env: Record<string, unknown>, faceRef: string, requestId: string) =>
  ({ op: "session:switch", ...env, target: faceRef, expectedGeneration: env["generation"], requestId });

describe("UDS session fault", () => {
  test("RED: a reply whose durable settle throws answers session-fault under the call's requestId, and no fault text reaches the wire", async () => {
    let failing = false;
    // The durable settle flushes the daemon doc by name; the fact ledger's own flush (the whole Repo) stands.
    const v = await stand("reply", { failFlush: (ids) => failing && ids !== undefined });
    try {
      const a = await v.connect();
      const envA = envOf(await a.ask({ op: "session:open", requestId: "open-a", faceRef: "hint-a", hand: "seat" }));
      failing = true;
      const reply = await a.ask(call(envA, "call-torn"));
      failing = false;
      expect(reply).toEqual({ kind: "session:refused", requestId: "call-torn", refusal: "session-fault" });
      expect(JSON.stringify(reply)).not.toContain("secret");
      expect(v.lines.some((l) => l.includes("/secret/path"))).toBe(true);     // the detail rests in the vessel's log alone
      // CONTROL: the same session answers whole once the flush stands.
      expect(await a.ask(call(envA, "call-whole"))).toMatchObject({ kind: "session:result", requestId: "call-whole", status: "done" });
    } finally { await v.done(); }
  });

  test("RED: a call whose fact ledger's whole-Repo flush rejects mid-arbitration answers session-fault under its requestId, and nothing runs", async () => {
    let failing = false;
    // The fact ledger flushes the whole Repo (no ids) before it answers "run"; that flush rejects here.
    const v = await stand("ledger", { failFlush: (ids) => failing && ids === undefined });
    try {
      const a = await v.connect();
      const envA = envOf(await a.ask({ op: "session:open", requestId: "open-a", faceRef: "hint-a", hand: "seat" }));
      const before = v.placed.length;
      failing = true;
      const reply = await a.ask(call(envA, "call-unledgered"));
      failing = false;
      expect(reply).toEqual({ kind: "session:refused", requestId: "call-unledgered", refusal: "session-fault" });
      expect(v.placed.length).toBe(before);                                   // nothing dispatched
      expect(v.lines.some((l) => l.startsWith("receipt-fact ledger failed") && l.includes("/secret/path"))).toBe(true);
      // CONTROL: the same session answers whole once the flush stands.
      expect(await a.ask(call(envA, "call-ledgered"))).toMatchObject({ kind: "session:result", requestId: "call-ledgered", status: "done" });
    } finally { await v.done(); }
  });

  test("RED: a frame whose processing throws answers session-fault under the frame's requestId, and no fault text reaches the wire", async () => {
    let failing = false;
    const v = await stand("frame", { failFlush: (ids) => failing && ids !== undefined });
    try {
      const a = await v.connect();
      const envA = envOf(await a.ask({ op: "session:open", requestId: "open-a", faceRef: "hint-a", hand: "seat" }));
      expect(await a.ask(call(envA, "settled"))).toMatchObject({ kind: "session:result", status: "done" });
      // The fact promotes to done as its outcome lands; the receipt reads terminal from there.
      let state: unknown;
      for (let n = 0; n < 50 && state !== "done"; n++) {
        state = ((await a.ask({ op: "session:receipt", ...envA, requestId: "settled" }))["receipt"] as Record<string, unknown>)["state"];
      }
      expect(state).toBe("done");
      failing = true;                                                          // the receipt of a terminal call settles durably, and that settle throws
      const reply = await a.ask({ op: "session:receipt", ...envA, requestId: "settled" });
      failing = false;
      expect(reply).toEqual({ kind: "session:refused", requestId: "settled", refusal: "session-fault" });
      expect(JSON.stringify(reply)).not.toContain("secret");
      expect(v.lines.some((l) => l.startsWith("session frame failed:") && l.includes("/secret/path"))).toBe(true);
      // CONTROL: the same receipt answers once the flush stands.
      expect(await a.ask({ op: "session:receipt", ...envA, requestId: "settled" })).toMatchObject({ kind: "session:receipt", requestId: "settled" });
    } finally { await v.done(); }
  });
});
