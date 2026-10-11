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
 *   · NOTHING in production calls these methods yet. This class is the built,
 *     tested crypto-backed slot; wiring a sharePolicy / LarVessel call site to
 *     construct it (retiring the OpenIdentitySlot default) is a SEPARATE thread.
 *     Until then it enforces at runtime only where a call site chooses to invoke
 *     it — construction alone gates nothing.
 *   · TRUE read-confidentiality — denying a *guessed* doc id and hiding the
 *     bytes at rest — is BeeKEM (Keyhive's encryption layer), not this shore.
 *     This slot gates the sharePolicy ACCESS decision; it does not encrypt.
 *   · verifyDelegation trusts the audience the token NAMES (see its doc): it
 *     confirms that named audience genuinely holds the cap via accessForDoc, but
 *     does not cryptographically bind the *presenter* to the token. Presenter↔
 *     token binding is the WASM sync-time membership proof, not this shore.
 *
 * Meme: lar:///ha.ka.ba/lararium/keyhive/identity-slot
 */
import type { ActorId, CapabilityToken, IdentitySlot } from "@lararium/mesh";
import type { CapabilityAccess } from "@lararium/mesh";
import { hex, sha256BytesSync } from "@lararium/mesh";
import type { CapabilityProvider } from "./capability-provider.js";

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
  /** Absolute expiry in POSIX milliseconds if the caller passed expiresIn; else null. WALL-CLOCK, and
   *  deliberately not the word `epoch` — that names the mesh's clockless fencing frontier (`epoch-lease`),
   *  and a reader who meets both spellings in one file has to guess which authority a number carries.
   *  NOTE (shore): the provider's DelegateArgs carries no expiry, so expiry is
   *  token-advisory only — verifyDelegation enforces it, the crypto layer does
   *  not. Real time-boxing waits on a provider expiry surface. */
  readonly expiresAtMs:  number | null;
  readonly bytesHex:     string;
  /**
   * §2c — the lease epoch (`epoch-lease.ts`, clockless) read off `leaseEpochOf(bagUrl)` AT MINT TIME, or `null`
   * when the slot was constructed with no `leaseEpochOf` (or the resolver itself returned/threw null). This is
   * the FENCE `verifyDelegation` checks before `expiresAtMs`: a token minted at epoch E refuses the moment the
   * bag's effective epoch has rolled past E, independent of any wall clock. Council ruling 6: a verifier that
   * cannot read the current epoch reports an INCOMPLETE VIEW (refuse), never "expired" and never "standing".
   */
  readonly boundEpoch:   number | null;
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

  constructor(opts: KeyhiveIdentitySlotOpts) {
    this.#provider = opts.provider;
    this.did       = opts.did;
    if (opts.leaseEpochOf) this.#leaseEpochOf = opts.leaseEpochOf;
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
    expiresIn?: number,
  ): Promise<CapabilityToken> {
    const result = await this.#provider.delegate({
      audience: toDid,
      bagUrl:   docUrl,
      access:   accessFor(ability),
    });
    // §2c — stamp the FENCE at mint time: the bag's effective lease epoch right now, via the SAME injected
    // resolver `verifyDelegation` reads later. No `leaseEpochOf` (or a resolver that read nothing) stamps
    // `null`, which the verify-side fence then refuses — an unfenced mint is a refused verify, not an open one.
    const boundEpoch = await readLeaseEpoch(this.#leaseEpochOf, docUrl);
    const payload: KeyhiveTokenPayload = {
      delegationId: result.delegationId,
      audience:     toDid,
      bagUrl:       docUrl,
      access:       accessFor(ability),
      expiresAtMs:  expiresIn === undefined ? null : Date.now() + expiresIn * 1000,
      bytesHex:     bytesToHex(result.bytes),
      boundEpoch,
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
   * ORDER (§2c, load-bearing — do not reshuffle): (1) parse, (2) bag-scope, (3) `provider.verify` (the real
   * revocation-aware barrier), (4) the clockless EPOCH FENCE, (5) THEN `expiresAtMs` — the wall-clock guard,
   * kept as a SECOND, RETIRING guard now that the fence is load-bearing (a prepared, not-yet-applied patch
   * drops this last line once the fence alone is trusted to stand). The fence sits AFTER revocation so a
   * presenter already denied by `provider.verify` reads that refusal, never a fence refusal that would read
   * as "the lease rolled" when the real cause is "never had the cap" / "since revoked".
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

    // §2c — the epoch fence: council ruling 6 — a verifier that cannot read the CURRENT epoch reports an
    // INCOMPLETE VIEW (refuse), never "expired" and never "standing". A token minted with no `boundEpoch`
    // (no `leaseEpochOf` at mint) refuses here too — an unfenced mint never reads as fenced-and-current.
    const boundEpoch = payload.boundEpoch ?? null;
    if (boundEpoch === null) return false;
    const currentEpoch = await readLeaseEpoch(this.#leaseEpochOf, docUrl);
    if (currentEpoch === null) return false;           // unreadable epoch — incomplete view, refuse
    if (currentEpoch > boundEpoch) return false;        // the lease rolled past the epoch this was minted at

    // RETIRING (second guard) — the wall-clock expiry. Kept until the prepared patch (not yet applied) drops
    // it; the fence above is already the load-bearing gate.
    if (payload.expiresAtMs !== null && Date.now() > payload.expiresAtMs) return false;

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
