/**
 * uds-session-door — the node's production door onto the session socket: the face a session wears, verified afresh at
 * every open and at every switch's preflight.
 *
 * A caller names a face by its ordinal hint, `h<N>`. The hint grants nothing: the door reads the face's PersonaGroup
 * from its own anchors and the face's K15 atom from its custody row (a locked face's row refuses).
 *
 * A SESSION IS A MEETING BETWEEN A FACE AND AN ANCHOR, held by neither's registry (session-contract#/the-hands). The
 * anchor follows the vessel's state, never its config: a dial pin standing (set once the vessel's own presentation
 * composed there) anchors the session at that Nexus, where the door reads the face's proof through the dial's own
 * reading (`composeFaceTarget`); no pin standing anchors it at the vessel's own place, its W29 place KEL prefix, where
 * the face proves itself by its atom presented to its own vessel and no Nexus admits it (`preparePlaceFace`). A hint
 * that names a Nexus (`h<N>@<aid>`) waits on a vessel that dials a second Nexus.
 *
 * The door reads and writes nothing: a founder's certificate stands from the dial's own presentation, and a face whose
 * certificate does not stand yet refuses by the absent piece. Each supply names its anchor; `anchorNow` answers where
 * the vessel stands, so the seat refuses `anchor-moved` to a session whose anchor the vessel left. The proven face's
 * PersonaGroup must be the hinted face's, or the door refuses `face-group-mismatch`.
 *
 * The supply it answers mounts nothing and mints no key. Its presenter names the face's atom, the key the daemon judges
 * that face's verbs by; its mint draws the session's signer once the owner's table holds the session live. At a place
 * the atom signs that signer's certificate, read afresh from custody at the mint and overwritten after.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/uds-session-door
 */
import {
  faceAtomPublicKey, signAsFaceAtom, HANDLE_INDEX_CEILING, nexusAidOfPin, preparePlaceFace, type GateBundlePin, type JoinedFaceTarget, type PlaceReading,
} from "@lararium/mesh";
import type { Hand } from "@lararium/mesh/session-contract";
import type { SessionOwnChain } from "@lararium/mesh";
import { HAND_PROFILES } from "@lararium/mesh/session-contract";
import { CustodyLocked } from "./custody-holder.js";
import { composeFaceTarget } from "./dial-presentation.js";
import { loadFaceAtomOfGroup } from "./face-atom-store.js";
import { loadIdentityAnchors } from "./identity-anchors.js";
import { placeReadingWatch } from "./node-vessel-identity.js";
import type { SessionAnchor, UdsSessionDoor } from "./uds-channel.js";

/** The ports the door reads; a vector replaces them, a vessel takes the defaults. */
export interface NodeSessionDoorPorts {
  /** The pin of the Nexus this vessel dials now (its own presentation composed there), or null: the place anchor. */
  readonly pin:          () => GateBundlePin | null;
  /** This vessel's own place, read from its verified place KEL. */
  readonly placeOf?:     () => Promise<PlaceReading>;
  readonly sealHome:     string;
  /** Where a fault's detail goes; the wire carries its code alone. */
  readonly onLog?:       (line: string) => void;
  readonly groupOfFace?: (face: number) => Promise<string | null>;
  readonly atomOfGroup?: (group: string) => Promise<Uint8Array | null>;
  readonly targetOf?:    (at: { readonly sealHome: string; readonly pin: GateBundlePin; readonly personaGroup: string }) =>
    Promise<{ readonly target: JoinedFaceTarget } | { readonly refusal: string }>;
}

const HINT = /^h(0|[1-9][0-9]{0,9})$/;
type DoorAnswer = Awaited<ReturnType<UdsSessionDoor["open"]>>;

/** Read a face hint: `h<N>`, the face ordinal below the handle-index ceiling. Anything else names no face. */
export function readFaceHint(hint: string): number | null {
  const m = HINT.exec(hint);
  if (!m) return null;
  const face = Number(m[1]);
  return face < HANDLE_INDEX_CEILING ? face : null;
}

export function nodeSessionDoor(ports: NodeSessionDoorPorts): UdsSessionDoor {
  const groupOfFace = ports.groupOfFace ?? (async (face: number) => (await loadIdentityAnchors(face))?.personaGroupId ?? null);
  const atomOfGroup = ports.atomOfGroup ?? loadFaceAtomOfGroup;
  const targetOf = ports.targetOf ?? ((at) => composeFaceTarget(at));
  const placeOf = ports.placeOf ?? placeReadingWatch();
  // THE PLACE ANCHOR NAMES ITS HEAD: each check reads where the place KEL stands (a stat, and a verify only once its bytes
  // moved), so a rotation of the place moves the anchor and ends the place's sessions `anchor-moved`; a read that fails
  // throws, and the seat refuses that frame `anchor-unread`. The signer reads the same head at each signature, so a
  // rotation mid-verb refuses `anchor-moved` there too.
  const placeAnchor = async (): Promise<SessionAnchor> => {
    const place = await placeOf();
    return { kind: "place", aid: place.place, head: place.head };
  };
  const anchorNow = async (): Promise<SessionAnchor> => {
    const pin = ports.pin();
    if (pin === null) return placeAnchor();
    const aid = nexusAidOfPin(pin);
    if (aid === null) throw new Error("the dial pin names no readable Nexus");
    return { kind: "nexus", aid };
  };
  const open = async (face: number, hand: Hand): Promise<DoorAnswer> => {
    const group = await groupOfFace(face);
    if (group === null) return { ok: false, refusal: "face-absent" };
    const seed = await atomOfGroup(group);
    if (seed === null) return { ok: false, refusal: "face-atom-absent" };
    let presenter: string;
    let atomKey: string;
    try { atomKey = faceAtomPublicKey(seed); presenter = `0x${atomKey}`; } finally { seed.fill(0); }
    const pin = ports.pin();
    if (pin === null) {
      // THE PLACE ANCHOR: the face's atom presented to its own vessel; no Nexus admits it.
      const place = await placeOf();
      const target = preparePlaceFace({ personaGroup: group, atomKey, place, anchorHead: async () => (await placeOf()).head, signAsAtom: async (image) => {
        const again = await atomOfGroup(group);
        if (again === null) throw new Error("the face's atom row went between the open and the mint");
        try { return await signAsFaceAtom(again, image); } finally { again.fill(0); }
      } });
      if (!("face" in target)) return { ok: false, refusal: target.refusal };
      return { ok: true, supply: {
        face: target.face, ordinal: face, profile: HAND_PROFILES[hand], presenter, anchor: { kind: "place", aid: place.place, head: place.head },
        mint: async (at) => {
          const minted = await target.mint(at);
          return "signer" in minted ? { ok: true, signer: minted.signer } : { ok: false, refusal: minted.refusal };
        },
      } };
    }
    const aid = nexusAidOfPin(pin);
    if (aid === null) return { ok: false, refusal: "pin-nexus-unreadable" };
    const read = await targetOf({ sealHome: ports.sealHome, pin, personaGroup: group });
    if (!("target" in read)) return { ok: false, refusal: read.refusal };
    const { target } = read;
    // The atom presents for the group the hint's anchors name; the proof must be that same group's, or nothing presents.
    if (target.face.personaGroup !== group) return { ok: false, refusal: "face-group-mismatch" };
    return { ok: true, supply: {
      face: target.face, ordinal: face, profile: HAND_PROFILES[hand], presenter, anchor: { kind: "nexus", aid },
      mint: async (at) => {
        const minted = await target.mint(at);
        return "signer" in minted ? { ok: true, signer: minted.signer } : { ok: false, refusal: minted.refusal };
      },
    } };
  };
  return {
    anchorNow,
    async open({ faceRef, hand }: { faceRef: string; hand: Hand }) {
      const face = readFaceHint(faceRef);
      if (face === null) return { ok: false, refusal: "face-hint-malformed" };
      // A refusal names a code alone: a locked face reads `face-locked`, any other fault `door-failed`, its detail logged.
      try { return await open(face, hand); }
      catch (error) {
        if (error instanceof CustodyLocked) return { ok: false, refusal: "face-locked" };
        ports.onLog?.(`session door: ${error instanceof Error ? error.message : String(error)}`);
        return { ok: false, refusal: "door-failed" };
      }
    },
  };
}

/**
 * Where the vessel's dial stands, as the session door reads it: the pin is set only once the vessel's own presentation
 * composed at it, and a refused composition, a failed re-dial or a dial stood down leaves none, so the vessel's
 * sessions anchor at its own place.
 */
export function dialAnchorCell(): {
  readonly pin: () => GateBundlePin | null;
  /** This vessel's own verified face chain at the pin, read off the presentation that composed there; null with no pin. */
  readonly chain: () => SessionOwnChain | null;
  readonly composed: (pin: GateBundlePin | null, presentation: unknown) => void;
  readonly clear: () => void;
} {
  let pin: GateBundlePin | null = null;
  let chain: SessionOwnChain | null = null;
  return Object.freeze({
    pin: () => pin,
    chain: () => chain,
    composed: (at: GateBundlePin | null, presentation: unknown) => {
      pin = presentation === null || presentation === undefined ? null : at;
      chain = pin === null ? null : chainOfPresentation(presentation);
    },
    clear: () => { pin = null; chain = null; },
  });
}

/** The public chain a composed presentation carries: the face's scope and this vessel's face-scoped key there. */
function chainOfPresentation(presentation: unknown): SessionOwnChain | null {
  const certificate = (presentation as { certificate?: { scope?: { faceKey?: unknown; nexus?: unknown }; vesselFaceKey?: unknown } } | null)?.certificate;
  const faceKey = certificate?.scope?.faceKey, nexus = certificate?.scope?.nexus, vesselFaceKey = certificate?.vesselFaceKey;
  return typeof faceKey === "string" && typeof nexus === "string" && typeof vesselFaceKey === "string"
    ? Object.freeze({ scope: Object.freeze({ faceKey, nexus }), vesselFaceKey })
    : null;
}
