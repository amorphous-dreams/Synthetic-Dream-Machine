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
 *   L3  RED: THE FLEET MIRROR. A pet-name and a declared Handle, each sealed by its act and then carried to the
 *       face's own persona plane (`selves.carry`), reach that plane's document and nothing else: no outcome, no
 *       receipt, no digest of either name, no byte of either in the daemon's document, the working layer,
 *       ANOTHER FACE'S PLANE, the door's log or a printed line. The carry frame itself names a face and which
 *       name, and holds no name.
 *       CONTROL: the face's plane holds both names (the mirror kept its destination), `selves.read` answers
 *       them to the caller alone, and the SAME pet-name carried as a `persona-label` verb leaves an outcome that
 *       holds it and a receipt that holds the digest of its arguments.
 *   L4  THE MIRROR MOVES A PLANE NO FURTHER THAN THE SEALED ROW SAYS. A carry of a name the row does not hold
 *       refuses and leaves the plane's copy standing (a fleet-mate's name survives a vessel that never held it);
 *       a clear refuses while the row still holds the name; a clear after the row's own clear clears the plane;
 *       an index this vessel holds no root for refuses both; `fill` never replaces a name the plane holds; a
 *       vessel with no plane refuses before any row opens, and the sealed row keeps the name. L3 and L4 run over
 *       a plane whose rest seals, the composition the sealed store's step three stands.
 *   L5  RED: A PLANE WHOSE REST STANDS CLEAR TAKES NO NAME. A carry refuses by the rest's own name, the plane's
 *       own write refuses too, the plane's document holds neither name, and the sealed rows keep both.
 *       CONTROL: a clear still runs there, and removes a name an older vessel of the face left on the plane.
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
import { SEALED_ACT_NAMES, SESSION_ACTS, runSealedAct } from "../src/sealed-acts.js";
import { writePersonaSelfName } from "@lararium/tw5";
import { personaSelvesPlaneOver } from "../src/persona-selves-plane.js";
import type { PlaneRest } from "../src/sealed-acts.js";
import { generateOrLoadPersonaGroupRoot, generateOrLoadVesselIdentity, makeNodePersonaPetnameStore } from "../src/node-vessel-identity.js";
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
async function stand(door: (parsed: unknown, sock: Socket) => boolean, rest: PlaneRest) {
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
  // Two faces' persona planes beside them, in the same Repo, as the vessel's main thread holds them: h0's and h1's.
  const personaHandle = repo.create<LarDoc>(emptyLarDoc());
  const otherFaceHandle = repo.create<LarDoc>(emptyLarDoc());
  const plane = personaSelvesPlaneOver(async () => [
    { handleIndex: 0, store: async () => new AutomergeDocStore(personaHandle as never, "bags/persona-leak-test-h0") },
    { handleIndex: 1, store: async () => new AutomergeDocStore(otherFaceHandle as never, "bags/persona-leak-test-h1") },
  ], { rest });
  return {
    socketPath: claim.socketPath,
    plane,
    /** h0's plane document as a store, past the plane: what an older vessel of the face left there. */
    planeStore: () => new AutomergeDocStore(personaHandle as never, "bags/persona-leak-test-h0"),
    /** The persona plane's own document, as one text. */
    planeText: () => JSON.stringify(personaHandle.doc()),
    /** Another face's plane, as one text. */
    otherPlaneText: () => JSON.stringify(otherFaceHandle.doc()),
    /** Every tiddler of both documents, by title, as one text. */
    text: () => JSON.stringify([daemonHandle.doc(), workingHandle.doc()]),
    titles: () => [...Object.keys(daemonHandle.doc().tiddlers ?? {}), ...Object.keys(workingHandle.doc().tiddlers ?? {})],
    async down() { front.close(); await claim.release(); rmSync(dir, { recursive: true, force: true }); },
  };
}

/** The digest a receipt fact keeps for a verb's arguments (the worker's own formula). */
const digestOf = (verb: string, args: Record<string, unknown>): Promise<string> =>
  verbInputDigest({ verb, args });

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
    const v = await stand(door, "clear");
    drops.push(() => v.down());
    expect(SEALED_ACT_NAMES.length).toBeGreaterThan(10);
    const args = new Map<string, string>();
    for (const act of SEALED_ACT_NAMES) {
      const canary = `ARG-CANARY-${act}-${Math.random().toString(36).slice(2)}`;
      args.set(act, canary);
      const a = await sendLine(v.socketPath, { op: "act", act, args: { petname: canary } });
      // An act that acts as a face rides a session (`session:act`, whose receipt names the act and the face alone): the
      // custody door's own frame refuses it and runs nothing.
      if (SESSION_ACTS.has(act)) expect(a).toMatchObject({ op: "act", status: "error", refusal: { reason: "face-act-rides-a-session" } });
      else expect(a).toEqual({ op: "act", act, result: { held: answers.get(act) } });     // the caller alone holds the answer
    }
    await new Promise((r) => setTimeout(r, 150));                                          // let any late write land
    const afterActs = v.text();
    expect(v.titles().filter((t) => t.startsWith(OUTCOME_URI_PREFIX))).toEqual([]);
    expect(v.titles().filter((t) => t.startsWith(RECEIPT_FACT_URI_PREFIX))).toEqual([]);
    for (const act of SEALED_ACT_NAMES.filter((a) => !SESSION_ACTS.has(a))) {
      expect(afterActs.includes(answers.get(act)!), `the answer of ${act} rests in a document`).toBe(false);
      expect(afterActs.includes(args.get(act)!), `an argument of ${act} rests in a document`).toBe(false);
      expect(afterActs.includes(await digestOf(act, { petname: args.get(act)! })), `a digest of ${act}'s arguments rests in a document`).toBe(false);
      expect(logs.some((l) => l.includes(answers.get(act)!) || l.includes(args.get(act)!))).toBe(false);
    }
    expect(logs.filter((l) => l.endsWith(": done")).length).toBe(SEALED_ACT_NAMES.length - SESSION_ACTS.size);  // the door named each act it ran

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
      runAct: (act, a) => runSealedAct(act, a, { kelHead: null, personaSelves: null, walk: null }),
    });
    const v = await stand(door, "clear");
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

  test("L3 — the fleet mirror of a pet-name and a declared Handle reaches the face's own plane and nothing else", async () => {
    const c: SeatedScratchCustody = await seatScratchCustody("act-leak-mirror");
    drops.push(() => c.drop());
    await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
    await generateOrLoadPersonaGroupRoot(0);
    await generateOrLoadPersonaGroupRoot(1);
    const logs: string[] = [];
    let v!: Awaited<ReturnType<typeof stand>>;
    const door = custodyFrameHandler({
      holder: c.holder, testScratch: false, standing: () => "hearth", recompose: async () => ({ standing: "hearth" }),
      onLog: (line) => logs.push(line),
      runAct: (act, a) => runSealedAct(act, a, { kelHead: null, personaSelves: v.plane, walk: null }),
    });
    v = await stand(door, "sealed");
    drops.push(() => v.down());
    const printed: string[] = [];
    for (const stream of ["log", "error", "warn", "info"] as const) vi.spyOn(console, stream).mockImplementation((...a: unknown[]) => { printed.push(a.map(String).join(" ")); });
    const PETNAME = `the-quiet-compartment-${Math.random().toString(36).slice(2)}`;
    const HANDLE = `The Lindwyrm ${Math.random().toString(36).slice(2)}`;
    const carryPetname = { op: "act", act: "selves.carry", args: { handleIndex: 0, name: "petname" } };
    const carryHandle = { op: "act", act: "selves.carry", args: { handleIndex: 0, name: "handle" } };
    await sendLine(v.socketPath, { op: "act", act: "petname.set", args: { handleIndex: 0, petname: PETNAME } });
    await sendLine(v.socketPath, { op: "act", act: "declaration.set", args: { handleIndex: 0, declaration: { handle: HANDLE, seat: true, chair: "a private chair" } } });
    expect(await sendLine(v.socketPath, carryPetname)).toEqual({ op: "act", act: "selves.carry", result: { carried: true } });
    expect(await sendLine(v.socketPath, carryHandle)).toEqual({ op: "act", act: "selves.carry", result: { carried: true } });
    // The carry frame names a face and which name: no byte of either name rides it.
    expect(JSON.stringify([carryPetname, carryHandle]).includes(PETNAME)).toBe(false);
    expect(JSON.stringify([carryPetname, carryHandle]).includes(HANDLE)).toBe(false);
    const read = await sendLine(v.socketPath, { op: "act", act: "selves.read", args: {} });
    await new Promise((r) => setTimeout(r, 150));
    vi.restoreAllMocks();
    // RED: neither name, nor a digest of either as a verb's argument, rests in the daemon's document, the working
    // layer or ANOTHER FACE'S plane.
    const docs = v.text() + v.otherPlaneText();
    for (const name of [PETNAME, HANDLE]) expect(docs.includes(name), `"${name}" rests in a document outside its face's plane`).toBe(false);
    expect(docs.includes(await digestOf("persona-label", { handleIndex: 0, petname: PETNAME }))).toBe(false);
    expect(docs.includes(await digestOf("persona-handle", { handleIndex: 0, handle: HANDLE }))).toBe(false);
    expect(v.titles().filter((t) => t.startsWith(OUTCOME_URI_PREFIX) || t.startsWith(RECEIPT_FACT_URI_PREFIX))).toEqual([]);
    expect(logs).toEqual(["act petname.set: done", "act declaration.set: done", "act selves.carry: done", "act selves.carry: done", "act selves.read: done"]);
    expect(printed.join("\n").includes(PETNAME) || printed.join("\n").includes(HANDLE)).toBe(false);
    // CONTROL: the mirror kept its destination. The face's plane holds both names, the seat claim and the chair
    // label stayed off it, and the read answered its one caller.
    expect(v.planeText().includes(PETNAME)).toBe(true);
    expect(v.planeText().includes(HANDLE)).toBe(true);
    expect(v.planeText().includes("a private chair")).toBe(false);
    expect(read).toEqual({ op: "act", act: "selves.read", result: { selves: [{ handleIndex: 0, petname: PETNAME, handle: HANDLE }], rest: "sealed" } });
    // CONTROL: the same pet-name carried as the store verb leaves the outcome and the receipt digest the search hunts.
    const verbArgs = { handleIndex: 0, petname: PETNAME };
    await sendLine(v.socketPath, { verb: "persona-label", args: verbArgs, requestedBy: "did:key:leak-test", requestId: "leak-control-3" });
    await new Promise((r) => setTimeout(r, 150));
    expect(v.text().includes(PETNAME)).toBe(true);
    expect(v.text().includes(await digestOf("persona-label", verbArgs))).toBe(true);
  });

  test("L4 — the mirror moves a plane no further than the sealed row says", async () => {
    const c: SeatedScratchCustody = await seatScratchCustody("act-leak-clear");
    drops.push(() => c.drop());
    await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
    await generateOrLoadPersonaGroupRoot(0);
    await generateOrLoadPersonaGroupRoot(1);
    let v!: Awaited<ReturnType<typeof stand>>;
    let lend = true;
    const door = custodyFrameHandler({
      holder: c.holder, testScratch: false, standing: () => "hearth", recompose: async () => ({ standing: "hearth" }), onLog: () => {},
      runAct: (act, a) => runSealedAct(act, a, { kelHead: null, personaSelves: lend ? v.plane : null, walk: null }),
    });
    v = await stand(door, "sealed");
    drops.push(() => v.down());
    const act = (name: string, args: Record<string, unknown>) => sendLine(v.socketPath, { op: "act", act: name, args });
    const reason = (a: Record<string, unknown>): string => `${(a["refusal"] as { reason?: string } | undefined)?.reason}: ${String(a["errorMessage"])}`;

    // A FLEET-MATE'S NAME SURVIVES A VESSEL THAT NEVER HELD IT. Another vessel of face 1 named it on the plane; this
    // vessel's row holds no pet-name for h1, so its carry refuses and the plane's copy stands.
    await v.plane.write(1, "petname", "a-fleet-mates-name");
    expect(reason(await act("selves.carry", { handleIndex: 1, name: "petname" }))).toMatch(/^act-refused: the sealed row holds no petname for h1/);
    expect(await v.plane.read()).toEqual([{ handleIndex: 1, petname: "a-fleet-mates-name" }]);
    // FILL never replaces what the plane holds, and says so; a plain carry (a rename here) replaces it.
    await act("petname.set", { handleIndex: 1, petname: "an-old-local-name" });
    expect(await act("selves.carry", { handleIndex: 1, name: "petname", fill: true })).toEqual({ op: "act", act: "selves.carry", result: { carried: false } });
    expect(await v.plane.read()).toEqual([{ handleIndex: 1, petname: "a-fleet-mates-name" }]);
    expect(await act("selves.carry", { handleIndex: 1, name: "petname" })).toEqual({ op: "act", act: "selves.carry", result: { carried: true } });   // control
    expect(await v.plane.read()).toEqual([{ handleIndex: 1, petname: "an-old-local-name" }]);
    // A CLEAR FOLLOWS THE ROW'S OWN CLEAR, never the other way round.
    expect(reason(await act("selves.clear", { handleIndex: 1, name: "petname" }))).toMatch(/^act-refused: the sealed row still holds a petname for h1/);
    expect(await v.plane.read()).toEqual([{ handleIndex: 1, petname: "an-old-local-name" }]);
    await act("petname.clear", { handleIndex: 1 });
    expect(await act("selves.clear", { handleIndex: 1, name: "petname" })).toEqual({ op: "act", act: "selves.clear", result: { cleared: true } });
    expect(await v.plane.read()).toEqual([]);
    // AN INDEX THIS VESSEL HOLDS NO ROOT FOR moves nothing, by either act.
    expect(reason(await act("selves.carry", { handleIndex: 5, name: "petname" }))).toMatch(/^act-refused: this vessel holds no persona root at h5/);
    expect(reason(await act("selves.clear", { handleIndex: 5, name: "petname" }))).toMatch(/^act-refused: this vessel holds no persona root at h5/);
    // A name outside the two that ride refuses as a bad argument: the seat claim has no carry.
    expect(reason(await act("selves.carry", { handleIndex: 0, name: "seat" }))).toMatch(/^bad-args/);
    // NO PLANE: the carry refuses by name before any row opens, and the sealed row keeps the name.
    await act("petname.set", { handleIndex: 0, petname: "the-name-that-stays" });
    lend = false;
    expect(reason(await act("selves.carry", { handleIndex: 0, name: "petname" }))).toMatch(/^act-refused: no persona plane stands here/);
    expect((await act("selves.read", {}))["status"]).toBe("error");
    expect(await v.plane.read()).toEqual([]);
    expect(await (await makeNodePersonaPetnameStore()).get(0)).toBe("the-name-that-stays");
  });

  test("L5 — a plane whose rest stands clear takes no name: the carry refuses by name and the name stays sealed", async () => {
    const c: SeatedScratchCustody = await seatScratchCustody("act-leak-clear-rest");
    drops.push(() => c.drop());
    await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
    await generateOrLoadPersonaGroupRoot(0);
    let v!: Awaited<ReturnType<typeof stand>>;
    const door = custodyFrameHandler({
      holder: c.holder, testScratch: false, standing: () => "hearth", recompose: async () => ({ standing: "hearth" }), onLog: () => {},
      runAct: (act, a) => runSealedAct(act, a, { kelHead: null, personaSelves: v.plane, walk: null }),
    });
    v = await stand(door, "clear");
    drops.push(() => v.down());
    const act = (name: string, args: Record<string, unknown>) => sendLine(v.socketPath, { op: "act", act: name, args });
    const reason = (a: Record<string, unknown>): string => `${(a["refusal"] as { reason?: string } | undefined)?.reason}: ${String(a["errorMessage"])}`;
    const PETNAME = `a-relit-label-${Math.random().toString(36).slice(2)}`;
    const HANDLE = `A Re-lit Handle ${Math.random().toString(36).slice(2)}`;
    await act("petname.set", { handleIndex: 0, petname: PETNAME });
    await act("declaration.set", { handleIndex: 0, declaration: { handle: HANDLE } });
    // RED: each carry refuses by the rest's own name, and neither name reaches the plane's document.
    expect(reason(await act("selves.carry", { handleIndex: 0, name: "petname" }))).toMatch(/^act-refused: h0's persona plane rests in the clear/);
    expect(reason(await act("selves.carry", { handleIndex: 0, name: "handle", fill: true }))).toMatch(/^act-refused: h0's persona plane rests in the clear/);
    expect(v.planeText().includes(PETNAME) || v.planeText().includes(HANDLE)).toBe(false);
    // The plane's own write refuses a name too, whoever calls it: the rest decides, never the door alone.
    await expect(v.plane.write(0, "petname", PETNAME)).rejects.toThrow(/rests in the clear/);
    expect(v.planeText().includes(PETNAME)).toBe(false);
    // The sealed rows keep both names, and the read answers what the plane holds: nothing.
    expect(await (await makeNodePersonaPetnameStore()).get(0)).toBe(PETNAME);
    expect(await act("selves.read", {})).toEqual({ op: "act", act: "selves.read", result: { selves: [], rest: "clear" } });
    // CONTROL: a clear still runs at a clear rest, since it moves no name onto it. A name an older vessel of the
    // face left on the plane leaves it once the row's own clear landed.
    await writePersonaSelfName(v.planeStore(), 0, "petname", "a-name-an-older-vessel-left", "t1");
    expect(await v.plane.read()).toEqual([{ handleIndex: 0, petname: "a-name-an-older-vessel-left" }]);
    await act("petname.clear", { handleIndex: 0 });
    expect(await act("selves.clear", { handleIndex: 0, name: "petname" })).toEqual({ op: "act", act: "selves.clear", result: { cleared: true } });
    expect(await v.plane.read()).toEqual([]);
  });
});
