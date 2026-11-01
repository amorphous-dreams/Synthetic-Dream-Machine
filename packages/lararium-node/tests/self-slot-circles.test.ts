/**
 * self-slot-circles — the circles doc reaches the face that owns it, NEVER federates to a stranger (STRUCTURAL).
 *
 * The operator ruling: the follow-graph rides the sovereign circles Automerge doc, PRIVATE-but-fleet-synced
 * (matching the catalog registry) — a follow shows on ALL the operator's OWN devices, and NEVER on anyone else's. This
 * holds that posture structurally at the sharePolicy shore, no vessel booted:
 *
 *   · the circles doc is a PRIVATE bag: its random doc id sits OUTSIDE the DeterministicFederationGate's fixed
 *     federatable set {crossroads · who · kapae-antigen · members · persona-KEL}. A cross-operator peer is
 *     denied it even with the Nexus OPEN — only the public shelf crosses. (never-federates)
 *   · a SAME-OPERATOR WS peer reads the circles doc through the gate of the face its session proved, and never by
 *     its class alone (D3, "Sharing after the gate"). (fleet-sync, face-scoped)
 *
 * A circles doc from ANOTHER key models the circles doc's own random private doc id — NOT in the gate built for
 * THIS Nexus, exactly as a private bag's id is not in the deterministic public set.
 */

import { describe, expect, test } from "vitest";
import { interpretAsDocumentId, type DocumentId } from "@automerge/automerge-repo";
import { DeterministicFederationGate, crossroadsDocUrl } from "@lararium/mesh";
import { selfSlotShareDecision, NO_BANS, NOBODY_ASIDE, NOTHING_CLASSED } from "../src/self-slot-share.js";

const NEXUS   = "ab".repeat(32);           // this operator's Nexus key
const OTHER   = "cd".repeat(32);           // a different key — its doc models the circles doc's random private id
const gate    = new DeterministicFederationGate(NEXUS);
const crossroadsId  = interpretAsDocumentId(crossroadsDocUrl(NEXUS)) as DocumentId;   // the PUBLIC shelf
const circlesStandIn = interpretAsDocumentId(crossroadsDocUrl(OTHER)) as DocumentId;  // a PRIVATE-bag-shaped id

describe("circles fleet-sync-but-never-federate (structural)", () => {
  test("the federatable set is the fixed public shelf — the circles doc is NOT in it", () => {
    expect(gate.mayFederate(crossroadsId)).toBe(true);    // the public shelf federates
    expect(gate.mayFederate(circlesStandIn)).toBe(false); // a private-bag id never does
  });

  test("a SAME-OPERATOR WS peer syncs the circles doc through its face's gate, and never by class (D3)", async () => {
    const base = {
      hasWsSocket: true, peerClass: "same-operator" as const,
      selfSlotFedGate: gate, antigenRing: NO_BANS, shadow: NOBODY_ASIDE, protectedDocs: NOTHING_CLASSED, membership: null, planeSeal: null,
      federationPosture: "private", peerId: "same-op-device", documentId: circlesStandIn,
    };
    expect(await selfSlotShareDecision(base)).toBe(false);   // RED: the class alone opens no private plane
    // CONTROL: the face that owns the circles doc reads it through its own gate.
    expect(await selfSlotShareDecision({ ...base, sessionFace: { mayFederate: (d: DocumentId) => d === circlesStandIn } })).toBe(true);
  });

  test("a CROSS-OPERATOR peer is DENIED the circles doc even with the Nexus OPEN", async () => {
    const base = {
      hasWsSocket: true, peerClass: "stranger" as const,
      selfSlotFedGate: gate, antigenRing: NO_BANS, shadow: NOBODY_ASIDE, protectedDocs: NOTHING_CLASSED, membership: null, planeSeal: null,
      federationPosture: "open" as const, peerId: "stranger",
    };
    // The public shelf DOES cross under OPEN — proving the denial below is SELECTIVE, not a blanket block.
    expect(await selfSlotShareDecision({ ...base, documentId: crossroadsId })).toBe(true);
    // the circles doc never crosses to a stranger — the follow-graph stays home.
    expect(await selfSlotShareDecision({ ...base, documentId: circlesStandIn })).toBe(false);
  });

  test("a CROSS-OPERATOR peer is denied the circles doc under a PRIVATE Nexus too", async () => {
    const denied = await selfSlotShareDecision({
      hasWsSocket: true, peerClass: "stranger",
      selfSlotFedGate: gate, antigenRing: NO_BANS, membership: null, planeSeal: null,
      federationPosture: "private", peerId: "stranger", documentId: circlesStandIn,
      shadow: NOBODY_ASIDE, protectedDocs: NOTHING_CLASSED,
    });
    expect(denied).toBe(false);
  });
});
