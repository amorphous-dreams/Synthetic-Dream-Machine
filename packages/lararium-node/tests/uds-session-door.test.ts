/**
 * uds-session-door.test — the node's production door verifies a face hint afresh: its anchors, its K15 atom and its
 * proof at the Nexus the vessel dials; the hint grants nothing, and a session's presenter names the face's own atom.
 */
import { describe, expect, test } from "vitest";
import { faceAtomKeyFromSeed, readPlaceSessionCertificate, SessionTable, sessionBinding, type GateBundlePin, type SessionFace } from "@lararium/mesh";
import { CustodyLocked, FaceLocked } from "../src/custody-holder.js";
import { dialAnchorCell, nodeSessionDoor, readFaceHint } from "../src/uds-session-door.js";

const AID = "nexus-door.synthetic";
const PIN = { nexus: Buffer.from(AID).toString("hex") } as unknown as GateBundlePin;
/** The face whose PersonaGroup is `group`, as its proof reads. */
const face = (group: string): SessionFace => {
  const name = group.replace(/^group-/, "");
  return {
  personaGroup: group, proofSubject: `proof-${name}`, admitRef: `admit-${name}`, causalRevision: `revision-${name}`,
  planes: { persona: `p-${name}`, circles: `c-${name}`, identities: `i-${name}`, sessions: `s-${name}`, intents: `n-${name}` },
  };
};
const seedOf = (n: number) => new Uint8Array(32).fill(n + 1);
const PLACE = { place: "EplacePrefixSynthetic", seq: 2, head: "c".repeat(64) };

function door(over: Partial<Parameters<typeof nodeSessionDoor>[0]> = {}) {
  const asked: Array<{ personaGroup: string; pin: GateBundlePin }> = [];
  const minted: string[] = [];
  const logged: string[] = [];
  const d = nodeSessionDoor({
    pin: () => PIN, sealHome: "/scratch/seal", onLog: (line) => logged.push(line),
    placeOf: async () => PLACE,
    groupOfFace: async (n) => (n < 2 ? `group-${n}` : null),
    atomOfGroup: async (g) => seedOf(Number(g.slice(-1))),
    targetOf: async ({ personaGroup, pin }) => {
      asked.push({ personaGroup, pin });
      return { target: { face: face(personaGroup), mint: async ({ session }) => {
        minted.push(session.face.proofSubject);
        return { signer: { dropped: false, drop() {} } as never };
      } } };
    },
    ...over,
  });
  return { d, asked, minted, logged };
}

describe("the node session door", () => {
  test("a hint reads h<N> alone", () => {
    expect([readFaceHint("h0"), readFaceHint("h12"), readFaceHint("h01"), readFaceHint("0"), readFaceHint("h1@aid"), readFaceHint("proof-a")])
      .toEqual([0, 12, null, null, null, null]);
    expect(readFaceHint(`h${0x80000000}`)).toBeNull();          // past the handle-index ceiling names no face
  });

  test("two faces each open their own supply: each face's atom presents, each proof reads at the dialed Nexus", async () => {
    const { d, asked } = door();
    const a = await d.open({ faceRef: "h0", hand: "cli" });
    const b = await d.open({ faceRef: "h1", hand: "seat" });
    if (!a.ok || !b.ok) throw new Error("door refused");
    expect(a.supply).toMatchObject({ face: { personaGroup: "group-0" }, anchor: { kind: "nexus", aid: AID }, profile: "verb", presenter: `0x${faceAtomKeyFromSeed(seedOf(0), "group-0").key}` });
    expect(b.supply).toMatchObject({ profile: "seat", presenter: `0x${faceAtomKeyFromSeed(seedOf(1), "group-1").key}` });
    expect(a.supply.presenter).not.toBe(b.supply.presenter);
    expect(asked).toEqual([{ personaGroup: "group-0", pin: PIN }, { personaGroup: "group-1", pin: PIN }]);
  });

  test("the supply mints nothing until the table holds the session", async () => {
    const { d, minted } = door();
    const a = await d.open({ faceRef: "h0", hand: "cli" });
    if (!a.ok) throw new Error(a.refusal);
    expect(minted).toEqual([]);
    const table = new SessionTable("owner");
    const binding = sessionBinding("socket");
    const opened = table.open(binding, a.supply.face, a.supply.profile);
    if (!opened.ok) throw new Error(opened.refusal);
    expect(await a.supply.mint({ table, binding, session: opened.session })).toMatchObject({ ok: true });
    expect(minted).toEqual([a.supply.face.proofSubject]);
  });

  test("each absence refuses by name: a malformed hint, no face, a locked face, no atom, a proof that refuses", async () => {
    expect(await door().d.open({ faceRef: "proof-a", hand: "cli" })).toEqual({ ok: false, refusal: "face-hint-malformed" });
    expect(await door().d.open({ faceRef: "h7", hand: "cli" })).toEqual({ ok: false, refusal: "face-absent" });
    expect(await door({ atomOfGroup: async () => { throw new CustodyLocked(); } }).d.open({ faceRef: "h0", hand: "cli" })).toEqual({ ok: false, refusal: "face-locked" });
    expect(await door({ atomOfGroup: async () => null }).d.open({ faceRef: "h0", hand: "cli" })).toEqual({ ok: false, refusal: "face-atom-absent" });
    expect(await door({ targetOf: async () => ({ refusal: "admit-absent" }) }).d.open({ faceRef: "h0", hand: "cli" })).toEqual({ ok: false, refusal: "admit-absent" });
  });

  test("RED: a face whose anchors read locked refuses face-locked, and any other fault refuses door-failed with its detail logged alone", async () => {
    // A locked face's anchors are a face-hot row: the first read the door makes throws FaceLocked.
    expect(await door({ groupOfFace: async () => { throw new FaceLocked("ffffffff00000000"); } }).d.open({ faceRef: "h0", hand: "cli" }))
      .toEqual({ ok: false, refusal: "face-locked" });
    const torn = door({ targetOf: async () => { throw new Error("row /secret/identity/face.json torn"); } });
    expect(await torn.d.open({ faceRef: "h0", hand: "cli" })).toEqual({ ok: false, refusal: "door-failed" });
    expect(torn.logged.join("\n")).toContain("/secret/identity/face.json");
  });

  test("RED: a proof whose face stands in another PersonaGroup than the hint's refuses face-group-mismatch; CONTROL: its own group presents", async () => {
    const other = door({ targetOf: async () => ({ target: { face: face("group-1"), mint: async () => ({ refusal: "never" }) } as never }) });
    expect(await other.d.open({ faceRef: "h0", hand: "cli" })).toEqual({ ok: false, refusal: "face-group-mismatch" });
    expect(await other.d.open({ faceRef: "h1", hand: "cli" })).toMatchObject({ ok: true });
  });

  test("RED: with no dial pin the face opens at the vessel's own place: its atom presents, no Nexus proof reads, and the atom certifies the signer", async () => {
    // A PersonaGroup id as Keyhive spells it: the place face's planes derive from it.
    const group = "0x0a1b2c3d4e5f6071";
    const { d, asked } = door({ pin: () => null, groupOfFace: async () => group, atomOfGroup: async () => seedOf(0) });
    const a = await d.open({ faceRef: "h0", hand: "cli" });
    if (!a.ok) throw new Error(a.refusal);
    const atomKey = faceAtomKeyFromSeed(seedOf(0), group).key;
    expect(a.supply).toMatchObject({ anchor: { kind: "place", aid: PLACE.place, head: PLACE.head }, presenter: `0x${atomKey}`, profile: "verb",
      face: { personaGroup: group, admitRef: `place:${PLACE.place}@${PLACE.head}` } });
    expect(asked).toEqual([]);
    expect(await d.anchorNow()).toEqual({ kind: "place", aid: PLACE.place, head: PLACE.head });
    const table = new SessionTable("owner");
    const binding = sessionBinding("socket");
    const opened = table.open(binding, a.supply.face, a.supply.profile);
    if (!opened.ok) throw new Error(opened.refusal);
    const minted = await a.supply.mint({ table, binding, session: opened.session });
    if (!minted.ok) throw new Error(minted.refusal);
    const certificate = (minted.signer as unknown as { certificate: unknown }).certificate;
    expect(readPlaceSessionCertificate(certificate)).toMatchObject({ read: { scope: { atomKey, place: PLACE.place } } });
  });

  test("the door answers where the vessel stands: the dialed Nexus while a pin stands, its place once none does", async () => {
    let pin: GateBundlePin | null = PIN;
    const { d } = door({ pin: () => pin });
    expect(await d.anchorNow()).toEqual({ kind: "nexus", aid: AID });
    pin = null;
    expect(await d.anchorNow()).toEqual({ kind: "place", aid: PLACE.place, head: PLACE.head });
  });

  test("RED: the dial anchor sets only once the vessel's own presentation composed; a refusal or a failed re-dial leaves none (the place anchor)", () => {
    const cell = dialAnchorCell();
    cell.composed(PIN, null);                       // the presentation refused
    expect(cell.pin()).toBeNull();
    cell.composed(PIN, { presented: true });        // CONTROL: it composed
    expect(cell.pin()).toBe(PIN);
    cell.clear();                                   // a re-dial that threw
    expect(cell.pin()).toBeNull();
    cell.composed(PIN, { presented: true });
    cell.composed(PIN, null);                       // a later re-dial whose presentation refused drops the old pin
    expect(cell.pin()).toBeNull();
  });
});
