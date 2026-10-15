/**
 * gate-rings — THE GRANT RING a gate asks (`@lararium/mesh` `face-gate` `GateFaceGrantRing`): the private,
 * root-authorized record that a presenting face key speaks for a PersonaGroup this vessel shares, or null.
 *
 * ── TWO SOURCES, ONE ANSWER ─────────────────────────────────────────────────────────────────────
 * The ring answers the union of what this vessel holds of its own faces:
 *   · A JOINED VESSEL'S RECORDS. Each fleet join this vessel landed left a face's record (`face-join-record`):
 *     the root's grants, kept beside the root key that signed them. Every grant re-reads under that record's
 *     root key (`readFaceKeyGrant`) and must name the record's own PersonaGroup; a grant that fails either
 *     reads as no grant.
 *   · THE ROOT HOLDER'S OWN SCOPES. A vessel that holds a face's root signs a grant for each scope the face
 *     stands at whenever a joinee asks (`fleet-join` ANSWER). The ring reads, for each such standing scope,
 *     the grant that root would sign. Its revision digests the signed image alone, so the ring signs nothing
 *     and touches no seed to answer it.
 * Two sources that name one scope agree, or the ring answers null: one face key speaks for one PersonaGroup,
 * and a scope two groups claim reads as no grant.
 *
 * ── PURE OVER INJECTED READERS ──────────────────────────────────────────────────────────────────
 * `gateGrantFor` decides over values it receives. `gateGrantRing` asks its readers afresh at every presenter
 * and caches nothing, so a record a later join replaced answers at once. A reader that throws (a locked seat,
 * a record that reads malformed) throws through `grantFor`: the gate reads a thrown collaborator as a fault and
 * falls silent, where a ring that swallowed the fault would sort a same-operator face as a stranger by chance.
 *
 * The node's disk readers (the records under the identity seat, the root holder's charters and per-Nexus keys)
 * stay the composition's to bind; this module reads no disk.
 *
 * Stands specified until the socket cutover seats a gate over it.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/face-proof#/the-key-hierarchy
 */
import {
  faceKeyGrantRevision, readFaceKeyGrant,
  type FaceGrantReading, type FaceScope,
} from "@lararium/mesh";
import type { FaceJoinRecord } from "./fleet-join-custody.js";

/** A face whose root this vessel holds, and the scopes the face stands at here. */
export interface GateRootHolding {
  readonly personaGroup: string;
  readonly scopes:       readonly FaceScope[];
}

/** What the ring reads. Each reader answers this vessel's own state as it stands at the call. */
export interface GateGrantRingReaders {
  /** Every face record this vessel landed at a fleet join. */
  readonly joinRecords:  () => readonly FaceJoinRecord[] | Promise<readonly FaceJoinRecord[]>;
  /** Every face whose root this vessel holds; none on a vessel that holds no root. */
  readonly rootHoldings: () => readonly GateRootHolding[] | Promise<readonly GateRootHolding[]>;
}

/** The ring, as `face-gate`'s `GateFaceGrantRing` asks it. */
export interface GateGrantRing {
  grantFor(scope: FaceScope): Promise<FaceGrantReading | null>;
}

const atScope = (s: FaceScope, scope: FaceScope): boolean => s.faceKey === scope.faceKey && s.nexus === scope.nexus;
const sameReading = (a: FaceGrantReading, b: FaceGrantReading): boolean =>
  a.personaGroup === b.personaGroup && a.faceKey === b.faceKey && a.nexus === b.nexus && a.revision === b.revision;

function reading(personaGroup: string, scope: FaceScope): FaceGrantReading {
  const revision = faceKeyGrantRevision({ personaGroup, scope, signature: "" });
  return Object.freeze({ personaGroup, faceKey: scope.faceKey, nexus: scope.nexus, revision });
}

/**
 * The grant this vessel holds for `scope`, over the records it landed and the roots it holds; null where neither
 * names the scope, or where two name it for different PersonaGroups.
 */
export function gateGrantFor(scope: FaceScope, records: readonly FaceJoinRecord[], holdings: readonly GateRootHolding[]): FaceGrantReading | null {
  const found: FaceGrantReading[] = [];
  for (const record of records) {
    for (const raw of record.grants) {
      const grant = readFaceKeyGrant(raw, record.rootKey);
      if (grant === null || grant.personaGroup !== record.personaGroup || !atScope(grant.scope, scope)) continue;
      found.push(reading(grant.personaGroup, grant.scope));
    }
  }
  for (const holding of holdings) {
    if (holding.scopes.some((s) => atScope(s, scope))) found.push(reading(holding.personaGroup, scope));
  }
  const [first] = found;
  if (first === undefined) return null;
  return found.every((r) => sameReading(r, first)) ? first : null;
}

/** The grant ring over this vessel's readers. */
export function gateGrantRing(readers: GateGrantRingReaders): GateGrantRing {
  return Object.freeze({
    async grantFor(scope: FaceScope): Promise<FaceGrantReading | null> {
      const [records, holdings] = await Promise.all([readers.joinRecords(), readers.rootHoldings()]);
      return gateGrantFor(scope, records, holdings);
    },
  });
}
