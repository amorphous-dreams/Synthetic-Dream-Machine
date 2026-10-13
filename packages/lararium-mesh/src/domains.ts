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
 * `/v2` collapse the moment a reset renumbers them. So `keyring-envelope`'s SIGNING domain and its HKDF
 * `info` each carry their own NAME, and separation belongs to the name alone. A change
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
export const DYAD_VEIL_INFO = frozen("dyad-veil");
/** The founder's SELF-RECOVERY leaf off the PERSONA tree: a 1-of-1 recovery key derived from the
 *  persona seed, pre-committed at inception so no prefix ever incepts unarmed — the multitude-of-one,
 *  NAMED, until a real guardian set grafts in (the seal-reserve founding rhyme). */
export const PERSONA_SELF_RECOVERY_INFO = frozen("persona-self-recovery");
/** The Fork-B registration handshake — DELIBERATELY apart from GUARDIAN_CONFIRM_DOMAIN: a bearer
 *  SHARE and a public REGISTRATION must never speak one phrase (the IdenTrust wrong-object cure). */
export const GUARDIAN_REGISTRATION_DOMAIN = frozen("guardian-registration");
/** The growth rite's crossing record: old quorum signs the handoff, new quorum the receipt, witnesses
 *  outside both sets attest the rite — the checkable form of the ceremony witness report. */
export const RESERVE_TRANSITION_DOMAIN = frozen("reserve-transition");
/** A charter epoch's ROLL: the revealed, pre-committed keys sign the predecessor's cid, the seated key-set,
 *  its threshold and the next commitment — the KERI rotation event. Its own name: a roll must never verify
 *  as a crossing record, a roll anchor, or any carriage act. */
export const SEAL_ROLL_DOMAIN = mint("seal-roll");
/** A seat's NEXT-KEY commitment: the digest of one cold verifying key, the value a charter carries until that
 *  seat reveals the key to roll. Its own name: a seat digest must never read as a key-set hash or a bare hash. */
export const SEAT_NEXT_KEY_DOMAIN = mint("seat-next-key");
/** The COLD-KEY CARD: the checksum that binds every character of a card's code, and the confirm phrase two
 *  people read to each other over it. Apart from `guardian-confirm`: a seat's card and a guardian's share never
 *  speak one phrase. */
export const COLD_KEY_CARD_DOMAIN = mint("cold-key-card");

// ── CUSTODY: THE VK, ITS KEYSLOTS, AND THE VESSEL KEL ───────────────────────────────────────────
/** The vessel's own key-event log: the inception that commits the next floor key's digest. */
export const VESSEL_KEL_DOMAIN = mint("vessel-kel");
/** The HKDF `info` every keyslot wrap derives under: a pin's KEK wrapping its share of the slot key, and the
 *  slot key wrapping the VK. */
export const VK_SLOT_WRAP_INFO = mint("vk-slot-wrap");
/** The HKDF `info` of the slot tree's VK check: the keyed digest a tree carries so every writer proves the VK
 *  in hand against the standing tree before any byte moves. */
export const VK_CHECK_INFO = mint("vk-check");

// ── ADMISSION + ENROLMENT ───────────────────────────────────────────────────────────────────────
export const PERSONA_ENROLL_DOMAIN = frozen("persona-enroll");
export const PERSONA_GRANT_DOMAIN = frozen("persona-grant");
export const PERSONA_SEALED_DOMAIN = frozen("persona-sealed-grant");
export const PERSONA_JOIN_DOMAIN = frozen("persona-join");
/** The grant seal's HKDF `info`. A NAME of its own — never a version digit carrying the separation from
 *  the four signing domains above. */
export const PERSONA_ADMIT_SEAL_INFO = frozen("persona-admit-grant-seal");
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
export const MEMBERSHIP_RELAY_DOMAIN = frozen("membership-relay");
/** One hand's act over one RELATIONSHIP — a raise or a lower, by the edge's holder or by the seat quorum. */
export const EDGE_KAPAE_DOMAIN = mint("edge-act");
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
/** One hand's own stake on a joiner — a vouch admits nobody. */
export const VOUCH_EDGE_DOMAIN = frozen("vouch-edge");
/** The record that a re-anchoring happened, never what made it valid. */
export const RE_ANCHORING_DOMAIN = frozen("re-anchoring");
/** A guardian's confirmation on a recovery card. */
export const GUARDIAN_CONFIRM_DOMAIN = frozen("guardian-confirm");

// ── SEALED CONTENT + TRANSPORT ──────────────────────────────────────────────────────────────────
/** The keyring delivery envelope — the signed wire shape. */
export const KEYRING_ENVELOPE_DOMAIN = frozen("keyring-envelope");
/** Its HKDF `info`. A NAME of its own, held apart from the signing domain above: a version digit doing a
 *  domain's job fuses the two on the first reset. */
export const KEYRING_ENVELOPE_SEAL_INFO = frozen("keyring-envelope-seal");
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
/** The relay gate's seed derivation — the crossroads transport identity, never the vessel's own. */
export const RELAY_GATE_INFO = frozen("relay-gate");
/** The V3 PROOF OF POSSESSION a peer signs at the wire's gate: nonce, gate key, own key, audience and
 *  timestamp, committed under this name so a proof can never verify as any other signed thing, nor any
 *  other signature as a proof. Ephemeral — both ends run one build, so nothing persisted rides it. */
export const AUTH_PROOF_DOMAIN = mint("auth-proof");
/** The LEAF'S PROOF OF POSSESSION over what a socket PRESENTS — an admit, a hosting grant or a redeemed token:
 *  the presenting leaf signs the gate's nonce, the gate key, the presenting vessel key and the presentation's
 *  CID under this name, binding that presentation to ONE socket. One relation across every arm, so one name.
 *  Apart from `auth-proof`: the vessel key signs that one and the leaf signs this one, and neither signature
 *  may verify as the other. No root signs it and no root is named in it. */
export const PRESENTED_LEAF_PROOF_DOMAIN = mint("presented-leaf-proof");
/** The per-shrine KNOCK's key: a gate answers an upgrade only on the path an HMAC under SHA-256(this name ‖ its
 *  gate key) derives (`gate-knock`), so a dialer that pinned no gate key reaches no gate. A derivation, never a
 *  signature: its own name keeps the knock apart from every proof made with the same key. */
export const GATE_KNOCK_DOMAIN = mint("gate-knock");
/** The GATE'S VERDICT: a gate signs its `lar:auth-ok` with its own gate key over both nonces, the gate key,
 *  the leaf's key and the audience under this name, so a leaf reads a passing verdict only from the gate it
 *  pinned. Its own name, apart from `auth-proof`: the leaf signs that one and the gate signs this one. */
export const AUTH_OK_DOMAIN = mint("auth-ok");
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
// ── THE GATE: one bundle per (Nexus, route), and the exchange it answers ────────────────────────
// Canon: lar:///ha.ka.ba/lares/api/pono/face-proof#/the-gate-exchange. A gate derives its keys and never
// stores them; each name below separates one derivation, one digest or one signed image from the rest.
/** The custody root's CHILD every gate bundle of a vessel derives from: an HKDF `info`, asked of the custody
 *  seat once per derivation. Apart from every other child of that root. */
export const GATE_BUNDLE_INFO = mint("gate-bundle");
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
/** The gate's VERDICT: its signing key signs the handshake's hash, the bundle's digest and a digest of its
 *  answer under this name, so a dialer reads an answer only from the gate it pinned, for the dial it made. */
export const GATE_VERDICT_DOMAIN = mint("gate-verdict");
/** A realm-bag REGISTRATION — the record a bag's stewards sign onto the realm's shared doc (`keptBy`,
 *  `readTier`, the doc url). Its own domain: a registration must never verify as any other signed thing. */
export const REALM_BAG_DOMAIN = frozen("realm-bag");

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
 *  derive into an admit seal or a keyring envelope. */
export const SEED_WRAP_PRF_INFO = frozen("seed-wrap-prf");

// ── PLANES + SCOPES (HMAC name derivations) ─────────────────────────────────────────────────────
/** One PersonaGroup's private plane name, derived from that group's own doc id. */
export const PERSONA_SCOPE_INFO = frozen("persona-scope");
/** The per-circle hardened index — the key a persona presents to one circle. */
export const CIRCLE_SCOPE_INFO = frozen("circle-scope");
/** The per-NEXUS scope leaf. Distinct from `circle-scope`: a compartment and an island must never
 *  derive into one another, so their MAC domains stay apart. */
export const NEXUS_SCOPE_INFO = frozen("nexus-scope");

// ── ARTEFACTS + BOARDS ──────────────────────────────────────────────────────────────────────────
/** The served `oracle` pointer doc. */
export const ORACLE_POINTER_DOMAIN = frozen("oracle-pointer");
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

/**
 * Every domain this house mints, in declaration order. DERIVED: each `mint` and `frozen` call above lands
 * here, so a declared domain cannot be left out of the table. The witness also refuses any domain literal
 * written outside this file.
 */
export const ALL_DOMAINS: readonly string[] = Object.freeze([...declared]);
