/**
 * persona-group-ring-assembly — THE ONE assembly of the PersonaGroup identity-slot ring, for EVERY vessel.
 *
 * The ruling (`docs/pono/identity-slot-policy#/the-ruling`, arm B) hands the verdict to the face's own grant
 * records. `makePersonaGroupIdentityRing` (mesh) holds that verdict; this function hands it the inputs every
 * vessel reads the same way:
 *
 *   · `governs`         — the face's four plane doc-ids, resolved off the vessel's own catalog
 *                         (`governedPlaneDocIds`, the resolution `DeterministicFederationGate` runs);
 *   · `provenVesselKey` — the trailing 64 hex of what the peer PROVED (`provenVesselKeyOf`), never a claim;
 *   · `isOwnHand`       — the vessel's own in-process hand, never questioned;
 *   · `grants`          — the face-join grant records on the face's own plane, judged by the ONE
 *                         `verifyFaceGrantRecord` the joinee's own kit runs (the ring re-cuts no seal).
 *
 * ONE FUNCTION, TWO SHORES. Node and browser both call this; only the PROOF SOURCE differs. A node vessel
 * reads the identifier its inbound `DaemonAuthGate` proved; a browser leaf reads the gate key its outbound
 * transport proved when that gate SIGNED its verdict (`LarWSClientAdapter.provenKeyOf`). Neither source is
 * a claim the peer made about itself.
 *
 * NO CLOCK RIDES IN AT ALL. `verifyFaceGrantRecord`'s validity window is a founder-edge freshness check
 * `verifyEdgeAgainstPersonaKel` can run with or without; this assembly supplies no `now` and abstains
 * (refuses) whenever it holds no founder persona-KEL chain to walk. Admission rides EVENT ORDER alone: the
 * KEL-head walk refuses an edge a rotated-away op-key signed.
 *
 * IT WIDENS AND NEVER NARROWS: the ring `compose`s onto a vessel's outer fed gate by an OR, opening exactly
 * the face's own planes to a proven grant-holder and touching nothing else (see `persona-group-ring.ts`).
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/identity-slot-policy
 */
import {
  makePersonaGroupIdentityRing, personaScopedBagIds, governedPlaneDocIds, provenVesselKeyOf,
  type PersonaGroupIdentityRing, type PersonaKelEvent, type PlaneCatalog,
} from "@lararium/mesh";
import { verifyFaceGrantRecord, FACE_GRANT_PREFIX } from "./face-grant-record.js";

type RingPeerId = Parameters<PersonaGroupIdentityRing["admitsPeer"]>[1];

export interface PersonaGroupRingInput {
  readonly catalog: PlaneCatalog;
  /** The face this vessel wears — its PersonaGroup sentinel doc id (hex). */
  readonly personaGroupDocIdHex: string;
  /** The persona root the face pinned at admit — the published seal the founder edge chains to. */
  readonly personaRootDid: string;
  /** The founder's persona-KEL, when this vessel holds it (the edge verifies under the KEL head). */
  readonly personaKel?: { readonly prefix: string; readonly chain: readonly PersonaKelEvent[] };
  /** What a peer PROVED to this vessel — an identifier or a bare verifying key; its trailing 64 hex is read.
   *  Undefined or null for a peer that proved nothing. */
  readonly provenKeyOf: (peerId: RingPeerId) => string | null | undefined;
  /** The vessel's OWN hand — its in-process island / own fleet; never questioned. */
  readonly isOwnHand?: (peerId: RingPeerId) => boolean;
}

export async function assemblePersonaGroupRing(input: PersonaGroupRingInput): Promise<PersonaGroupIdentityRing> {
  const group = input.personaGroupDocIdHex;
  const governedDocIds = await governedPlaneDocIds(input.catalog, group);        // resolved once, at wiring time
  const planeBag = personaScopedBagIds(group).persona;
  const prefix = `${FACE_GRANT_PREFIX}${group}/`;

  return makePersonaGroupIdentityRing({
    governs: (documentId) => governedDocIds.has(documentId),
    ...(input.isOwnHand ? { isOwnHand: input.isOwnHand } : {}),
    provenVesselKey: (peerId) => provenVesselKeyOf(input.provenKeyOf(peerId)),
    grants: {
      // The records resting on the face's own plane — the SAME store `takeFaceGrantIfPublished` reads.
      records: async () => {
        const store = await input.catalog.storeOf(planeBag);
        if (!store) return [];
        const titles = (await store.listVisible()).filter((t) => t.startsWith(prefix));
        const out: unknown[] = [];
        for (const title of titles) {
          const rec = await store.get(title);
          const text = (rec as { tiddler?: { text?: unknown } } | null)?.tiddler?.text;
          if (typeof text !== "string") continue;
          try { out.push(JSON.parse(text)); } catch { /* a torn record withholds — skip, never throw */ }
        }
        return out;
      },
      // The ONE verify the joinee's own kit runs, bound to THIS face's root/KEL — NO clock. Absent a founder
      // persona-KEL chain to walk, this ABSTAINS (refuses): fail-closed, never a clock-decided admit.
      verify: async (record, joineeVesselKey) => {
        if (!input.personaKel) return false;
        const verdict = await verifyFaceGrantRecord(record, {
          personaRootDid: input.personaRootDid,
          selfVerifyingKey: joineeVesselKey,
          groupDocIdHex: group,
          personaKel: input.personaKel,
        });
        return verdict.ok;
      },
    },
  });
}
