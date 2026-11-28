/**
 * uds-channel-ask-book — NO RECEIPT RESTS: the verb door answers a request id from what it holds in memory (the answer
 * ring, its ask book) and from the verdict row a write leaves, and never writes a receipt title into the control document.
 *
 * The island here runs the dispatcher's own `writeOutcome` (`@lararium/tw5`): a write leaves its verdict row and, under an
 * effect key, its effect row; every answer rides the vessel's answer ring whole. Each worker counts what it ran, so a
 * re-ask that runs nothing reads as a count that held.
 *
 *   R1 — a same-id re-ask answers from the answer ring, and places nothing.
 *   R2 — past the ring, a write's re-ask reads its verdict row (the act record, its effect row beside it): released body,
 *        nothing placed; a read's re-ask runs again, honestly.
 *   R3 — 2,000 door calls leave no receipt title in the control document.
 *   plus the book's own laws: a cancel that meets nothing marks the id abandoned for this life (and a restart forgets it),
 *   a cancel that meets a running ask changes nothing, a same id with changed input refuses by name.
 */
import { describe, test, expect } from "vitest";
import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConnection } from "node:net";
import { Repo, type DocHandle } from "@automerge/automerge-repo";
import { emptyLarDoc, type LarDoc } from "@lararium/mesh/base-doc";
import { answerRingOf, controlStoreOf } from "@lararium/mesh/control-home";
import type { CompositeStore } from "@lararium/mesh/composite-store";
import { CONTROL_HOME_ID } from "@lararium/mesh/lar-uris";
import { EFFECT_URI_PREFIX, OUTCOME_URI_PREFIX, type Verb } from "@lararium/mesh/verb-tiddler";
import { writeOutcome } from "@lararium/tw5";
import { AskBook, startUdsChannel, type UdsChannel } from "../src/uds-channel.js";
import { claimStore, type StoreClaim } from "../src/owned-store.js";

/** Where receipt facts rested before they burned: no title stands under it. */
const RECEIPT_TITLES = `${CONTROL_HOME_ID}/receipts/`;

type Placed = { requestId: string; verb: string; args: Record<string, unknown>; requestedBy: string; effectKey?: string };

function send(socketPath: string, line: unknown): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const sock = createConnection(socketPath);
    let buf = "";
    sock.setEncoding("utf8");
    sock.on("connect", () => sock.write(JSON.stringify(line) + "\n"));
    sock.on("data", (chunk: string) => {
      buf += chunk;
      const nl = buf.indexOf("\n");
      if (nl !== -1) { const l = buf.slice(0, nl); sock.end(); resolve(JSON.parse(l)); }
    });
    sock.on("error", reject);
  });
}

/** The island's verb as the dispatcher hands `writeOutcome` one. */
function invocationOf(p: Placed): Verb {
  return {
    requestId: p.requestId, title: `lar:///lararium.local.vm/verbs/${p.requestId}`, action: p.verb, args: p.args, targets: [],
    batchMode: "best-effort", status: "pending", requestedBy: p.requestedBy, requestedAt: "t",
    ...(p.effectKey !== undefined ? { effectKey: p.effectKey } : {}),
  } as unknown as Verb;
}

/** A vessel: one Repo, one control document, the door over a scratch claim. `hold` keeps a placed verb unanswered until
 *  the test lands it. A restart keeps the Repo and the document and stands a fresh door (and a fresh ring). */
class Vessel {
  claim!: StoreClaim & { readonly holder: "vessel" };
  channel!: UdsChannel;
  control!: CompositeStore;
  readonly ran: Placed[] = [];
  readonly held = new Map<string, () => void>();
  hold = false;
  constructor(readonly repo: Repo, readonly controlHandle: DocHandle<LarDoc>, readonly dir: string) {}

  static async boot(): Promise<Vessel> {
    const repo = new Repo({ sharePolicy: async () => true });
    const v = new Vessel(repo, repo.create<LarDoc>(emptyLarDoc()), mkdtempSync(join(tmpdir(), "uds-ask-book-")));
    await v.start();
    return v;
  }

  private async start(): Promise<void> {
    this.control = controlStoreOf(this.controlHandle);
    this.claim = await claimStore(this.dir, { holder: "vessel" });
    this.channel = startUdsChannel({
      controlHandle: this.controlHandle, control: this.control, claim: this.claim, repo: this.repo, timeoutMs: 5_000,
      placeVerb: (o) => {
        const p = o as unknown as Placed;
        this.ran.push(p);
        const land = (): void => { void writeOutcome(this.control, { invocation: invocationOf(p), status: "done", result: { echo: p.args, body: `body-of-${p.requestId}` }, touched: {} }); };
        if (this.hold) this.held.set(p.requestId, land); else land();
      },
    });
    for (let i = 0; i < 100 && !existsSync(this.claim.socketPath); i++) await new Promise((r) => setTimeout(r, 10));
  }

  get socketPath(): string { return this.claim.socketPath; }
  ask(verb: string, requestId: string, args: Record<string, unknown> = {}, effectKey?: string): Promise<Record<string, unknown>> {
    return send(this.socketPath, { verb, args, requestedBy: "did:key:test", requestId, ...(effectKey !== undefined ? { effectKey } : {}) });
  }
  titles(): string[] { return Object.keys(this.controlHandle.doc()?.tiddlers ?? {}); }

  async restart(): Promise<void> {
    this.channel.close();
    await this.claim.release();
    answerRingOf(this.control).clear();
    await this.start();
  }

  async teardown(): Promise<void> {
    this.channel.close();
    await this.claim.release();
    rmSync(this.dir, { recursive: true, force: true });
  }
}

const WRITE = "nexus-kapae";
const READ = "ddate";

describe("the verb door answers a request id from memory and the act record, and rests no receipt", () => {
  test("★ R1 — a same-id re-ask answers from the answer ring and places nothing ★", async () => {
    const v = await Vessel.boot();
    try {
      for (const [verb, id] of [[READ, "r1-read"], [WRITE, "r1-write"]] as const) {
        const first = await v.ask(verb, id, { n: 1 });
        expect(first["status"]).toBe("done");
        expect(JSON.stringify(first["results"])).toContain(`body-of-${id}`);
        const again = await v.ask(verb, id, { n: 1 });
        expect(again["status"]).toBe("done");
        expect(JSON.stringify(again["results"]), "the ring's whole answer").toContain(`body-of-${id}`);
      }
      expect(v.ran.map((p) => p.requestId)).toEqual(["r1-read", "r1-write"]);
      expect((await send(v.socketPath, { op: "receipt", requestId: "r1-read" }))["state"]).toBe("done");
    } finally { await v.teardown(); }
  });

  test("★ R2 — past the ring, a write's re-ask reads its verdict row (body released, nothing placed); a read runs again ★", async () => {
    const v = await Vessel.boot();
    try {
      expect((await v.ask(WRITE, "r2-write", { n: 2 }, "effect-r2"))["status"]).toBe("done");
      expect((await v.ask(READ, "r2-read", { n: 2 }))["status"]).toBe("done");
      expect(v.titles()).toContain(`${EFFECT_URI_PREFIX}effect-r2`);
      expect(v.titles()).toContain(`${OUTCOME_URI_PREFIX}r2-write`);
      expect(v.titles()).not.toContain(`${OUTCOME_URI_PREFIX}r2-read`);

      await v.restart();   // the ring and the book begin empty; the control document stands

      const write = await v.ask(WRITE, "r2-write", { n: 2 }, "effect-r2");
      expect(write["status"]).toBe("done");
      expect(write["results"], "the body left with the ring").toBeUndefined();
      expect((write["body"] as { released?: boolean } | undefined)?.released).toBe(true);
      expect(typeof (write["body"] as { sha256?: unknown }).sha256).toBe("string");
      const read = await v.ask(READ, "r2-read", { n: 2 });
      expect(read["status"]).toBe("done");
      expect(JSON.stringify(read["results"]), "the read ran again").toContain("body-of-r2-read");
      expect(v.ran.map((p) => p.requestId)).toEqual(["r2-write", "r2-read", "r2-read"]);
      // CONTROL: the write's row still refuses a reused id that carries other input.
      const changed = await v.ask(WRITE, "r2-write", { n: 3 }, "effect-r2");
      expect((changed["refusal"] as { reason?: string } | undefined)?.reason).toBe("request-id-reused-with-changed-input");
      expect(v.ran).toHaveLength(3);
    } finally { await v.teardown(); }
  });

  test("★ R3 — 2,000 door calls leave no receipt title in the control document ★", async () => {
    const v = await Vessel.boot();
    try {
      for (let i = 0; i < 2_000; i++) {
        // Every seventh call re-asks the id before it, as a retrying client does; every 97th cancels an id nothing holds.
        const base = i % 7 === 6 ? i - 1 : i;
        const verb = base % 5 === 0 ? WRITE : READ;
        const answer = i % 97 === 0 ? await send(v.socketPath, { op: "cancel", requestId: `r3-cancel-${i}` }) : await v.ask(verb, `r3-${base}`, { n: base });
        expect(answer["status"] ?? answer["state"], `call ${i}`).toMatch(/^(done|abandoned)$/);
      }
      expect(v.titles().filter((t) => t.startsWith(RECEIPT_TITLES))).toEqual([]);
    } finally { await v.teardown(); }
  }, 180_000);

  test("a cancel that meets nothing marks the id abandoned for this life; a restart forgets it and the id runs", async () => {
    const v = await Vessel.boot();
    try {
      expect(await send(v.socketPath, { op: "cancel", requestId: "c-1" })).toEqual({ requestId: "c-1", state: "abandoned" });
      expect(await send(v.socketPath, { op: "cancel", requestId: "c-1" })).toEqual({ requestId: "c-1", state: "abandoned" });
      const refused = await v.ask(WRITE, "c-1");
      expect((refused["refusal"] as { reason?: string } | undefined)?.reason).toBe("abandoned");
      expect(String(refused["errorMessage"])).toMatch(/already refused request c-1 before dispatch/);
      expect(v.ran).toHaveLength(0);
      await v.restart();
      expect((await v.ask(WRITE, "c-1"))["status"]).toBe("done");
      expect(v.ran).toHaveLength(1);
    } finally { await v.teardown(); }
  });

  test("a cancel that meets a running ask answers `committed`, the act runs on, and a same-id re-ask joins its wait", async () => {
    const v = await Vessel.boot();
    try {
      v.hold = true;
      const asked = v.ask(WRITE, "c-run", { n: 1 });
      for (let i = 0; i < 500 && !v.held.has("c-run"); i++) await new Promise((r) => setTimeout(r, 10));
      expect(await send(v.socketPath, { op: "cancel", requestId: "c-run" })).toEqual({ requestId: "c-run", state: "committed" });
      const joined = v.ask(WRITE, "c-run", { n: 1 });
      const changed = await v.ask(WRITE, "c-run", { n: 2 });
      expect((changed["refusal"] as { reason?: string } | undefined)?.reason).toBe("request-id-reused-with-changed-input");
      v.held.get("c-run")!();
      expect((await asked)["status"]).toBe("done");
      expect((await joined)["status"]).toBe("done");
      expect(v.ran).toHaveLength(1);
      const cancelled = await send(v.socketPath, { op: "cancel", requestId: "c-run" });
      expect(cancelled["state"]).toBe("done");
    } finally { await v.teardown(); }
  });

  test("an id nothing holds reads `unknown`, never a guessed verdict", async () => {
    const v = await Vessel.boot();
    try {
      expect(await send(v.socketPath, { op: "receipt", requestId: "never-met" })).toEqual({ requestId: "never-met", state: "unknown" });
    } finally { await v.teardown(); }
  });
});

describe("AskBook — one synchronous turn decides, one count bounds it", () => {
  test("begin books a fresh id running; the same input reads it back, another input refuses, an abandoned id refuses on state alone", () => {
    const book = new AskBook();
    expect(book.begin("a", "d1")).toEqual({ verdict: "run" });
    expect(book.begin("a", "d1")).toMatchObject({ verdict: "standing" });
    expect(book.begin("a", "d2")).toEqual({ verdict: "refuse", reason: "request-id-reused-with-changed-input" });
    book.abandon("b");
    expect(book.begin("b", "any")).toEqual({ verdict: "refuse", reason: "abandoned" });
    book.abandon("a");   // a no-op: the running ask stands
    expect(book.get("a")?.state).toBe("running");
    book.landed("a");
    expect(book.get("a")).toEqual({ state: "landed", digest: "d1" });
    // A landed ask whose answer stands nowhere runs again under its own input; another input still refuses.
    expect(book.begin("a", "d2")).toEqual({ verdict: "refuse", reason: "request-id-reused-with-changed-input" });
    expect(book.begin("a", "d1")).toEqual({ verdict: "run" });
  });

  test("an act's verdict stands for a retry; past the bound the oldest entry leaves", () => {
    const book = new AskBook(2);
    book.settle("act-1", "done", "d", "act:x");
    expect(book.begin("act-1", "d")).toMatchObject({ verdict: "standing", entry: { state: "done", action: "act:x" } });
    book.abandon("x");
    book.abandon("y");
    expect(book.get("act-1")).toBeUndefined();
    expect(book.size).toBe(2);
  });
});
