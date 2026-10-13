/**
 * face-gate — the gate behind interfaces, proven against a dialer in the same process.
 *
 * Proven here, each beside its control:
 *   · THE WALK: knock, first flight, message two, sealed presentation, signed finish, signed verdict, session;
 *   · NOTHING BEFORE A VALID FIRST MESSAGE: a wrong knock, a foreign flight and a flight with a payload draw
 *     no byte at all;
 *   · ONE SILENCE: a stranger at a private gate, a failed finish, a shadowed presenter, a denied admit, a
 *     withdrawn key under no held admit and a replayed flight read byte-for-byte alike from the dialer's
 *     side, and the gate cuts none of them before its one deadline lapses;
 *   · THE SIX ANSWERS, at a partitioned gate: a gate that learned nothing newer accepts; a gate that holds a
 *     later frontier answers `unconfirmed` and hands over what the device lacks; a learned denial answers
 *     `withdrawn`; an unjoinable frontier answers `incomplete`; two histories answer `forked`; a named
 *     answer reaches only a presenter of an admitted face;
 *   · THE SORTER runs once, inside the gate, after the finish and before any answer, and its class never
 *     outgrows the arm that earned it;
 *   · THE ADMIT verifies through the house's own presenter-verifier against a held root, for this face and
 *     this Nexus alone;
 *   · THE PROFILE a session carries comes from its certificate, and no dialer widens it;
 *   · TWO NEXUSES on one vessel share no gate, no knock, no posture and no admit.
 */
import { describe, expect, test } from "vitest";
import { canonicalJsonBytes, hex, hexToBytes, utf8Bytes } from "../src/crypto.js";
import { learnWithdrawals, type WithdrawalMemory } from "../src/face-authority.js";
import { memoryBackedWithdrawals } from "../src/face-gate.js";
import { MIN_MESSAGE2_BYTES, NOISE_MAX_MESSAGE_BYTES } from "../src/noise-ik.js";
import { custodyRootDoor, deriveGateBundle, gateFields, gateKnock, readGateSignature, sovereignGateRoot, sovereignRoute } from "../src/gate-bundle.js";
import { GATE_FINISH_DOMAIN, GATE_PLACE_FINISH_DOMAIN } from "../src/domains.js";
import {
  GATE_FRAME, GATE_FRAME_BODY_MAX, GATE_SUBJECT_MAX_BYTES, encodeGateAnswer, gateFrame, gatePartReader, gateParts,
  gateFinishPayload, gatePlaceFinishImage, gateVerdictImage, readGateAnswer, readGatePresentation, readPlacePresentation,
} from "../src/gate-exchange.js";
import {
  AUDIENCE, GROUP, bentDial, bentPlaceDial, dial, dialPlace, memoryOf, place, presenter, replayFlight, rootOf, settle, sibling, wire, world,
  type Presenter, type World,
} from "./face-gate-fixture.js";
import { chain, history, stringLeaves, withdrawal } from "./face-proof-fixture.js";
import { genesisFrontier, withdrawalHead, type FaceWithdrawal } from "../src/face-proof-subjects.js";

/** What a dialer's side reads of one socket: each frame's length, in order, and whether the gate cut it. */
const heard = (log: { toDialer: Uint8Array[]; cuts: number }): { frames: number[]; cuts: number } => ({ frames: log.toDialer.map((frame) => frame.length), cuts: log.cuts });
/** The transcript every silent refusal past the first flight draws: message two, empty, and one cut. */
const ONE_SILENCE = { frames: [MIN_MESSAGE2_BYTES], cuts: 1 };
/** The transcript a refusal before the first flight decrypts draws: nothing, and one cut. */
const NO_BYTE = { frames: [], cuts: 1 };

function learned(memory: WithdrawalMemory, events: unknown): WithdrawalMemory {
  const next = learnWithdrawals(memory, events);
  if (!("memory" in next)) throw new Error(next.refusal);
  return next.memory;
}

/** A face with two vessels, and a history that withdraws the second. */
async function withdrawnPair(w: World, label: string): Promise<{ honest: Presenter; gone: Presenter; events: FaceWithdrawal[] }> {
  const honest = await presenter(w, label);
  const gone = await sibling(honest, `${label} gone`);
  const events = await history(honest.chain, [gone.vessel.key]);
  return { honest, gone, events };
}

describe("the walk: one face proven at one gate", () => {
  test("CONTROL: an admitted face dials, the gate answers a signed verdict after the finish, and a session attaches", async () => {
    const w = await world();
    const p = await presenter(w, "walk");
    const run = await dial(w, p);
    expect(run.outcome.state).toBe("verified");
    expect(run.gate).toEqual({ outcome: "attached", class: "contracted" });
    expect(run.log.cuts).toBe(0);
    expect(run.log.closes).toBe(0);                                       // a verified dial keeps its socket
    expect(w.deadlines.drawn).toBe(1);
    expect(w.deadlines.cancelled).toBe(1);
    // The order on the wire: message two, then the dialer's sealed frames, then the gate's answer and its signature.
    expect(run.log.order[0]).toBe(`gate:${MIN_MESSAGE2_BYTES}`);
    expect(run.log.order.filter((step) => step.startsWith("gate:")).length).toBe(3);
    const sides = run.log.order.map((step) => step.slice(0, 4));
    expect(sides.indexOf("gate", 1)).toBeGreaterThan(sides.lastIndexOf("dial"));
    expect(sides.lastIndexOf("dial")).toBeGreaterThan(0);                 // the dialer did send: the order above compares two real places
    // The collaborators, in the order the gate asked them: the sorter after the shadow ring, before the session.
    expect(w.asked).toEqual(["admit", "shadow", "grant", "sort", "attach", "open"]);
    // The table took the session before any verdict left: only message two had crossed.
    expect(w.sentAtAttach).toEqual([1]);
    // The session the gate attached, and the channel both ends now hold.
    const [{ session }] = w.attached as [typeof w.attached[number]];
    expect(session.scope).toEqual(p.scope);
    expect(session.sessionKey).toBe(p.signer.certificate.sessionKey);
    expect(session.class).toBe("contracted");
    expect(session.standing).toEqual({ nym: p.scope.faceKey, aid: w.nexus });
    if (run.outcome.state !== "verified") throw new Error("unreachable");
    const sealed = run.outcome.transport.send.seal(utf8Bytes("the first application frame"));
    expect(new TextDecoder().decode(session.transport.receive.open(sealed))).toBe("the first application frame");
  });

  test("the session a gate attaches holds no vessel's key, and no key crosses in the clear", async () => {
    const w = await world();
    const p = await presenter(w, "clear");
    const run = await dial(w, p);
    expect(run.outcome.state).toBe("verified");
    expect(stringLeaves(w.attached[0]!.session.scope)).not.toContain(p.vessel.key);
    expect(JSON.stringify({ ...w.attached[0]!.session, transport: null })).not.toContain(p.vessel.key);
    // Every byte an observer reads: the flight, message two, and the sealed frames both ways.
    const clear = [run.log.flight!.message1, ...run.log.toDialer, ...run.log.toGate].map((frame) => hex(frame)).join("|") + utf8Bytes(run.log.flight!.knock).toString();
    for (const secret of [p.scope.faceKey, p.vessel.key, p.signer.certificate.sessionKey, hex(utf8Bytes(p.scope.faceKey)), hex(utf8Bytes(w.nexus))]) {
      expect(clear).not.toContain(secret);
    }
    // CONTROL: the presentation the dialer sealed does name all three keys; the scan above would have found them bare.
    const presentation = hex(canonicalJsonBytes({ certificate: p.certificate, sessionCertificate: p.signer.certificate }));
    for (const key of [p.scope.faceKey, p.vessel.key, p.signer.certificate.sessionKey]) expect(presentation).toContain(hex(utf8Bytes(key)));
  });

  test("RED: the verdict a dialer believes stands under the pinned signing key, for its own handshake", async () => {
    const w = await world();
    const other = await world({ nexus: "nexus-b.synthetic" });
    const bytes = encodeGateAnswer({ state: "verified" });
    const hash = new Uint8Array(32).fill(5);
    const image = gateVerdictImage({ handshakeHash: hash, bundleDigest: w.bundle.digest, answer: bytes });
    const signature = await w.bundle.sign(image);
    expect(readGateSignature(w.pin, image, signature)).toBe(true);                                             // CONTROL
    expect(readGateSignature(w.pin, gateVerdictImage({ handshakeHash: new Uint8Array(32).fill(6), bundleDigest: w.bundle.digest, answer: bytes }), signature)).toBe(false);
    expect(readGateSignature(w.pin, gateVerdictImage({ handshakeHash: hash, bundleDigest: other.bundle.digest, answer: bytes }), signature)).toBe(false);
    expect(readGateSignature(w.pin, gateVerdictImage({ handshakeHash: hash, bundleDigest: w.bundle.digest, answer: encodeGateAnswer({ state: "incomplete", frontier: genesisFrontier((await presenter(w, "v")).scope) }) }), signature)).toBe(false);
    expect(readGateSignature(other.pin, image, signature)).toBe(false);
  });

  test("RED: a dialer pinned to one vessel's gate hears nothing from another vessel's gate for the same Nexus and route", async () => {
    const w = await world();
    const impostor = await world({ root: rootOf("another vessel") });
    const p = await presenter(w, "impostor");
    // The dialer pins `w`; the socket reaches a gate that holds another root's bundle for the same Nexus and route.
    const { dial: socket, accepted, log } = wire();
    const { dialFaceGate } = await import("../src/face-dial.js");
    const outcome = dialFaceGate({ pin: w.pin, tier: "sovereign", socket, audience: AUDIENCE, certificate: p.certificate, signer: p.signer, arm: p.arm, history: p.history, deadlines: { draw: () => ({ cancel() {} }) } });
    const gate = await impostor.gate.accept({ ...(await accepted), flight: { knock: impostor.bundle.knock, message1: log.flight!.message1 } });
    impostor.deadlines.fire();
    expect(gate.outcome).toBe("silence");
    expect(await outcome).toEqual({ state: "silence" });
    expect(heard(log)).toEqual(NO_BYTE);
  });
});

describe("a dialer believes the pinned gate alone", () => {
  test("RED: a gate that answers the flight and signs its verdict under another key reads as silence", async () => {
    const elsewhere = await world({ nexus: "nexus-b.synthetic" });
    // This gate holds the pinned transport key and signs with a key the pin never named.
    const w = await world({ gateBundle: (derived) => ({ pin: derived.pin, digest: derived.digest, knock: derived.knock, respond: derived.respond, drop: derived.drop, dropped: false, sign: elsewhere.bundle.sign }) });
    const p = await presenter(w, "another signer");
    const run = await dial(w, p);
    expect(run.gate).toEqual({ outcome: "attached", class: "contracted" });      // the setup took: the gate ran its whole exchange
    expect(run.log.toDialer.length).toBe(3);
    expect(run.outcome).toEqual({ state: "silence" });
    const honest = await world();
    expect((await dial(honest, await presenter(honest, "another signer control"))).outcome.state).toBe("verified");   // CONTROL
  });
});

describe("nothing leaves the gate before a valid first message", () => {
  test("RED: a wrong knock, a flight written to another gate, garbage and a flight that carries a payload draw no byte", async () => {
    const w = await world();
    const elsewhere = await world({ nexus: "nexus-b.synthetic" });
    const p = await presenter(w, "first-flight");
    const cases: Array<[string, Parameters<typeof bentDial>[2]]> = [
      ["a wrong knock",                       { knock: "0".repeat(32) }],
      ["another Nexus's knock",               { knock: elsewhere.bundle.knock }],
      ["a flight written to another gate",    { pin: elsewhere.pin, knock: w.bundle.knock }],
      ["a flight that carries a payload",     { payload: utf8Bytes("an early act") }],
    ];
    for (const [name, bend] of cases) {
      const before = w.asked.length;
      const run = await bentDial(w, p, bend);
      expect(run.gate.outcome, name).toBe("silence");
      expect(heard(run.log), name).toEqual(NO_BYTE);
      expect(run.cutsBeforeLapse, name).toBe(0);
      expect(w.asked.length, name).toBe(before);                 // no collaborator heard of it
    }
    const garbage = await replayFlight(w, { knock: w.bundle.knock, message1: new Uint8Array(96).fill(9) });
    expect(heard(garbage.log)).toEqual(NO_BYTE);
    // CONTROL: the same presenter, unbent, draws message two and a verdict.
    expect((await dial(w, p)).outcome.state).toBe("verified");
  });

  test("RED: past its bound of pending sockets a gate reads no flight at all", async () => {
    const w = await world({ maxPending: 1 });
    const p = await presenter(w, "pending");
    const first = wire(), second = wire();
    const { dialFaceGate } = await import("../src/face-dial.js");
    void dialFaceGate({ pin: w.pin, tier: "sovereign", socket: second.dial, audience: AUDIENCE, certificate: p.certificate, signer: p.signer, arm: p.arm, history: p.history, deadlines: { draw: () => ({ cancel() {} }) } });
    // The first socket sends a flight and nothing after it, so it stands pending.
    const stalled = bentDial(w, p, { stopAfterMessage2: true });
    while (w.gate.pending < 1) await settle(1);
    expect(w.gate.pending).toBe(1);
    const refused = await w.gate.accept(await second.accepted);
    expect(refused).toEqual({ outcome: "silence", reason: "too many pending sockets" });
    expect(second.log.toDialer).toEqual([]);
    void first;
    await stalled;
    expect(w.gate.pending).toBe(0);
  });

  test("RED: one socket carries one first flight: a second run on it sends no second message two", async () => {
    const w = await world();
    const p = await presenter(w, "one flight");
    const { dial: socket, accepted, log } = wire();
    const { dialFaceGate } = await import("../src/face-dial.js");
    const outcome = dialFaceGate({ pin: w.pin, tier: "sovereign", socket, audience: AUDIENCE, certificate: p.certificate, signer: p.signer, arm: p.arm, history: p.history, deadlines: { draw: () => ({ cancel() {} }) } });
    const gateSocket = await accepted;
    const first = w.gate.accept(gateSocket);
    expect(await w.gate.accept(gateSocket)).toEqual({ outcome: "silence", reason: "the socket already carried its one flight" });
    expect(await first).toEqual({ outcome: "attached", class: "contracted" });                 // CONTROL: the first run stood untouched
    expect((await outcome).state).toBe("verified");
    expect(log.toDialer.filter((frame) => frame.length === MIN_MESSAGE2_BYTES).length).toBe(1);
    // The second run drew no deadline: nothing stands that could cut the socket the first run attached.
    expect(w.deadlines.drawn).toBe(1);
    expect(await w.gate.accept(gateSocket)).toMatchObject({ outcome: "silence" });
    w.deadlines.fire();
    expect(log.cuts).toBe(0);
  });

  test("RED: a session the table cannot open gets abandoned and its socket cut, since no deadline stands over it", async () => {
    const w = await world();
    const p = await presenter(w, "no open");
    const cut: string[] = [];
    const run = (async () => {
      const { dial: socket, accepted, log } = wire();
      const { dialFaceGate } = await import("../src/face-dial.js");
      void dialFaceGate({ pin: w.pin, tier: "sovereign", socket, audience: AUDIENCE, certificate: p.certificate, signer: p.signer, arm: p.arm, history: p.history, deadlines: { draw: () => ({ cancel() {} }) } });
      const gateSocket = await accepted;
      const outcome = await w.gate.accept(gateSocket);
      cut.push(`cuts:${log.cuts}`);
      return outcome;
    });
    w.seatFault = new Error("the door stuck");
    expect(await run()).toEqual({ outcome: "silence", reason: "the session could not open: the door stuck" });
    expect(cut).toEqual(["cuts:1"]);
    expect(w.asked.slice(-3)).toEqual(["attach", "open", "abandon"]);
    expect(w.attached).toEqual([]);
    expect(w.gate.pending).toBe(0);
    w.seatFault = null;
    expect(await run()).toEqual({ outcome: "attached", class: "contracted" });                 // CONTROL
  });
});

describe("one silence: every refusal past the first flight reads alike, up to the one deadline", () => {
  test("RED: a stranger, a failed finish, a shadowed presenter, a denied admit, a withdrawn key and a replay draw one transcript", async () => {
    const w = await world({ posture: "private" });
    const p = await presenter(w, "silence");
    const transcripts: Record<string, { frames: number[]; cuts: number }> = {};
    const reasons: Record<string, string> = {};
    const note = (name: string, run: { gate: { outcome: string; reason?: string }; log: { toDialer: Uint8Array[]; cuts: number }; cutsBeforeLapse: number; pendingBeforeLapse: number }): void => {
      expect(run.gate.outcome, name).toBe("silence");
      expect(run.cutsBeforeLapse, `${name}: the gate cut before its deadline`).toBe(0);
      // Each refused socket holds its place until the deadline, however early its run ended.
      expect(run.pendingBeforeLapse, `${name}: the socket left its place before the deadline`).toBe(1);
      expect(w.gate.pending, name).toBe(0);
      transcripts[name] = heard(run.log);
      reasons[name] = (run.gate as { reason: string }).reason;
    };

    // A stranger at a private gate: a sound chain and a sound finish, and no arm.
    note("a stranger at a private gate", await bentDial(w, p, {}, { arm: null }));
    // A failed proof: one decoded byte of the finish signature moved.
    note("a failed finish", await bentDial(w, p, { finish: (signature) => { const moved = Uint8Array.from(signature); moved[10]! ^= 1; expect(hex(moved)).not.toBe(hex(signature)); return moved; } }));
    // A shadowed presenter: an admitted face, a sound finish, and a standing shadow.
    w.aside.add(p.scope.faceKey);
    note("a shadowed presenter", await bentDial(w, p));
    w.aside.clear();
    // A denied admit: a counted revoke descends from it on the board this vessel holds.
    const { carriageEntryActCid } = await import("../src/carriage-registry.js");
    const revoke = await w.revokeFor(p.chain.face, [carriageEntryActCid(p.admit)]);
    const held = w.held!;
    w.held = { ...held, denyBoard: [revoke] };
    note("a denied admit", await bentDial(w, p));
    w.held = held;
    // A withdrawn key under no held admit: the history denies the vessel, and the presenter carries no arm.
    const denial = await history(p.chain, [p.vessel.key]);
    note("a withdrawn key under no held admit", await bentDial(w, p, {}, { arm: null, carry: denial }));
    // A finish signed over another handshake: a recorded finish holds no hash of this dial.
    note("a finish over another handshake", await bentDial(w, p, { finishOver: { handshakeHash: new Uint8Array(32).fill(3) } }));
    note("a finish over another audience", await bentDial(w, p, { finishOver: { audience: "lar:///another" } }));
    note("a finish over another gate's bundle", await bentDial(w, p, { finishOver: { bundleDigest: "ab".repeat(32) } }));
    note("a presentation moved after the finish", await bentDial(w, p, { bytesAfterFinish: (bytes) => { const moved = presentationWithAnotherFrontier(bytes); expect(hex(moved)).not.toBe(hex(bytes)); return moved; } }));
    note("a presentation and no finish", await bentDial(w, p, { noFinish: true }));
    note("a sorter that faults", await (async () => { w.sorterAnswer = () => { throw new Error("boom"); }; const run = await bentDial(w, p); w.sorterAnswer = null; return run; })());
    // A session table that refuses the session: no verdict leaves for a session nothing installed.
    note("a session table that refuses", await (async () => { w.tableFault = new Error("no seat"); const run = await bentDial(w, p); w.tableFault = null; return run; })());
    // A place whose carriage contract a counted `uncarry` closed: a sound finish under its own key, and no standing.
    const carrier = await place(w, "silence carrier");
    w.held = { ...w.held!, denyBoard: [await w.uncarryFor(carrier.seed, [carriageEntryActCid(carrier.contract)])] };
    note("a place whose contract a quorum closed", await bentPlaceDial(w, carrier));
    w.held = held;
    // A replayed first flight: the recorded bytes, and nothing after them.
    const honest = await dial(w, p);
    expect(honest.outcome.state).toBe("verified");                                           // CONTROL: the same flight, live, attached
    note("a replayed first flight", await replayFlight(w, honest.log.flight!));

    for (const [name, transcript] of Object.entries(transcripts)) expect(transcript, name).toEqual(ONE_SILENCE);
    // The causes differ on the vessel's own log and nowhere else: each case refused for the reason it names.
    expect(reasons).toEqual({
      "a stranger at a private gate":            "sorted to silence",
      "a failed finish":                         "the finish refuses: signature-refused",
      "a shadowed presenter":                    "a standing shadow sets the presenter aside",
      "a denied admit":                          "the admit reads denied: revoke-descends-from-admit",
      "a withdrawn key under no held admit":     "the chain reads withdrawn under no held admit",
      "a finish over another handshake":         "the finish refuses: signature-refused",
      "a finish over another audience":          "the finish refuses: signature-refused",
      "a finish over another gate's bundle":     "the finish refuses: signature-refused",
      "a presentation moved after the finish":   "the finish refuses: signature-refused",
      "a presentation and no finish":            "no signed finish",
      "a sorter that faults":                    "a fault: boom",
      "a session table that refuses":            "a fault: no seat",
      "a place whose contract a quorum closed":  "the contract reads denied: uncarry-descends-from-contract",
      "a replayed first flight":                 "no presentation",
    });
  });

  test("RED: a deadline that lapses while the gate still checks cuts once, and nothing leaves after it", async () => {
    const w = await world();
    const { honest, gone, events } = await withdrawnPair(w, "lapse");
    honest.history = memoryOf(honest.scope, events);
    expect((await dial(w, honest)).gate.outcome).toBe("attached");                             // CONTROL, and the gate learns the denial
    // The deadline lapses inside the sorter: the last collaborator before any answer.
    w.sorterAnswer = (input) => { w.deadlines.fire(); return { class: "contracted", standing: { nym: input.scope!.faceKey, aid: input.scope!.nexus } }; };
    const attached = w.attached.length;
    const verified = await dial(w, honest);
    expect(verified.gate).toEqual({ outcome: "silence", reason: "the deadline lapsed before the verdict" });
    expect(heard(verified.log)).toEqual(ONE_SILENCE);
    expect(verified.outcome).toEqual({ state: "silence" });
    const named = await dial(w, gone);                                                         // a withdrawn key: a named answer stood ready
    expect(named.gate).toEqual({ outcome: "silence", reason: "the deadline lapsed before the answer" });
    expect(heard(named.log)).toEqual(ONE_SILENCE);
    expect(w.attached.length).toBe(attached);
  });

  test("RED: a dial draws its own deadline: a gate that answers a flight and then waits forever holds no dial open", async () => {
    const w = await world({ posture: "private" });
    const p = await presenter(w, "patience");
    const { dial: socket, accepted, log } = wire();
    const patience = (await import("./face-gate-fixture.js")).handDeadlines();
    const { dialFaceGate } = await import("../src/face-dial.js");
    let ended: string | null = null;
    const outcome = dialFaceGate({ pin: w.pin, tier: "sovereign", socket, audience: AUDIENCE, certificate: p.certificate, signer: p.signer, arm: null, history: p.history, deadlines: patience }).then((result) => { ended = result.state; return result; });
    // The gate refuses the stranger and stays quiet; nobody fires ITS deadline, so it never cuts.
    expect(await w.gate.accept(await accepted)).toEqual({ outcome: "silence", reason: "sorted to silence" });
    await settle();
    expect(ended).toBeNull();                                                                  // the dial still waits
    expect(patience.standing).toBe(1);
    patience.fire();
    expect(await outcome).toEqual({ state: "silence" });
    expect(log.closes).toBeGreaterThanOrEqual(1);
    expect(log.cuts).toBe(0);
    // A socket whose own promises never settle holds no dial open either: the lapse answers by itself.
    const stuck = (await import("./face-gate-fixture.js")).handDeadlines();
    let closed = 0;
    const never = dialFaceGate({
      pin: w.pin, tier: "sovereign", audience: AUDIENCE, certificate: p.certificate, signer: p.signer, arm: null, history: p.history, deadlines: stuck,
      socket: { open: () => new Promise<void>(() => {}), send() {}, recv: () => new Promise<Uint8Array | null>(() => {}), close() { closed++; } },
    });
    await settle();
    stuck.fire();
    expect(await never).toEqual({ state: "silence" });
    expect(closed).toBeGreaterThanOrEqual(1);
    // CONTROL: a dial the gate answers stands its own deadline down.
    const answered = (await import("./face-gate-fixture.js")).handDeadlines();
    w.posture = "open";
    expect((await dial(w, p, { deadlines: answered })).outcome.state).toBe("verified");
    expect(answered.cancelled).toBe(1);
  });

  test("a replayed first flight buys message two and nothing else: no collaborator hears of it, and nothing attaches", async () => {
    const w = await world();
    const p = await presenter(w, "replay");
    const honest = await dial(w, p);
    const asked = w.asked.length, attached = w.attached.length;
    const replay = await replayFlight(w, honest.log.flight!);
    expect(heard(replay.log)).toEqual(ONE_SILENCE);
    expect(w.asked.length).toBe(asked);
    expect(w.attached.length).toBe(attached);
    // The replayer holds the honest dial's sealed frames too, and they open nothing under the new exchange.
    const { dial: socket, accepted, log } = wire();
    void socket.open(honest.log.flight!);
    const accepting = w.gate.accept(await accepted);
    for (const frame of honest.log.toGate) socket.send(frame);
    const gate = await accepting;
    w.deadlines.fire();
    expect(gate.outcome).toBe("silence");
    expect(heard(log)).toEqual(ONE_SILENCE);
    expect(w.attached.length).toBe(attached);
  });
});

/** The same presentation under another frontier head, re-encoded: a decoded field moved, the encoding with it.
 *  Every check a gate runs before the finish still passes over it, so the finish alone refuses it. */
function presentationWithAnotherFrontier(bytes: Uint8Array): Uint8Array {
  const value = JSON.parse(new TextDecoder().decode(bytes)) as { frontier: { position: number; head: string } };
  const head = hexToBytes(value.frontier.head);
  head[0]! ^= 1;
  return canonicalJsonBytes({ ...value, frontier: { ...value.frontier, head: hex(head) } });
}

describe("what a gate checks before it answers", () => {
  test("RED: another audience, another Nexus's chain and an arm under another key each draw silence", async () => {
    const w = await world({ posture: "open" });
    const p = await presenter(w, "checks");
    const elsewhere = await chain("checks elsewhere", "nexus-b.synthetic");
    const stranger = await presenter(w, "checks stranger");
    const runs = {
      audience: await bentDial(w, p, {}, { audience: "lar:///ha.ka.ba/bags/other" }),
      nexus: await bentDial(w, p, { presentation: (honest) => ({ ...honest, certificate: elsewhere.certificate, sessionCertificate: elsewhere.sessionCertificate }) }),
      arm: await bentDial(w, p, {}, { arm: stranger.arm }),
      extra: await bentDial(w, p, { presentation: (honest) => ({ ...honest, contactCard: "a card" }) }),
      // One vessel's certificate beside a session certificate another vessel of the face signed: each verifies alone.
      chains: await bentDial(w, await sibling(p, "checks sibling"), { presentation: (honest) => ({ ...honest, certificate: p.certificate }) }),
    };
    for (const [name, run] of Object.entries(runs)) {
      expect(run.gate.outcome, name).toBe("silence");
      expect(heard(run.log), name).toEqual(ONE_SILENCE);
    }
    // A walker's arm for another Nexus names the face key and still earns nothing here.
    const grantElsewhere = { nexusAid: "nexus-b.synthetic", leaf: p.scope.faceKey, epoch: "ab".repeat(32), lineage: "cd".repeat(32), survived: 0, from: "host" as const, tag: "ef".repeat(64) };
    const astray = await bentDial(w, p, {}, { arm: { kind: "grant", grant: grantElsewhere } });
    expect(astray.gate).toEqual({ outcome: "silence", reason: "the arm names another Nexus" });
    expect((runs.audience.gate as { reason: string }).reason).toBe("the dial names another audience");
    expect((runs.nexus.gate as { reason: string }).reason).toBe("the chain names another Nexus");
    expect((runs.chains.gate as { reason: string }).reason).toBe("the session certificate stands under another chain");
    expect((runs.arm.gate as { reason: string }).reason).toBe("the arm stands under another key");
    expect((runs.extra.gate as { reason: string }).reason).toBe("the presentation reads as none");
    expect(w.attached).toEqual([]);
    expect((await dial(w, p)).outcome.state).toBe("verified");                                 // CONTROL
    expect((await dial(w, p, { arm: { kind: "grant", grant: { ...grantElsewhere, nexusAid: w.nexus } } })).gate).toEqual({ outcome: "attached", class: "walker" });   // CONTROL
  });

  test("RED: an admit verifies against a root this vessel holds, and refuses by name where it holds none", async () => {
    const w = await world();
    const p = await presenter(w, "held-root");
    expect((await dial(w, p)).gate).toEqual({ outcome: "attached", class: "contracted" });    // CONTROL
    const held = w.held!;
    w.held = null;
    const rootless = await dial(w, p);
    expect(rootless.gate).toEqual({ outcome: "silence", reason: "the admit refuses: no-held-root" });
    expect(rootless.outcome).toEqual({ state: "silence" });
    // A root this vessel holds for another Nexus reads no admit for this gate.
    w.held = { ...held, nexus: "nexus-b.synthetic" };
    expect((await dial(w, p)).gate).toEqual({ outcome: "silence", reason: "the admit stands in another Nexus" });
    // An admit another quorum signed, for the same face key, counts under no roster this vessel holds.
    w.held = held;
    const other = await world({ nexus: "nexus-b.synthetic" });
    const foreign = await other.admitFor(p.chain.face);
    const run = await bentDial(w, p, {}, { arm: { kind: "admit", admit: foreign, lineage: [] } });
    expect(run.gate.outcome).toBe("silence");
    expect((run.gate as { reason: string }).reason).toMatch(/^the admit reads (rejected|wrong-epoch)/);
  });

  test("RED: the profile a session carries comes from its certificate, and a widened one fails its signature", async () => {
    const w = await world();
    const seat = await presenter(w, "seat", "seat");
    expect((await dial(w, seat)).outcome.state).toBe("verified");
    expect(w.attached[0]!.session.profile).toBe("seat");
    expect(w.sorted[0]!.profile).toBe("seat");
    const widened = await bentDial(w, seat, { presentation: (honest) => ({ ...honest, sessionCertificate: { ...honest.sessionCertificate, profile: "face" } }) });
    expect(widened.gate.outcome).toBe("silence");
    expect((widened.gate as { reason: string }).reason).toMatch(/^the session certificate refuses: signature-refused/);
    expect(w.attached.length).toBe(1);
  });
});

describe("the sorter: once, inside the gate, before any answer", () => {
  test("the four classes, and silence at a private gate", async () => {
    const w = await world({ posture: "open" });
    const fleet = await presenter(w, "class fleet");
    w.grants.set(fleet.scope.faceKey, { personaGroup: GROUP, faceKey: fleet.scope.faceKey, nexus: w.nexus, revision: "group-heads-1" });
    const contracted = await presenter(w, "class contracted");
    const walker = await presenter(w, "class walker");
    const grant = { nexusAid: w.nexus, leaf: walker.scope.faceKey, epoch: "ab".repeat(32), lineage: "cd".repeat(32), survived: 0, from: "host" as const, tag: "ef".repeat(64) };
    expect((await dial(w, fleet)).gate).toEqual({ outcome: "attached", class: "same-operator" });
    expect((await dial(w, contracted)).gate).toEqual({ outcome: "attached", class: "contracted" });
    expect((await dial(w, walker, { arm: { kind: "grant", grant } })).gate).toEqual({ outcome: "attached", class: "walker" });
    // Whether a grant or a claim HOLDS stays the sorter's own reading (its hosting store, its epochs, its burn):
    // the gate binds the arm to the face key and the Nexus, and a sorter that reads no walker in it draws silence.
    w.sorterAnswer = (input) => (input.arm?.kind === "grant" ? null : { class: "stranger" });
    expect((await dial(w, walker, { arm: { kind: "grant", grant } })).gate).toEqual({ outcome: "silence", reason: "sorted to silence" });
    w.sorterAnswer = null;
    expect((await dial(w, contracted, { arm: null })).gate).toEqual({ outcome: "attached", class: "stranger" });
    w.posture = "private";
    expect((await dial(w, contracted, { arm: null })).gate).toEqual({ outcome: "silence", reason: "sorted to silence" });
    expect((await dial(w, contracted)).gate).toEqual({ outcome: "attached", class: "contracted" });   // an admitted face still crosses
  });

  test("RED: the sorter runs exactly once per answered dial, never before the finish holds, and never twice", async () => {
    const w = await world();
    const p = await presenter(w, "once");
    await bentDial(w, p, { finish: (signature) => { const moved = Uint8Array.from(signature); moved[0]! ^= 1; return moved; } });
    await bentDial(w, p, { noFinish: true });
    await bentDial(w, p, { stopAfterMessage2: true });
    expect(w.asked).toEqual([]);                                  // no collaborator at all before a finish verifies
    await dial(w, p);
    expect(w.asked.filter((step) => step === "sort").length).toBe(1);
    expect(w.asked.indexOf("sort")).toBeGreaterThan(-1);
    expect(w.asked.indexOf("sort")).toBeLessThan(w.asked.indexOf("attach"));
    // A named answer other than `verified` also waits on the sorter.
    const { honest, gone, events } = await withdrawnPair(w, "once named");
    honest.history = memoryOf(honest.scope, events);
    await dial(w, honest);
    w.asked.length = 0;
    const run = await dial(w, gone);
    expect(run.outcome.state).toBe("withdrawn");
    expect(w.asked).toEqual(["admit", "shadow", "grant", "sort"]);
  });

  test("RED: a class the arm never earned, and same-operator over no grant or over a device set aside, draw silence", async () => {
    const w = await world({ posture: "open" });
    const p = await presenter(w, "narrow");
    w.sorterAnswer = () => ({ class: "contracted" });
    expect((await dial(w, p, { arm: null })).gate.outcome).toBe("silence");             // no arm earns contracted
    w.sorterAnswer = () => ({ class: "stranger" });
    expect((await dial(w, p)).gate.outcome).toBe("silence");                            // an admit never sorts down to a stranger
    w.sorterAnswer = () => ({ class: "same-operator" });
    expect((await dial(w, p)).gate).toMatchObject({ outcome: "silence", reason: expect.stringContaining("same-operator over no private grant") });
    w.grants.set(p.scope.faceKey, { personaGroup: GROUP, faceKey: p.scope.faceKey, nexus: w.nexus, revision: "g" });
    expect((await dial(w, p)).gate).toEqual({ outcome: "attached", class: "same-operator" });   // CONTROL: the grant earns it
    w.fleetAside.add(p.vessel.key);
    expect((await dial(w, p)).gate.outcome).toBe("silence");                            // a device set aside never sorts same-operator
    // A grant the ring holds for another face or another Nexus earns nothing.
    w.fleetAside.clear();
    w.grants.set(p.scope.faceKey, { personaGroup: GROUP, faceKey: p.scope.faceKey, nexus: "nexus-b.synthetic", revision: "g" });
    expect((await dial(w, p)).gate.outcome).toBe("silence");
    expect(w.attached.length).toBe(1);
  });

  test("at the floor every fleet lane stays shut: a device of this vessel's own fleet sorts by what else it proves", async () => {
    const w = await world();
    const p = await presenter(w, "floor");
    w.grants.set(p.scope.faceKey, { personaGroup: GROUP, faceKey: p.scope.faceKey, nexus: w.nexus, revision: "g" });
    expect((await dial(w, p)).gate).toEqual({ outcome: "attached", class: "same-operator" });   // CONTROL: a raised vessel reads its fleet
    w.fleetReadable = false;
    expect((await dial(w, p)).gate).toEqual({ outcome: "attached", class: "contracted" });
    expect(w.sorted.at(-1)!.fleetAside).toBe(true);
  });
});

describe("the six answers, at a partitioned gate", () => {
  test("a gate that learned nothing newer accepts a withdrawn vessel, until an honest vessel of the face dials it", async () => {
    const w = await world();
    const { honest, gone, events } = await withdrawnPair(w, "partition");
    // The withdrawn vessel shows the frontier it held before its removal, and carries nothing.
    expect((await dial(w, gone)).gate).toEqual({ outcome: "attached", class: "contracted" });   // the named leak, as the law states it
    // The first honest vessel carries the history. The gate learns it.
    honest.history = memoryOf(honest.scope, events);
    expect((await dial(w, honest)).gate).toEqual({ outcome: "attached", class: "contracted" });
    expect((await w.withdrawals.read(honest.scope))!.frontier.position).toBe(1);
    // The withdrawn vessel dials again, under the same old frontier: the denial names its key whatever it claims.
    const again = await dial(w, gone);
    expect(again.gate).toEqual({ outcome: "answered", state: "withdrawn" });
    expect(again.outcome.state).toBe("withdrawn");
    expect(again.log.closes).toBe(1);                                     // a dial that attached nothing closes its socket
    if (again.outcome.state !== "withdrawn") throw new Error("unreachable");
    expect(again.outcome.events).toEqual(events);
    expect(w.attached.length).toBe(2);
    // The vessel folds what the gate handed over, and reads its own key withdrawn.
    const { readOwnStanding } = await import("../src/face-authority.js");
    expect(readOwnStanding(learned(gone.history, again.outcome.events), gone.vessel.key as never)).toBe("withdrawn");
  });

  test("a gate that holds a later frontier answers `unconfirmed` and hands over what the device lacks", async () => {
    const w = await world();
    const honest = await presenter(w, "behind");
    const quiet = await sibling(honest, "behind quiet");
    const first = await sibling(honest, "behind first"), second = await sibling(honest, "behind second");
    const events = await history(honest.chain, [first.vessel.key, second.vessel.key]);
    honest.history = memoryOf(honest.scope, events);
    await dial(w, honest);
    const attached = w.attached.length;
    // A long-silent device of the same face, withdrawn by nobody, shows the frontier it last held.
    const stale = await dial(w, quiet);
    expect(stale.gate).toEqual({ outcome: "answered", state: "unconfirmed" });
    if (stale.outcome.state !== "unconfirmed") throw new Error(`the dial read ${stale.outcome.state}`);
    expect(stale.outcome.events).toEqual(events);
    expect(stale.outcome.frontier).toEqual({ position: 2, head: withdrawalHead(events[1]!) });
    expect(w.attached.length).toBe(attached);                           // it attached nothing
    // The device folds the events through the withdrawal's own reader, then presents again under the later frontier.
    quiet.history = learned(quiet.history, stale.outcome.events);
    expect((await dial(w, quiet)).gate).toEqual({ outcome: "attached", class: "contracted" });
    // A device one event behind receives exactly the event it lacks.
    const half = await sibling(honest, "behind half");
    half.history = memoryOf(honest.scope, [events[0]]);
    const partial = await dial(w, half, { carry: [] });
    if (partial.outcome.state !== "unconfirmed") throw new Error(`the dial read ${partial.outcome.state}`);
    expect(partial.outcome.events).toEqual([events[1]]);
  });

  test("a frontier the gate cannot join answers `incomplete`; the presenter then carries the whole history", async () => {
    const w = await world();
    const ahead = await presenter(w, "ahead");
    const lost = await sibling(ahead, "ahead lost");
    const events = await history(ahead.chain, [lost.vessel.key]);
    ahead.history = memoryOf(ahead.scope, events);
    const bare = await dial(w, ahead, { carry: [] });
    expect(bare.gate).toEqual({ outcome: "answered", state: "incomplete" });
    if (bare.outcome.state !== "incomplete") throw new Error(`the dial read ${bare.outcome.state}`);
    expect(bare.outcome.frontier).toEqual(genesisFrontier(ahead.scope));
    expect(w.attached).toEqual([]);
    expect((await dial(w, ahead)).gate).toEqual({ outcome: "attached", class: "contracted" });   // the default carries the whole line
    expect((await w.withdrawals.read(ahead.scope))!.denied.length).toBe(1);
  });

  test("two histories under one face key answer `forked`, and stay proven for every vessel of the face", async () => {
    const w = await world();
    const p = await presenter(w, "fork");
    const other = await sibling(p, "fork other");
    const genesis = genesisFrontier(p.scope).head;
    const one = await withdrawal(p.scope, 1, genesis, (await chain("fork a", w.nexus)).vessel.key, p.chain.face);
    const two = await withdrawal(p.scope, 1, genesis, (await chain("fork b", w.nexus)).vessel.key, p.chain.face);
    const run = await dial(w, p, { carry: [one, two] });
    expect(run.gate).toEqual({ outcome: "answered", state: "forked" });
    if (run.outcome.state !== "forked") throw new Error(`the dial read ${run.outcome.state}`);
    expect(run.outcome.events.length).toBe(2);
    expect((await dial(w, other)).gate).toEqual({ outcome: "answered", state: "forked" });   // an honest vessel, carrying nothing
    expect(w.attached).toEqual([]);
  });

  test("RED: a named answer reaches only a presenter of an admitted face, and a gate keeps no history for any other", async () => {
    const w = await world({ posture: "open" });
    const honest = await presenter(w, "named");
    const first = await sibling(honest, "named first");
    const events = await history(honest.chain, [first.vessel.key]);
    honest.history = memoryOf(honest.scope, events);
    await dial(w, honest);
    // The same stale device, once with the face's admit and once with no arm.
    const quiet = await sibling(honest, "named quiet");
    expect((await dial(w, quiet)).outcome.state).toBe("unconfirmed");                      // CONTROL
    const bare = await dial(w, quiet, { arm: null });
    // With no admit the gate reads the chain against nothing it kept: the stale frontier joins an empty line.
    expect(bare.gate).toEqual({ outcome: "attached", class: "stranger" });
    // A self-made face carries events of its own: the gate reads them and keeps none.
    const selfMade = await presenter(w, "named self-made");
    const lost = await sibling(selfMade, "named self-made lost");
    selfMade.history = memoryOf(selfMade.scope, await history(selfMade.chain, [lost.vessel.key]));
    expect((await dial(w, selfMade, { arm: null })).gate).toEqual({ outcome: "attached", class: "stranger" });
    expect(await w.withdrawals.read(selfMade.scope)).toBeNull();
    // And a withdrawn key under no admit hears nothing, at an open gate too.
    const silent = await dial(w, lost, { arm: null, carry: selfMade.history.line });
    expect(silent.gate.outcome).toBe("silence");
    expect(heard(silent.log)).toEqual(ONE_SILENCE);
  });

  test("a gate's memory only accretes: two checks that interleave lose nothing either learned", async () => {
    const w = await world();
    const p = await presenter(w, "accrete");
    const a = await sibling(p, "accrete a"), b = await sibling(p, "accrete b");
    const events = await history(p.chain, [a.vessel.key, b.vessel.key]);
    const store = memoryBackedWithdrawals();
    const whole = memoryOf(p.scope, events), older = memoryOf(p.scope, [events[0]]);
    await store.keep(whole);
    await store.keep(older);                                             // a check that read earlier lands later
    expect((await store.read(p.scope))!.frontier.position).toBe(2);
    await store.keep(memoryOf(p.scope));
    expect((await store.read(p.scope))!.denied.length).toBe(2);
    await store.keep({ ...whole } as WithdrawalMemory);                  // a memory spelled by hand teaches nothing
    expect((await store.read(p.scope))!.frontier.position).toBe(2);
    expect(await store.read((await chain("accrete other", w.nexus)).scope)).toBeNull();
  });
});

describe("two Nexuses on one vessel", () => {
  test("RED: they share no gate, no knock, no posture and no admit", async () => {
    const root = rootOf("one vessel, two Nexuses");
    const open = await world({ nexus: "nexus-a.synthetic", root, posture: "open" });
    const shut = await world({ nexus: "nexus-b.synthetic", root, posture: "private" });
    expect(new Set([open.pin.transportKey, open.pin.signingKey, shut.pin.transportKey, shut.pin.signingKey]).size).toBe(4);
    expect(open.bundle.knock).not.toBe(shut.bundle.knock);
    const p = await presenter(open, "two-nexus");
    // Posture reads per Nexus exactly: the open Nexus answers a stranger, and the private one beside it answers none.
    expect((await dial(open, p, { arm: null })).gate).toEqual({ outcome: "attached", class: "stranger" });
    const atShut = await presenter(shut, "two-nexus shut");
    expect((await dial(shut, atShut, { arm: null })).gate).toEqual({ outcome: "silence", reason: "sorted to silence" });
    // A dial pinned to one Nexus reaches no gate of the other: the knock, the flight and the chain each refuse.
    const { dialFaceGate } = await import("../src/face-dial.js");
    expect(await dialFaceGate({ pin: shut.pin, tier: "sovereign", socket: wire().dial, audience: AUDIENCE, certificate: p.certificate, signer: p.signer, arm: p.arm, history: p.history, deadlines: { draw: () => ({ cancel() {} }) } }))
      .toEqual({ state: "refused", refusal: "pin-other-nexus", sent: false });
    const crossed = await bentDial(shut, p, { pin: open.pin });
    expect(heard(crossed.log)).toEqual(NO_BYTE);
    // An admit the open Nexus's quorum signed earns nothing at the private Nexus, under a chain scoped there.
    const run = await bentDial(shut, atShut, {}, { arm: { kind: "admit", admit: await open.admitFor(atShut.chain.face), lineage: [] } });
    expect(run.gate.outcome).toBe("silence");
    expect((run.gate as { reason: string }).reason).toMatch(/^the admit reads/);
    // A gate refuses to stand over a bundle derived for another Nexus.
    const { makeFaceGate } = await import("../src/face-gate.js");
    expect(() => makeFaceGate({ bundle: deriveGateBundle(sovereignGateRoot(custodyRootDoor(root)), utf8Bytes("nexus-b.synthetic"), sovereignRoute("/ws")), nexus: "nexus-a.synthetic" } as never)).toThrow(/Nexus/);
    expect(gateKnock(open.pin)).toBe(open.bundle.knock);
  });
});

describe("the exchange's own subjects", () => {
  test("RED: a presentation reads under exact keys and one encoding", async () => {
    const w = await world();
    const p = await presenter(w, "subjects");
    const honest = { certificate: p.certificate, sessionCertificate: p.signer.certificate, arm: p.arm, frontier: p.history.frontier, carried: [], audience: AUDIENCE };
    const bytes = canonicalJsonBytes(honest);
    expect(readGatePresentation(bytes)).toMatchObject({ audience: AUDIENCE, armSubject: p.scope.faceKey });   // CONTROL
    expect(readGatePresentation(canonicalJsonBytes({ ...honest, vesselKey: "ab".repeat(32) }))).toBeNull();
    expect(readGatePresentation(canonicalJsonBytes({ ...honest, arm: { kind: "admit", admit: p.admit, lineage: [], leafProof: "ab".repeat(64) } }))).toBeNull();
    expect(readGatePresentation(canonicalJsonBytes({ ...honest, arm: { kind: "edge" } }))).toBeNull();
    expect(readGatePresentation(canonicalJsonBytes({ ...honest, audience: "two words" }))).toBeNull();
    expect(readGatePresentation(utf8Bytes(` ${new TextDecoder().decode(bytes)}`))).toBeNull();               // a second spelling of the same value
    expect(readGatePresentation(new Uint8Array(0))).toBeNull();
    expect(readGatePresentation(gateFrame(GATE_FRAME.finish, bytes))).toBeNull();
    expect(hexToBytes(readGatePresentation(bytes)!.digest).length).toBe(32);
  });

  test("RED: an answer reads under a known state, exact keys and one encoding", () => {
    const frontier = { position: 0, head: "ab".repeat(32) };
    expect(readGateAnswer(encodeGateAnswer({ state: "verified" }))).toEqual({ state: "verified" });        // CONTROL
    expect(readGateAnswer(encodeGateAnswer({ state: "incomplete", frontier: frontier as never }))).toEqual({ state: "incomplete", frontier });
    expect(readGateAnswer(canonicalJsonBytes({ state: "verified", class: "same-operator" }))).toBeNull();
    expect(readGateAnswer(canonicalJsonBytes({ state: "admitted" }))).toBeNull();
    expect(readGateAnswer(canonicalJsonBytes({ state: "unconfirmed", frontier }))).toBeNull();           // the events it must carry stand absent
    expect(readGateAnswer(canonicalJsonBytes({ state: "withdrawn", events: "none" }))).toBeNull();
    expect(readGateAnswer(utf8Bytes("{ \"state\": \"verified\" }"))).toBeNull();                        // a second spelling
    expect(readGateAnswer(new Uint8Array(0))).toBeNull();
  });

  test("a subject that outgrows one frame rides in parts, both ways, and a foreign or oversized part refuses", async () => {
    const big = new Uint8Array(GATE_FRAME_BODY_MAX * 2 + 7).map((_, at) => at % 251);
    const frames = gateParts(GATE_FRAME.presentationPart, GATE_FRAME.presentationEnd, big);
    expect(frames.map((frame) => frame[0])).toEqual([GATE_FRAME.presentationPart, GATE_FRAME.presentationPart, GATE_FRAME.presentationEnd]);
    expect(Math.max(...frames.map((frame) => frame.length))).toBeLessThanOrEqual(NOISE_MAX_MESSAGE_BYTES - 16);
    const reader = gatePartReader(GATE_FRAME.presentationPart, GATE_FRAME.presentationEnd);
    expect(reader.push(frames[0]!)).toBeNull();
    expect(reader.push(frames[1]!)).toBeNull();
    expect(hex(reader.push(frames[2]!) as Uint8Array)).toBe(hex(big));
    expect(reader.push(frames[2]!)).toBe("refused");                                           // a reader serves one subject
    expect(gatePartReader(GATE_FRAME.presentationPart, GATE_FRAME.presentationEnd).push(gateFrame(GATE_FRAME.answerEnd, big.subarray(0, 4)))).toBe("refused");
    expect(gatePartReader(GATE_FRAME.presentationPart, GATE_FRAME.presentationEnd).push(new Uint8Array(0))).toBe("refused");
    // Every part but the last rides full: an empty part, or a short one, holds nothing a reader will keep.
    expect(gatePartReader(GATE_FRAME.presentationPart, GATE_FRAME.presentationEnd).push(gateFrame(GATE_FRAME.presentationPart, new Uint8Array(0)))).toBe("refused");
    expect(gatePartReader(GATE_FRAME.presentationPart, GATE_FRAME.presentationEnd).push(gateFrame(GATE_FRAME.presentationPart, new Uint8Array(GATE_FRAME_BODY_MAX - 1)))).toBe("refused");
    const flood = gatePartReader(GATE_FRAME.presentationPart, GATE_FRAME.presentationEnd);
    const part = gateFrame(GATE_FRAME.presentationPart, new Uint8Array(GATE_FRAME_BODY_MAX));
    let last: unknown = null;
    for (let sent = 0; sent <= GATE_SUBJECT_MAX_BYTES / GATE_FRAME_BODY_MAX + 1 && last === null; sent++) last = flood.push(part);
    expect(last).toBe("refused");                                                              // past its bound a reader holds no more
    expect(() => gateParts(1, 2, new Uint8Array(GATE_SUBJECT_MAX_BYTES + 1))).toThrow(RangeError);
    expect(gateParts(1, 2, new Uint8Array(0)).map((frame) => [...frame])).toEqual([[2]]);
  });

  test("a long history crosses in parts: the gate learns it whole, and hands it whole to a device behind", async () => {
    const w = await world();
    const honest = await presenter(w, "long");
    const quiet = await sibling(honest, "long quiet");
    const gone: string[] = [];
    for (let at = 0; at < 220; at++) gone.push((await chain(`long gone ${at}`, w.nexus)).vessel.key);
    const events = await history(honest.chain, gone);
    honest.history = memoryOf(honest.scope, events);
    const carried = await dial(w, honest);
    expect(carried.gate).toEqual({ outcome: "attached", class: "contracted" });
    expect(carried.log.toGate.length).toBeGreaterThan(2);                     // the presentation rode more than one frame beside the finish
    expect((await w.withdrawals.read(honest.scope))!.frontier.position).toBe(220);
    const stale = await dial(w, quiet);
    if (stale.outcome.state !== "unconfirmed") throw new Error(`the dial read ${stale.outcome.state}`);
    expect(stale.outcome.events.length).toBe(220);
    expect(stale.log.toDialer.length).toBeGreaterThan(3);                     // message two, the answer in parts, the signature
    quiet.history = learned(quiet.history, stale.outcome.events);
    expect((await dial(w, quiet)).gate).toEqual({ outcome: "attached", class: "contracted" });
  }, 60_000);
});

describe("two tiers of gate: the floor seats no fleet lane", () => {
  test("RED: a floor gate asks no private grant, sorts nobody same-operator, and marks its seat as the floor's", async () => {
    const root = rootOf("floor and sovereign");
    const floor = await world({ root, tier: "floor", posture: "open" });
    const raised = await world({ root, posture: "open" });
    const p = await presenter(raised, "floor fleet");
    for (const w of [floor, raised]) w.grants.set(p.scope.faceKey, { personaGroup: GROUP, faceKey: p.scope.faceKey, nexus: w.nexus, revision: "g" });
    expect((await dial(raised, p)).gate).toEqual({ outcome: "attached", class: "same-operator" });       // CONTROL: the sovereign gate seats the fleet
    expect(raised.attached[0]!.session.tier).toBe("sovereign");
    // The same face, the same admit and the same grant ring, at the floor gate of the same vessel.
    const atFloor = await dial(floor, p, { pin: floor.pin });
    expect(atFloor.gate).toEqual({ outcome: "attached", class: "contracted" });
    expect(floor.attached[0]!.session.tier).toBe("floor");
    expect(floor.asked).toEqual(["admit", "shadow", "sort", "attach", "open"]);                       // no "grant": the ring never heard
    expect(floor.sorted[0]).toMatchObject({ tier: "floor", fleetAside: true, sameGroup: null });
    // A sorter that answers same-operator at the floor draws silence.
    floor.sorterAnswer = () => ({ class: "same-operator" });
    expect((await dial(floor, p, { pin: floor.pin })).gate.outcome).toBe("silence");
    // The two pins share nothing, and a dial pinned to one reaches no gate of the other.
    expect(new Set([floor.pin.transportKey, floor.pin.signingKey, raised.pin.transportKey, raised.pin.signingKey]).size).toBe(4);
    const crossed = await bentDial(floor, p, { pin: raised.pin });
    expect(heard(crossed.log)).toEqual(NO_BYTE);
    // A caller that means to reach a sovereign gate and holds a floor pin dials nothing: no flight leaves.
    const meant = await dial(floor, p, { tier: "sovereign" });
    expect(meant.outcome).toEqual({ state: "refused", refusal: "pin-other-tier", sent: false });
    expect(meant.log.flight).toBeNull();
    const herm = await place(floor, "floor tier herm");
    expect((await dialPlace(floor, herm, { tier: "sovereign" })).outcome).toEqual({ state: "refused", refusal: "pin-other-tier" });
  });

  test("RED: a floor gate keeps no withdrawal memory and answers no refusing state", async () => {
    const floor = await world({ tier: "floor", posture: "open" });
    const { honest, gone, events } = await withdrawnPair(floor, "floor memory");
    honest.history = memoryOf(honest.scope, events);
    expect((await dial(floor, honest)).gate).toEqual({ outcome: "attached", class: "contracted" });
    expect(await floor.withdrawals.read(honest.scope)).toBeNull();                                     // it learned nothing it keeps
    // The withdrawn vessel, carrying its own denial: a sovereign gate would answer `withdrawn`; the floor says nothing.
    const run = await dial(floor, gone, { carry: events });
    expect(run.gate).toEqual({ outcome: "silence", reason: "the chain reads withdrawn at a floor gate" });
    expect(heard(run.log)).toEqual(ONE_SILENCE);
    const raised = await world();
    const pair = await withdrawnPair(raised, "floor memory control");
    expect((await dial(raised, pair.gone, { carry: pair.events })).gate).toEqual({ outcome: "answered", state: "withdrawn" });   // CONTROL
  });
});

describe("the place arm: a faceless place proves its own key, outside the face proof", () => {
  test("CONTROL: a contracted place attaches under the carriage profile, with no chain, no grant and no memory asked", async () => {
    const w = await world();
    const herm = await place(w, "herm");
    const run = await dialPlace(w, herm);
    expect(run.outcome.state).toBe("verified");
    expect(run.gate).toEqual({ outcome: "attached", class: "contracted" });
    expect(w.asked).toEqual(["contract", "shadow-place", "sort", "attach", "open"]);
    const { session } = w.attached[0]!;
    expect(session).toMatchObject({ tier: "sovereign", scope: null, sessionKey: null, placeKey: herm.key, profile: "carriage", class: "contracted", standing: { nym: herm.key, aid: w.nexus } });
    expect(w.sorted[0]).toMatchObject({ scope: null, placeKey: herm.key, profile: "carriage", admit: null, sameGroup: null, fleetAside: true });
    if (run.outcome.state !== "verified") throw new Error("unreachable");
    expect(new TextDecoder().decode(session.transport.receive.open(run.outcome.transport.send.seal(utf8Bytes("sealed bytes it cannot open"))))).toBe("sealed bytes it cannot open");
  });

  test("RED: a contract for another Nexus, a closed one, a shadowed edge and a rootless gate each draw silence", async () => {
    const w = await world({ posture: "open" });
    const other = await world({ nexus: "nexus-b.synthetic" });
    const herm = await place(w, "refused herm");
    const reasons: string[] = [];
    const silent = async (run: Promise<{ gate: { outcome: string; reason?: string }; log: { toDialer: Uint8Array[]; cuts: number } }>): Promise<void> => {
      const done = await run;
      expect(done.gate.outcome).toBe("silence");
      expect(heard(done.log)).toEqual(ONE_SILENCE);
      reasons.push((done.gate as { reason: string }).reason);
    };
    const elsewhere = await other.carryFor(herm.seed);
    await silent(dialPlace(w, herm, { arm: { kind: "place", contract: elsewhere, lineage: [] } }));
    w.placeAside.add(herm.key);
    await silent(dialPlace(w, herm));
    w.placeAside.clear();
    const held = w.held!;
    w.held = null;
    await silent(dialPlace(w, herm));
    w.held = { ...held, nexus: "nexus-b.synthetic" };
    await silent(dialPlace(w, herm));
    w.held = held;
    // A contract whose carrier seal ANOTHER key signed, at this very epoch, counts for nobody.
    const thief = await place(w, "refused herm thief");
    const forged = { ...herm.contract, contractSig: { signer: herm.key, sig: thief.contract.contractSig!.sig } };
    expect(thief.contract.sealEpochCid).toBe(herm.contract.sealEpochCid);                      // the setup took: only the signer differs
    await silent(dialPlace(w, herm, { arm: { kind: "place", contract: forged, lineage: [] } }));
    expect(reasons).toEqual([
      "the contract reads wrong-epoch: contract-not-at-head-epoch",
      "a standing shadow sets the place aside",
      "the contract refuses: no-held-root",
      "the contract stands in another Nexus",
      "the contract reads rejected: contract-not-counted",
    ]);
    expect(w.attached).toEqual([]);
    expect((await dialPlace(w, herm)).gate).toEqual({ outcome: "attached", class: "contracted" });   // CONTROL
  });

  test("RED: one arm rides one dial: a place key beside a chain, or a face's arm under a place key, reads as none", async () => {
    const w = await world({ posture: "open" });
    const herm = await place(w, "one arm");
    const p = await presenter(w, "one arm face");
    const none = "the presentation reads as none";
    expect((await bentPlaceDial(w, herm, { presentation: (honest) => ({ ...honest, certificate: p.certificate }) })).gate).toEqual({ outcome: "silence", reason: none });
    expect((await bentPlaceDial(w, herm, { presentation: (honest) => ({ ...honest, arm: p.arm }) })).gate).toEqual({ outcome: "silence", reason: none });
    expect((await bentPlaceDial(w, herm, { presentation: (honest) => ({ ...honest, arm: { ...herm.arm, contract: { ...herm.contract, nym: p.scope.faceKey } } }) })).gate).toEqual({ outcome: "silence", reason: none });
    // A face's presentation that carries a place arm reads as none too.
    expect((await bentDial(w, p, { presentation: (honest) => ({ ...honest, arm: herm.arm }) })).gate).toEqual({ outcome: "silence", reason: none });
    expect((await bentDial(w, p, { presentation: (honest) => ({ ...honest, placeKey: herm.key }) })).gate).toEqual({ outcome: "silence", reason: none });
    expect(readPlacePresentation(canonicalJsonBytes({ placeKey: herm.key, arm: herm.arm, audience: AUDIENCE }))).toMatchObject({ placeKey: herm.key });   // CONTROL
    expect(readGatePresentation(canonicalJsonBytes({ placeKey: herm.key, arm: herm.arm, audience: AUDIENCE }))).toBeNull();
  });

  test("RED: the finish stands under the place's own key and its own name: another key, and a face's finish image, refuse", async () => {
    const w = await world();
    const herm = await place(w, "finish");
    const thief = await place(w, "finish thief");
    const refused = { outcome: "silence", reason: "the place's finish refuses" };
    expect((await bentPlaceDial(w, herm, { signWith: thief.seed })).gate).toEqual(refused);
    // The same four fields a face's session key signs, signed by the place's own key: the name differs, so it verifies for no place.
    expect((await bentPlaceDial(w, herm, { image: (parts) => gateFinishPayload(parts) })).gate).toEqual(refused);
    expect((await bentPlaceDial(w, herm, { image: (parts) => { const moved = Uint8Array.from(parts.handshakeHash); moved[0]! ^= 1; return (parts.handshakeHash = moved, new Uint8Array(40)); } })).gate).toEqual(refused);
    expect(w.asked).toEqual([]);                                                                 // no collaborator heard of any of them
    // The image leads with the place finish's own name: no other signed image of the house shares its first field.
    const parts = { handshakeHash: new Uint8Array(32).fill(7), bundleDigest: w.bundle.digest, presentationDigest: "ab".repeat(32), audience: AUDIENCE, placeKey: herm.key };
    expect(hex(gatePlaceFinishImage(parts))).toBe(hex(gateFields(GATE_PLACE_FINISH_DOMAIN, parts.handshakeHash, hexToBytes(parts.bundleDigest), hexToBytes(parts.presentationDigest), utf8Bytes(AUDIENCE), hexToBytes(herm.key))));
    expect(GATE_PLACE_FINISH_DOMAIN).not.toBe(GATE_FINISH_DOMAIN);
    // A place that names another audience draws silence, as a face does.
    expect((await dialPlace(w, herm, { audience: "lar:///ha.ka.ba/bags/other" })).gate).toEqual({ outcome: "silence", reason: "the dial names another audience" });
    expect((await bentPlaceDial(w, herm)).gate).toEqual({ outcome: "attached", class: "contracted" });   // CONTROL
  });

  test("RED: a place never sorts same-operator, and with no contract it draws what a proven stranger draws", async () => {
    const w = await world({ posture: "private" });
    const herm = await place(w, "classes");
    w.sorterAnswer = () => ({ class: "same-operator" });
    expect((await dialPlace(w, herm)).gate.outcome).toBe("silence");
    w.sorterAnswer = () => ({ class: "walker" });
    expect((await dialPlace(w, herm)).gate.outcome).toBe("silence");
    // A standing the sorter names under another key, or another Nexus, seats nobody: for a place and for a face.
    const face = await presenter(w, "classes face");
    w.sorterAnswer = () => ({ class: "contracted", standing: { nym: face.scope.faceKey, aid: w.nexus } });
    expect((await dialPlace(w, herm)).gate).toEqual({ outcome: "silence", reason: "the sorter named a standing under another key or another Nexus" });
    w.sorterAnswer = () => ({ class: "contracted", standing: { nym: herm.key, aid: w.nexus } });
    expect((await dial(w, face)).gate).toEqual({ outcome: "silence", reason: "the sorter named a standing under another key or another Nexus" });
    w.sorterAnswer = () => ({ class: "contracted", standing: { nym: herm.key, aid: "nexus-b.synthetic" } });
    expect((await dialPlace(w, herm)).gate.outcome).toBe("silence");
    w.sorterAnswer = () => ({ class: "contracted", standing: { nym: herm.key, aid: w.nexus } });
    expect((await dialPlace(w, herm)).gate).toEqual({ outcome: "attached", class: "contracted" });   // CONTROL
    w.sorterAnswer = null;
    // No contract: a private gate says nothing; an open floor gate seats it as a stranger, under the carriage profile.
    expect((await dialPlace(w, herm, { arm: null })).gate).toEqual({ outcome: "silence", reason: "sorted to silence" });
    const floor = await world({ tier: "floor", posture: "open" });
    const run = await dialPlace(floor, herm, { arm: null });
    expect(run.gate).toEqual({ outcome: "attached", class: "stranger" });
    expect(floor.attached[0]!.session).toMatchObject({ tier: "floor", placeKey: herm.key, profile: "carriage", scope: null });
    expect(floor.asked).toEqual(["sort", "attach", "open"]);                                     // no contract, so no root and no shadow got asked
    // A contracted place at the floor: the blind relay a locked herm still answers.
    const contracted = await place(floor, "classes floor");
    expect((await dialPlace(floor, contracted)).gate).toEqual({ outcome: "attached", class: "contracted" });
  });
});
