/**
 * boot-invite — the invite an end user boots into a Nexus on. Any face that stands in that Nexus may mint
 * one; the newcomer spends it once; nobody remembers who invited whom.
 *
 * An end user needs no quorum admit. It needs an INVITE from a face that already stands in the Nexus — a
 * Kahu, a Lamplighter, or another member — and nothing else.
 *
 * WHAT IT IS, AND IS NOT:
 *   · SIGNED BY THE INVITER'S FACE FOR THAT NEXUS — the persona's per-Nexus leaf
 *     (`m / handle' / context' / nexus-scope'`, `deriveNexusScopedKey`), never a vessel key and never a
 *     PersonaGroup root. The leaf names the inviter to this one Nexus and to nothing else, so an invite read
 *     in two Nexuses links no face across them.
 *   · IT CARRIES ITS OWN STANDING. The verifier holds no roster and looks nothing up: the invite presents what
 *     proves its inviter stands, and the gate reads that proof against the kahu quorum's seats, the Nexus's
 *     DENY-only board and the Kapae antigen. What proves standing is named on `InviterStanding`.
 *   · A USER STANDS BY ITS HOST. A user face holds no admit, so its invite carries the COUNTERSIGN of a hearth
 *     that hosts it: the hearth signs the Nexus, the invite nonce and the walker's leaf, and only over a live
 *     session in which the walker's leaf proved itself to that hearth (`countersignHostedInvite`). The hearth
 *     stands through its own admit, read like any other. The hearth learns that one of its walkers invited
 *     someone and never who: the invite names no guest, and the nonce is random. Neither side keeps anything.
 *   · CARRIED, never fetched — the newcomer holds it (paste / QR / URL fragment); no relay sees it in transit.
 *     It verifies OFFLINE.
 *   · SINGLE-USE, burned LOCALLY. The newcomer's vessel records the invite's burn id in its OWN spent-set and
 *     refuses a second spend. No federated burn-registry exists: a mesh-wide spent list would track exactly
 *     what the doctrine forbids tracking. The single-use burn is what CLOSES an invite — it carries no clock.
 *     A signature does not age; the invite's scope (one Nexus, one spend) bounds it.
 *   · ONE HOP, REMEMBERED BY NO ONE. Spending records nothing about who invited whom: no board entry, nothing
 *     at the inviter, and on the newcomer only a burn id that digests the Nexus and the nonce — never the
 *     inviter's key, never its standing. A newcomer's own standing never cites the invite it spent, so
 *     invites never chain into a lineage (a lineage of who-invited-whom IS a roster). The inviter carries no
 *     liability for whom it invited: membership never confers trust.
 *   · WITHHOLD, never forge. A garbled / absent / wrong-Nexus / unsigned / unstanding / already-spent invite
 *     does NOT throw and does NOT admit — the vessel founds its OWN group and stands at the anon floor.
 *
 * Platform-blind: rides ./crypto and @noble/ed25519 only. The LOCAL spent-set lives in the boot host (node:
 * boot-invite-burn; browser: browser-boot-invite-burn) and arrives here through an injected `isSpent` shore.
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-invite
 */

import { NEXUS_INVITE_DOMAIN, HOST_COUNTERSIGN_DOMAIN, HOST_SESSION_PROOF_DOMAIN } from "./domains.js";
import * as ed25519 from "@noble/ed25519";
import { canonicalJsonBytes, hexToBytes, sha256HexBytesSync } from "./crypto.js";
import {
  verifyPresentedAdmit,
  type CarriageEntry, type PresentedAdmitInput, type PresentedLineageAct,
} from "./carriage-registry.js";
import { foldAntigenVerdicts } from "./kapae-antigen.js";

/** The domain an invite signs over. A signature is meaningless without the domain it was made in. */
export { NEXUS_INVITE_DOMAIN, HOST_COUNTERSIGN_DOMAIN, HOST_SESSION_PROOF_DOMAIN } from "./domains.js";

/**
 * What proves the inviter stands in the Nexus. Every kind is checked against the deny board and the antigen;
 * none consults a roster of members.
 *
 *   · `admit` — the inviter's own quorum-signed member admit on its leaf nym, with that admit's closed, tight
 *     causal lineage (`presentationFromBoardDoc`). A Lamplighter stands this way, and so does any face the
 *     kahu quorum admitted — a Kahu included, on its leaf. Read by `verifyPresentedAdmit`; only `held` stands.
 *   · `hosted` — a USER face, which holds no admit, stands by the hearth that hosts it: the hearth's per-Nexus
 *     leaf countersigns the Nexus, the invite nonce and the walker's leaf (`HostedStanding`), and the hearth's
 *     own admit stands exactly as the `admit` arm reads one. The walker's leaf itself is read against the
 *     antigen. No roster says who a hearth hosts: the countersign is minted only over a live session.
 *   · `seat`  — the inviter's key sits as a chair of the kahu quorum's seats. REFUSED (`seat-standing-owed`):
 *     a chair carries a PersonaGroup root key, and a root proof never rides a wire. The arm stands at the
 *     re-found, which re-keys the chairs to per-Nexus leaves.
 */
export type InviterStanding =
  | { readonly kind: "admit"; readonly admit: CarriageEntry; readonly lineage: readonly PresentedLineageAct[] }
  | HostedStanding
  | { readonly kind: "seat" };

/**
 * A user's standing, lent by the hearth that hosts it. The hearth's per-Nexus leaf signs
 * `hostCountersignBytes` over this Nexus, the invite's nonce and the walker's leaf; the hearth's own admit
 * and its lineage prove the hearth stands. It names no guest.
 */
export interface HostedStanding {
  readonly kind:       "hosted";
  /** The hosting hearth's per-Nexus leaf verifying key (hex). */
  readonly hearthKey:  string;
  /** The hearth's own quorum-signed admit on `hearthKey`. */
  readonly admit:      CarriageEntry;
  readonly lineage:    readonly PresentedLineageAct[];
  /** Ed25519 by `hearthKey` over `hostCountersignBytes`. */
  readonly countersig: string;
}

/**
 * A sealed, single-use invite into ONE Nexus. Absent by construction: any joiner identity, any place edge,
 * any expiry. The inviter's leaf rides only so the seal and the standing can be checked; the burn digests
 * neither.
 */
export interface BootInvite {
  readonly kind:       typeof NEXUS_INVITE_DOMAIN;
  /** The Nexus this invite boots INTO — its genesis AID (`realmIdOfCharter`). An invite is never a general pass. */
  readonly nexusAid:   string;
  /** A random freshness nonce (hex) — makes each invite unique and keys its local burn. Carries no identity. */
  readonly nonce:      string;
  /** The inviter's per-Nexus leaf verifying key (hex). Signs the invite; never a vessel key, never a root. */
  readonly inviterKey: string;
  /** What proves the inviter stands in this Nexus. */
  readonly standing:   InviterStanding;
  /** Ed25519 by `inviterKey` over the canonical bytes of everything above. */
  readonly sig:        string;
}

/** The bytes an invite signs over. Canonical, so one invite yields one signature. */
export function bootInviteBytes(parts: Omit<BootInvite, "sig">): Uint8Array {
  return canonicalJsonBytes({
    kind:       parts.kind,
    nexusAid:   parts.nexusAid,
    nonce:      parts.nonce,
    inviterKey: parts.inviterKey,
    standing:   parts.standing,
  });
}

/**
 * Mint an invite. The caller supplies the inviter's leaf signer (this module holds no key) and a fresh CSPRNG
 * nonce (the caller owns the RNG so the module stays platform-blind).
 */
export async function signBootInvite(
  parts: Omit<BootInvite, "kind" | "sig">,
  sign: (bytes: Uint8Array) => Promise<string>,
): Promise<BootInvite> {
  const unsigned = { ...parts, inviterKey: parts.inviterKey.toLowerCase(), kind: NEXUS_INVITE_DOMAIN } as Omit<BootInvite, "sig">;
  return { ...unsigned, sig: await sign(bootInviteBytes(unsigned)) };
}

/**
 * The LOCAL burn key: a digest over the domain, the Nexus and the nonce ALONE. It names no inviter and no
 * standing, so the spent-set a newcomer keeps remembers that AN invite spent, never whose. Two invites that
 * share a Nexus and a nonce burn as one.
 */
export function bootInviteId(inv: Pick<BootInvite, "nexusAid" | "nonce">): string {
  return sha256HexBytesSync(canonicalJsonBytes({
    kind: NEXUS_INVITE_DOMAIN, nexusAid: normAid(inv.nexusAid), nonce: inv.nonce,
  }));
}

/** The OFFLINE Ed25519 check over @noble/ed25519. False on any malformed input — a torn seal reads as withhold. */
export async function verifyBootInviteSig(bytes: Uint8Array, sigHex: string, keyHex: string): Promise<boolean> {
  try { return await ed25519.verifyAsync(hexToBytes(sigHex), bytes, hexToBytes(keyHex)); }
  catch { return false; }
}

// ── THE HOST COUNTERSIGN ────────────────────────────────────────────────────────────────────────

/** The bytes a hosting hearth countersigns: the Nexus, the invite nonce and the walker's leaf. No guest. */
export function hostCountersignBytes(parts: { readonly nexusAid: string; readonly nonce: string; readonly walkerKey: string }): Uint8Array {
  return canonicalJsonBytes({
    kind: HOST_COUNTERSIGN_DOMAIN, nexusAid: normAid(parts.nexusAid), nonce: parts.nonce, walkerKey: parts.walkerKey.toLowerCase(),
  });
}

/**
 * A live hosting session, as the HEARTH holds it: the nonce and gate key its own gate issued on a socket that is
 * open now. The hearth reads both from its gate, never from anything the walker echoed.
 */
export interface HostSession {
  readonly nonce:      string;
  readonly gatePubKey: string;
}

/** What a walker asks its hearth to countersign, with its leaf's proof over the live session. */
export interface HostCountersignRequest {
  readonly nexusAid:  string;
  /** The nonce of the invite the walker is minting. */
  readonly nonce:     string;
  /** The walker's per-Nexus leaf (hex) — the key that will sign the invite. */
  readonly walkerKey: string;
  /** Ed25519 by `walkerKey` over `hostSessionProofBytes`. */
  readonly proof:     string;
}

/** The bytes a walker's leaf signs to ask for a countersign: bound to ONE live session, one Nexus, one invite. */
export function hostSessionProofBytes(parts: {
  readonly session: HostSession; readonly nexusAid: string; readonly nonce: string; readonly walkerKey: string;
}): Uint8Array {
  return canonicalJsonBytes({
    kind:       HOST_SESSION_PROOF_DOMAIN,
    session:    parts.session.nonce,
    gatePubKey: parts.session.gatePubKey.toLowerCase(),
    nexusAid:   normAid(parts.nexusAid),
    nonce:      parts.nonce,
    walkerKey:  parts.walkerKey.toLowerCase(),
  });
}

/** Build a countersign request. The caller supplies the walker's leaf signer; this module holds no key. */
export async function signHostCountersignRequest(
  parts: { readonly session: HostSession; readonly nexusAid: string; readonly nonce: string; readonly walkerKey: string },
  sign: (bytes: Uint8Array) => Promise<string>,
): Promise<HostCountersignRequest> {
  const walkerKey = parts.walkerKey.toLowerCase();
  return {
    nexusAid: parts.nexusAid, nonce: parts.nonce, walkerKey,
    proof: await sign(hostSessionProofBytes({ ...parts, walkerKey })),
  };
}

/** Why a hearth declined to countersign. */
export type HostCountersignRefusal =
  | "no-live-session"     // the hearth holds no open, gate-keyed session with this walker
  | "malformed-request"   // the request is not a readable countersign request
  | "wrong-nexus"         // the request names a Nexus other than the hearth's
  | "bad-session-proof"   // the walker's leaf did not sign over THIS session
  | "hearth-not-admitted"; // the hearth's admit names a key other than its own leaf

export type HostCountersignVerdict =
  | { readonly ok: true;  readonly standing: HostedStanding }
  | { readonly ok: false; readonly refusal: HostCountersignRefusal };

/**
 * THE HEARTH'S SIDE. Countersign a walker's invite nonce — only over a live session the hearth holds with that
 * walker, and only for the hearth's own Nexus. "Currently hosts" is proven without a roster: the walker's leaf
 * signs the nonce the hearth's own gate issued on a socket open now, so the hearth countersigns exactly the
 * walkers it is talking to. Pure: it writes nothing and returns nothing that names a guest.
 */
export async function countersignHostedInvite(args: {
  /** The live session the request arrived on, read from the hearth's gate — null when none is open. */
  readonly session:  HostSession | null;
  readonly request:  HostCountersignRequest;
  /** The Nexus this hearth stands in. */
  readonly nexusAid: string;
  /** The hearth's per-Nexus leaf, its own admit, and its signer. */
  readonly hearth: {
    readonly key: string; readonly admit: CarriageEntry; readonly lineage: readonly PresentedLineageAct[];
    readonly sign: (bytes: Uint8Array) => Promise<string>;
  };
}): Promise<HostCountersignVerdict> {
  const { session, request: req } = args;
  if (!session || typeof session.nonce !== "string" || typeof session.gatePubKey !== "string"
      || session.nonce.length === 0 || session.gatePubKey.length === 0) {
    return { ok: false, refusal: "no-live-session" };
  }
  if (!req || typeof req !== "object" || typeof req.nexusAid !== "string" || typeof req.nonce !== "string"
      || typeof req.walkerKey !== "string" || typeof req.proof !== "string" || req.nonce.length === 0) {
    return { ok: false, refusal: "malformed-request" };
  }
  if (normAid(req.nexusAid) !== normAid(args.nexusAid)) return { ok: false, refusal: "wrong-nexus" };
  const walkerKey = req.walkerKey.toLowerCase();
  const proofBytes = hostSessionProofBytes({ session, nexusAid: req.nexusAid, nonce: req.nonce, walkerKey });
  if (!(await verifyBootInviteSig(proofBytes, req.proof, walkerKey))) return { ok: false, refusal: "bad-session-proof" };
  const hearthKey = args.hearth.key.toLowerCase();
  if (args.hearth.admit?.nym?.toLowerCase() !== hearthKey) return { ok: false, refusal: "hearth-not-admitted" };
  const countersig = await args.hearth.sign(hostCountersignBytes({ nexusAid: req.nexusAid, nonce: req.nonce, walkerKey }));
  return {
    ok: true,
    standing: { kind: "hosted", hearthKey, admit: args.hearth.admit, lineage: args.hearth.lineage, countersig },
  };
}

// ── THE COUNTERSIGN ON THE SESSION ──────────────────────────────────────────────────────────────

/** The session kind a walker asks on, carrying a `HostCountersignRequest`. */
export const HOST_COUNTERSIGN_ASK = "host-countersign/ask";
/** The session kind a hearth answers on, carrying `{ nonce, verdict }` for the request's nonce. */
export const HOST_COUNTERSIGN_ANSWER = "host-countersign/answer";

/** The walker's side of an authenticated session — the shape `LarWSClientAdapter` presents. */
export interface HostSessionChannel {
  readonly session: HostSession | null;
  sendSession(kind: string, body: unknown): boolean;
  onSession(listener: (msg: { readonly kind: string; readonly body: unknown }) => void): () => void;
}

const isVerdict = (v: unknown): v is HostCountersignVerdict => {
  if (!v || typeof v !== "object") return false;
  const r = v as { ok?: unknown; refusal?: unknown; standing?: unknown };
  if (r.ok === false) return typeof r.refusal === "string";
  if (r.ok !== true || !r.standing || typeof r.standing !== "object") return false;
  const h = r.standing as Partial<HostedStanding>;
  return h.kind === "hosted" && typeof h.hearthKey === "string" && typeof h.countersig === "string"
    && !!h.admit && typeof h.admit === "object" && Array.isArray(h.lineage);
};

/**
 * Ask the hearth at the other end of `channel` to countersign `request`, and read its answer for that request's
 * nonce. With no session standing, nothing is sent and the answer is `no-live-session`; an `abort` reads the
 * same. A malformed answer is never taken for a lend: the walker keeps listening for a well-formed one.
 */
export function askHearthOverSession(
  channel: HostSessionChannel, request: HostCountersignRequest, abort?: AbortSignal,
): Promise<HostCountersignVerdict> {
  const closed: HostCountersignVerdict = { ok: false, refusal: "no-live-session" };
  if (abort?.aborted) return Promise.resolve(closed);
  return new Promise((resolve) => {
    const off = channel.onSession((msg) => {
      if (msg.kind !== HOST_COUNTERSIGN_ANSWER || !msg.body || typeof msg.body !== "object") return;
      const body = msg.body as { nonce?: unknown; verdict?: unknown };
      if (body.nonce !== request.nonce || !isVerdict(body.verdict)) return;
      done(body.verdict);
    });
    const onAbort = () => done(closed);
    function done(v: HostCountersignVerdict): void { off(); abort?.removeEventListener("abort", onAbort); resolve(v); }
    abort?.addEventListener("abort", onAbort);
    if (!channel.sendSession(HOST_COUNTERSIGN_ASK, request)) done(closed);
  });
}

/**
 * Mint a USER's invite — the `hosted` arm, platform-blind. The walker's per-Nexus leaf (`walkerKey`, `sign`)
 * signs a request over `session`, `askHearth` carries it to the hearth that holds that session, and the lent
 * standing rides inside the invite the same leaf then signs. A refused countersign mints nothing.
 */
export async function mintHostedInvite(opts: {
  readonly nexusAid: string; readonly nonce: string; readonly walkerKey: string; readonly session: HostSession;
  readonly sign: (bytes: Uint8Array) => Promise<string>;
  readonly askHearth: (request: HostCountersignRequest) => Promise<HostCountersignVerdict>;
}): Promise<{ readonly ok: true; readonly invite: BootInvite } | { readonly ok: false; readonly refusal: HostCountersignRefusal }> {
  const request = await signHostCountersignRequest(
    { session: opts.session, nexusAid: opts.nexusAid, nonce: opts.nonce, walkerKey: opts.walkerKey }, opts.sign,
  );
  const verdict = await opts.askHearth(request);
  if (!verdict.ok) return verdict;
  const invite = await signBootInvite(
    { nexusAid: opts.nexusAid, nonce: opts.nonce, inviterKey: opts.walkerKey, standing: verdict.standing }, opts.sign,
  );
  return { ok: true, invite };
}

/** How the boot answers "may this vessel cross into the Nexus?". The operator turns it — code never bakes it in. */
export type BootInvitePolicy =
  /** invite-only — a sealed, unspent invite from a standing face is REQUIRED, or the vessel founds its own group. */
  | { readonly kind: "invite-only" }
  /** open — no invite required; every vessel boots into the Nexus. */
  | { readonly kind: "open" };

/** Why a boot crossing was refused. A refused vessel founds its own group at the anon floor. */
export type BootRefusal =
  | "no-invite"            // invite-only, and none arrived (absent / garbled)
  | "wrong-nexus"          // the invite names a different Nexus
  | "bad-signature"        // the inviter's leaf did not sign this — forged or torn
  | "inviter-not-standing" // the standing it presents does not hold here (rejected, denied, unsettled, unread)
  | "no-countersign"       // a `hosted` invite that carries no hosting hearth's countersign
  | "bad-countersign"      // the countersign does not verify over this Nexus, this nonce and this walker
  | "host-not-standing"    // the countersigning hearth's own admit does not hold here
  | "seat-standing-owed"   // a `seat` claim: a chair carries a PersonaGroup root, so the arm stands only once chairs carry leaves
  | "already-spent";       // single-use: this invite was burned already (local island fact)

export interface BootVerdict {
  /** True → the vessel boots INTO the Nexus. False → it founds its own group + stands at the anon floor. */
  readonly admitted: boolean;
  /** Present only on a refusal. */
  readonly refusal?: BootRefusal;
  /** Present only on an admission — the caller MUST burn this id in its LOCAL spent-set before granting. */
  readonly burnId?:  string;
}

/**
 * The Nexus material an inviter's standing is read against — the presented-admit verifier's inputs without
 * the presentation: the kahu quorum's seats at the charter head, the charter lineage, the deny board and the
 * antigen.
 * The caller owns which Nexus this material belongs to.
 */
export type InviteStandingContext = Omit<PresentedAdmitInput, "admit" | "lineage">;

const normAid = (aid: string): string => aid.trim().toLowerCase();

/**
 * Does the presented standing hold for `inviterKey` against the Nexus material? Fail-closed; never throws.
 * Answers null when it holds, else the refusal that names why.
 */
async function inviterRefusal(
  inv: BootInvite, inviterKey: string, standing: InviterStanding, ctx: InviteStandingContext,
): Promise<BootRefusal | null> {
  try {
    if (standing.kind === "admit") {
      if (standing.admit?.nym?.toLowerCase() !== inviterKey) return "inviter-not-standing";   // the admit must name the signer
      const v = await verifyPresentedAdmit({ ...ctx, admit: standing.admit, lineage: standing.lineage });
      return v.state === "held" ? null : "inviter-not-standing";
    }
    if (standing.kind === "hosted") {
      const hearthKey = standing.hearthKey.toLowerCase();
      const bytes = hostCountersignBytes({ nexusAid: inv.nexusAid, nonce: inv.nonce, walkerKey: inviterKey });
      if (!(await verifyBootInviteSig(bytes, standing.countersig, hearthKey))) return "bad-countersign";
      if (standing.admit?.nym?.toLowerCase() !== hearthKey) return "host-not-standing";   // the admit must name the countersigner
      const v = await verifyPresentedAdmit({ ...ctx, admit: standing.admit, lineage: standing.lineage });
      if (v.state !== "held") return "host-not-standing";
      // The walker's own leaf holds no admit; the antigen still reads it. Held or unsettled → withhold.
      const verdicts = await foldAntigenVerdicts(ctx.antigen, ctx.antigenRoster, ctx.antigenVerifier);
      for (const [nym, verdict] of verdicts) {
        if (nym.toLowerCase() === inviterKey && verdict !== "withdrawn") return "inviter-not-standing";
      }
      return null;
    }
    return "inviter-not-standing";
  } catch {
    return "inviter-not-standing";
  }
}

/**
 * THE GATE. Decide whether a vessel boots into the Nexus on a carried invite. OFFLINE, clockless and pure:
 * it checks the Nexus binding, the inviter's leaf seal, the inviter's presented standing against `standing`
 * (the roster, deny board and antigen the caller holds for this Nexus), and the LOCAL burn set. Every failure
 * returns `admitted:false`; nothing throws.
 *
 * The caller MUST, on an admission, burn `burnId` in its local spent-set BEFORE granting — this fn does not
 * mutate the set (the host burns first, then grants, so a crash between never double-spends).
 */
export async function decideBootInvite(args: {
  readonly policy:   BootInvitePolicy;
  /** The genesis AID of the Nexus this vessel crosses into. */
  readonly nexusAid: string;
  readonly invite:   BootInvite | null;
  /** The Nexus material standing is read against. Absent → no invite can show standing, so invite-only withholds. */
  readonly standing: InviteStandingContext | null;
  /** Has this burn id been spent on THIS island already? A LOCAL fact — never a federated lookup. */
  readonly isSpent:  (burnId: string) => boolean | Promise<boolean>;
}): Promise<BootVerdict> {
  if (args.policy.kind === "open") return { admitted: true };

  const inv = args.invite;
  if (!inv || typeof inv !== "object" || inv.kind !== NEXUS_INVITE_DOMAIN
      || typeof inv.nexusAid !== "string" || typeof inv.nonce !== "string"
      || typeof inv.inviterKey !== "string" || typeof inv.sig !== "string"
      || !inv.standing || typeof inv.standing !== "object") {
    return { admitted: false, refusal: "no-invite" };
  }

  // Bind to THIS Nexus BEFORE the seal — a valid invite into another Nexus is a valid signature and an
  // invalid admission here.
  if (normAid(inv.nexusAid) !== normAid(args.nexusAid)) return { admitted: false, refusal: "wrong-nexus" };

  const inviterKey = inv.inviterKey.toLowerCase();
  if (!(await verifyBootInviteSig(bootInviteBytes(inv), inv.sig, inviterKey))) {
    return { admitted: false, refusal: "bad-signature" };
  }

  // A chair carries a PersonaGroup root key, and a root proof never rides a wire: the `seat` arm stands only
  // once the chairs carry per-Nexus leaves. Refused before any Nexus material is read.
  if (inv.standing.kind === "seat") return { admitted: false, refusal: "seat-standing-owed" };
  if (inv.standing.kind === "hosted") {
    const h = inv.standing;
    if (typeof h.countersig !== "string" || h.countersig.length === 0 || typeof h.hearthKey !== "string") {
      return { admitted: false, refusal: "no-countersign" };
    }
  }
  if (!args.standing) return { admitted: false, refusal: "inviter-not-standing" };
  const refusal = await inviterRefusal(inv, inviterKey, inv.standing, args.standing);
  if (refusal) return { admitted: false, refusal };

  const burnId = bootInviteId(inv);
  if (await args.isSpent(burnId)) return { admitted: false, refusal: "already-spent" };

  return { admitted: true, burnId };
}
