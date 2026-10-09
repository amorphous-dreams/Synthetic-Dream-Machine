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
/** A walker's own SEAL secret for the documents a hearth carries for it — derived from the walker's leaf in the
 *  Nexus, so the read stays with the walker and the hearth carries ciphertext it can never open. */
export const WALK_CARRY_SEAL_INFO = mint("walk-carry-seal");
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
/** The kāpae raised over one RELATIONSHIP rather than over a party. */
export const EDGE_KAPAE_DOMAIN = frozen("edge-kapae");
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
/** The `cad` convergent keystream — ciphertext-addressed bodies. */
export const CAD_KEYSTREAM_INFO = frozen("cad-keystream");
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
/** The CATCH-UP seal's HKDF `info`: a sibling ahead seals the persona-KEL suffix a stale sibling lacks, under the
 *  secret they share, so the herm carries the suffix without reading it. Apart from `leaf-peer-seal`: a suffix
 *  box must never open as a proof box. */
export const LEAF_CATCH_UP_SEAL_INFO = mint("leaf-catch-up-seal");
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
