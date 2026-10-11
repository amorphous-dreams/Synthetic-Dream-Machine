/**
 * persona-admit-flow — the node orchestration of the airgapped 3-hop persona-admission, composing the ceremony
 * library (@lararium/mesh persona-admit) + the per-vessel multitude-view store + the QR transport.
 *
 * Each hop is a SEPARATE, offline invocation (a QR crosses the airgap between them), so the on-device secret
 * persists in the consume-once pending store between hops. These flow functions carry the WHOLE per-hop logic —
 * mint/seal/open/ack + the store reads/writes + the QR render — behind injected dependencies (signers, the KEL
 * head resolver, a store dir), so the `lares persona admit` CLI thin-wraps them and the flow stays testable with
 * two simulated vessels and no real vault / camera.
 *
 * INVARIANTS held here: per-vessel-multitude-view-NEVER-syncs (every write lands in the local store, never a
 * bag); no-global-now (§2a gate-removal v3 — no step compares a wall clock to a carried expiry; the carried
 * `expiry` is advisory display only, and liveness lives in consumption, withdrawal, and the held session's
 * own monotonic patience); type-blind (a PersonaRef is
 * prefix + key-material, no branch); wax-seals-only (the grant is the persona's own signature). The B side keeps
 * its ephemeral SECRET on-device (the store, 0o600) and drops it the instant an open consumes it.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/persona-admit-flow
 */

import type { Repo } from "@automerge/automerge-repo";
import {
  mintEnrollmentOffer, sealPersonaGrant, openPersonaGrant, mintJoinAck, verifyJoinAck,
  headOpKey, personaKelChainForPrefix, personaKelBoardDocUrl, materializeSharedLarDoc,
  sealKeyringEnvelope, openKeyringEnvelope, KEYRING_ENVELOPE_DOMAIN,
  base64UrlEncode, base64UrlDecode, utf8Bytes, hex, sha256HexSync,
  type PersonaRef, type AdmitSigner, type JoinRecord, type EnrollmentOffer, type SealedGrant, type JoinAck,
  type KeyringEnvelope, type EnrollmentSecret,
} from "@lararium/mesh";
import {
  toEnrollmentCarriage, parseEnrollmentCarriage, toGrantCarriage, parseGrantCarriage,
  toAckCarriage, parseAckCarriage,
} from "./persona-admit-carriage.js";
import { loadVesselVerifyingKey } from "./node-vessel-identity.js";
import { nodeNexusIsland } from "./nexus-standing.js";
import {
  recordAdmittedPersona, stashEnrollmentSecret, peekEnrollmentSecrets, takeEnrollmentSecret,
  stashSentMemo, takeSentMemo, withdrawAdmitOffer, withdrawAdmitGrant,
} from "./node-persona-admit-store.js";
import { loadNexusKeyring, installDeliveredKeyring } from "./nexus-convergence-secret-store.js";
import { qrCarriageToTerminalResilient } from "./qr-transport.js";

/**
 * The per-Nexus convergence keyring rides the SAME grant hop as the persona grant, under its OWN `&keyring=`
 * fragment on the grant carriage — the grant proves the delegation, the keyring hands the joinee the cad READ-key.
 * Both seal to the SAME recipient (the offer's ephemeral X25519 key B keeps on-device), domain-separated by their
 * HKDF `info`s (grant-seal vs keyring-envelope), so one carriage delivers BOTH with no second keypair minted. The
 * mesh grant parser already tolerates an `&`-joined fragment (`#grant=…&keyring=…`), so the grant carriage stays
 * verbatim; only THIS node leg reads the keyring sibling.
 *
 * AUTHENTICATED, NEVER MERELY SEALED. The recipient pubkey rode PUBLIC in the offer, so a sealed-only fragment
 * carries no proof the FOUNDER authored it — an active paster could substitute their own keyring sealed to that
 * same public key. The founder therefore folds a sha256 over the EXACT carried token INTO the signed grant
 * transcript (`keyringSealDigest`); the joinee installs a keyring ONLY when the signed digest and the arriving
 * token agree. Digest the token, carry the token — one canonical byte-image, so the two can never drift.
 * WITHHOLD-not-forge: any garble / mismatch / strip reads carry-only, never a throw.
 */
const KEYRING_CARRIAGE_KEY = "keyring" as const;

/** Read the raw `&keyring=<token>` b64url token off a grant carriage — the EXACT bytes the digest commits to. */
function extractKeyringToken(carriage: string): string | null {
  const m = new RegExp(`(?:[#&?])${KEYRING_CARRIAGE_KEY}=([A-Za-z0-9_-]+)`).exec(carriage);
  return m?.[1] ?? null;
}

/** Decode a keyring token → the sealed envelope, or `null` when garbled / not a keyring envelope. */
function decodeKeyringToken(token: string): KeyringEnvelope | null {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(base64UrlDecode(token))) as Record<string, unknown>;
    return parsed?.["kind"] === KEYRING_ENVELOPE_DOMAIN ? (parsed as unknown as KeyringEnvelope) : null;
  } catch {
    return null;
  }
}

/** The founder's sealed keyring as {token to carry, digest to sign} — or `null` when the founder holds no keyring. */
interface KeyringCarriage { readonly token: string; readonly digest: string; }

/**
 * Seal the FOUNDER's convergence keyring to the offer's ephemeral recipient pubkey — the STAGE-2 delivery. Reads
 * the founder's held `{epoch → secret}` set (never MINTS one — a granter with no keyring delivers no read-key, and
 * the joinee stays carry-only). Returns the carried token + the sha256 the grant must SIGN over it, or `null` when
 * the founder holds no keyring yet. The digest reads over the EXACT token the fragment carries (no re-serialize).
 */
function sealFounderKeyringCarriage(recipientEphemeralPubkey: string, founderKeyringDir?: string): KeyringCarriage | null {
  const keyring = loadNexusKeyring(founderKeyringDir);
  if (!keyring) return null;   // the founder minted no convergence secret — nothing to deliver (the seal path stands it)
  const entries = keyring.epochs.map((epoch) => ({ epoch, secretHex: hex(keyring.forEpoch(epoch)!) }));
  const envelope = sealKeyringEnvelope(entries, recipientEphemeralPubkey);
  const token = base64UrlEncode(utf8Bytes(JSON.stringify(envelope)));
  return { token, digest: sha256HexSync(token) };   // digest what we carry — the one byte-image both sides read
}

/** Append the founder's keyring token to a grant carriage as its `&keyring=<token>` sibling fragment. */
function appendKeyringFragment(grantCarriage: string, token: string): string {
  return `${grantCarriage}&${KEYRING_CARRIAGE_KEY}=${token}`;
}

/**
 * Open + INSTALL a keyring the founder sealed to THIS enrollment's ephemeral recipient — the joinee's adopt step,
 * gated on the SIGNED grant. INSTALL ONLY when the signed transcript COMMITTED a keyring digest AND the arriving
 * token hashes to it: an unbound fragment (no digest in the signed grant) is an injection and installs NOTHING; a
 * stripped fragment (digest committed, none arrives) refuses; a substituted fragment (digest ≠ token hash) refuses.
 * Only past that binding does it open with the SAME on-device ephemeral secret that opened the grant and install
 * AUTHORITATIVELY (the founder's secret supersedes the self-minted phantom). Returns the installed epoch count, or
 * `0` for every carry-only path. Fail-closed + WITHHOLD-not-forge throughout — a bad delivery never throws.
 */
function adoptDeliveredKeyring(
  grantCarriage:      string,
  secret:             EnrollmentSecret,
  expectedDigest:     string | undefined,   // the SIGNED transcript's keyringSealDigest (signature-covered)
  keyringInstallDir?: string,
): number {
  if (!expectedDigest) return 0;                         // the founder committed no keyring → ignore any fragment
  const token = extractKeyringToken(grantCarriage);
  if (!token) return 0;                                  // committed a keyring but none arrived → stripped, refuse
  if (sha256HexSync(token) !== expectedDigest.toLowerCase()) return 0;   // substituted keyring → the binding breaks
  const envelope = decodeKeyringToken(token);
  if (!envelope) return 0;                               // the committed token decodes to garbage → refuse
  const delivered = openKeyringEnvelope(envelope, secret.ephemeralSecret);
  if (!delivered || delivered.length === 0) return 0;   // wrong recipient / tamper → carry-only (fail-closed)
  return installDeliveredKeyring(delivered, keyringInstallDir).epochs.length;
}

/** A flow result carrying the hop's carriage + a terminal QR of it (a tabletop hand-off). */
export interface HopRender {
  readonly carriage:   string;
  /** The scannable terminal QR (empty when oversized — the carriage still travels as a paste / PNG). */
  readonly terminalQr: string;
  /** The ECC the QR fit at (H for small hops; degraded only if forced), or null when oversized. */
  readonly qrEcc:      "H" | "Q" | "M" | "L" | null;
  /** True when the carriage exceeds a single static QR even at ECC-L — the reserved bc-ur multi-part leg's cue. */
  readonly qrOversized: boolean;
}

async function render(carriage: string): Promise<HopRender> {
  const r = await qrCarriageToTerminalResilient(carriage);
  return { carriage, terminalQr: r.qr, qrEcc: r.ecc, qrOversized: r.oversized };
}

/**
 * ONE materialize of THIS vessel's LOCAL persona-KEL board replica — the shared root both head resolvers below
 * read, so the board door (`personaKelBoardDocUrl`) is addressed from exactly ONE call site in this file
 * regardless of how many resolver SHAPES are built off it (op-key, KEL seq, …). `repo` names the store's one
 * holder — the standing vessel's own Repo, or the direct holder's (`ownedStore`).
 */
async function localPersonaKelBoard(repo: Repo) {
  const nexusPubkey = await loadVesselVerifyingKey();
  const boardIsland = nodeNexusIsland({ ownVesselKey: nexusPubkey });
  return materializeSharedLarDoc(repo, personaKelBoardDocUrl(boardIsland), "board:persona-kel");
}

/**
 * Build the ruling-#3 head resolver off THIS vessel's LOCAL persona-KEL board replica: a prefix → its CURRENT
 * head op-key (verifying the KEL's structure + rotation quorums), or null when the prefix is unknown / unsynced
 * (fail-closed). The open step checks the grant's op-key IS this head (rotate-not-resurrect); a same-Nexus
 * target already carries the granter's persona-KEL (it federates once), a cross-Nexus one that lacks it draws
 * the fail-closed refusal.
 */
export async function makeLocalPersonaKelHeadResolver(repo: Repo): Promise<(prefix: string) => Promise<string | null>> {
  const board = await localPersonaKelBoard(repo);
  return async (prefix: string): Promise<string | null> => {
    const chain = personaKelChainForPrefix(board.doc(), prefix);
    if (!chain || chain.length === 0) return null;
    return headOpKey(chain, { verifyQuorums: true });
  };
}

/**
 * M12's sibling resolver — the SAME local persona-KEL board replica, read for the head event's KEL SEQUENCE
 * NUMBER rather than its op-key. ADVISORY ONLY end to end (see `openPersonaGrant`'s `resolveHeadSeq` /
 * `JoinRecord.granterSeq`): feeds `recordAdmittedPersona`'s causal supersede order, never a verdict. Finds the
 * head by the SAME walk `headOpKey` does (skip provisional, newest-first) and reads that event's own `seq` —
 * so the seq named here is always the seq of the SAME key `makeLocalPersonaKelHeadResolver` would have named.
 */
export async function makeLocalPersonaKelHeadSeqResolver(repo: Repo): Promise<(prefix: string) => Promise<number | null>> {
  const board = await localPersonaKelBoard(repo);
  return async (prefix: string): Promise<number | null> => {
    const chain = personaKelChainForPrefix(board.doc(), prefix);
    if (!chain || chain.length === 0) return null;
    const head = await headOpKey(chain, { verifyQuorums: true });
    if (!head) return null;
    for (let i = chain.length - 1; i >= 0; i--) {
      const e = chain[i]!;
      if (e.provisional) continue;
      if (e.opKeyDid === head) return e.seq;
    }
    return null;
  };
}

/**
 * L11 — the SAME head + seq read as `makeLocalPersonaKelHeadResolver` / `makeLocalPersonaKelHeadSeqResolver`
 * above, but off ONE board materialize instead of two. A caller that wants both (as `store-door-verbs.ts`'s
 * `persona-kel-head` door does) previously called both builders, each materializing the board independently
 * — a comment there claimed "the SAME board read" while the code made two, so a sync landing between them
 * could let head and seq straddle it. This builds the board once and derives both from that single chain
 * walk, so they can never disagree about which board state they read.
 */
export async function makeLocalPersonaKelHeadAndSeqResolver(
  repo: Repo,
): Promise<(prefix: string) => Promise<{ head: string | null; seq: number | null }>> {
  const board = await localPersonaKelBoard(repo);
  return async (prefix: string): Promise<{ head: string | null; seq: number | null }> => {
    const chain = personaKelChainForPrefix(board.doc(), prefix);
    if (!chain || chain.length === 0) return { head: null, seq: null };
    const head = await headOpKey(chain, { verifyQuorums: true });
    if (!head) return { head: null, seq: null };
    for (let i = chain.length - 1; i >= 0; i--) {
      const e = chain[i]!;
      if (e.provisional) continue;
      if (e.opKeyDid === head) return { head, seq: e.seq };
    }
    return { head, seq: null };
  };
}

/**
 * HOP 1 (B): mint an enrollment offer for this vessel's device key, STASH the on-device ephemeral secret
 * (consume-once), and render QR#1. The secret never leaves the store; only the offer travels.
 */
export async function offerAdmitFlow(args: {
  readonly deviceVerifyingKey: string;
  readonly dir?:               string;
  readonly expiryMs?:          number;
  readonly now?:               number;
  /** The pending-offer set's count bound (§2a) — omit to take the store's own named default. */
  readonly maxPendingOffers?:  number;
}): Promise<{ offer: EnrollmentOffer } & HopRender> {
  const { offer, secret } = mintEnrollmentOffer({
    targetVesselId: args.deviceVerifyingKey,
    ...(args.expiryMs !== undefined ? { expiryMs: args.expiryMs } : {}),
    ...(args.now !== undefined ? { now: args.now } : {}),
  });
  if (args.maxPendingOffers !== undefined) {
    stashEnrollmentSecret(offer.ephemeralPubkey, secret, args.dir, args.maxPendingOffers);
  } else {
    stashEnrollmentSecret(offer.ephemeralPubkey, secret, args.dir);
  }
  return { offer, ...(await render(toEnrollmentCarriage(offer))) };
}

/**
 * WITHDRAW a pending offer this vessel minted (§2a) — the operator's own causal act when their own patience
 * for a hand-off ends (never a clock comparison inside the store). Pass `"all"` to drop every pending offer.
 */
export function withdrawOfferFlow(target: string | "all", dir?: string): number {
  return withdrawAdmitOffer(target, dir);
}

/** WITHDRAW a sent grant memo this vessel minted (§2a) — the granter's own causal act; a late ACK against the
 *  withdrawn nonce_A then refuses by name, exactly as a consumed one already does. */
export function withdrawGrantFlow(nonceA: string, dir?: string): boolean {
  return withdrawAdmitGrant(nonceA, dir);
}

/**
 * HOP 2 (A): read B's offer carriage, seal a persona→vessel grant signed by the persona-prefix op-key, STASH
 * the sent memo (to verify B's ACK later), and render QR#2. Refuses a torn offer carriage (fail-closed) —
 * never a wall-clock-expired one (§2a gate-removal v3: `expiry` is advisory display only here).
 */
export async function grantAdmitFlow(args: {
  readonly offerCarriage: string;
  readonly personaRef:    PersonaRef;
  readonly personaSigner: AdmitSigner;
  readonly dir?:          string;
  /** Where the FOUNDER's convergence secrets live — defaults to the identity home. Omit → no keyring, carry-only. */
  readonly founderKeyringDir?: string;
  readonly expiryMs?:     number;
  readonly now?:          number;
}): Promise<({ sealed: SealedGrant; keyringDelivered: boolean } & HopRender) | { error: string }> {
  const offer = parseEnrollmentCarriage(args.offerCarriage);
  if (!offer) return { error: "not a valid enrollment offer carriage — the QR did not arrive" };
  // Seal the founder's cad read-key FIRST — the recipient is the offer's ephemeral pubkey (the same key B keeps
  // on-device for the grant), so no second keypair mints. Its digest rides the signed transcript BELOW, so the
  // persona signature COMMITS to the exact keyring token; a founder holding no keyring delivers none (carry-only).
  const keyring = sealFounderKeyringCarriage(offer.ephemeralPubkey, args.founderKeyringDir);
  let sealed: SealedGrant;
  let sent;
  try {
    ({ sealed, sent } = await sealPersonaGrant({
      offer, personaRef: args.personaRef, personaSigner: args.personaSigner,
      ...(keyring ? { keyringSealDigest: keyring.digest } : {}),   // fold the commitment IN before signing
      ...(args.expiryMs !== undefined ? { expiryMs: args.expiryMs } : {}),
      ...(args.now !== undefined ? { now: args.now } : {}),
    }));
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
  stashSentMemo(sent, args.dir);
  // Append the SAME token the signed digest committed to (digest-what-you-carry — the two share one byte-image).
  const grantCarriage = toGrantCarriage(sealed);
  const carriage = keyring ? appendKeyringFragment(grantCarriage, keyring.token) : grantCarriage;
  return { sealed, keyringDelivered: keyring !== null, ...(await render(carriage)) };
}

/**
 * HOP 3 (B): read A's sealed grant, try to open it against EACH pending enrollment (B cannot know which offer a
 * grant answers until one decrypts), verify against the persona PREFIX head, consume the matching secret, RECORD
 * the join into THIS vessel's multitude-view, mint + render the ACK (QR#3). Fail-closed at every shore.
 */
export async function openAdmitFlow(args: {
  readonly grantCarriage:    string;
  readonly resolveHeadOpKey: (prefix: string) => Promise<string | null> | string | null;
  readonly deviceSigner:     AdmitSigner;
  readonly dir?:             string;
  /** Where THIS joinee's convergence secrets live — defaults to the identity home. The delivered keyring lands here. */
  readonly keyringInstallDir?: string;
  /** OPTIONAL (M12) — resolve the SAME prefix's head KEL seq; rides into `JoinRecord.granterSeq` as an ADVISORY
   *  ordering hint for `recordAdmittedPersona`'s causal supersede. `makeLocalPersonaKelHeadSeqResolver` builds one
   *  off the same board `resolveHeadOpKey` reads. Omit it and the view falls back to its nonce-only tiebreak. */
  readonly resolveHeadSeq?: (prefix: string) => Promise<number | null> | number | null;
  readonly now?:             number;
  /**
   * M8 — restrict the match search to THIS held session's own offer (its ephemeral pubkey). Omitted → try
   * every pending offer (the original behavior; `lares persona admit open` keeps using it, since it holds
   * no single "own" offer context). A HELD offer's post-paste open must scope to itself: without this, a
   * grant answering a DIFFERENT pending offer Y could be consumed inside offer X's held session, leaving Y
   * believing it still stands pending while its secret has already been taken.
   */
  readonly onlyEphemeral?: string;
}): Promise<({ joinRecord: JoinRecord; keyringEpochs: number } & HopRender) | { error: string }> {
  const sealed = parseGrantCarriage(args.grantCarriage);
  if (!sealed) return { error: "not a valid sealed-grant carriage — the QR did not arrive" };

  const allPending = peekEnrollmentSecrets(args.dir);
  const pending = args.onlyEphemeral
    ? allPending.filter((p) => p.ephemeralPubkey === args.onlyEphemeral)
    : allPending;
  if (pending.length === 0) {
    return {
      error: args.onlyEphemeral
        ? "this session's own offer is no longer pending (withdrawn, expired, or already opened)"
        : "no pending enrollment on this vessel — run `persona admit offer` first",
    };
  }

  // L10 — `lastReason` used to report whichever offer was tried LAST, which is usually the least
  // informative "decrypt-failed" (every offer that simply isn't the matching one fails to decrypt). Prefer
  // the first NON-decrypt reason any candidate drew (a real cause: a torn head, a replayed nonce) — that is
  // the informative refusal a human can act on; a decrypt-only set of misses falls back to naming that.
  let lastReason = "no pending enrollment matched this grant";
  let informativeReason: string | null = null;
  for (const { ephemeralPubkey, secret } of pending) {
    const verdict = await openPersonaGrant({
      sealed, secret, resolveHeadOpKey: args.resolveHeadOpKey,
      ...(args.resolveHeadSeq ? { resolveHeadSeq: args.resolveHeadSeq } : {}),
      ...(args.now !== undefined ? { now: args.now } : {}),
    });
    if (!verdict.ok) {
      lastReason = verdict.reason;
      if (informativeReason === null && !verdict.reason.startsWith("decrypt-failed")) informativeReason = verdict.reason;
      continue;
    }
    // A matching enrollment: consume its secret (never re-usable) + record the join into the local view.
    takeEnrollmentSecret(ephemeralPubkey, args.dir);
    // ADOPT the founder's cad keyring riding this SAME grant carriage — but ONLY when the now-VERIFIED transcript
    // committed a digest that the arriving token matches (a substituted / stripped / unbound fragment installs
    // nothing). Opened with the SAME ephemeral secret that opened the grant, installed authoritatively (the
    // founder's secret supersedes the joinee's self-minted phantom). No bound keyring → carry-only (keyringEpochs 0).
    const keyringEpochs = adoptDeliveredKeyring(
      args.grantCarriage, secret, verdict.accepted.transcript.keyringSealDigest, args.keyringInstallDir,
    );
    const { ack, joinRecord } = await mintJoinAck({ accepted: verdict.accepted, secret, deviceSigner: args.deviceSigner });
    recordAdmittedPersona(joinRecord, args.dir);
    return { joinRecord, keyringEpochs, ...(await render(toAckCarriage(ack))) };
  }
  return { error: informativeReason ?? lastReason };
}

/**
 * HOP 3-close (A): read B's ACK, look up the sent memo by nonce_A, verify the ACK against it + B's device key,
 * and RECORD the matching join into A's OWN multitude-view. Both vessels now hold the mutually-signed record.
 */
export async function acceptAdmitFlow(args: {
  readonly ackCarriage: string;
  readonly dir?:        string;
  readonly now?:        number;
}): Promise<{ joinRecord: JoinRecord } | { error: string }> {
  const ack: JoinAck | null = parseAckCarriage(args.ackCarriage);
  if (!ack) return { error: "not a valid ACK carriage — the QR did not arrive" };
  const memo = takeSentMemo(ack.joinRecord.nonceA, args.dir);
  if (!memo) return { error: "no sent grant matches this ACK's nonce — the grant was never issued from this vessel (or already accepted)" };
  const verdict = await verifyJoinAck({ ack, sent: memo, ...(args.now !== undefined ? { now: args.now } : {}) });
  if (!verdict.ok) {
    // Re-stash the memo: a transient bad ACK must not silently discard a legitimately-pending grant.
    stashSentMemo(memo, args.dir);
    return { error: verdict.reason };
  }
  recordAdmittedPersona(verdict.joinRecord, args.dir);
  return { joinRecord: verdict.joinRecord };
}
