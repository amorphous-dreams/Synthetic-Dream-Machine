/**
 * realm-plane — the node holder that STANDS one plane per realm on a vessel: a verb names its realm. A cabal takes
 * no key and no roster here; standing reads as a live query the edge shadow ring answers. The realm-doc pointer
 * names each realm doc, the id pointer names the default realm, the steward pointer names a realm's worn key,
 * and the standing pointer carries that realm's folded registrations. The holder materializes each shared CRDT,
 * charter names, pins the pointer on the vessel's own oracle plane (so the daemon island's reach walks it),
 * folds the standing registrations into the wire gate, and lands a steward's registration + its @crossroads
 * announce.
 *
 * A vessel that holds no charter stands no realm: the holder rests INERT (no doc, no pointer, the base gate
 * unchanged). A charter import (`nexus seal import`, carried or primary) on a standing vessel stands it: the
 * import itself pokes the vessel's refold at once (no separate verb to run), and this holder's own
 * `refresh(charter)` re-reads the realm id and materializes on first sight; a re-read of the same realm
 * changes nothing. The realm id NEVER moves for a standing realm (a genesis epoch is fixed for life), so a different id
 * on refresh names a DIFFERENT charter — the holder re-stands on it and the prior realm's docs leave the gate.
 *
 * WHO SEALS. The holder seals with the steward signers its door hands it, and holds no key. Every signer passes
 * the `stewardGuard` the composing vessel seats before any byte gets signed: the door `realm-steward` builds
 * that guard over the vessel's own keys, and it refuses a persona root, a vessel key and a key it cannot class.
 *
 * A NAME ENTERS A RECORD BY ITS OWN HAND FIRST. Nobody can class a key that belongs to another hand, so the
 * holder writes somebody else's name only where that name already sealed a record of this realm
 * (`sealedHere`, checked at `register`, the write itself, and by the steward door before it). A hand that would keep a bag another hand keeps ASKS (`join`): it seals a proposal that names
 * the standing stewards and itself, and each standing steward consents by `coSign`. A record still short of a
 * seal lands under its own key and never unseats the registration that stands.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/realm-bag-brief#/what-the-realm-holds
 */

import { interpretAsDocumentId, type Repo, type DocHandle, type AutomergeUrl, type DocumentId } from "@automerge/automerge-repo";
import {
  materializeSharedLarDoc, storedLarRecord, tiddlerText, type LarDoc,
  type NexusDoc, type FederationGate, type NexusMembership, type CapTier,
  REALM_ID_TIDDLER, CABAL_REALM_RE, realmDocPointer, realmStewardPointer, realmStandingPointer,
  writeRealmStanding, nexusAidOf, realmDocUrl, RealmBagGate,
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
  | "handle-chain-mismatch"   // a Handle signer whose chain does not open on its own name
  | "realm-unreadable";

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
   *  nothing until each proposed hand co-signs (n-of-n; a named-but-unsigned steward is conscription). A
   *  proposed name must already have sealed a record of this realm, else `steward-name-unproven`.
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

/**
 * MANY REALM PLANES behind one holder. The holder's own members answer for the CHARTER-DERIVED realm (the
 * default a verb routes to when it names none); `plane` hands out one realm's plane by name.
 */
export interface RealmPlanesHolder extends RealmPlaneHolder {
  /** Every realm this vessel stands a plane for: the charter-derived realm first, then its cabal realms, sorted. */
  realms(): readonly string[];
  /** The plane of one realm: the charter-derived realm for `null`, `undefined` or its own id; a cabal realm's
   *  plane by its id; null for a realm this vessel stands no plane for. Each plane answers for ITS realm alone,
   *  its `gate` included; its `refresh` and `dispose` belong to the whole holder. */
  plane(realm?: string | null): RealmPlaneHolder | null;
  /** ENTER a cabal realm: stand its plane and note it in the vessel's own ledger, so the next boot stands it
   *  again. Refuses a name that reads as no cabal realm, and refuses while no charter stands (a cabal realm
   *  stands under a Nexus). Entering a realm already stood answers its plane and notes nothing. */
  enter(realm: string): Promise<RealmPlaneHolder>;
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
  /** The cabal realms this vessel noted in its OWN ledger: the holder's own memory, never a roster of a mesh. */
  readonly realms?: () => readonly string[] | Promise<readonly string[]>;
  /** Does this peer hold lineage standing in this realm (the edge shadow ring's live reading)? Absent, a cabal
   *  realm's documents cross to nobody past the base gate. */
  readonly standsInRealm?: (peerId: string, realm: string) => boolean;
  /** Note a realm in the vessel's own ledger: `enter` calls it once per realm. */
  readonly noteRealm?: (realm: string) => Promise<void>;
}): RealmPlanesHolder {
  const { repo, oracleHandle, crossroadsHandle, membership, base } = opts;
  const log = opts.onLog ?? (() => {});

  /** One realm's plane as the holder keeps it: the plane a verb acts through, its gate, and its teardown. */
  interface Stood {
    readonly kind:  "charter" | "cabal";
    readonly plane: RealmPlaneHolder;
    readonly gate:  RealmBagGate;
    /** Does this vessel's own steward keep, in this realm, the book this document holds? */
    keepsOwn(documentId: DocumentId): boolean;
    refold(): Promise<void>;
    drop(): void;
  }
  const stood = new Map<string, Stood>();
  /** The cabal realms this run stands or stood: a plane that failed to stand stands again at the next refresh. */
  const entered = new Set<string>();
  /** The charter-derived realm's id: the Nexus AID every plane's steward keys derive against. Null while inert. */
  let charterRealm: string | null = null;

  // THE COMPOSITE GATE. A document some realm's plane holds answers by that plane's own lanes. Wire access
  // attaches to the DOCUMENT, never to the record that named it:
  //   · where this vessel's OWN steward keeps the book in some realm, those realms alone answer, so a record
  //     another hand wrote in another realm neither opens the book nor shuts it;
  //   · a book two answering realms both hold crosses to a peer EVERY one of them admits, so one realm's record
  //     never opens a book past another realm's refusal.
  // A document no plane holds falls to the base gate.
  const gate: FederationGate = {
    async mayFederate(documentId, peerId) {
      const holding = [...stood.values()].filter((s) => s.gate.holdsDoc(documentId));
      if (holding.length === 0) return base.mayFederate(documentId, peerId);
      const kept = holding.filter((s) => s.keepsOwn(documentId));
      const holders = kept.length > 0 ? kept : holding;
      for (const holder of holders) if (!(await holder.gate.mayFederate(documentId, peerId))) return false;
      return true;
    },
  };

  /** Stand ONE realm's plane: its shared doc, its gate, its pointers on the vessel's own plane, its verbs. */
  const standPlane = async (realmId: string, kind: "charter" | "cabal"): Promise<Stood> => {
    const realmUrl = realmDocUrl(realmId);
    const realmHandle = await materializeSharedLarDoc(repo, realmUrl, "realm");
    const nexusAid = (): string => charterRealm ?? realmId;
    const memberAside = opts.memberAside?.(realmId);
    const realmGate = new RealmBagGate(base, membership, realmUrl, {
      ...(opts.charter ? { charter: opts.charter } : {}),
      ...(opts.pace    ? { pace:    opts.pace }    : {}),
      ...(memberAside ? { memberAside } : {}),
      ...(opts.sealReading ? { sealReading: opts.sealReading } : {}),
      // A CABAL REALM answers to lineage standing in that realm alone: the Nexus lane and the charter-hearth
      // lane stay shut, so a Nexus member outside the cabal reads nothing of it.
      ...(kind === "cabal" ? { nexusLane: false, stands: (peerId: string) => opts.standsInRealm?.(peerId, realmId) ?? false } : {}),
    });

    let lastStanding: string | null = null;
    let dropped = false;
    const foldOnce = async (): Promise<void> => {
      if (dropped) return;
      await realmGate.refold(realmHandle.doc(), realmId);
      if (dropped) return;
      // THE VERDICT RESTS ON THE VESSEL'S OWN PLANE: the daemon island reads the standing registrations this
      // plane folded, and folds nothing itself.
      const folded = realmGate.registrations();
      const image = JSON.stringify([...folded.values()].sort((a, b) => (a.bagUri < b.bagUri ? -1 : a.bagUri > b.bagUri ? 1 : 0)));
      if (image !== lastStanding) {
        oracleHandle.change((d) => { writeRealmStanding(d, realmId, folded); });
        lastStanding = image;
      }
      opts.onRefold?.();
    };
    // ONE FOLD AT A TIME per plane, each over the doc as it reads when its turn comes: a slow fold over an
    // earlier doc never lands after a later one and never restores a verdict the later one replaced.
    let tail: Promise<void> = Promise.resolve();
    const refold = (): Promise<void> => {
      const turn = tail.then(foldOnce);
      tail = turn.catch(() => {});
      return turn;
    };
    const onChange = (): void => { void refold().catch(() => {}); };
    realmHandle.on("change", onChange);

    /** Pin THIS vessel's own steward name in THIS realm on its OWN plane: the write path reads stewardship from
     *  here. Written the moment this hand seals, never from a name another hand wrote. */
    const pinSteward = (nym: string): void => {
      const key = realmStewardPointer(realmId);
      if (tiddlerText(oracleHandle.doc()?.tiddlers?.[key]) === nym) return;
      oracleHandle.change((d) => { d.tiddlers[key] = storedLarRecord(key, { text: nym }, "realm-bag"); });
    };

    // The pointers on the vessel's OWN plane: the daemon island's reach reads a realm's doc from here, never off
    // the realm doc itself (a member who could rewrite an id there could make a foreign record count). The
    // charter-derived realm also names itself the DEFAULT a verb routes to.
    const docPointer = realmDocPointer(realmId);
    // A STAND THAT FAILS LEAVES NOTHING: no listener, no pin, no verdict.
    try {
      const oracle = oracleHandle.doc();
      const wantsDefault = kind === "charter" && tiddlerText(oracle?.tiddlers?.[REALM_ID_TIDDLER]) !== realmId;
      if (tiddlerText(oracle?.tiddlers?.[docPointer]) !== realmUrl || wantsDefault) {
        oracleHandle.change((d) => {
          d.tiddlers[docPointer] = storedLarRecord(docPointer, { text: realmUrl }, "vessel-boot");
          if (kind === "charter") d.tiddlers[REALM_ID_TIDDLER] = storedLarRecord(REALM_ID_TIDDLER, { text: realmId }, "vessel-boot");
        });
      }
      await refold();
    } catch (e) {
      dropped = true;
      realmHandle.off("change", onChange);
      unpin(realmId);
      throw e;
    }
    log(`realm ${realmId.slice(0, 16)}… stands (${kind}) — doc ${realmUrl}`);

    const plane: RealmPlaneHolder = {
      gate: realmGate,                 // a named plane answers for its own realm's documents alone
      realmId: () => realmId,
      nexusAid,
      realmUrl: () => realmUrl,
      refresh: (charter) => refresh(charter),
      async reading(rec) {
        return {
          counts:   await realmBagRegistrationCounts(rec, realmId, opts.sealReading),
          sealedBy: await realmBagSealedBy(rec, opts.sealReading),
        };
      },
      async sealedHere(name) {
        return stewardSealedHere(realmHandle.doc(), realmId, name.trim().toLowerCase(), opts.sealReading);
      },
      async standing() {
        return foldRealmBags(realmHandle.doc(), realmId, opts.sealReading);
      },
      async register({ bagUri, docUrl, readTier, charters, expiry, signers, propose }) {
        if (signers.length === 0) throw new Error("realm-bag: a bag is kept by a named steward — no signer supplied");
        for (const s of signers) await opts.stewardGuard?.(s, nexusAid());
        const parts = {
          realmId, bagUri, docUrl, readTier: readTier ?? "contract" as CapTier,
          ...(charters ? { charters } : {}),
          ...(expiry === undefined ? {} : { expiry }),
        };
        const proposed = (propose ?? []).map((n) => n.trim().toLowerCase()).filter((n) => !signers.some((s) => s.signer.toLowerCase() === n));
        // THE WRITE BOUNDARY holds the naming law whoever calls: a name another hand holds enters only where its
        // own holder already sealed here.
        for (const name of proposed) {
          if (!(await stewardSealedHere(realmHandle.doc(), realmId, name, opts.sealReading))) {
            throw new StewardRefused("steward-name-unproven", `"${name}" sealed nothing in this realm, so no hand but its own may write it here — that hand asks to keep the bag from its own vessel (\`lares nexus realm-bag <bag> --join\`), and each standing steward consents (\`--cosign\`)`);
          }
        }
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
        await opts.stewardGuard?.(asker, nexusAid());
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
        await opts.stewardGuard?.(cosigner, nexusAid());
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
      dispose: () => dispose(),
    };
    const keepsOwn = (documentId: DocumentId): boolean => {
      const own = tiddlerText(oracleHandle.doc()?.tiddlers?.[realmStewardPointer(realmId)]);
      if (!own) return false;
      for (const rec of realmGate.registrations().values()) {
        if (rec.keptBy.includes(own) && interpretAsDocumentId(rec.docUrl as AutomergeUrl) === documentId) return true;
      }
      return false;
    };
    return { kind, plane, gate: realmGate, keepsOwn, refold, drop: () => { dropped = true; realmHandle.off("change", onChange); } };
  };

  const dropAll = (): void => { for (const s of stood.values()) s.drop(); stood.clear(); };
  /** A realm this vessel left takes its pointers with it: the island reads no verdict of a plane that stands no more. */
  const unpin = (realmId: string): void => {
    const keys = [realmDocPointer(realmId), realmStewardPointer(realmId), realmStandingPointer(realmId)];
    if (!keys.some((k) => oracleHandle.doc()?.tiddlers?.[k] !== undefined)) return;
    oracleHandle.change((d) => { for (const k of keys) delete d.tiddlers[k]; });
  };

  /** The cabal realms the vessel's own ledger notes: names that read as a cabal realm, apart from the Nexus's own. */
  const notedRealms = async (): Promise<string[]> => {
    let named: readonly string[] = [];
    try { named = (await opts.realms?.()) ?? []; } catch { named = []; }
    return [...new Set(named.map((r) => r.trim().toLowerCase()))].filter((r) => CABAL_REALM_RE.test(r) && r !== charterRealm).sort();
  };

  // ONE HOLDER ACT AT A TIME: a refresh and an entry each run whole, so an entry never commits a plane across a
  // Nexus change that dropped every plane beside it.
  let lane: Promise<void> = Promise.resolve();
  const inTurn = <T>(act: () => Promise<T>): Promise<T> => {
    const turn = lane.then(act);
    lane = turn.then(() => {}, () => {});
    return turn;
  };
  const refresh = (charter: NexusDoc | null): Promise<void> => inTurn(() => refreshNow(charter));

  async function refreshNow(charter: NexusDoc | null): Promise<void> {
    const id = nexusAidOf(charter);
    if (!id) return;                   // no charter → inert (a vessel outside every realm)
    if (id !== charterRealm) {
      // ANOTHER NEXUS: every plane re-stands under it, since a steward's key derives against the Nexus.
      // Every plane leaves with its pins: a steward's key derives against the Nexus, so no pin of the Nexus
      // this vessel left answers under the next, and a failed stand leaves no realm readable.
      const left = [...stood.keys()];
      dropAll();
      for (const realm of left) unpin(realm);
      // The holder names its Nexus only while that Nexus's own plane stands: a stand that fails leaves the holder
      // inert, and the next refresh stands it again.
      charterRealm = id;
      try { stood.set(id, await standPlane(id, "charter")); }
      catch (e) { charterRealm = null; throw e; }
    } else {
      for (const s of stood.values()) await s.refold();
    }
    // Every cabal realm this run entered, and every one the ledger notes, stands under the Nexus that stands now.
    for (const realm of await notedRealms()) entered.add(realm);
    for (const realm of [...entered].sort()) if (realm !== charterRealm && !stood.has(realm)) stood.set(realm, await standPlane(realm, "cabal"));
  }

  function dispose(): void { dropAll(); }

  const charterPlane = (): RealmPlaneHolder | null => (charterRealm ? stood.get(charterRealm)?.plane ?? null : null);
  const unstood = (verb: string): Error => new Error(verb === "register"
    ? "realm-bag: this vessel stands in no realm — seat a charter (`lares nexus rite quorum`) or import one (`lares nexus seal import`); the realm stands when this vessel next boots, or when its after-write refold reads the charter"
    : "realm-bag: this vessel stands in no realm — import the charter (`lares nexus seal import`) first");

  const holder: RealmPlanesHolder = {
    gate,
    realmId: () => charterRealm,
    nexusAid: () => charterRealm,
    realmUrl: () => charterPlane()?.realmUrl() ?? null,
    refresh,
    reading: async (rec) => (await charterPlane()?.reading(rec)) ?? { counts: false, sealedBy: [] },
    sealedHere: async (name) => (await charterPlane()?.sealedHere(name)) ?? false,
    standing: async () => (await charterPlane()?.standing()) ?? new Map(),
    register: async (input) => { const p = charterPlane(); if (!p) throw unstood("register"); return p.register(input); },
    join:     async (input) => { const p = charterPlane(); if (!p) throw unstood("join");     return p.join(input); },
    coSign:   async (input) => { const p = charterPlane(); if (!p) throw unstood("coSign");   return p.coSign(input); },
    dispose,
    realms: () => (charterRealm ? [charterRealm, ...[...stood.keys()].filter((r) => r !== charterRealm).sort()] : []),
    plane(realm) {
      if (realm === null || realm === undefined) return charterPlane();
      return stood.get(realm.trim().toLowerCase())?.plane ?? null;
    },
    async enter(realm) {
      const name = realm.trim().toLowerCase();
      if (!CABAL_REALM_RE.test(name)) throw new StewardRefused("realm-unreadable", `"${realm}" reads as no cabal realm — a cabal realm wears 64 lower-case hex, the name its vouch board and its feed already wear`);
      return inTurn(async () => {
        const already = stood.get(name);
        if (already) return already.plane;
        if (!charterRealm) throw new StewardRefused("no-realm", "a cabal realm stands under a Nexus, and this vessel holds no charter — seat one (`lares nexus rite quorum`) or import one (`lares nexus seal import`)");
        const fresh = await standPlane(name, "cabal");
        // THE LEDGER NOTES FIRST: a realm the vessel's own ledger failed to note stands nowhere, so the next
        // boot and this run agree on which realms the vessel entered.
        try { await opts.noteRealm?.(name); }
        catch (e) { fresh.drop(); unpin(name); throw e; }
        stood.set(name, fresh);
        entered.add(name);
        return fresh.plane;
      });
    },
  };
  return holder;
}
