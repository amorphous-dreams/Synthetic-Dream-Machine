/**
 * worn-mount — WHICH face a reboot mounts, when the operator wore one that is not the founding face.
 *
 * ── THE GAP THIS CLOSES ─────────────────────────────────────────────────────────────────────────
 * `persona wear N` moves ONE thing: the selector pointer ("only the selector pointer moves; the root
 * never does"). The daemon doc's singular mount pins — the PersonaGroup + MeshCabal ids, the signer DID,
 * the persona-KEL prefix and the signed device edge — are written ONCE, by the FOUNDING face, and never
 * move again; an added compartment founds `mount:false` and pins none of them. So a reboot after a wear
 * re-mounted h0 no matter which mask the operator had put on, while the door told them the opposite
 * ("reboot-to-switch: restart the node to sign as it"). A pointer moved and nothing followed it.
 *
 * The switched face's material is not missing — it lives in that face's OWN anchors, persisted at its
 * founding: the signer DID, the persona-KEL prefix, and the SIGNED device→persona edge. All of it is
 * PUBLIC re-pin material (a verifying-key identifier, a KEL prefix, a signed grant record); no secret
 * rides here, which is why it may sit beside the doc-ids at all.
 *
 * ── WHAT THIS DECIDES, AND WHAT IT REFUSES TO DECIDE ────────────────────────────────────────────
 * It answers ONLY "which face did the operator wear, and does that face carry its own mount material".
 * It verifies no signature and grants no capability: the edge it names is presented to the SAME Binding
 * Gate every boot runs, which verifies it in full or grants no persona caps at all. The switch changes
 * WHICH edge is presented, never WHETHER it is checked — a gate that softened for a switched mask would
 * turn a convenience into a hole.
 *
 * FAIL-CLOSED, AND SILENT WHERE SILENCE IS HONEST. Three readings answer `null`, each meaning "no switch
 * is owed" rather than "something is wrong": nothing worn (no selector), the FOUNDING face worn (the pins
 * already name it), and anchors that carry no mount material — written before the slot existed, or held
 * by a joinee that minted no edge of its own. A half-anchor never re-pins a mount: a partial switch would
 * mount one face's planes under another face's authority, which is the one outcome worse than not switching.
 */

import { loadActivePersonaIndex } from "./node-vessel-identity.js";
import { loadIdentityAnchors } from "./identity-anchors.js";
import type { DeviceDelegationTiddler } from "@lararium/mesh";

/** A switched face's mount material — every field required, because a partial mount is the bad outcome. */
export interface WornPersonaMount {
  readonly handleIndex:            number;
  readonly personaGroupDocIdHex:   string;
  readonly meshCabalDocIdHex:      string;
  readonly personaGroupAgentIdHex: string;
  readonly signerDid:              string;
  readonly personaKelPrefix:       string;
  readonly deviceEdge:             DeviceDelegationTiddler;
}

/**
 * The face this vessel WEARS, when a reboot owes it a mount-switch — or `null` when it owes none.
 *
 * Reads the selector, then that face's own anchors. Index 0 answers `null` by design: the founding face
 * already owns the daemon-doc pins, so re-pinning it from anchors would replace a reading with an identical
 * one and invite the two sources to drift.
 */
export async function readWornPersonaMount(dataDir: string): Promise<WornPersonaMount | null> {
  const handleIndex = await loadActivePersonaIndex(dataDir);
  if (handleIndex === undefined || handleIndex === 0) return null;

  const anchors = loadIdentityAnchors(handleIndex);
  if (!anchors) return null;
  const { signerDid, personaKelPrefix, deviceEdge } = anchors;
  // ALL THREE OR NONE — see the fail-closed note above.
  if (!signerDid || !personaKelPrefix || !deviceEdge) return null;

  return {
    handleIndex,
    personaGroupDocIdHex:   anchors.personaGroupDocIdHex,
    meshCabalDocIdHex:      anchors.meshCabalDocIdHex,
    personaGroupAgentIdHex: anchors.personaGroupAgentIdHex,
    signerDid,
    personaKelPrefix,
    deviceEdge,
  };
}
