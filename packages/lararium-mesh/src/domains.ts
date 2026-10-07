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

// ── ADMISSION + ENROLMENT ───────────────────────────────────────────────────────────────────────
export const PERSONA_ENROLL_DOMAIN = frozen("persona-enroll");
export const PERSONA_GRANT_DOMAIN = frozen("persona-grant");
export const PERSONA_SEALED_DOMAIN = frozen("persona-sealed-grant");
export const PERSONA_JOIN_DOMAIN = frozen("persona-join");
/** The grant seal's HKDF `info`. A NAME of its own — never a version digit carrying the separation from
 *  the four signing domains above. */
export const PERSONA_ADMIT_SEAL_INFO = frozen("persona-admit-grant-seal");
/** A burnable boot invite, spent once at a vessel's first waking. */
export const BOOT_INVITE_DOMAIN = frozen("boot-invite");
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
/** The LEAF'S PROOF OF POSSESSION over a presented carriage admit: the admit's own leaf signs the gate's
 *  nonce, the gate key, the presenting vessel key and the admit's act CID under this name, binding that admit
 *  to ONE socket. Its own name, apart from `auth-proof`: the vessel key signs that one and the leaf signs this
 *  one, and neither signature may verify as the other. No root signs it and no root is named in it. */
export const PRESENTED_ADMIT_LEAF_PROOF_DOMAIN = mint("presented-admit-leaf-proof");
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
