/**
 * realm-plane — the node holder that STANDS the realm's shared CRDT on a vessel: materializes the realm doc the
 * charter names, pins the pointer on the vessel's own oracle plane (so the daemon island's reach walks it),
 * folds the standing registrations into the wire gate, and lands a steward's registration + its @crossroads
 * announce.
 *
 * A vessel that holds no charter stands no realm — the holder is INERT (no doc, no pointer, the base gate
 * unchanged). A charter that arrives AFTER boot (`nexus seal import`, then `nexus refresh`) stands it then:
 * `refresh(charter)` re-reads the realm id and materializes on first sight; a re-read of the same realm is a
 * no-op. The realm id NEVER moves for a standing realm (a genesis epoch is fixed for life), so a different id
 * on refresh names a DIFFERENT charter — the holder re-stands on it and the prior realm's docs leave the gate.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/realm-bag-brief#/what-the-realm-holds
 */

import type { Repo, DocHandle, AutomergeUrl } from "@automerge/automerge-repo";
import { materializeSharedLarDoc } from "./deterministic-doc.js";
import { mutableLarRecord, tiddlerText, type LarDoc } from "./base-doc.js";
import type { NexusDoc } from "./nexus-seal-seed.js";
import type { FederationGate, NexusMembership } from "./federation-gate.js";
import type { CapTier } from "./cap-tier.js";
import {
  REALM_DOC_URI, REALM_ID_TIDDLER, realmIdOfCharter, realmDocUrl, RealmBagGate,
  signRealmBagRegistration, realmBagRegistrationCounts, writeRealmBagRegistration, foldRealmBags,
  writeRealmBagAnnounce, type RealmBagRegistration,
} from "./realm-bag.js";

export interface RealmPlaneHolder {
  /** The composed wire gate — the base's federatable shelf plus the realm's member-read lane. */
  readonly gate: FederationGate;
  /** The realm this vessel stands in, or null while no charter names one. */
  realmId(): string | null;
  /** The realm doc url, or null while unstood. */
  realmUrl(): AutomergeUrl | null;
  /** Re-read the charter; stand the realm on first sight (or on a different id). Idempotent for a standing realm. */
  refresh(charter: NexusDoc | null): Promise<void>;
  /** The standing registrations (counted, folded) keyed by bag URI. */
  standing(): Promise<ReadonlyMap<string, RealmBagRegistration>>;
  /** Register a bag this vessel's steward keeps: sign, land on the realm doc, announce on @crossroads. */
  register(input: {
    readonly bagUri: string;
    readonly docUrl: string;
    readonly readTier?: CapTier;
    readonly signers: ReadonlyArray<{ readonly signer: string; readonly sign: (bytes: Uint8Array) => Promise<string> }>;
  }): Promise<RealmBagRegistration>;
  /** Detach the realm doc change listener. */
  dispose(): void;
}

export function makeRealmPlane(opts: {
  readonly repo: Repo;
  /** The vessel's own oracle plane — the pointer to the realm doc lands here. */
  readonly oracleHandle: DocHandle<LarDoc>;
  /** The public crossroads doc the announce lands on. */
  readonly crossroadsHandle: DocHandle<LarDoc>;
  readonly membership: NexusMembership;
  readonly base: FederationGate;
  readonly onLog?: (line: string) => void;
}): RealmPlaneHolder {
  const { repo, oracleHandle, crossroadsHandle, membership, base } = opts;
  const log = opts.onLog ?? (() => {});
  let realmId: string | null = null;
  let realmUrl: AutomergeUrl | null = null;
  let realmHandle: DocHandle<LarDoc> | null = null;
  let realmGate: RealmBagGate | null = null;
  let onChange: (() => void) | null = null;

  const refold = async (): Promise<void> => {
    if (!realmGate || !realmHandle || !realmId) return;
    await realmGate.refold(realmHandle.doc(), realmId);
  };

  const detach = (): void => {
    if (realmHandle && onChange) realmHandle.off("change", onChange);
    realmHandle = null; onChange = null;
  };

  const stand = async (id: string): Promise<void> => {
    detach();
    realmId  = id;
    realmUrl = realmDocUrl(id);
    realmHandle = await materializeSharedLarDoc(repo, realmUrl, "realm");
    realmGate = new RealmBagGate(base, membership, realmUrl);
    onChange = () => { void refold(); };
    realmHandle.on("change", onChange);
    await refold();
    // The pointer on the vessel's OWN plane — the daemon island's reach reads the realm id and doc from here,
    // never off the realm doc itself (a member who could rewrite the id there could make a foreign record count).
    const doc = oracleHandle.doc();
    if (tiddlerText(doc?.tiddlers?.[REALM_DOC_URI]) !== realmUrl || tiddlerText(doc?.tiddlers?.[REALM_ID_TIDDLER]) !== id) {
      const url = realmUrl;
      oracleHandle.change((d) => {
        d.tiddlers[REALM_DOC_URI]   = mutableLarRecord(REALM_DOC_URI,   { text: url }, "vessel-boot");
        d.tiddlers[REALM_ID_TIDDLER] = mutableLarRecord(REALM_ID_TIDDLER, { text: id },  "vessel-boot");
      });
    }
    log(`realm ${id.slice(0, 16)}… stands — doc ${realmUrl}`);
  };

  const gate: FederationGate = {
    mayFederate: (documentId, peerId) => (realmGate ?? base).mayFederate(documentId, peerId),
  };

  return {
    gate,
    realmId: () => realmId,
    realmUrl: () => realmUrl,
    async refresh(charter) {
      const id = realmIdOfCharter(charter);
      if (!id) return;                 // no charter → inert (a vessel outside every realm)
      if (id === realmId) { await refold(); return; }
      await stand(id);
    },
    async standing() {
      if (!realmHandle || !realmId) return new Map();
      return foldRealmBags(realmHandle.doc(), realmId);
    },
    async register({ bagUri, docUrl, readTier, signers }) {
      if (!realmHandle || !realmId) throw new Error("realm-bag: this vessel stands in no realm — seat a charter (`lares nexus rite cabal`) or import one (`lares nexus seal import`) and `lares nexus refresh`");
      if (signers.length === 0) throw new Error("realm-bag: a bag is kept by a named steward — no signer supplied");
      const rec = await signRealmBagRegistration({ realmId, bagUri, docUrl, readTier: readTier ?? "contract" }, signers);
      // Self-verify before the write: a record the fold would ignore reads as registered while carrying nothing.
      if (!(await realmBagRegistrationCounts(rec, realmId))) throw new Error("realm-bag: refusing to write a registration that does not count");
      realmHandle.change((d) => writeRealmBagRegistration(d, rec));
      crossroadsHandle.change((d) => writeRealmBagAnnounce(d, rec));
      await refold();
      return rec;
    },
    dispose: detach,
  };
}
