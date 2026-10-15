/**
 * KeyhiveIdentitySlot — the pono IdentitySlot: every method rides the REAL
 * Keyhive capability barrier, never a permissive default.
 *
 * WHY IT LIVES HERE (not in @lararium/mesh): mesh owns the `IdentitySlot`
 * interface but CANNOT import Keyhive — keyhive imports FROM mesh, so a mesh→
 * keyhive edge would close a package cycle. This mirrors the #49 federation-gate
 * precedent exactly: mesh keeps the narrow deny-nothing default (OpenIdentitySlot)
 * as its alpha socket; the crypto-backed implementation slots in behind the
 * SAME interface from the keyhive package, no call-site churn.
 *
 * Each method routes through a real `CapabilityProvider` (KeyhiveProvider in
 * production): `verify` rides genuine `accessForDoc` (Ed25519 membership),
 * `delegate` mints a real revocable delegation event.
 *
 * ── HONEST BOUND ────────────────────────────────────────────────────────────
 * PROVABLY ENFORCES (rides real crypto, at any call site that invokes it):
 *   · A presenter never delegated (or since revoked) CANNOT obtain
 *     verifyCapability → true. The verdict is `provider.verify().ok`, which
 *     resolves bagUrl→docId, materializes the island, and calls Keyhive's
 *     `accessForDoc` — a genuine capability check, not an id-guess gate.
 *   · edit ⇒ admin: a read-only delegation does NOT satisfy verifyCapability(…,
 *     "edit"). "edit" maps to the "admin" rung; admin satisfies read, read never
 *     satisfies admin (KeyhiveProvider.verify §402-419).
 *
 * OUT OF SCOPE (the held wiring second-half + BeeKEM):
 *   · NO production path constructs this class: it stands SPECIFIED in code,
 *     tested, and out of the package barrel. Both vessels fill the inner ring
 *     with the PersonaGroup ring (`assemblePersonaGroupRing`; ruling B in
 *     `identity-slot.ts`). The caller it waits on stands named in
 *     `federation-gate.ts` (`identityShareDecision`): a main-thread capability
 *     provider with the docId→bagUrl map carried across, a `tokenSeal` and a
 *     `leaseEpochOf`. Construction alone gates nothing.
 *   · TRUE read-confidentiality — denying a *guessed* doc id and hiding the
 *     bytes at rest — is BeeKEM (Keyhive's encryption layer), not this shore.
 *     This slot gates the sharePolicy ACCESS decision; it does not encrypt.
 *   · verifyDelegation trusts the audience the token NAMES (see its doc): it
 *     confirms that named audience genuinely holds the cap via accessForDoc, but
 *     does not cryptographically bind the *presenter* to the token. Presenter↔
 *     token binding is the WASM sync-time membership proof, not this shore.
 *
 * H6 (gp25 iteration 4) — the §2c epoch fence rode a BARE JSON field. `KeyhiveTokenPayload` carried no
 * signature over `boundEpoch` (or anything), so a presenter could edit its own `boundEpoch` upward after
 * the lease rolled and `verifyDelegation` would clear it — proven live over a real WASM provider under real,
 * set-forward and set-back clocks (every causal refusal held; the forged-epoch row alone passed). The fence
 * is now SIGNED: `tokenSeal` (the vessel device key) signs the canonical fenced fields at mint time, and
 * verify checks that signature BEFORE trusting `boundEpoch` at all. A slot with no `tokenSeal` mints
 * `boundEpoch: null` — fail-closed, the same shape as today's no-`leaseEpochOf` path — because an unsealed
 * epoch is exactly as forgeable as no epoch at all; `leaseEpochOf` alone (no seal) no longer fences anything.
 *
 * Meme: lar:///ha.ka.ba/lararium/keyhive/identity-slot
 */
import type { ActorId, CapabilityToken, IdentitySlot } from "@lararium/mesh";
import type { CapabilityAccess } from "@lararium/mesh";
import { canonicalJsonBytes, hex, sha256BytesSync } from "@lararium/mesh";
import type { CapabilityProvider } from "./capability-provider.js";

/**
 * H6 — signs/verifies the canonical fenced fields of a minted token with the vessel's own device key (or
 * whatever long-lived keypair the caller wants to bind the fence to). Injected rather than constructed here:
 * this package stays decoupled from wherever the device key actually lives (Keyhive's own Ed25519 identity,
 * a hardware key, a test double). `sign`/`verify` operate on raw bytes — the caller owns the signature
 * scheme entirely; this shore only ever calls it with the SAME canonical byte image at mint and at verify.
 */
export interface TokenSeal {
  readonly sign:   (bytes: Uint8Array) => string;
  readonly verify: (bytes: Uint8Array, sigHex: string) => boolean;
}

export interface KeyhiveIdentitySlotOpts {
  /** The real capability provider (KeyhiveProvider in production). */
  readonly provider: CapabilityProvider;
  /** This vessel's DID — the presenter asserted by verifyCapability (self). */
  readonly did: string;
  /**
   * §2c — resolve bagUrl's CURRENT effective lease epoch (clockless; the caller composes this off
   * `epoch-lease.ts`'s `effectiveLeaseEpoch` against its own board read). INJECTED rather than imported
   * directly: this package stays decoupled from the board/materialize machinery that resolves an epoch, so a
   * caller names its own composition. The SAME function is read at mint time (stamps `boundEpoch` onto the
   * token) and at verify time (the fence's "current epoch") — both calls route through this one closure, so a
   * granter and a verifier sharing a slot instance always read the SAME epoch authority. Omitted entirely →
   * mint stamps `boundEpoch: null`, and `verifyDelegation`'s fence then refuses every token this slot ever
   * mints (an unfenced mint is a refused verify, never a silent open gate).
   */
  readonly leaseEpochOf?: (bagUrl: string) => Promise<number | null> | number | null;
  /**
   * H6 — signs the canonical fenced fields `{delegationId, audience, bagUrl, access, boundEpoch}` at mint
   * time (the vessel device key in production); verify checks the SAME canonical bytes against the carried
   * signature before trusting `boundEpoch` for anything. Omitted entirely → mint stamps `boundEpoch: null`
   * regardless of `leaseEpochOf` (an unsealed fence is a forgeable fence, so it mints as no fence at all),
   * and verify refuses any presented token whose `boundEpoch` is non-null (this slot cannot check it).
   */
  readonly tokenSeal?: TokenSeal;
}

/**
 * The wire shape of a CapabilityToken this slot mints. Self-describing so a
 * remote verifyDelegation can route the honest accessForDoc check without a
 * side channel. `bytes` (hex) carries the raw Keyhive delegation event the
 * audience ingests over the federation transport.
 */
interface KeyhiveTokenPayload {
  readonly delegationId: string;
  readonly audience:     string;
  readonly bagUrl:       string;
  readonly access:       CapabilityAccess;
  readonly bytesHex:     string;
  /**
   * §2c — the lease epoch (`epoch-lease.ts`, clockless) read off `leaseEpochOf(bagUrl)` AT MINT TIME, or `null`
   * when the slot was constructed with no `leaseEpochOf` (or the resolver itself returned/threw null). This is
   * the FENCE `verifyDelegation` checks: a token minted at epoch E refuses the moment the
   * bag's effective epoch has rolled past E, independent of any wall clock. Council ruling 6: a verifier that
   * cannot read the current epoch reports an INCOMPLETE VIEW (refuse), never "expired" and never "standing".
   */
  readonly boundEpoch:   number | null;
  /**
   * H6 — the hex signature over `sealedFenceBytes({delegationId, audience, bagUrl, access, boundEpoch})`,
   * or `null` when the minting slot carried no `tokenSeal` (in which case `boundEpoch` is also `null` — see
   * `KeyhiveIdentitySlotOpts.tokenSeal`). Covers exactly the fields a forger would need to edit to move the
   * fence, and nothing else, so re-serializing the SAME delegation never invalidates its own seal.
   */
  readonly sealSigHex:  string | null;
}

/** The canonical bytes `tokenSeal` signs/verifies — the fenced fields only, sorted-key stable. A forger who
 *  edits `boundEpoch` (or any of the other four) after minting invalidates this signature. */
function sealedFenceBytes(fields: {
  delegationId: string; audience: string; bagUrl: string; access: CapabilityAccess; boundEpoch: number | null;
}): Uint8Array {
  return canonicalJsonBytes({
    delegationId: fields.delegationId,
    audience:     fields.audience,
    bagUrl:       fields.bagUrl,
    access:       fields.access,
    boundEpoch:   fields.boundEpoch,
  });
}

/** "edit" is the interface's write verb; the provider's write rung is "admin". */
function accessFor(ability: "read" | "edit"): CapabilityAccess {
  return ability === "edit" ? "admin" : "read";
}

/** Best-effort resolve a (possibly async, possibly throwing) `leaseEpochOf` to a finite epoch or `null` — a
 *  resolver fault reads as "unreadable", never a thrown fault that would crash the mint/verify call site. */
async function readLeaseEpoch(
  leaseEpochOf: ((bagUrl: string) => Promise<number | null> | number | null) | undefined,
  bagUrl: string,
): Promise<number | null> {
  if (!leaseEpochOf) return null;
  try {
    const v = await leaseEpochOf(bagUrl);
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

export class KeyhiveIdentitySlot implements IdentitySlot {
  readonly did: string;
  readonly #provider: CapabilityProvider;
  readonly #leaseEpochOf?: (bagUrl: string) => Promise<number | null> | number | null;
  readonly #tokenSeal?: TokenSeal;

  constructor(opts: KeyhiveIdentitySlotOpts) {
    this.#provider = opts.provider;
    this.did       = opts.did;
    if (opts.leaseEpochOf) this.#leaseEpochOf = opts.leaseEpochOf;
    if (opts.tokenSeal)    this.#tokenSeal    = opts.tokenSeal;
  }

  /**
   * Does THIS vessel hold `ability` on docUrl? Presenter = self (this.did):
   * the sharePolicy asks "may I sync this doc", so the vessel presents its own
   * DID against the real barrier. Rides provider.verify → accessForDoc.
   */
  async verifyCapability(docUrl: string, ability: "read" | "edit"): Promise<boolean> {
    const res = await this.#provider.verify({
      presenter: this.did,
      bagUrl:    docUrl,
      access:    accessFor(ability),
    });
    return res.ok;
  }

  /**
   * Mint a real, revocable delegation of `ability` on docUrl to toDid, and
   * serialize it into a self-describing CapabilityToken. The audience peer must
   * already be a known agent to the provider (contactCard exchanged) — the
   * provider throws otherwise, surfacing the missing-introduction honestly.
   */
  async delegateCapability(
    docUrl:     string,
    toDid:      string,
    ability:    "read" | "edit",
  ): Promise<CapabilityToken> {
    const result = await this.#provider.delegate({
      audience: toDid,
      bagUrl:   docUrl,
      access:   accessFor(ability),
    });
    // §2c/H6 — stamp the FENCE at mint time: the bag's effective lease epoch right now, via the SAME
    // injected resolver `verifyDelegation` reads later. No `tokenSeal` on this slot stamps `boundEpoch:
    // null` REGARDLESS of `leaseEpochOf` — an unsealed epoch is exactly as forgeable as no epoch, so it
    // mints as no fence at all, never a fence nothing can authenticate. No `leaseEpochOf` (or a resolver
    // that read nothing) stamps `null` too, which the verify-side fence then refuses either way — an
    // unfenced mint is a refused verify, not an open one.
    const boundEpoch = this.#tokenSeal ? await readLeaseEpoch(this.#leaseEpochOf, docUrl) : null;
    const access = accessFor(ability);
    // H6 — sign the canonical fenced fields so a presenter who edits `boundEpoch` (or any of the other
    // fields the signature covers) after minting invalidates its own seal. No `tokenSeal` → no signature,
    // matching the forced-null `boundEpoch` above (there is nothing to sign that would mean anything).
    const sealSigHex = this.#tokenSeal
      ? this.#tokenSeal.sign(sealedFenceBytes({ delegationId: result.delegationId, audience: toDid, bagUrl: docUrl, access, boundEpoch }))
      : null;
    const payload: KeyhiveTokenPayload = {
      delegationId: result.delegationId,
      audience:     toDid,
      bagUrl:       docUrl,
      access,
      bytesHex:     bytesToHex(result.bytes),
      boundEpoch,
      sealSigHex,
    };
    return JSON.stringify(payload);
  }

  /**
   * Verify a delegation token a remote vessel presents for docUrl.
   *
   * Honest check landed: parse the token, enforce its bag-scope + advisory
   * expiry, then route the NAMED audience through the REAL barrier —
   * provider.verify({presenter: token.audience, bagUrl: docUrl}) rides
   * accessForDoc. A forged token naming an audience never delegated (or since
   * revoked) returns false; only a genuinely-held delegation clears.
   *
   * SHORE (surfaced, not faked): this trusts the audience the token NAMES. The
   * provider surface exposes no token→presenter resolution, so this cannot
   * cryptographically bind the presenting peer to the token — that binding is
   * the WASM sync-time membership proof. It never returns a bare `true`: every
   * clear rides real accessForDoc for the named audience.
   *
   * ORDER (§2c/H6, load-bearing — do not reshuffle): (1) parse, (2) bag-scope, (3) `provider.verify` (the
   * real revocation-aware barrier), (4) the SEAL GATE (H6) — a non-null `boundEpoch` must carry a signature
   * THIS slot can check, over the exact canonical fields a forger could otherwise edit freely, (5) the
   * clockless EPOCH FENCE. The wall-clock expiry guard (`gate-retire-keyhive-expiry` patch) is GONE, and the
   * field it read (`expiresAtMs`) with it (evergreen sweep, 2026-10-11): the seal gate + fence alone decide.
   * Both sit AFTER revocation so a presenter already denied by
   * `provider.verify` reads that refusal, never a seal/fence refusal that would read as "forged" or "the
   * lease rolled" when the real cause is "never had the cap" / "since revoked".
   */
  async verifyDelegation(token: CapabilityToken, docUrl: string): Promise<boolean> {
    if (token === null) return false;   // no open default: absent token = deny
    let payload: KeyhiveTokenPayload;
    try {
      payload = JSON.parse(token) as KeyhiveTokenPayload;
    } catch {
      return false;                     // unparseable token = deny
    }
    if (typeof payload !== "object" || payload === null) return false;   // a body that names nothing = deny
    if (payload.bagUrl !== docUrl) return false;   // token scoped to another bag

    const res = await this.#provider.verify({
      presenter: payload.audience,
      bagUrl:    docUrl,
      access:    payload.access,
    });
    if (!res.ok) return false;

    // H6 — the SEAL GATE, BEFORE the fence: a non-null `boundEpoch` is trusted only when THIS slot can
    // verify a signature over the canonical fenced fields. No `tokenSeal` on this verifying slot, no
    // `sealSigHex` on the token, or a signature that fails to verify — all three refuse outright, so a
    // forged `boundEpoch` (edited after minting, or minted by a slot with no seal at all) never reaches the
    // fence below. Note this does NOT run when `boundEpoch` is already `null` — the fence refuses that on
    // its own, the same unfenced-mint shape as before H6.
    const boundEpoch = payload.boundEpoch ?? null;
    if (boundEpoch !== null) {
      if (!this.#tokenSeal) return false;                 // this slot holds no key to check the seal with
      const sigHex = payload.sealSigHex;
      if (typeof sigHex !== "string" || sigHex.length === 0) return false;   // no seal carried = deny
      const bytes = sealedFenceBytes({ delegationId: payload.delegationId, audience: payload.audience, bagUrl: payload.bagUrl, access: payload.access, boundEpoch });
      if (!this.#tokenSeal.verify(bytes, sigHex)) return false;              // signature doesn't check out
    }

    // §2c — the epoch fence: council ruling 6 — a verifier that cannot read the CURRENT epoch reports an
    // INCOMPLETE VIEW (refuse), never "expired" and never "standing". A token minted with no `boundEpoch`
    // (no `leaseEpochOf`, or no `tokenSeal`, at mint) refuses here too — an unfenced mint never reads as
    // fenced-and-current.
    if (boundEpoch === null) return false;
    const currentEpoch = await readLeaseEpoch(this.#leaseEpochOf, docUrl);
    if (currentEpoch === null) return false;           // unreadable epoch — incomplete view, refuse
    if (currentEpoch > boundEpoch) return false;        // the lease rolled past the epoch this was minted at

    return true;
  }

  /**
   * Stable Automerge actor id from this identity's DID — mesh's SYNC SHA-256 (@noble/hashes,
   * platform-blind: Node, browser, and worker alike) truncated to 16 bytes. Deterministic: same
   * DID → same actorId. Routes through mesh's crypto.ts rather than SubtleCrypto so no runtime
   * needs a non-crypto fallback — every runtime that loads @lararium/mesh carries noble's sync digest.
   */
  async deriveActorId(): Promise<ActorId> {
    const bytes = sha256BytesSync(new TextEncoder().encode(this.did)).slice(0, 16);
    return formatUuid(bytes);
  }
}

function bytesToHex(bytes: Uint8Array): string {
  return hex(bytes);
}

function formatUuid(bytes: Uint8Array): string {
  const h = hex(bytes);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${((parseInt(h[16]!, 16) & 0x3) | 0x8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
