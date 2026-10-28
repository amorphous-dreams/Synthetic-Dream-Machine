/**
 * uds-session-door — the node's production door onto the session socket: the face a session wears, verified afresh at
 * every open and at every switch's preflight.
 *
 * A caller names a face by its ordinal hint, `h<N>`. The hint grants nothing: the door reads the face's PersonaGroup
 * from its own anchors, the face's K15 atom from its custody row (a locked face's row refuses), and the face's proof
 * at the Nexus of the vessel's current dial pin through the dial's own reading (`composeFaceTarget`). One session
 * binds one (face, Nexus): the door binds the one Nexus the vessel dials, and a hint that names a Nexus
 * (`h<N>@<aid>`) waits on a second Nexus.
 *
 * The supply it answers mounts nothing and mints no key. Its presenter names the face's atom, the key the daemon judges
 * that face's verbs by; its mint draws the session's signer once the owner's table holds the session live.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/uds-session-door
 */
import { faceAtomKeyFromSeed, type GateBundlePin, type JoinedFaceTarget } from "@lararium/mesh";
import type { Hand } from "@lararium/mesh/session-contract";
import { HAND_PROFILES } from "@lararium/mesh/session-contract";
import { CustodyLocked } from "./custody-holder.js";
import { composeFaceTarget } from "./dial-presentation.js";
import { loadFaceAtomOfGroup } from "./face-atom-store.js";
import { loadIdentityAnchors } from "./identity-anchors.js";
import type { UdsSessionDoor } from "./uds-channel.js";

/** The ports the door reads; a vector replaces them, a vessel takes the defaults. */
export interface NodeSessionDoorPorts {
  /** The pin of the Nexus this vessel dials now, or null where it dials none. */
  readonly pin:          () => GateBundlePin | null;
  readonly sealHome:     string;
  readonly groupOfFace?: (face: number) => Promise<string | null>;
  readonly atomOfGroup?: (group: string) => Promise<Uint8Array | null>;
  readonly targetOf?:    (at: { readonly sealHome: string; readonly pin: GateBundlePin; readonly personaGroup: string }) =>
    Promise<{ readonly target: JoinedFaceTarget } | { readonly refusal: string }>;
}

const HINT = /^h(0|[1-9][0-9]{0,9})$/;

/** Read a face hint: `h<N>`, the face ordinal. Anything else names no face. */
export function readFaceHint(hint: string): number | null {
  const m = HINT.exec(hint);
  return m ? Number(m[1]) : null;
}

export function nodeSessionDoor(ports: NodeSessionDoorPorts): UdsSessionDoor {
  const groupOfFace = ports.groupOfFace ?? (async (face: number) => (await loadIdentityAnchors(face))?.personaGroupId ?? null);
  const atomOfGroup = ports.atomOfGroup ?? loadFaceAtomOfGroup;
  const targetOf = ports.targetOf ?? ((at) => composeFaceTarget(at));
  return {
    async open({ faceRef, hand }: { faceRef: string; hand: Hand }) {
      const face = readFaceHint(faceRef);
      if (face === null) return { ok: false, refusal: "face-hint-malformed" };
      const group = await groupOfFace(face);
      if (group === null) return { ok: false, refusal: "face-absent" };
      let seed: Uint8Array | null;
      try { seed = await atomOfGroup(group); }
      catch (error) {
        if (error instanceof CustodyLocked) return { ok: false, refusal: "face-locked" };
        throw error;
      }
      if (seed === null) return { ok: false, refusal: "face-atom-absent" };
      let presenter: string;
      try { presenter = `0x${faceAtomKeyFromSeed(seed, group).key}`; } finally { seed.fill(0); }
      const pin = ports.pin();
      if (pin === null) return { ok: false, refusal: "no-dial-pin" };
      const read = await targetOf({ sealHome: ports.sealHome, pin, personaGroup: group });
      if (!("target" in read)) return { ok: false, refusal: read.refusal };
      const { target } = read;
      return { ok: true, supply: {
        face: target.face, profile: HAND_PROFILES[hand], presenter,
        mint: async (at) => {
          const minted = await target.mint(at);
          return "signer" in minted ? { ok: true, signer: minted.signer } : { ok: false, refusal: minted.refusal };
        },
      } };
    },
  };
}
