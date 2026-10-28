/**
 * uds-session-door.test — the node's production door verifies a face hint afresh: its anchors, its K15 atom and its
 * proof at the Nexus the vessel dials; the hint grants nothing, and a session's presenter names the face's own atom.
 */
import { describe, expect, test } from "vitest";
import { faceAtomKeyFromSeed, SessionTable, sessionBinding, type GateBundlePin, type SessionFace } from "@lararium/mesh";
import { CustodyLocked } from "../src/custody-holder.js";
import { nodeSessionDoor, readFaceHint } from "../src/uds-session-door.js";

const PIN = { nexus: "ab".repeat(16) } as unknown as GateBundlePin;
const face = (name: string): SessionFace => ({
  personaGroup: `group-${name}`, proofSubject: `proof-${name}`, admitRef: `admit-${name}`, causalRevision: `revision-${name}`,
  planes: { persona: `p-${name}`, circles: `c-${name}`, identities: `i-${name}`, sessions: `s-${name}`, intents: `n-${name}` },
});
const seedOf = (n: number) => new Uint8Array(32).fill(n + 1);

function door(over: Partial<Parameters<typeof nodeSessionDoor>[0]> = {}) {
  const asked: Array<{ personaGroup: string; pin: GateBundlePin }> = [];
  const minted: string[] = [];
  const d = nodeSessionDoor({
    pin: () => PIN, sealHome: "/scratch/seal",
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
  return { d, asked, minted };
}

describe("the node session door", () => {
  test("a hint reads h<N> alone", () => {
    expect([readFaceHint("h0"), readFaceHint("h12"), readFaceHint("h01"), readFaceHint("0"), readFaceHint("h1@aid"), readFaceHint("proof-a")])
      .toEqual([0, 12, null, null, null, null]);
  });

  test("two faces each open their own supply: each face's atom presents, each proof reads at the dialed Nexus", async () => {
    const { d, asked } = door();
    const a = await d.open({ faceRef: "h0", hand: "cli" });
    const b = await d.open({ faceRef: "h1", hand: "seat" });
    if (!a.ok || !b.ok) throw new Error("door refused");
    expect(a.supply).toMatchObject({ face: { personaGroup: "group-group-0" }, profile: "verb", presenter: `0x${faceAtomKeyFromSeed(seedOf(0), "group-0").key}` });
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

  test("each absence refuses by name: a malformed hint, no face, a locked face, no atom, no dial pin, a proof that refuses", async () => {
    expect(await door().d.open({ faceRef: "proof-a", hand: "cli" })).toEqual({ ok: false, refusal: "face-hint-malformed" });
    expect(await door().d.open({ faceRef: "h7", hand: "cli" })).toEqual({ ok: false, refusal: "face-absent" });
    expect(await door({ atomOfGroup: async () => { throw new CustodyLocked(); } }).d.open({ faceRef: "h0", hand: "cli" })).toEqual({ ok: false, refusal: "face-locked" });
    expect(await door({ atomOfGroup: async () => null }).d.open({ faceRef: "h0", hand: "cli" })).toEqual({ ok: false, refusal: "face-atom-absent" });
    expect(await door({ pin: () => null }).d.open({ faceRef: "h0", hand: "cli" })).toEqual({ ok: false, refusal: "no-dial-pin" });
    expect(await door({ targetOf: async () => ({ refusal: "admit-absent" }) }).d.open({ faceRef: "h0", hand: "cli" })).toEqual({ ok: false, refusal: "admit-absent" });
  });
});
