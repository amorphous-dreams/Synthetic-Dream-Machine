/**
 * persona-group-ring.test — THE PERSONAGROUP OWNS THE IDENTITY-SLOT VERDICT (the 2026-09-13 ruling, arm (B)
 * of the fork `docs/pono/identity-slot-policy#/the-fork-that-wants-a-ruling` surfaced):
 *
 *   "a slot doc's verdict = the face's grant records (the joinee's own act), never the realm's `keptBy`,
 *    never a roster; the realm never reads persona planes."
 *
 * THE INSTRUMENT-LIE THIS FILE REFUSES TO TELL. The policy carrier measured it: a stranger asking a slot doc
 * ALREADY draws false, because a slot doc sits outside the deterministic federatable set and the base gate
 * denies by default. A red that goes green on THAT answer measures the base and names the ring. So every
 * vector here asks the ring's OWN predicate (`admitsPeer`) directly, and the composed gate is tested beside a
 * PERMISSIVE base — which makes the ring, and nothing else, the thing that decides.
 *
 * Proven:
 *   · a peer holding a VERIFIED grant record on this face's PersonaGroup plane is admitted to the plane's docs,
 *   · a stranger — a peer that proved no key, or proved one no record names — is refused,
 *   · CONTROL: a peer named only in a REALM registration's `keptBy` is refused; the ring reads grants alone,
 *   · CONTROL: a record that fails the seal admits nobody, and a doc this ring does not govern is not its business,
 *   · CONTROL: the vessel's OWN hand (its in-process island, its own fleet) is never questioned, and a base
 *     that already allows is never narrowed — the ring WIDENS and never tightens.
 */
import { describe, test, expect } from "vitest";
import type { DocumentId, PeerId } from "@automerge/automerge-repo";
import { makePersonaGroupIdentityRing } from "../src/persona-group-ring.js";
import type { FederationGate } from "../src/federation-gate.js";

const PLANE   = "plane-doc" as DocumentId;
const ELSEWHERE = "some-other-doc" as DocumentId;
const MEMBER  = "peer-member"   as PeerId;
const STRANGER = "peer-stranger" as PeerId;
const MUTE    = "peer-proved-nothing" as PeerId;
const OWN     = "peer-own-island" as PeerId;
const MEMBER_KEY  = "aa".repeat(32);
const STRANGER_KEY = "bb".repeat(32);

const denyAll: FederationGate = { mayFederate: () => false };
const allowAll: FederationGate = { mayFederate: () => true };

/** One grant record as it rests on the plane — opaque to the ring, which never re-cuts a seal itself. */
const grantFor = (key: string) => ({ kind: "face-join-grant/v1", joineeAgentIdHex: `agent-${key}`, sig: `sig-${key}` });

function ring(opts?: { records?: unknown[]; verifyFails?: boolean }) {
  return makePersonaGroupIdentityRing({
    governs: (doc) => doc === PLANE,
    isOwnHand: (peer) => peer === OWN,
    provenVesselKey: (peer) => (peer === MEMBER ? MEMBER_KEY : peer === STRANGER ? STRANGER_KEY : null),
    grants: {
      records: () => opts?.records ?? [grantFor(MEMBER_KEY)],
      // The injected seal check — the SAME verify the joinee's own kit runs (`verifyFaceGrantRecord`), never
      // a second cut of it. Here it answers for the key the record names and refuses every other.
      verify: async (record, joineeVesselKey) =>
        !opts?.verifyFails && (record as { joineeAgentIdHex: string }).joineeAgentIdHex === `agent-${joineeVesselKey}`,
    },
  });
}

describe("the PersonaGroup ring — the face's grant records decide, and nothing else does", () => {
  test("a member holding a verified grant is admitted; a stranger and a mute peer are refused", async () => {
    const r = ring();
    expect(await r.admitsPeer(PLANE, MEMBER)).toBe(true);
    expect(await r.admitsPeer(PLANE, STRANGER)).toBe(false);   // proved a key no record names
    expect(await r.admitsPeer(PLANE, MUTE)).toBe(false);       // proved nothing — fail-closed
  });

  test("CONTROL: a peer named only in a realm registration's keptBy is refused — the realm never reads persona planes", async () => {
    // The registration a realm would carry for this hand, verbatim in its `keptBy`. The ring takes no realm
    // reading at all, so the name grants nothing here — which is the ruling, stated as an absence in the type.
    const realmRegistration = { bagUri: "lar:///ha.ka.ba/bags/lares", keptBy: [STRANGER_KEY], readTier: "contract" };
    expect(realmRegistration.keptBy).toContain(STRANGER_KEY);
    expect(await ring().admitsPeer(PLANE, STRANGER)).toBe(false);
  });

  test("CONTROL: a record that fails the seal admits nobody, and an empty plane admits nobody", async () => {
    expect(await ring({ verifyFails: true }).admitsPeer(PLANE, MEMBER)).toBe(false);
    expect(await ring({ records: [] }).admitsPeer(PLANE, MEMBER)).toBe(false);
  });

  test("CONTROL: a doc this ring does not govern is not its business", async () => {
    expect(await ring().admitsPeer(ELSEWHERE, MEMBER)).toBe(false);
  });

  test("the composed gate WIDENS a denying base for a grant-holder and never narrows an allowing one", async () => {
    const r = ring();
    const widened = r.compose(denyAll);
    expect(await widened.mayFederate(PLANE, MEMBER)).toBe(true);
    expect(await widened.mayFederate(PLANE, STRANGER)).toBe(false);
    expect(await widened.mayFederate(ELSEWHERE, MEMBER)).toBe(false);
    // CONTROL: the base's own allow survives untouched — the ring is a LEG, never a second veto.
    const permissive = r.compose(allowAll);
    expect(await permissive.mayFederate(PLANE, STRANGER)).toBe(true);
    expect(await permissive.mayFederate(ELSEWHERE, STRANGER)).toBe(true);
  });

  test("CONTROL: the vessel's OWN hand is never questioned — the founder's own reads do not move", async () => {
    let asked = 0;
    const r = makePersonaGroupIdentityRing({
      governs: () => true,
      isOwnHand: (peer) => peer === OWN,
      provenVesselKey: () => { asked += 1; return null; },
      grants: { records: () => [], verify: async () => false },
    });
    expect(await r.admitsPeer(PLANE, OWN)).toBe(true);
    expect(asked, "the ring read the peer's key for its own hand — the own-hand class must short-circuit").toBe(0);
  });
});
