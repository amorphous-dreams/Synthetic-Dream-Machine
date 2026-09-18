/**
 * self-slot-persona-ring — assemble THE PERSONAGROUP identity-slot ring for the node self-slot shore.
 *
 * The ruling (`docs/pono/identity-slot-policy#/the-ruling`, arm B) hands the verdict to the face's own grant
 * records. `makePersonaGroupIdentityRing` (mesh) holds that verdict; a live node vessel already carries every
 * input it wants, so this factory ASSEMBLES them and hands back a ring the shore composes onto its outer gate:
 *
 *   · `governs`         — the face's four plane doc-ids, resolved off the catalog the SAME way
 *                         `DeterministicFederationGate` resolves its own set (`interpretAsDocumentId`);
 *   · `provenVesselKey` — the trailing 64 hex of what the peer PROVED at the DaemonAuthGate (never a claim);
 *   · `isOwnHand`       — the class the shore already vouches (an in-process / same-operator peer);
 *   · `grants`          — the persona-plane read `takeFaceGrantIfPublished` already runs, bound to the ONE
 *                         `verifyFaceGrantRecord` the joinee's own kit runs (the ring re-cuts no seal).
 *
 * NO CLOCK RIDES IN AT ALL. `verifyFaceGrantRecord`'s validity window is a founder-edge freshness check
 * `verifyEdgeAgainstPersonaKel` can run with or without; this factory supplies no `now` and abstains
 * (refuses) whenever it holds no founder persona-KEL chain to walk, rather than falling back to a
 * pinned-root-only verify gated on a wall clock. Admission rides EVENT ORDER alone: the KEL-head walk
 * refuses an edge a rotated-away op-key signed, clocklessly (no global now).
 *
 * IT WIDENS AND NEVER NARROWS: the ring `compose`s onto the outer fed gate by an OR, opening exactly the
 * face's own planes to a proven grant-holder and touching nothing else (see `persona-group-ring.ts`).
 *
 * Meme: lar:///ha.ka.ba/lararium/node/self-slot-share · lar:///ha.ka.ba/lares/docs/pono/identity-slot-policy
 */
import { interpretAsDocumentId, type AutomergeUrl, type DocumentId, type PeerId } from "@automerge/automerge-repo";
import {
  makePersonaGroupIdentityRing, personaScopedBagIds,
  type PersonaGroupIdentityRing, type PersonaKelEvent,
} from "@lararium/mesh";
import { verifyFaceGrantRecord, FACE_GRANT_PREFIX } from "@lararium/keyhive";

/** The slice of a catalog accessor the ring reads — `makeCatalogAccessor(repo, catalogUrl)` satisfies it. */
export interface PlaneCatalog {
  urlOf(bagUri: string): Promise<string | null>;
  storeOf(bagUri: string): Promise<{ listVisible(): Promise<string[]>; get(title: string): Promise<unknown> } | null>;
}

export interface SelfSlotPersonaRingInput {
  readonly catalog: PlaneCatalog;
  /** The face this vessel wears — its PersonaGroup sentinel doc id (hex). */
  readonly personaGroupDocIdHex: string;
  /** The persona root the face pinned at admit — the published seal the founder edge chains to. */
  readonly personaRootDid: string;
  /** The founder's persona-KEL, when this vessel holds it (the edge verifies under the KEL head). */
  readonly personaKel?: { readonly prefix: string; readonly chain: readonly PersonaKelEvent[] };
  /** The identifier a peer PROVED at the DaemonAuthGate (peerIdentifierMap.get); undefined for a peer that proved none. */
  readonly provenIdentifierOf: (peerId: PeerId) => string | null | undefined;
  /** The vessel's OWN hand — its in-process island / own fleet; never questioned. */
  readonly isOwnHand?: (peerId: PeerId) => boolean;
}

/**
 * The vessel verifying key a proven identifier carries — its trailing 64 hex.
 * A peer that proved nothing, or an identifier too short to carry a key, reads null (fail-closed).
 */
export function provenVesselKeyOf(identifier: string | null | undefined): string | null {
  if (typeof identifier !== "string") return null;
  const m = identifier.toLowerCase().match(/[0-9a-f]{64}$/);
  return m ? m[0] : null;
}

/** Resolve the face's four plane bags to the doc-ids the shore decides over. Absent planes fall out (fail-closed). */
async function governedDocIdsOf(catalog: PlaneCatalog, group: string): Promise<ReadonlySet<DocumentId>> {
  const planes = personaScopedBagIds(group);
  const ids = new Set<DocumentId>();
  for (const bag of [planes.persona, planes.circles, planes.identities, planes.sessions]) {
    const url = await catalog.urlOf(bag);
    if (url) ids.add(interpretAsDocumentId(url as AutomergeUrl) as DocumentId);
  }
  return ids;
}

export async function makeSelfSlotPersonaGroupRing(input: SelfSlotPersonaRingInput): Promise<PersonaGroupIdentityRing> {
  const group = input.personaGroupDocIdHex;
  const governedDocIds = await governedDocIdsOf(input.catalog, group);        // resolved once, at wiring time
  const planeBag = personaScopedBagIds(group).persona;
  const prefix = `${FACE_GRANT_PREFIX}${group}/`;

  return makePersonaGroupIdentityRing({
    governs: (documentId) => governedDocIds.has(documentId),
    ...(input.isOwnHand ? { isOwnHand: input.isOwnHand } : {}),
    provenVesselKey: (peerId) => provenVesselKeyOf(input.provenIdentifierOf(peerId)),
    grants: {
      // The records resting on the face's own plane — read the SAME store `takeFaceGrantIfPublished` reads.
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
      // The ONE verify the joinee's own kit runs, bound to THIS face's root/KEL — NO clock. Absent a
      // founder persona-KEL chain to walk, this ABSTAINS (refuses) rather than falling back to a
      // pinned-root-only check gated on a wall clock: fail-closed, never a clock-decided admit.
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
