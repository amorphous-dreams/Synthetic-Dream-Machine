/**
 * realm-plane — the node holder that STANDS the realm's shared CRDT on a vessel: materializes the realm doc the
 * charter names, pins the pointer on the vessel's own oracle plane (so the daemon island's reach walks it),
 * folds the standing registrations into the wire gate, and lands a steward's registration + its @crossroads
 * announce.
 *
 * A vessel that holds no charter stands no realm — the holder is INERT (no doc, no pointer, the base gate
 * unchanged). A charter that arrives AFTER boot (`nexus seal import`, carried or primary) stands it then: the
 * import itself pokes a standing vessel's refold at once (no separate verb to run), and this holder's own
 * `refresh(charter)` re-reads the realm id and materializes on first sight; a re-read of the same realm is a
 * no-op. The realm id NEVER moves for a standing realm (a genesis epoch is fixed for life), so a different id
 * on refresh names a DIFFERENT charter — the holder re-stands on it and the prior realm's docs leave the gate.
 *
 * WHO SEALS. The holder seals with the steward signers its door hands it, and holds no key. Every signer passes
 * the `stewardGuard` the composing vessel seats before any byte gets signed: the door `realm-steward` builds
 * that guard over the vessel's own keys, and it refuses a persona root, a vessel key and a key it cannot class.
 *
 * A NAME ENTERS A RECORD BY ITS OWN HAND FIRST. Nobody can class a key that belongs to another hand, so the
 * steward door writes somebody else's name only where that name already sealed a record of this realm
 * (`sealedHere`). A hand that would keep a bag another hand keeps ASKS (`join`): it seals a proposal that names
 * the standing stewards and itself, and each standing steward consents by `coSign`. A record still short of a
 * seal lands under its own key and never unseats the registration that stands.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/realm-bag-brief#/what-the-realm-holds
 */

import type { Repo, DocHandle, AutomergeUrl } from "@automerge/automerge-repo";
import {
  materializeSharedLarDoc, storedLarRecord, tiddlerText, type LarDoc,
  type NexusDoc, type FederationGate, type NexusMembership, type CapTier,
  REALM_DOC_URI, REALM_ID_TIDDLER, REALM_STEWARD_TIDDLER, realmIdOfCharter, realmDocUrl, RealmBagGate,
  signRealmBagRegistration, proposeRealmBagRegistration, coSignRealmBagRegistration,
  realmBagRegistrationCounts, writeRealmBagRegistration, realmBagRegistrationsFromDoc, foldRealmBags,
  realmBagBytes, realmBagSealedBy, stewardSealedHere, hex,
  writeRealmBagAnnounce, type RealmBagRegistration, type RealmCharterConsult, type StewardSigner,
  type RealmBagFoldOptions,
} from "@lararium/mesh";

/** Why a seal on this vessel refused. */
export type StewardRefusal =
  | "no-realm"                 // the plane never stood, or stands in no realm
  | "no-face-worn"             // this vessel wears no face, or holds no root for the worn index
  | "steward-key-unreadable"   // this vessel's own keys would not read (a locked vault, a torn roster)
  | "steward-key-class"        // the key reads as anything but this vessel's own per-Nexus face key at this Nexus
  | "steward-name-unreadable"  // a name that reads neither a face key nor a Handle prefix
  | "steward-name-unproven"    // a name another hand would write, whose own holder sealed nothing in this realm
  | "handle-chain-mismatch";   // a Handle signer whose chain does not open on its own name

/** A refusal to seal or to name, by name. Nothing got sealed and nothing got written when one throws. */
export class StewardRefused extends Error {
  constructor(readonly refusal: StewardRefusal, message: string) {
    super(`realm-bag: REFUSED (${refusal}) — ${message}`);
    this.name = "StewardRefused";
  }
}

/** The check a steward signer passes before it seals on this vessel. It throws to refuse, by name. `nexusAid`
 *  names the Nexus the realm stands under: the AID a face's per-Nexus key derives against. */
export type StewardGuard = (signer: StewardSigner, nexusAid: string) => Promise<void>;

export interface RealmPlaneHolder {
  /** The composed wire gate — the base's federatable shelf plus the realm's member-read lane. */
  readonly gate: FederationGate;
  /** The realm this vessel stands in, or null while no charter names one. */
  realmId(): string | null;
  /** The Nexus this realm stands under: the AID a face's per-Nexus key derives against. Null while unstood. */
  nexusAid(): string | null;
  /** The realm doc url, or null while unstood. */
  realmUrl(): AutomergeUrl | null;
  /** Re-read the charter; stand the realm on first sight (or on a different id). Idempotent for a standing realm. */
  refresh(charter: NexusDoc | null): Promise<void>;
  /** The standing registrations (counted, folded) keyed by bag URI. */
  standing(): Promise<ReadonlyMap<string, RealmBagRegistration>>;
  /** How one record reads on THIS vessel: whether it counts, and which kept names sealed it (each seal
   *  verified, a Handle's against this vessel's own handle book). A door reports a record through this
   *  reading and never through the names a record merely lists. */
  reading(rec: RealmBagRegistration): Promise<{ readonly counts: boolean; readonly sealedBy: readonly string[] }>;
  /** Has this steward name SEALED HERE: does some record of this realm on the doc this vessel holds carry that
   *  name's own verifying seal? The steward door asks before it writes a name another hand holds. */
  sealedHere(name: string): Promise<boolean>;
  /** Register a bag this vessel's steward keeps: seal, land on the realm doc, announce on @crossroads.
   *  `propose` names stewards whose hands have NOT sealed this record — it accretes their names and counts
   *  nothing until each proposed hand co-signs (n-of-n; a named-but-unsigned steward is conscription).
   *  Each signer names its steward: the worn face's key at this realm's Nexus, or a quorum Handle's prefix. */
  register(input: {
    readonly bagUri: string;
    readonly docUrl: string;
    readonly readTier?: CapTier;
    /** Beside each steward name, the charter that hand holds — omit for a single-charter realm. */
    readonly charters?: Readonly<Record<string, string>>;
    /** The registration's lease in rolls of the realm's pace — omit for a registration that never lapses. */
    readonly expiry?: number;
    readonly signers: readonly StewardSigner[];
    readonly propose?: readonly string[];
  }): Promise<RealmBagRegistration>;
  /** ASK TO KEEP a bag another hand keeps: seal a proposal that names the standing stewards and this signer,
   *  over the standing registration's own doc, tier, charters and lease. It counts nothing until every
   *  standing steward co-signs, and the registration that stands keeps standing meanwhile. Refuses when no
   *  registration stands for the bag, or when the signer already keeps it. */
  join(input: { readonly bagUri: string } & StewardSigner): Promise<RealmBagRegistration>;
  /** CO-SIGN a proposal that names this vessel's steward: seal the proposer's exact bytes and land the record
   *  under this hand's OWN key. Where a registration stands for the bag, only a proposal that keeps its doc,
   *  tier, charters and lease and widens its steward set gets a seal. The signer names the hand it consents
   *  WITH (`withName`: a name that sealed the proposal) wherever the choice stays open: where several
   *  different proposals wait, and where no registration stands to hold a proposal to. Without that name the
   *  co-sign refuses and lists what waits. Among copies of one proposal it completes the one
   *  that carries the most seals. A record every kept name sealed counts and gets announced; one still short
   *  of a hand lands as a proposal. Refuses when no such proposal names the signer for that bag. */
  coSign(input: { readonly bagUri: string; readonly withName?: string } & StewardSigner): Promise<RealmBagRegistration>;
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
  /** The realm's OWN consult — the proven contract nym behind a wire key, and who holds which charter. Absent,
   *  the gate answers exactly as the Nexus lane alone answered. */
  readonly charter?: RealmCharterConsult;
  /** The realm's pace in rolls (`realmPace`) — the lease a registration's `expiry` reads against. */
  readonly pace?: () => number | null;
  /** The member shadow for THIS realm (kapae#/reach): a member set aside reads none of the realm's documents.
   *  The standing vessel supplies it from its edge-shadow ring, bound to the realm id it hands in. */
  readonly memberAside?: (realmId: string) => (peerId: string) => boolean;
  /** THE STEWARD GUARD: every signer passes it before it seals (`realm-steward`). */
  readonly stewardGuard?: StewardGuard;
  /** What this vessel knows of a Handle that sealed (its own handle book): every fold reads a Handle steward's
   *  seal against it. Absent, a Handle seal reads against the chain it carries. */
  readonly sealReading?: RealmBagFoldOptions;
  /**
   * Fired after EVERY fold of the standing registrations — the stand, a verb this vessel ran, and (the one
   * that matters) a change ANOTHER member wrote onto the shared realm doc. The fold decides which documents
   * the wire gate opens, and a Repo caches its share verdict per (doc, peer) until something asks it to read
   * again: absent this hook a member's co-signature re-seats a registration the holder still answers DENIED for.
   */
  readonly onRefold?: () => void;
  readonly onLog?: (line: string) => void;
}): RealmPlaneHolder {
  const { repo, oracleHandle, crossroadsHandle, membership, base } = opts;
  const log = opts.onLog ?? (() => {});
  let realmId: string | null = null;
  let nexusAid: string | null = null;
  let realmUrl: AutomergeUrl | null = null;
  let realmHandle: DocHandle<LarDoc> | null = null;
  let realmGate: RealmBagGate | null = null;
  let onChange: (() => void) | null = null;

  const refold = async (): Promise<void> => {
    if (!realmGate || !realmHandle || !realmId) return;
    await realmGate.refold(realmHandle.doc(), realmId);
    opts.onRefold?.();
  };

  /** Pin THIS vessel's own steward nym on its OWN oracle plane — the write path reads stewardship from here.
   *  Written the moment this hand signs (a registration or a co-sign), never from a name another hand wrote. */
  const pinSteward = (nym: string): void => {
    const doc = oracleHandle.doc();
    if (tiddlerText(doc?.tiddlers?.[REALM_STEWARD_TIDDLER]) === nym) return;
    oracleHandle.change((d) => { d.tiddlers[REALM_STEWARD_TIDDLER] = storedLarRecord(REALM_STEWARD_TIDDLER, { text: nym }, "realm-bag"); });
  };

  const detach = (): void => {
    if (realmHandle && onChange) realmHandle.off("change", onChange);
    realmHandle = null; onChange = null;
  };

  const stand = async (id: string): Promise<void> => {
    detach();
    realmId  = id;
    nexusAid = id;   // the charter-derived realm takes its Nexus's own AID for its name
    realmUrl = realmDocUrl(id);
    realmHandle = await materializeSharedLarDoc(repo, realmUrl, "realm");
    realmGate = new RealmBagGate(base, membership, realmUrl, {
      ...(opts.charter ? { charter: opts.charter } : {}),
      ...(opts.pace    ? { pace:    opts.pace }    : {}),
      ...(opts.memberAside ? { memberAside: opts.memberAside(id) } : {}),
      ...(opts.sealReading ? { sealReading: opts.sealReading } : {}),
    });
    onChange = () => { void refold(); };
    realmHandle.on("change", onChange);
    await refold();
    // The pointer on the vessel's OWN plane — the daemon island's reach reads the realm id and doc from here,
    // never off the realm doc itself (a member who could rewrite the id there could make a foreign record count).
    const doc = oracleHandle.doc();
    if (tiddlerText(doc?.tiddlers?.[REALM_DOC_URI]) !== realmUrl || tiddlerText(doc?.tiddlers?.[REALM_ID_TIDDLER]) !== id) {
      const url = realmUrl;
      oracleHandle.change((d) => {
        d.tiddlers[REALM_DOC_URI]   = storedLarRecord(REALM_DOC_URI,   { text: url }, "vessel-boot");
        d.tiddlers[REALM_ID_TIDDLER] = storedLarRecord(REALM_ID_TIDDLER, { text: id },  "vessel-boot");
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
    nexusAid: () => nexusAid,
    realmUrl: () => realmUrl,
    async refresh(charter) {
      const id = realmIdOfCharter(charter);
      if (!id) return;                 // no charter → inert (a vessel outside every realm)
      if (id === realmId) { await refold(); return; }
      await stand(id);
    },
    async reading(rec) {
      if (!realmId) return { counts: false, sealedBy: [] };
      return {
        counts:   await realmBagRegistrationCounts(rec, realmId, opts.sealReading),
        sealedBy: await realmBagSealedBy(rec, opts.sealReading),
      };
    },
    async sealedHere(name) {
      if (!realmHandle || !realmId) return false;
      return stewardSealedHere(realmHandle.doc(), realmId, name.trim().toLowerCase(), opts.sealReading);
    },
    async standing() {
      if (!realmHandle || !realmId) return new Map();
      return foldRealmBags(realmHandle.doc(), realmId, opts.sealReading);
    },
    async register({ bagUri, docUrl, readTier, charters, expiry, signers, propose }) {
      if (!realmHandle || !realmId) throw new Error("realm-bag: this vessel stands in no realm — seat a charter (`lares nexus rite quorum`) or import one (`lares nexus seal import`); the realm stands when this vessel next boots, or when its after-write refold reads the charter");
      if (signers.length === 0) throw new Error("realm-bag: a bag is kept by a named steward — no signer supplied");
      for (const s of signers) await opts.stewardGuard?.(s, nexusAid ?? realmId);
      const parts = {
        realmId, bagUri, docUrl, readTier: readTier ?? "contract" as CapTier,
        ...(charters ? { charters } : {}),
        ...(expiry === undefined ? {} : { expiry }),
      };
      const proposed = (propose ?? []).map((n) => n.trim().toLowerCase()).filter((n) => !signers.some((s) => s.signer.toLowerCase() === n));
      const rec = proposed.length > 0
        ? await proposeRealmBagRegistration(parts, signers, proposed)
        : await signRealmBagRegistration(parts, signers);
      const counts = await realmBagRegistrationCounts(rec, realmId, opts.sealReading);
      // A record with NO proposed hand must count before it lands — one that the fold would ignore reads as
      // registered while carrying nothing. A PROPOSAL is expected not to count: it waits on the second hand.
      if (proposed.length === 0 && !counts) throw new Error("realm-bag: refusing to write a registration that does not count");
      const by = signers[0]!.signer.toLowerCase();
      realmHandle.change((d) => writeRealmBagRegistration(d, rec, by, counts));
      // The announce carries the ford's existence — and only once the record actually counts, so a proposal
      // never tells the crossroads a ford stands that no fold has seated.
      if (counts) crossroadsHandle.change((d) => writeRealmBagAnnounce(d, rec));
      pinSteward(by);
      await refold();
      return rec;
    },
    async join({ bagUri, ...asker }) {
      if (!realmHandle || !realmId) throw new Error("realm-bag: this vessel stands in no realm — import the charter (`lares nexus seal import`) first");
      await opts.stewardGuard?.(asker, nexusAid ?? realmId);
      const nym = asker.signer.trim().toLowerCase();
      const stands = (await foldRealmBags(realmHandle.doc(), realmId, opts.sealReading)).get(bagUri);
      if (!stands) throw new Error(`realm-bag: no registration stands for "${bagUri}" on the realm doc this vessel holds — a hand asks to keep a bag another hand already keeps (the keeping hand registers it first, and the realm doc syncs)`);
      if (stands.keptBy.includes(nym)) throw new Error(`realm-bag: this steward already keeps "${bagUri}"`);
      // THE STANDING RECORD'S OWN BYTES, widened by one name: the same doc, tier, charters and lease. Every name
      // it carries beside the asker's own already sealed the record that stands.
      const parts = {
        realmId, bagUri, docUrl: stands.docUrl, readTier: stands.readTier,
        ...(stands.charters ? { charters: stands.charters } : {}),
        ...(stands.expiry === undefined ? {} : { expiry: stands.expiry }),
      };
      const rec = await proposeRealmBagRegistration(parts, [{ ...asker, signer: nym }], stands.keptBy);
      realmHandle.change((d) => writeRealmBagRegistration(d, rec, nym, false));
      pinSteward(nym);
      await refold();
      return rec;
    },
    async coSign({ bagUri, withName, ...cosigner }) {
      if (!realmHandle || !realmId) throw new Error("realm-bag: this vessel stands in no realm — import the charter (`lares nexus seal import`) first");
      await opts.stewardGuard?.(cosigner, nexusAid ?? realmId);
      const nym = cosigner.signer.trim().toLowerCase();
      const doc = realmHandle.doc();
      const stands = (await foldRealmBags(doc, realmId, opts.sealReading)).get(bagUri);
      // A charter map compares as the record's signed bytes read it: each hand that keeps under ANOTHER charter,
      // by lower-case name, whatever order a writer listed them in.
      const chartersOf = (r: RealmBagRegistration): string =>
        JSON.stringify(Object.entries(r.charters ?? {}).filter(([, c]) => c !== r.realmId).map(([n, c]) => [n.toLowerCase(), c]).sort());
      // WHAT THIS HAND MAY CONSENT TO. Where a registration stands, a proposal earns a seal only when it keeps
      // that registration's doc, tier, charters and lease, holds every standing steward and names one more:
      // consent widens who keeps a book and never moves the book, and a record no wider than the one that
      // stands waits on nobody. Each proposal groups with its own copies by the bytes it signs.
      const groups = new Map<string, Array<{ rec: RealmBagRegistration; sealed: number }>>();
      for (const rec of realmBagRegistrationsFromDoc(doc)) {
        if (rec.realmId !== realmId || rec.bagUri !== bagUri || !rec.keptBy.includes(nym)) continue;
        if (rec.signatures.some((s) => s.signer === nym)) continue;
        if (stands && !(rec.docUrl === stands.docUrl && rec.readTier === stands.readTier && rec.expiry === stands.expiry
                        && chartersOf(rec) === chartersOf(stands) && stands.keptBy.every((k) => rec.keptBy.includes(k))
                        && rec.keptBy.length > stands.keptBy.length)) continue;
        const sealedBy = await realmBagSealedBy(rec, opts.sealReading);
        if (sealedBy.length === 0) continue;                        // nobody's verifying seal: nothing to consent to
        if (withName !== undefined && !sealedBy.includes(withName.trim().toLowerCase())) continue;
        const image = hex(realmBagBytes(rec));
        (groups.get(image) ?? (groups.set(image, []), groups.get(image)!)).push({ rec, sealed: sealedBy.length });
      }
      if (groups.size === 0) throw new Error(`realm-bag: no standing proposal on the realm doc names this steward for "${bagUri}" — a hand that would keep the bag asks from its own vessel first (\`lares nexus realm-bag <bag> --join\`), and a keeping hand names a steward by the key that steward's worn face presents here (\`--steward <key>\`)`);
      // WHERE NO REGISTRATION STANDS, nothing holds a proposal to a book: the signer names the hand it consents
      // with, so one planted proposal never draws a seal from a bare co-sign.
      if (!stands && withName === undefined) {
        const askers = [...groups.values()].map((g) => g[0]!.rec.signatures.map((s) => s.signer).join("+")).sort();
        throw new Error(`realm-bag: no registration stands for "${bagUri}", so this co-sign would found one — name the hand this one consents with (\`--cosign --with <key>\`); proposals wait sealed by ${askers.join(" · ")}`);
      }
      if (groups.size > 1) {
        const askers = [...groups.values()].map((g) => g[0]!.rec.signatures.map((s) => s.signer).join("+")).sort();
        throw new Error(`realm-bag: ${groups.size} different proposals for "${bagUri}" wait on this steward (sealed by ${askers.join(" · ")}) — name the hand this one consents with (\`--cosign --with <key>\`)`);
      }
      // Copies of ONE proposal differ only in the seals they gathered: the one that carries the most completes first.
      const proposal = [...groups.values()][0]!.sort((a, b) => b.sealed - a.sealed)[0]!.rec;
      const rec = await coSignRealmBagRegistration(proposal, { ...cosigner, signer: nym });
      const counts = await realmBagRegistrationCounts(rec, realmId, opts.sealReading);
      realmHandle.change((d) => writeRealmBagRegistration(d, rec, nym, counts));
      // The announce follows a counted record alone: a record still short of a hand tells the crossroads nothing.
      if (counts) crossroadsHandle.change((d) => writeRealmBagAnnounce(d, rec));
      pinSteward(nym);
      await refold();
      return rec;
    },
    dispose: detach,
  };
}
