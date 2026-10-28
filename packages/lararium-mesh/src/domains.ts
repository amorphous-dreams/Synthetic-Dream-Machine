/**
 * domains — THE REGISTRY. Every domain-separation tag this house mints, in one place, as `lar:` URIs.
 *
 * ── WHAT A DOMAIN TAG IS, AND WHY IT LOOKS LIKE A MAGIC STRING ──────────────────────────────────
 * A signature or a derived key is meaningless without the domain it was made in. The tag rides inside the
 * signed bytes (or the HKDF `info`) so that a signature minted for one purpose can never be replayed as
 * another, and two derivations from one secret can never fuse. Its ONLY job is to differ.
 *
 * That is why it reads opaque, and every serious protocol does the same: HKDF's `info` (RFC 5869), TLS
 * 1.3's `"tls13 "`-prefixed HkdfLabel (RFC 8446 §7.1), MLS's `SignWithLabel` / `EncryptWithLabel` under
 * `"MLS 1.0 "` (RFC 9420), BIP-340's tagged hashes, the Noise protocol NAME hashed into the handshake
 * state, EIP-712's domainSeparator. The constant is protocol identity, never a magic number.
 *
 * ── WHY A TABLE, AND NOT JUST THE STRINGS ───────────────────────────────────────────────────────
 * Scattered, they cannot be checked. Thirty-two of them once sat across twenty-five files in TWO
 * spellings — `lar-<name>/v<N>` for signing, `"lares <name> v<N>"` for HMAC keys — and nothing could say
 * they differed. A typo in a domain tag does not fail loudly: it silently mints a SECOND protocol whose
 * signatures verify against nothing. Multiformats sets the sharpest prior art, and its whole value rides
 * on THE TABLE AS THE ARTIFACT rather than on the prefixes.
 *
 * ── THE ONTOLOGY: a domain is a NAME, so it takes the house's naming form ───────────────────────
 * `lar:` names and does not fetch (RFC 4151's `tag:` precedent), which is exactly a domain tag's nature:
 * pure bearing, never a fetchable location, never carrying a per-use value. So every domain reads
 *
 *     lar:///ha.ka.ba/lares/domain/<name>
 *
 * — the stable `ha.ka.ba` root, one path for the whole family, and a NAME that does all the separating.
 *
 * ── A NAME, NEVER A VERSION ─────────────────────────────────────────────────────────────────────
 * A version digit that carries separation fuses on the first reset: two purposes told apart by `/v1` and
 * `/v2` collapse the moment a reset renumbers them. So a SIGNING domain and an HKDF `info` each carry their
 * own NAME, and separation belongs to the name alone. A change
 * of protocol mints a NEW name; it never bumps a counter, because a counter claims an ordering — a global
 * now — that no two vessels share.
 *
 * Two mints follow from that. `mint` builds every NEW domain, bare. `frozen` reproduces the strings that
 * already sign live records and derive live keys: their trailing `/v1` names nothing, no successor will
 * ever exist, and it stays only because rewriting a domain re-keys every signature and seal minted under
 * it. A frozen string is an opaque name — read it whole, never parse its tail.
 *
 * ── HOW TO ADD ONE ──────────────────────────────────────────────────────────────────────────────
 * Add it HERE, exported, and use the export. `tools/domain-registry-witness.sh` refuses a duplicate, a
 * malformed address, and any domain literal written outside this file.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/lar-uri
 */

/** The one root every separation mints under. A change here re-keys every signature in the house; it is
 *  exported so a witness reads it instead of re-spelling it. */
export const DOMAIN_ROOT = "lar:///ha.ka.ba/lares/domain";

/** Every address `mint` and `frozen` build, in declaration order — the source `ALL_DOMAINS` derives from. */
const declared: string[] = [];
const declare = (address: string): string => { declared.push(address); return address; };

/** Mint a NEW domain address — the name alone, no suffix. Kept private: a domain must be DECLARED below,
 *  never built at a call site. */
const mint = (name: string): string => declare(`${DOMAIN_ROOT}/${name}`);

/** Reproduce a FROZEN domain address — a string already signing or deriving live material, kept byte-for-
 *  byte. Its `/v1` tail belongs to an opaque name and versions nothing. Never use it for a new domain. */
const frozen = (name: string): string => declare(`${DOMAIN_ROOT}/${name}/v1`);

// ── IDENTITY + DELEGATION ───────────────────────────────────────────────────────────────────────
/** A device delegation: an operator root vouching one device into a PersonaGroup. */
export const DEVICE_DELEGATION_DOMAIN = frozen("device-delegation");
/** The atom's countersignature over a device delegation: the atom signs the root's proof and the root's signature, so
 *  a root half never reads as a complete edge. */
export const DEVICE_ATOM_COUNTERSIGN_DOMAIN = mint("device-atom-countersign");
/** A face atom admits one tab to a holder by signing its fresh, port-bound challenge. */
export const HOLDER_SESSION_DOMAIN = mint("holder-session");
/** The key and context a ceremony checkpoint seals under: the atom's seed through HKDF, so a re-entered founding or
 *  admit lands the end state it first reached. Apart from every other child of the atom seed. */
export const FACE_CHECKPOINT_INFO = mint("face-checkpoint");
/** A face operation record seals issued bytes under the acting atom seed on its PersonaGroup plane. */
export const FACE_OPERATION_RECORD_INFO = mint("face-operation-record");
/** A persona's key-event log entry — the inception/rotation chain at persona scale. */
export const PERSONA_KEL_DOMAIN = frozen("persona-kel");
/** The announced outward face: a self-certifying HandleCard. */
export const HANDLE_CARD_DOMAIN = frozen("handle-card");
/** A Handle's key-event log entry — the SIBLING chain (burn · rotate · attest) whose prefix binds its
 *  owning persona at inception (identity-classes#the-handle-chain). */
export const HANDLE_KEL_DOMAIN = frozen("handle-kel");
/** A seat's display fingerprint: a short digest founders read aloud to check a seat key; never a signature. */
export const SEAT_FINGERPRINT_DOMAIN = mint("seat-fingerprint");
/** A fleet proof: one nym carried across a human's own vessels. */
export const FLEET_PROOF_DOMAIN = frozen("fleet-proof");
/** The vessel×veil dyad, and the binding that names it. */
export const DYAD_ID_DOMAIN = frozen("dyad-id");
export const DYAD_BINDING_DOMAIN = frozen("dyad-binding");
/** The per-handle dyad VEIL derivation off the DEVICE tree: the veil derives from the vessel's
 *  own seed, scoped by PersonaGroup — never from the persona seed (persona-circle#the-vault). */
/** The founder's SELF-RECOVERY leaf off the PERSONA tree: a 1-of-1 recovery key derived from the
 *  persona seed, pre-committed at inception so no prefix ever incepts unarmed — the multitude-of-one,
 *  NAMED, until a real guardian set grafts in (the seal-reserve founding rhyme). */
export const PERSONA_SELF_RECOVERY_INFO = frozen("persona-self-recovery");
/** The Fork-B registration handshake — DELIBERATELY apart from GUARDIAN_CONFIRM_DOMAIN: a bearer
 *  SHARE and a public REGISTRATION must never speak one phrase (the IdenTrust wrong-object cure). */
export const GUARDIAN_REGISTRATION_DOMAIN = frozen("guardian-registration");
/** A guardian's proof that it holds the private half of the recovery key it offers ONE face: its signature over
 *  that face's prefix and that key, taken before the face's enrolment commits the key's set. */
export const GUARDIAN_POSSESSION_DOMAIN = mint("guardian-possession");
/** The growth rite's crossing record: old quorum signs the handoff, new quorum the receipt, witnesses
 *  outside both sets attest the rite — the checkable form of the ceremony witness report. */
export const RESERVE_TRANSITION_DOMAIN = frozen("reserve-transition");
/** A charter epoch's ROLL: the revealed cold-key quorum signs the predecessor's cid, the seated key-set,
 *  its threshold and the next per-seat commitments — the KERI rotation event. Its own name: a roll must never verify
 *  as a crossing record, a roll anchor, or any carriage act. */
export const CHARTER_SEAT_ROLL_DOMAIN = mint("charter-seat-roll");
/** A seat's NEXT-KEY commitment: the digest of one cold verifying key, the value a charter carries until that
 *  seat reveals the key to roll. Its own name: a seat digest must never read as a key-set hash or a bare hash. */
export const SEAT_NEXT_KEY_DOMAIN = mint("seat-next-key");
/** The COLD-KEY CARD: the checksum that binds every character of a card's code, and the confirm phrase two
 *  people read to each other over it. Apart from `guardian-confirm`: a seat's card and a guardian's share never
 *  speak one phrase. */
export const COLD_KEY_CARD_DOMAIN = mint("cold-key-card");
/** The CO-FOUNDING OFFER: the public material one founder hands the other (a seat key, its cold successor's
 *  digest, the charter law and the release manifest's addresses), and the OFFER FINGERPRINT that digests it. It
 *  signs nothing. Its own name: an offer's fingerprint never reads as a charter's. */
export const COFOUND_OFFER_DOMAIN = mint("cofound-offer");
/** A charter's INCEPTION: the exact genesis image every seated key signs before the genesis reads as a charter,
 *  and the FINAL CHARTER FINGERPRINT that digests it. Its own name: an inception never verifies as a roll. */
export const CHARTER_INCEPTION_DOMAIN = mint("charter-inception");
/** A branch's ABANDON: the quorum of a forked branch, at its own head, closes that branch for every reader who holds
 *  the record. Its own name: an abandon never verifies as a roll, an inception or a reunion. */
export const CHARTER_ABANDON_DOMAIN = mint("charter-abandon");
/** A REUNION: one image naming the scope AID, both held branch heads and the new seats, signed by each branch's
 *  quorum at its head over identical bytes. Its own name: a reunion never verifies as a roll. */
export const CHARTER_REUNION_DOMAIN = mint("charter-reunion");
/** A Nexus's ENGINE CADENCE inception: the hearth keys that bear the reboot, their rule and their next-key
 *  commitments, signed by every holder; a joint founding cites its digest once. Its own name: a cadence inception
 *  never verifies as a charter's inception or a roll, and the cadence never fuses with the seat quorum. */
export const CADENCE_INCEPTION_DOMAIN = mint("cadence-inception");
/** A cadence holder's NEXT-KEY commitment: the digest of the hearth's next cadence key. Its own name: a cadence
 *  commitment never reads as a seat's. */
export const CADENCE_NEXT_KEY_DOMAIN = mint("cadence-next-key");

// ── CUSTODY: THE tree key, ITS KEYSLOTS, AND THE VESSEL KEL ───────────────────────────────────────────
/** The floor key's own inception: the key signed by itself, committing no next key. */
export const VESSEL_KEL_DOMAIN = mint("vessel-kel");
export const PLACE_NEXT_KEY_DOMAIN = mint("place-next-key");
/** The HKDF `info` every keyslot wrap derives under: a pin's KEK wrapping its share of the slot key, and the
 *  slot key wrapping the tree key. */
export const SLOT_WRAP_INFO = mint("slot-wrap");
/** The HKDF `info` of the slot tree's tree key check: the keyed digest a tree carries so every writer proves the tree key
 *  in hand against the standing tree before any byte moves. */
export const TREE_CHECK_INFO = mint("tree-key-check");

// ── ADMISSION + ENROLMENT ───────────────────────────────────────────────────────────────────────
/** A hearth's HOSTING ACT in one Nexus: its per-Nexus leaf signs the Nexus, itself, the act's POPRF public key
 *  and the act it rolls from. The act's CID names the hosting epoch; the act grants nothing and names no one but
 *  the hearth. Its own name: an act must never verify as a carriage act or any other signed thing. */
export const HOSTING_ACT_DOMAIN = mint("hosting-act");
/** The `keyInfo` a hosting act's POPRF key derives under (RFC 9497 DeriveKeyPair), over the Nexus and the act it
 *  rolls from — one key per act, derived and never stored. */
export const HOSTING_KEY_DOMAIN = mint("hosting-key");
/** The POPRF `info` an INVITE TOKEN evaluates under, with its class (`host-invite` · `walker-invite`), its Nexus
 *  and its epoch. Apart from `hosting-grant`: a token never verifies as a grant tag, nor a tag as a token. */
export const HOSTING_TOKEN_DOMAIN = mint("hosting-token");
/** The POPRF `info` a HOSTING GRANT's keyed tag evaluates under, with its Nexus and its epoch. */
export const HOSTING_GRANT_DOMAIN = mint("hosting-grant");
/** The operator SEAT's one DELEGATION to a hosting key in one Nexus: the seat signs the Nexus, itself and the
 *  hosting key, and nothing that moves per epoch or per session. Its own name: a delegation never verifies as a
 *  hosting act, a charter roll or any other seat signature. */
export const HOSTING_DELEGATION_DOMAIN = mint("hosting-delegation");
/** A DELEGATED hosting act: the hosting key signs the Nexus, the seat and its delegation, itself, the act's POPRF
 *  public key, the act it rolls from and the three dials. Apart from `hosting-act`, the leaf-signed shape the live
 *  cut retires: neither verifies as the other. */
export const HOSTING_DELEGATED_ACT_DOMAIN = mint("hosting-delegated-act");
/** The HKDF `info`, over the Nexus and the epoch, of the Ed25519 key that signs a walker's grant at that epoch,
 *  derived from the hosting key's seed. Its public half alone reaches a serving checker. */
export const HOSTING_GRANT_KEY_INFO = mint("hosting-grant-key");
/** A walker's SIGNED grant (H8): the epoch's grant key signs the Nexus, the epoch, the walker's leaf, its lineage,
 *  the epochs survived and its class. Apart from `hosting-grant`, the keyed POPRF tag's `info`. */
export const HOSTING_WALKER_GRANT_DOMAIN = mint("hosting-walker-grant");
/** A lineage's MINT MARKER at one hosting epoch: the hearth burns a digest of the lineage and the epoch under
 *  this name, so a lineage mints its whole allowance once per epoch and a replayed grant refills nothing. The
 *  marker names no one: the lineage is opaque to anyone who holds no claim. */
export const HOSTING_SPEND_DOMAIN = mint("hosting-spend");
/** The hearth's opaque key for one lineage's CARRIED record: a keyed digest of the lineage under the hearth's
 *  own leaf seed, so the record is reachable by the grant that opened it and names no one to anyone else. */
export const HOSTING_CARRY_DOMAIN = mint("hosting-carry");
/** A guest's INTRODUCTION of a friend to the hearth's operator: the guest's proven key signs the Nexus, the
 *  hosting epoch and the newcomer's key. The same name, under its own part labels, derives that key from the
 *  friend's secret and separates the seal an answer rides in. Its own name: an introduction must never verify
 *  as a hosting act, a token or a grant. The operator's answer consumes it, so nothing signed under this name
 *  rests anywhere after the answer. */
export const HOSTING_INTRODUCTION_DOMAIN = mint("hosting-introduction");
/** A walker's own SEAL secret for the documents a hearth carries for it — derived from the walker's leaf in the
 *  Nexus, so the read stays with the walker and the hearth carries ciphertext it can never open. */
export const WALK_CARRY_SEAL_INFO = mint("walk-carry-seal");
/** The HKDF `info` ONE carried document's key derives under, from the walker's carry secret and the document's
 *  own digest: each receipt holds a key that opens its own document and no other. */
export const WALK_CARRY_DOCUMENT_INFO = mint("walk-carry-document");
/** A cabal invite — the join axis, orthogonal to the carriage contract. */
export const CABAL_INVITE_DOMAIN = frozen("cabal-invite");

// ── THE NEXUS: charter, carriage, immunity ──────────────────────────────────────────────────────
export const NEXUS_DOC_DOMAIN = frozen("nexus-doc");
export const KAPAE_ANTIGEN_DOMAIN = frozen("kapae-antigen");
export const CARRIAGE_ENTRY_DOMAIN = frozen("carriage-entry");
export const CARRIAGE_CONTRACT_DOMAIN = frozen("carriage-contract");
/** A PLACE's own "I carry for this Nexus" seal — signed by its device-minted VESSEL key, never a persona
 *  root. Its OWN name rather than a flag on the contract domain: a carrier seal must never verify as a
 *  member's accepts-carriage token, nor that token as a carrier's, so the separation rides the name
 *  (heraldry#/the-herm-card). */
export const CARRIAGE_CARRIER_DOMAIN = frozen("carriage-carrier");
/** A SEAL ROLL's anchor on the carriage board: the NEW epoch's quorum names the epoch it closes, that epoch's
 *  public key-set, and the board's causal heads at the roll, so an admit already in those heads carries
 *  across the roll. Its own name: an anchor must never verify as a carriage act, nor an act as an anchor. */
export const CARRIAGE_ROLL_ANCHOR_DOMAIN = mint("carriage-roll-anchor");
/** The hiding commitment an ADMIT's quorum signs over the hearth's gate pin and canon list. The members board
 *  carries the commitment alone, so the floor travels unwidened; the opening rides only to the subject's hands. */
export const CARRIAGE_ADMIT_OPENING_DOMAIN = mint("carriage-admit-opening");
/** A PLACE's signed floor pin at one Nexus (`place-floor-pin`): the place's vessel key signs the pin its floor gate stands
 *  there, laid on the carriage board as a sidecar; a reader files it only where its own replica counts the place carried.
 *  Its own name: a floor-pin statement must never verify as a carrier seal, nor a seal as a pin. */
export const PLACE_FLOOR_PIN_DOMAIN = mint("place-floor-pin");
/** A herm's EXPLICIT JOIN carried by hand (`carry-bundle`): the kind the bundle's public bytes carry, so a reader never
 *  takes an admit bundle, or any other file, as a carry. */
export const CARRY_BUNDLE_DOMAIN = mint("carry-bundle");
/** One hand's act over one RELATIONSHIP — a raise or a lower, by the edge's holder or by the seat quorum. */
export const EDGE_KAPAE_DOMAIN = mint("edge-act");
/** One signed ACT in a face's `@persona` log (founding, admission, device edge, lease advance): the canonical
 *  body's `kind` names this domain, so no act verifies as another record and no record as an act. */
export const PERSONA_ACT_DOMAIN = mint("persona-act");
/** A face's independently signed, content-addressed intent entry. */
export const INTENT_ENTRY_DOMAIN = mint("intent-entry");
/** A root's narrow grant to an agent key on the face intent plane. */
export const INTENT_DELEGATION_DOMAIN = mint("intent-delegation");
/** The COMMITMENT a sealed face anchor keeps to its persona root: the root's DID hashes under this name, so
 *  the anchor names the root without carrying it. */
export const FACE_ANCHOR_ROOT_DOMAIN = mint("face-anchor-root");
/** The DIGEST a sealed face anchor keeps of its device edge. */
export const FACE_ANCHOR_EDGE_DOMAIN = mint("face-anchor-edge");
/** One signed EDGE FRONTIER on a board: the hand's own stream commitment (snapshot, parent, roster and epoch
 *  lineage). Apart from the act it counts. */
export const EDGE_FRONTIER_DOMAIN = mint("edge-frontier");
/** One signed LEASE ADVANCE in a PersonaGroup's per-writer slot: the writer signs the resource, its own key and
 *  the epoch it lifts the max-register to. An unsigned slot, or one signed by a key outside the face's roster, raises nothing. */
export const LEASE_ADVANCE_DOMAIN = mint("lease-advance");
/** One charter quorum's signed lease advance for a Nexus or realm, bound to its own seal epoch roster. */
export const QUORUM_LEASE_DOMAIN = mint("quorum-lease");
/** A SEAL ROLL's anchor on an edge board: the NEW epoch's quorum names the epoch it closes, that epoch's
 *  key-set, and the heads of the quorum acts that counted there, so a shadow carries across the roll. */
export const EDGE_ROLL_ANCHOR_DOMAIN = mint("edge-roll-anchor");
/** One device's relation to one fleet, named by the two ends every fleet device can read: the fleet root
 *  and the device key. The id a dyad's marker rides under on the fleet's edge board. */
export const DEVICE_EDGE_DOMAIN = mint("device-edge");
/** A member's whole relation to one realm, whoever vouched — the id a quorum's removal names. */
export const MEMBER_EDGE_DOMAIN = mint("member-edge");
/** A vessel's own receipt for one seat roll: its daemon island signs what the key group answered, and the
 *  vessel's ledger keeps a roll only under that signature (kapae#/keys). It crosses to nobody. */
export const SEAT_ROLL_DOMAIN = mint("seat-roll");
/** A vessel's own ASK of its daemon island's `seat-duties` verb: the vessel key signs one request id and a digest
 *  of the facts it hands in, so the island answers its own vessel's main thread and no other asker (kapae#/keys).
 *  Apart from `seat-roll`: an ask must never verify as a receipt. It crosses to nobody. */
export const SEAT_DUTIES_ASK_DOMAIN = mint("seat-duties-ask");
/** One hand's own stake on a joiner — a vouch admits nobody. */
export const VOUCH_EDGE_DOMAIN = frozen("vouch-edge");
/** The record that a re-anchoring happened, never what made it valid. */
export const RE_ANCHORING_DOMAIN = frozen("re-anchoring");
/** A guardian's confirmation on a recovery card. */
export const GUARDIAN_CONFIRM_DOMAIN = frozen("guardian-confirm");

// ── SEALED CONTENT + TRANSPORT ──────────────────────────────────────────────────────────────────
// ── THE SEALED STORE: the one private-byte format ───────────────────────────────────────────────
// Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store. Every derivation and every signed image takes a name
// of its own, so a body key never equals a commitment, an id never equals a locator, and no record of one
// kind verifies as another.
/** The SEALED VALUE's own name: it leads the context image every sealed value binds (bag, key version,
 *  role, logical reference), and its SHA-256 prefix stands as the format mark. A changed format takes a
 *  new name. */
export const SEALED_CHUNK_DOMAIN = mint("sealed-chunk");
/** The HKDF `info` a sealed value's single-use BODY KEY derives under. */
export const SEALED_CHUNK_KEY_INFO = mint("sealed-chunk-key");
/** The HKDF `info` a sealed value's COMMITMENT derives under: it binds the content key, the salt and the
 *  context, and a reader checks it before any segment opens. Apart from the body key's name. */
export const SEALED_CHUNK_COMMITMENT_INFO = mint("sealed-chunk-commitment");
/** The HKDF `info` a KEY VERSION ID derives under, with the bag's id: the id commits its content key. */
export const CONTENT_KEY_ID_INFO = mint("content-key-id");
/** The HKDF `info` a bag's opaque LOCATOR derives under, from the founding content key and the bag's id. */
export const SEALED_BAG_LOCATOR_INFO = mint("sealed-bag-locator");
/** The HKDF `info` a manifest ENTRY LOCATOR derives under, from the content key and the entry's context. */
export const SEALED_ENTRY_LOCATOR_INFO = mint("sealed-entry-locator");
/** The HKDF `info` a JOIN's proof of one parent key derives under, over the joining version's id. */
export const CONTENT_KEY_JOIN_PROOF_INFO = mint("content-key-join-proof");
/** A KEY VERSION RECORD: its clear part hashes to the record id under this name. */
export const CONTENT_KEY_VERSION_DOMAIN = mint("content-key-version");
/** A MANIFEST: its clear part hashes to the manifest id under this name. */
export const SEALED_MANIFEST_DOMAIN = mint("sealed-manifest");
/** A CHECKPOINT RECORD: its clear part hashes to the checkpoint id under this name. */
export const SEALED_CHECKPOINT_DOMAIN = mint("sealed-checkpoint");
/** What a record's writer SIGNS: the record's kind, its id and its private fields, under one name, handed
 *  to the session signer as an `act`. Apart from every record id's name. */
export const SEALED_RECORD_AUTHORSHIP_DOMAIN = mint("sealed-record-authorship");
/** A LOCKBOX PAYLOAD's image: the bag's id, its locator, the key version id and the content key. */
export const SEALED_LOCKBOX_DOMAIN = mint("sealed-lockbox");
/** A LOCKBOX as it rests and travels: its clear part (locator, key version id, wrap) and its box. */
export const SEALED_LOCKBOX_RECORD_DOMAIN = mint("sealed-lockbox-record");
/** A lockbox's BOX: the wrap document's id and the Keyhive ciphertext, and nothing else. */
export const SEALED_LOCKBOX_BOX_DOMAIN = mint("sealed-lockbox-box");
/** The CONTENT REFERENCE a wrap hands Keyhive for one lockbox: it cites no predecessor and names nothing. */
export const SEALED_LOCKBOX_REF_INFO = mint("sealed-lockbox-ref");
/** A signed RECORD as it rests and travels: its kind, its clear part and its sealed part. */
export const SEALED_RECORD_REST_DOMAIN = mint("sealed-record-rest");
/** One ROW of the chunk index as it rests. */
export const SEALED_INDEX_ROW_DOMAIN = mint("sealed-index-row");
/** A HAND-OVER RECORD: its clear part hashes to the record id under this name. */
export const SEALED_HAND_OVER_DOMAIN = mint("sealed-hand-over");
/** A PER-NEXUS KEY HAND-OVER: a face's key at one Nexus hands its standing on to a fresh key; both keys sign. */
export const NEXUS_KEY_HAND_OVER_DOMAIN = mint("nexus-key-hand-over");
/** A KEY PARCEL: one lockbox, its key version record and the wrap's public operations, for one reader. */
export const SEALED_KEY_PARCEL_DOMAIN = mint("sealed-key-parcel");
/** An OUTBOX PARCEL'S SEAL: the image a parcel and its reader ride in under the outbox key, and the AAD it binds. */
export const SEALED_OUTBOX_PARCEL_DOMAIN = mint("sealed-outbox-parcel");
/** The AEAD key an OUTBOX KEY derives for its parcels' seals (HKDF `info`). */
export const SEALED_OUTBOX_KEY_INFO = mint("sealed-outbox-key");
/** A MEMORY-IMPORT RECORD: its clear part hashes to the record id under this name. */
export const SEALED_MEMORY_IMPORT_DOMAIN = mint("sealed-memory-import");
/** A backup bundle's MEMORY SECTION: the image of its entries, each a bag's id, its locator, a key version
 *  id and that version's content key. */
export const SEALED_MEMORY_SECTION_DOMAIN = mint("sealed-memory-section");
/** The seal a MEMORY SECTION rides under: sealed to the public half of the pair its bundle key derives. */
export const SEALED_MEMORY_BOX_INFO = mint("sealed-memory-box");
/** The seal the section pair's SECRET half rides under to the one island that imports: sealed to a public
 *  key that island named for one import. */
export const SEALED_MEMORY_DOOR_INFO = mint("sealed-memory-door");
/** What a vessel's MAIN THREAD signs when it asks its own daemon island to cut or import a memory section. */
export const MEMORY_ASK_DOMAIN = mint("memory-ask");

// ── THE BACKUP BUNDLE ───────────────────────────────────────────────────────────────────────────
// Canon: lar:///ha.ka.ba/lararium/mesh/custody#/the-bundle.
/** The BACKUP BUNDLE's own name: its SHA-256 prefix stands as the format mark, and it leads the associated
 *  data of the bundle's sealed body. A changed format takes a new name: the body that carries the face's
 *  enrolled guardian set took this one. */
export const FACE_BUNDLE_DOMAIN = mint("face-bundle-guardian-set");
/** The HKDF `info` a bundle's BODY KEY derives under, from the bundle key. */
export const FACE_BUNDLE_BODY_INFO = mint("face-bundle-body");
/** The HKDF `info` a bundle's MEMORY SECTION key pair derives under, from the bundle key. Apart from the
 *  body key's name, so the pair's secret half never equals the key that opens the body. */
export const FACE_BUNDLE_MEMORY_INFO = mint("face-bundle-memory");
/** A PARTY'S OWN LOG VIEW of one face: the head a guardian, a seated chair or a sibling device holds for that
 *  face's key history, signed by the party's own key. A restored face stands provisional until one agrees. */
export const FACE_LOG_VIEW_DOMAIN = mint("face-log-view");
/** The per-shrine KNOCK's key: a gate answers an upgrade only on the path an HMAC under SHA-256(this name ‖ its
 *  gate key) derives (`gate-knock`), so a dialer that pinned no gate key reaches no gate. A derivation, never a
 *  signature: its own name keeps the knock apart from every proof made with the same key. */
export const GATE_KNOCK_DOMAIN = mint("gate-knock");
/** A LEAF'S PROOF TO A SIBLING LEAF of one PersonaGroup: a device key signs the exchange's whole transcript —
 *  both nonces, both ephemeral keys, its role — under this name, so the proof binds to one exchange and one channel. */
export const LEAF_PEER_PROOF_DOMAIN = mint("leaf-peer-proof");
/** Its HKDF `info` — the seal that keeps a leaf's device edge unread by the relay carrying it. */
export const LEAF_PEER_SEAL_INFO = mint("leaf-peer-seal");
/** Its SESSION's HKDF `info`: the per-direction keys and chain seeds two proven siblings derive from the
 *  ephemerals their device keys signed, so every frame after the proof rides the channel the proof admitted. */
export const LEAF_SESSION_INFO = mint("leaf-session");
/** The hello's HINT: an HMAC under the PersonaGroup secret over this name, the hello's nonce and its ephemeral
 *  key, so a sibling finds which of its secrets the other holds and a non-member forges no hint. */
export const LEAF_PEER_HINT_INFO = mint("leaf-peer-hint");
/** A persona-KEL SUCCESSOR DROP's name at one herm: a hash under this name over a KEL event's cid and the herm's
 *  gate key. The drop holds the events whose predecessor is that cid, so a leaf behind its group's head names the
 *  successors of the head it holds, and two herms see two names. */
export const PERSONA_KEL_DROP_DOMAIN = mint("persona-kel-drop");
/** The SIBLING CHANNEL's rendezvous tag: an HMAC under the PersonaGroup secret over this name and the herm's
 *  gate key, the opaque label its leaves join on that herm's relay. A non-member computes no tag, and two herms
 *  see two tags. The herm routes by it and reads no PersonaGroup from it. */
export const SIBLING_CHANNEL_INFO = mint("sibling-channel");
/** The PERSONAGROUP SECRET's derivation off the persona root's OWN seed, salted by the group's KEL prefix: the
 *  root derives it, never stores it, and a rotation's fresh op-key derives the next one. Never off the KEL, which
 *  rides public boards. */
export const PERSONA_GROUP_SECRET_INFO = mint("persona-group-secret");
/** Its delivery SEAL's HKDF `info`: the root seals the secret to one device key at enrolment, beside the edge. */
export const GROUP_SECRET_SEAL_INFO = mint("group-secret-seal");
/** The root's signature over one delivery seal — the op-key vouching that this box carries its secret to this
 *  device. Its own name: a seal signature must never verify as an edge, a KEL event or any other signed thing. */
export const GROUP_SECRET_ENROLMENT_DOMAIN = mint("group-secret-enrolment");
/** A rotation's SEALED ENROLMENT on the persona-KEL: the fresh op-key signs each box it re-enrols a device with
 *  under this name. The box names no device; its signature vouches only that the op-key sealed it. */
export const SEALED_ENROLMENT_DOMAIN = mint("sealed-enrolment");
/** Its box's HKDF `info`: the re-delegated edge and the next secret, sealed to one device key together. Apart from
 *  `group-secret-seal`: a KEL-borne box must never open as a delivery seal, nor one as the other. */
export const SEALED_ENROLMENT_INFO = mint("sealed-enrolment-box");
/** The repo PEER ID a sibling stands under: a hash under this name of the device key it proved over the sibling
 *  session. Derived, never chosen, so a sibling can name no peer another adapter carries. */
export const SIBLING_PEER_ID_INFO = mint("sibling-peer-id");
// ── THE FACE PROOF: face key → the vessel's face-scoped key → session key ───────────────────────
// Canon: lar:///ha.ka.ba/lares/api/pono/face-proof. Each image leads with its own name, so no link of the
// chain verifies as another link, and no digest of one purpose equals a digest of another.
/** A joining vessel's REQUEST: its own face-scoped key signs for itself, proving it holds the key it asks
 *  the face key to certify. Apart from the certificate: a request never reads as the face key's word. */
export const FACE_CERTIFICATE_REQUEST_DOMAIN = mint("face-certificate-request");
/** The CERTIFICATE the face key signs once, at the join, over one vessel's face-scoped key at one Nexus. */
export const FACE_CERTIFICATE_DOMAIN = mint("face-certificate");
/** A WITHDRAWAL event of the face's deny-only history, signed by the face key. */
export const FACE_WITHDRAWAL_DOMAIN = mint("face-withdrawal");
/** The GENESIS head a face's withdrawal history starts from: a digest name, signed by nobody. */
export const FACE_WITHDRAWAL_GENESIS_DOMAIN = mint("face-withdrawal-genesis");
/** The digest a denial names a withdrawn key by, bound to its face key and Nexus. */
export const FACE_WITHDRAWN_KEY_DOMAIN = mint("face-withdrawn-key");
/** The reference a local session carries for its face's proof subject: a digest name. */
export const FACE_PROOF_SUBJECT_DOMAIN = mint("face-proof-subject");
/** A SESSION's certificate: the vessel's face-scoped key signs one session key and its hand's profile. */
export const SESSION_CERTIFICATE_DOMAIN = mint("session-certificate");
/** What a session signer signs, one name per purpose: the dial's signed FINISH, an ordinary ACT, and an act
 *  that changes who holds AUTHORITY. Three names, so a finish never verifies as an act, and a profile barred
 *  from authority holds no signature that reads as one. */
export const SESSION_FINISH_DOMAIN = mint("session-finish");
export const SESSION_ACT_DOMAIN = mint("session-act");
export const SESSION_AUTHORITY_DOMAIN = mint("session-authority");
// ── THE FLEET-JOIN DOOR: one face's fleet takes a new vessel of the same human ───────────────────
// Canon: lar:///ha.ka.ba/lares/api/pono/face-proof#/the-chain. Three files cross by courier; each signed image
// and the secret's seal carry their own name.
/** A joining vessel's REQUEST: its own vessel key signs the nonce, its seal key and its certificate requests. */
export const FLEET_JOIN_REQUEST_DOMAIN = mint("fleet-join-request");
/** The ANSWER the PersonaGroup root signs: the edge by digest, the hearth's carriage and reach, the sealed secret. */
export const FLEET_JOIN_ANSWER_DOMAIN = mint("fleet-join-answer");
/** The digest an answer binds its device edge by. A digest name, signed by nobody. */
export const FLEET_JOIN_EDGE_DOMAIN = mint("fleet-join-edge");
/** The HKDF `info` of the face address secret's seal to the joining vessel. Apart from every other box. */
export const FLEET_JOIN_SECRET_INFO = mint("fleet-join-address-secret");
/** A FACE-KEY GRANT: the PersonaGroup root names one face key as its own at one Nexus. */
export const FACE_KEY_GRANT_DOMAIN = mint("face-key-grant");
// ── THE GATE: one bundle per (Nexus, route), and the exchange it answers ────────────────────────
// Canon: lar:///ha.ka.ba/lares/api/pono/face-proof#/the-gate-exchange. A gate derives its keys and never
// stores them; each name below separates one derivation, one digest or one signed image from the rest.
/** The custody root's CHILD every gate bundle of a vessel derives from: an HKDF `info`, asked of the custody
 *  seat once per derivation. Apart from every other child of that root. */
export const GATE_BUNDLE_INFO = mint("gate-bundle");
/** The FLOOR key's CHILD every floor-tier gate bundle derives from: an HKDF `info`, asked of the floor key's
 *  own door. Apart from the custody root's child: a floor bundle and a sovereign bundle share no ancestor. */
export const GATE_FLOOR_BUNDLE_INFO = mint("gate-floor-bundle");
/** A bundle's TRANSPORT key: the HKDF `info`, over the Nexus and the route, of the X25519 key that answers a
 *  dialer's first flight. */
export const GATE_TRANSPORT_KEY_INFO = mint("gate-transport-key");
/** A bundle's SIGNING key: the HKDF `info`, over the Nexus and the route, of the Ed25519 key that signs the
 *  gate's verdict and the floor's announcement. Apart from the transport key: neither derives the other. */
export const GATE_SIGNING_KEY_INFO = mint("gate-signing-key");
/** The digest that names a bundle's PIN (the Nexus, the route and both public keys) wherever a handshake or a
 *  signature binds it. A digest name, signed by nobody. */
export const GATE_BUNDLE_PIN_DOMAIN = mint("gate-bundle-pin");
/** The handshake's PROLOGUE: both ends mix the pin's digest under this name, so a first flight decrypts only
 *  at the gate whose pin its dialer held. */
export const GATE_HANDSHAKE_DOMAIN = mint("gate-handshake");
/** The digest of a PRESENTATION's own bytes, as the signed finish binds it. A digest name. */
export const GATE_PRESENTATION_DOMAIN = mint("gate-presentation");
/** The payload of the signed FINISH: the completed handshake's hash, the bundle's digest, the presentation's
 *  digest and the audience. It rides inside the session key's `session-finish` image and leads with its own
 *  name, so no other finish payload reads as a dial's. */
export const GATE_FINISH_DOMAIN = mint("gate-finish");
/** A PLACE's signed FINISH: a faceless place's own key signs the completed handshake's hash, the bundle's
 *  digest, its presentation's digest and the audience under this name. Apart from `gate-finish` and from the
 *  session key's `session-finish`: a finish signed for a place verifies for no face, and a face's for no place. */
export const GATE_PLACE_FINISH_DOMAIN = mint("gate-place-finish");
/** The gate's VERDICT: its signing key signs the handshake's hash, the bundle's digest and a digest of its
 *  answer under this name, so a dialer reads an answer only from the gate it pinned, for the dial it made. */
export const GATE_VERDICT_DOMAIN = mint("gate-verdict");
/** The FLOOR's ANNOUNCEMENT to its peers: a floor bundle's signing key signs one canonical body per carried
 *  Nexus (version, Nexus, floor pin digest, standing, causal position) under this name. Apart from the verdict:
 *  an announcement never reads as an answer to a dial, nor an answer as an announcement
 *  (lar:///ha.ka.ba/lares/api/pono/waking-floor#/the-announcement). */
export const WAKING_FLOOR_ANNOUNCE_DOMAIN = mint("waking-floor-announce");
/** A realm-bag REGISTRATION — the record a bag's stewards sign onto the realm's shared doc (`keptBy`,
 *  `readTier`, the doc url). Its own domain: a registration must never verify as any other signed thing. */
export const REALM_BAG_DOMAIN = frozen("realm-bag");
/** A quorum HANDLE's seal as a realm steward: the Handle's head key signs a realm record's digest under the
 *  chain state it stands at. Its own name, so a steward seal never verifies as a card, an attestation or a
 *  chain event, and none of those verifies as a seal. */
export const STEWARD_SEAL_DOMAIN = mint("steward-seal");

/**
 * THE OFFERING — one operator publishing their own plugin collection for others to take.
 *
 * A GIFT, NEVER A QUORUM ACT: a taker verifies the blobs BY HASH against the declared region, so nothing
 * stands for a second hand to attest that the hash does not already settle. One signature, one announce.
 */
export const PLUGIN_OFFERING_DOMAIN = frozen("plugin-offering");

/** The public Crossroads projection of one immutable plugin offering. The signed offering remains the authority. */
export const PLUGIN_OFFERING_ANNOUNCE_DOMAIN = frozen("plugin-offering-announce");

/**
 * A TENDER'S PRESENTATION over an offering — the Lamplighters' half of the immune architecture.
 *
 * PRESENTATION ⊥ CONDEMNATION. A tender presents what it noticed and carries ZERO threshold weight: N
 * tenders converging lowers nothing, and the quorum keeps its full k. Its own domain, so a presentation
 * can never be replayed as a verdict.
 */
export const OFFERING_PRESENTATION_DOMAIN = frozen("offering-presentation");

/**
 * The quorum act that sets an offering aside — the condemning half, held by a kahu quorum alone.
 *
 * Its OWN domain, apart from `kapae-antigen`: that board shadows a PRESENTER, this one an OFFERING, and a
 * signature minted over one must never verify as the other.
 */
export const OFFERING_KAPAE_DOMAIN = frozen("offering-kapae");
/** The @crossroads ANNOUNCE of a realm bag — that it exists and who keeps it, NEVER the doc. A different
 *  domain from the registration: a public announce must never stand in for a steward's signature. */
export const REALM_BAG_ANNOUNCE_DOMAIN = frozen("realm-bag-announce");
/** The persona-root seed WRAPPED at rest under a passkey PRF output (browser, opt-in). A NAME of its own,
 *  apart from every seal above: the PRF output is a cloud-synced-class secret and the wrap must never
 *  derive into an admit seal. */
export const SEED_WRAP_PRF_INFO = frozen("seed-wrap-prf");

// ── PLANES + SCOPES (HMAC name derivations) ─────────────────────────────────────────────────────
/** One PersonaGroup's private plane name, derived from that group's own doc id. */
export const PERSONA_SCOPE_INFO = frozen("persona-scope");
/** The per-circle hardened index — the key a persona presents to one circle. */
export const CIRCLE_SCOPE_INFO = frozen("circle-scope");

// ── ARTEFACTS + BOARDS ──────────────────────────────────────────────────────────────────────────
/** The signed causal pointer to a served FLOW-map snapshot (the herm's relay face). Its own name: the floor's answer is the
 *  release (`floor-release`), so no pointer signs a floor, and a flow pointer verifies as nothing else. */
export const FLOW_POINTER_DOMAIN = mint("flow-pointer");
/** The deterministic plugin build's provenance. */
export const PLUGIN_ATTESTATION_DOMAIN = frozen("plugin-attestation");
/** The Mu void marker — an immune-set refusal carrying no subject. */
export const MU_VOID_DOMAIN = frozen("mu-void");
/** A vessel's raise challenge — verifier-chosen freshness at the waking floor. */
export const RAISE_CHALLENGE_DOMAIN = frozen("raise-challenge");
/** The record a canon PROMOTION leaves behind — what crossed, by whom, from where, at which bytes. Its own
 *  name because it asserts CONTENT PROVENANCE and never authority: a cap delegation says who may write
 *  canon, and this says what was written (`docs/pono/canon-boundary#/the-promotion-boundary`). */
export const PROMOTION_RECEIPT_DOMAIN = frozen("promotion-receipt");
/** The seats' approval of one promotion: the EXACT bytes (hash), the purpose and the surface, under the
 *  chartered class the act takes. Its own name, apart from the receipt: the receipt records what crossed, and
 *  this carries the collective's authority for it (`lararium/mesh/kahu#/chartered-classes`). */
export const PROMOTION_APPROVAL_DOMAIN = mint("promotion-approval");
/** The seat quorum's admission of a PersonaGroup into a Nexus's Kahu cabal: its own authority act, never a
 *  vouch (`lararium/mesh/kahu#/cabal-admission`). */
export const KAHU_CABAL_ADMIT_DOMAIN = mint("kahu-cabal-admit");
/** The steward's seal on a Nexus's floor release: the one porch body that names the floor manifest CID, the charter
 *  epoch, the release before it and the Nexus AID. Its own name, so no seal over another shape (a flow pointer, a
 *  cabal act, a promotion approval) verifies as a release (`lares/docs/pono/w26-floor-lane#/the-slices`). */
export const FLOOR_RELEASE_DOMAIN = mint("floor-release");

// ── CUSTODY CARRIER CONTEXT ─────────────────────────────────────────────────────────────────────
/** A D row's seal context: confidential material one PersonaGroup owns, sealed under that group's face custody key. */
export const CUSTODY_D_DOMAIN = mint("custody-carrier-d");
/** An F row's context: deliberately public bytes. No sealed-carrier writer stands for it; the name keeps it apart. */
export const CUSTODY_F_DOMAIN = mint("custody-carrier-f");
/** An S row's seal context: a named node-only secret under a named node principal. */
export const CUSTODY_S_DOMAIN = mint("custody-carrier-s");

/**
 * Every domain this house mints, in declaration order. DERIVED: each `mint` and `frozen` call above lands
 * here, so a declared domain cannot be left out of the table. The witness also refuses any domain literal
 * written outside this file.
 */
export const ALL_DOMAINS: readonly string[] = Object.freeze([...declared]);
