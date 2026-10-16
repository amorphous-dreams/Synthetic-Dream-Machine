/**
 * socket-sorter.test.ts — the ONE sorter every face gate arms with (`face-gate` `GateSorter`), over the facts the
 * gate proved and this gate's own Nexus posture alone.
 *
 * Proven:
 *   · an admit the gate read held sorts CONTRACTED, standing as the proven face key at the admit's Nexus;
 *   · RED: it sorts SAME-OPERATOR only at a sovereign gate, with the PersonaGroup grant and no fleet shadow (D4)
 *     / CONTROL: each missing fact leaves it contracted;
 *   · a place's held carriage contract sorts CONTRACTED, standing as the place key;
 *   · RED: a walker's grant or claim arm draws nothing, whatever the posture: the route ships SHUT by name, and
 *     the name reaches the vessel's own log alone;
 *   · RED: a presenter with no arm is silence under PRIVATE / CONTROL: OPEN answers it as a stranger; the
 *     posture reads fresh at each sort;
 *   · every verdict passes the gate itself: a real gate over this sorter seats each class the sorter names;
 *   · a refold drops a stranger once nothing answers strangers, and a contracted session the membership no
 *     longer holds — never a same-operator one, and nothing at all under OPEN.
 */
import { describe, test, expect } from "vitest";
import type { FederationPosture, GateSortInput, PeerClass, FaceAdmitReading, FaceGrantReading, PlaceContractReading, CarriageEntry } from "@lararium/mesh";
import { makeGateSorter, socketsNoLongerHeld, ownPlacePosture, SHUT_ARMS } from "../src/socket-sorter.js";
import { world, presenter, dial, GROUP } from "../../lararium-mesh/tests/face-gate-fixture.js";

const FACE  = "aa".repeat(32);
const PLACE = "bb".repeat(32);
const N     = "nexus-n";
const admit: FaceAdmitReading = { verdict: { state: "held", reason: "held", nym: FACE }, nexus: N, admitRef: "ref", revision: "r1", head: FACE };
const grant: FaceGrantReading = { personaGroup: "0xgroup", faceKey: FACE, nexus: N, revision: "g1" };
const place: PlaceContractReading = { verdict: { state: "held", reason: "held", nym: PLACE }, nexus: N, contractRef: "c", revision: "r1" };
const entry = {} as CarriageEntry;

function face(over: Partial<GateSortInput> = {}): GateSortInput {
  return {
    tier: "sovereign", scope: { faceKey: FACE, nexus: N } as GateSortInput["scope"], placeKey: null, place: null,
    profile: "hand" as GateSortInput["profile"], admit: null, sameGroup: null, fleetAside: false, arm: null, ...over,
  };
}
const admitArm = { kind: "admit" as const, admit: entry, lineage: [] };
const sorter = (posture: FederationPosture = "private", shut: string[] = []) =>
  makeGateSorter({ posture: () => posture, onShut: (arm) => { shut.push(arm); } });

describe("the gate sorter — four classes, and silence", () => {
  test("an admit the gate read held sorts contracted, standing as the proven face at the admit's Nexus", async () => {
    expect(await sorter().sort(face({ arm: admitArm, admit }))).toEqual({ class: "contracted", standing: { nym: FACE, aid: N } });
  });

  test("RED: same-operator only at a sovereign gate with the grant and no fleet shadow; CONTROL: each lack leaves it contracted", async () => {
    expect(await sorter().sort(face({ arm: admitArm, admit, sameGroup: grant }))).toEqual({ class: "same-operator" });
    const contracted = { class: "contracted", standing: { nym: FACE, aid: N } };
    expect(await sorter().sort(face({ arm: admitArm, admit, sameGroup: grant, fleetAside: true }))).toEqual(contracted);
    expect(await sorter().sort(face({ arm: admitArm, admit, sameGroup: null }))).toEqual(contracted);
    expect(await sorter().sort(face({ arm: admitArm, admit, sameGroup: grant, tier: "floor" }))).toEqual(contracted);
    // A grant that names another face never stands for this one.
    expect(await sorter().sort(face({ arm: admitArm, admit, sameGroup: { ...grant, faceKey: "cc".repeat(32) } }))).toEqual(contracted);
  });

  test("an admit arm the gate read no admit for draws nothing", async () => {
    expect(await sorter("open").sort(face({ arm: admitArm, admit: null }))).toBeNull();
  });

  test("a place's held carriage contract sorts contracted, standing as the place key; a place arm with no contract draws nothing", async () => {
    const arm = { kind: "place" as const, contract: entry, lineage: [] };
    const input = face({ scope: null, placeKey: PLACE, place, arm, fleetAside: true });
    expect(await sorter().sort(input)).toEqual({ class: "contracted", standing: { nym: PLACE, aid: N } });
    expect(await sorter("open").sort({ ...input, place: null })).toBeNull();
  });

  test("RED: a walker's grant or claim draws nothing under either posture, and names its shut route locally", async () => {
    const shut: string[] = [];
    const grantArm = { kind: "grant", grant: {} } as unknown as GateSortInput["arm"];
    const claimArm = { kind: "claim", nexusAid: N, token: {}, claim: "c" } as unknown as GateSortInput["arm"];
    for (const p of ["private", "open"] as const) {
      expect(await sorter(p, shut).sort(face({ arm: grantArm }))).toBeNull();
      expect(await sorter(p, shut).sort(face({ arm: claimArm }))).toBeNull();
    }
    expect(shut).toEqual(["grant", "claim", "grant", "claim"]);
    expect([...SHUT_ARMS]).toEqual(["grant", "claim"]);
    // A log that throws decides nothing.
    const loud = makeGateSorter({ posture: () => "open", onShut: () => { throw new Error("a log that fails"); } });
    expect(await loud.sort(face({ arm: grantArm }))).toBeNull();
  });

  test("RED: a presenter with no arm is silence under PRIVATE; CONTROL: OPEN answers it as a stranger, read fresh", async () => {
    let posture: FederationPosture = "private";
    const live = makeGateSorter({ posture: () => posture });
    expect(await live.sort(face())).toBeNull();
    expect(await live.sort(face({ scope: null, placeKey: PLACE }))).toBeNull();
    posture = "open";
    expect(await live.sort(face())).toEqual({ class: "stranger" });
    expect(await live.sort(face({ scope: null, placeKey: PLACE }))).toEqual({ class: "stranger" });
  });

  test("a herm reads the charter of the Nexus that carries it exactly as a lararium does, and an absent one fails closed", () => {
    expect(ownPlacePosture("herm", null)).toBe("private");
    expect(ownPlacePosture("lararium", null)).toBe("private");
  });
});

describe("every verdict passes a real gate", () => {
  test("a real gate over this sorter seats contracted, then same-operator with the grant, and contracted again under the fleet shadow", async () => {
    const w = await world();
    const gated = makeGateSorter({ posture: () => w.posture });
    w.sorterAnswer = (input) => gated.sort(input);
    const p = await presenter(w, "one face");
    expect((await dial(w, p)).gate).toEqual({ outcome: "attached", class: "contracted" });
    expect(w.attached.at(-1)!.session.standing).toEqual({ nym: p.scope.faceKey, aid: w.nexus });
    w.grants.set(p.scope.faceKey, { personaGroup: GROUP, faceKey: p.scope.faceKey, nexus: w.nexus, revision: "g1" });
    expect((await dial(w, p)).gate).toEqual({ outcome: "attached", class: "same-operator" });
    w.fleetAside.add(p.certificate.vesselFaceKey);
    expect((await dial(w, p)).gate).toEqual({ outcome: "attached", class: "contracted" });
    // No arm at a PRIVATE gate: silence; CONTROL: OPEN seats the stranger.
    expect((await dial(w, p, { arm: null })).gate).toEqual({ outcome: "silence", reason: "sorted-silent" });
    w.posture = "open";
    expect((await dial(w, p, { arm: null })).gate).toEqual({ outcome: "attached", class: "stranger" });
  });
});

describe("a refold drops what it no longer holds", () => {
  const admitted = (pairs: Array<[string, PeerClass | undefined]>) => pairs.map(([peerId, cls]) => ({ peerId, socket: peerId, cls }));

  test("RED: under PRIVATE strangers and unheld contracted sessions drop; same-operator and held stay", () => {
    const drop = socketsNoLongerHeld(admitted([
      ["self", "same-operator"], ["held", "contracted"], ["gone", "contracted"], ["str", "stranger"], ["none", undefined],
    ]), { holds: (id) => id === "held", answersStrangers: false });
    expect(drop.sort()).toEqual(["gone", "none", "str"]);
  });

  test("CONTROL: under OPEN nothing drops", () => {
    expect(socketsNoLongerHeld(admitted([["gone", "contracted"], ["str", "stranger"]]), { holds: () => false, answersStrangers: true })).toEqual([]);
  });
});
