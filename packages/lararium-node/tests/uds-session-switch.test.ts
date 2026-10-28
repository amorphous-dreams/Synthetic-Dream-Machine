import { describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConnection, type Socket } from "node:net";
import { Repo } from "@automerge/automerge-repo";
import { AutomergeDocStore, CompositeStore, DAEMON_BAG_ID, SWITCH_ACT_URI_PREFIX, emptyLarDoc, concludeVerb, wikiSlotUri,
  type LarDoc, type SessionFace } from "@lararium/mesh";
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
} = {}) {
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
  const door: UdsSessionDoor = { open: async ({ faceRef }) => {
    if (opts.hold && faceRef === opts.hold.hint) await opts.hold.until;
    const refusal = opts.refuse?.(faceRef) ?? null;
    if (refusal) return { ok: false, refusal };
    const name = faceRef.replace(/^hint-/, "");
    return { ok: true, supply: { face: face(name), profile: "seat", presenter: `verified-${faceRef}`, mint: async ({ session }) => {
      const n = drawn.length;
      if (opts.refuseMint?.(n)) return { ok: false, refusal: "dial-refused" };
      const signer: Drawn = { face: session.face.proofSubject, n, dropped: false, drop() { signer.dropped = true; } };
      drawn.push(signer);
      return { ok: true, signer };
    } } };
  } };
  const flushing = { flush: (ids?: Parameters<Repo["flush"]>[0]) => (opts.failFlush?.() ? Promise.reject(new Error("disk full at /secret/path")) : repo.flush(ids)) };
  const channel = startUdsChannel({ daemonHandle, composite, claim, repo: flushing, sessions: door,
    placeVerb: (o) => {
      placed.push(o);
      const outcome = concludeVerb({ requestId: o.requestId, verb: o.verb, status: "done",
        requestedBy: o.requestedBy, cause: "test-worker", batchMode: "best-effort", results: { summary: { ok: true } } });
      daemonHandle.change((doc) => { doc.tiddlers[outcome.tiddler.title] = outcome as unknown as LarDoc["tiddlers"][string]; });
    },
  });
  const peers: Peer[] = [];
  const connect = async () => { const p = await Peer.connect(claim.socketPath); peers.push(p); return p; };
  const done = async () => { for (const p of peers) p.end(); channel.close(); await claim.release(); rmSync(dir, { recursive: true, force: true }); };
  /** Count the switch acts that land from here on. */
  const watchActs = () => {
    const seen: Array<Record<string, unknown>> = [];
    const stop = composite.subscribe((change) => {
      if (change.title.startsWith(SWITCH_ACT_URI_PREFIX) && change.record) seen.push(change.record.tiddler as Record<string, unknown>);
    });
    return { seen, stop };
  };
  return { placed, drawn, connect, done, watchActs };
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
      expect(acts.seen).toEqual([]);
    } finally { await v.done(); }
  });

  test("the intent and the outcome rest as switch acts, naming two faces and no session", async () => {
    const v = await stand("acts");
    try {
      const a = await v.connect();
      const envA = envOf(await a.ask({ op: "session:open", requestId: "open-a", faceRef: "hint-a", hand: "seat" }));
      const { seen, stop } = v.watchActs();
      await a.ask(switchTo(envA, "hint-b", "switch-a"));
      stop();
      expect(seen.map((t) => t["phase"])).toEqual(["intent", "outcome"]);
      expect(seen[1]).toMatchObject({ outgoing: "proof-a", incoming: "proof-b", generation: "0", outcome: "switched", "disk-projection": "no" });
      expect(JSON.stringify(seen)).not.toContain(String(envA.sessionId));
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
});
