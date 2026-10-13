/**
 * sealed-act-leak — NOTHING AN ACT CARRIES OR ANSWERS REACHES THE DAEMON'S DOCUMENT.
 *
 * A store verb's output rests in the daemon's document as an outcome (`bags/daemon/outcomes/<id>`), in the clear,
 * and the digest of its arguments rests in a receipt fact. A sealed row's act rides the custody door instead. This
 * suite stands a real verb socket (the front, the verb seat, a daemon document and a working layer) with the
 * custody door ahead of the seat, exactly as the vessel's main thread composes them, and reads every tiddler of
 * both documents after the acts ran.
 *
 *   L1  RED: every act the table names, sent as an `act` frame, leaves no outcome, no receipt fact and no byte of
 *       its arguments or its answer in either document.
 *       CONTROL: the SAME name and arguments sent as a verb leave an outcome that holds the answer and a receipt
 *       fact that holds the digest of the arguments, and the search finds both.
 *   L2  RED: a real act over a founded scratch custody (a pet-name set, then read) answers its caller with the
 *       pet-name and leaves it in neither document nor in the door's log.
 *       CONTROL: the row's own reader holds the pet-name, and the same pet-name sent as a verb argument leaves
 *       its digest behind.
 */
import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConnection, type Socket } from "node:net";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import {
  emptyLarDoc, concludeVerb, verbInputDigest, RECEIPT_FACT_URI_PREFIX, OUTCOME_URI_PREFIX, DAEMON_BAG_ID, AutomergeDocStore,
  CompositeStore, wikiSlotUri, type LarDoc,
} from "@lararium/mesh";
import { custodyFrameHandler } from "../src/custody-frames.js";
import type { CustodyHolder } from "../src/custody-holder.js";
import { claimStore, type StoreClaim } from "../src/owned-store.js";
import { SEALED_ACT_NAMES, runSealedAct } from "../src/sealed-acts.js";
import { makeNodePersonaPetnameStore } from "../src/node-vessel-identity.js";
import { makeUdsSeat, serveUdsFront, type UdsFront } from "../src/uds-channel.js";
import { seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

interface Placed { verb: string; args: Record<string, unknown>; requestedBy: string; requestId: string }

function sendLine(socketPath: string, line: unknown): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const sock = createConnection(socketPath);
    let buf = "";
    sock.setEncoding("utf8");
    sock.on("connect", () => { sock.write(JSON.stringify(line) + "\n"); });
    sock.on("data", (chunk: string) => {
      buf += chunk;
      const nl = buf.indexOf("\n");
      if (nl !== -1) { const l = buf.slice(0, nl); sock.end(); resolve(JSON.parse(l) as Record<string, unknown>); }
    });
    sock.on("error", reject);
  });
}

/** A verb socket composed as the vessel's main thread composes it: the custody door ahead of the verb seat. */
async function stand(door: (parsed: unknown, sock: Socket) => boolean) {
  const repo = new Repo({ sharePolicy: async () => true });
  const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
  const workingHandle = repo.create<LarDoc>(emptyLarDoc());
  const dir = mkdtempSync(join(tmpdir(), "sealed-act-leak-"));
  const composite = new CompositeStore();
  composite.addLayer({ bagId: DAEMON_BAG_ID, store: new AutomergeDocStore(daemonHandle as never, DAEMON_BAG_ID), writable: true, defaultWritable: false });
  composite.addLayer({ bagId: wikiSlotUri("daemon", "working"), store: new AutomergeDocStore(workingHandle as never, wikiSlotUri("daemon", "working")), writable: true });
  const claim: StoreClaim & { readonly holder: "vessel" } = await claimStore(dir, { holder: "vessel" });
  const front: UdsFront = serveUdsFront({ claim, onFrame: door });
  front.attach(makeUdsSeat({
    daemonHandle, composite, claim, repo, timeoutMs: 2_000,
    // The worker lands a verb's OUTPUT in its outcome, as a store verb's reactor does.
    placeVerb: (o) => {
      const p = o as Placed;
      const outcome = concludeVerb({
        requestId: p.requestId, verb: p.verb, status: "done", requestedBy: p.requestedBy, cause: "test-worker",
        batchMode: "best-effort", results: { summary: { echoed: p.args } },
      });
      daemonHandle.change((doc) => { doc.tiddlers[outcome.tiddler.title] = outcome as unknown as LarDoc["tiddlers"][string]; });
    },
  }));
  for (let i = 0; i < 200 && !existsSync(claim.socketPath); i++) await new Promise((r) => setTimeout(r, 10));
  return {
    socketPath: claim.socketPath,
    /** Every tiddler of both documents, by title, as one text. */
    text: () => JSON.stringify([daemonHandle.doc(), workingHandle.doc()]),
    titles: () => [...Object.keys(daemonHandle.doc().tiddlers ?? {}), ...Object.keys(workingHandle.doc().tiddlers ?? {})],
    async down() { front.close(); await claim.release(); rmSync(dir, { recursive: true, force: true }); },
  };
}

/** The digest a receipt fact keeps for a verb's arguments (the worker's own formula). */
const digestOf = (verb: string, args: Record<string, unknown>): Promise<string> =>
  verbInputDigest({ verb, args, requestedBy: "did:key:leak-test" });

const unlockedHolder = { isUnlocked: () => true, openedSlot: () => "slot-1", attemptsLeft: () => 3 } as unknown as CustodyHolder;
const drops: Array<() => Promise<void>> = [];
afterEach(async () => { for (const drop of drops.splice(0).reverse()) await drop(); });

describe("an act frame and the daemon's document", () => {
  test("L1 — no act the table names leaves an outcome, a receipt or a byte of its arguments or answer; the same content as a verb leaves both", async () => {
    const logs: string[] = [];
    const answers = new Map<string, string>();
    const door = custodyFrameHandler({
      holder: unlockedHolder, testScratch: false, standing: () => "hearth", recompose: async () => ({ standing: "hearth" }),
      onLog: (line) => logs.push(line),
      // Each act answers a canary of its own, so a leak names the act it came from.
      runAct: async (act) => { const canary = `ANSWER-CANARY-${act}-${Math.random().toString(36).slice(2)}`; answers.set(act, canary); return { held: canary }; },
    });
    const v = await stand(door);
    drops.push(() => v.down());
    expect(SEALED_ACT_NAMES.length).toBeGreaterThan(10);
    const args = new Map<string, string>();
    for (const act of SEALED_ACT_NAMES) {
      const canary = `ARG-CANARY-${act}-${Math.random().toString(36).slice(2)}`;
      args.set(act, canary);
      const a = await sendLine(v.socketPath, { op: "act", act, args: { petname: canary } });
      expect(a).toEqual({ op: "act", act, result: { held: answers.get(act) } });          // the caller alone holds the answer
    }
    await new Promise((r) => setTimeout(r, 150));                                          // let any late write land
    const afterActs = v.text();
    expect(v.titles().filter((t) => t.startsWith(OUTCOME_URI_PREFIX))).toEqual([]);
    expect(v.titles().filter((t) => t.startsWith(RECEIPT_FACT_URI_PREFIX))).toEqual([]);
    for (const act of SEALED_ACT_NAMES) {
      expect(afterActs.includes(answers.get(act)!), `the answer of ${act} rests in a document`).toBe(false);
      expect(afterActs.includes(args.get(act)!), `an argument of ${act} rests in a document`).toBe(false);
      expect(afterActs.includes(await digestOf(act, { petname: args.get(act)! })), `a digest of ${act}'s arguments rests in a document`).toBe(false);
      expect(logs.some((l) => l.includes(answers.get(act)!) || l.includes(args.get(act)!))).toBe(false);
    }
    expect(logs.filter((l) => l.endsWith(": done")).length).toBe(SEALED_ACT_NAMES.length);  // the door named each act it ran

    // CONTROL: the same name and the same arguments, sent as a VERB, leave exactly the two traces the search hunts.
    const act = SEALED_ACT_NAMES[0]!;
    const verbArgs = { petname: args.get(act)! };
    const done = await sendLine(v.socketPath, { verb: act, args: verbArgs, requestedBy: "did:key:leak-test", requestId: "leak-control-1" });
    expect(done["status"]).toBe("done");
    await new Promise((r) => setTimeout(r, 150));
    const afterVerb = v.text();
    expect(v.titles().filter((t) => t.startsWith(OUTCOME_URI_PREFIX))).toEqual([`${OUTCOME_URI_PREFIX}leak-control-1`]);
    expect(afterVerb.includes(args.get(act)!)).toBe(true);                                 // the outcome holds what the verb answered
    expect(afterVerb.includes(await digestOf(act, verbArgs))).toBe(true);                 // the receipt holds the arguments' digest
  });

  test("L2 — a real act over a founded custody answers its caller and leaves its pet-name in no document and no log", async () => {
    const c: SeatedScratchCustody = await seatScratchCustody("act-leak");
    drops.push(() => c.drop());
    const logs: string[] = [];
    const door = custodyFrameHandler({
      holder: c.holder, testScratch: false, standing: () => "hearth", recompose: async () => ({ standing: "hearth" }),
      onLog: (line) => logs.push(line),
      runAct: (act, a) => runSealedAct(act, a, { kelHead: null }),
    });
    const v = await stand(door);
    drops.push(() => v.down());
    // Every line the process prints while the acts run: a row's own node function must print no sealed content.
    const printed: string[] = [];
    for (const stream of ["log", "error", "warn", "info"] as const) vi.spyOn(console, stream).mockImplementation((...a: unknown[]) => { printed.push(a.map(String).join(" ")); });
    const PETNAME = `the-quiet-compartment-${Math.random().toString(36).slice(2)}`;
    expect(await sendLine(v.socketPath, { op: "act", act: "petname.set", args: { handleIndex: 0, petname: PETNAME } })).toEqual({ op: "act", act: "petname.set", result: {} });
    const read = await sendLine(v.socketPath, { op: "act", act: "petname.entries", args: {} });
    expect(read).toEqual({ op: "act", act: "petname.entries", result: { entries: [[0, PETNAME]] } });   // the caller holds the answer
    await new Promise((r) => setTimeout(r, 150));
    expect(v.text().includes(PETNAME)).toBe(false);
    expect(v.titles().filter((t) => t.startsWith(OUTCOME_URI_PREFIX) || t.startsWith(RECEIPT_FACT_URI_PREFIX))).toEqual([]);
    expect(logs).toEqual(["act petname.set: done", "act petname.entries: done"]);
    expect(printed.join("\n").includes(PETNAME)).toBe(false);
    vi.restoreAllMocks();
    // CONTROL: the sealed row holds the pet-name, and the same pet-name as a verb argument leaves its digest.
    expect(await (await makeNodePersonaPetnameStore()).get(0)).toBe(PETNAME);
    await sendLine(v.socketPath, { verb: "petname-as-a-verb", args: { petname: PETNAME }, requestedBy: "did:key:leak-test", requestId: "leak-control-2" });
    await new Promise((r) => setTimeout(r, 150));
    expect(v.text().includes(PETNAME)).toBe(true);
  });
});
