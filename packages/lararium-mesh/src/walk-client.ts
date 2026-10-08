/**
 * walk-client — the WALKER's side of hosting, platform-blind: carry an invite, redeem it at the hearth's own
 * gate, keep the grant the hearth pushes, and present that grant on every later dial. A browser leaf and a node
 * vessel compose this one client with their own store and their own per-Nexus leaf; the sorter at the hearth
 * reads only what a socket presents, never what kind of device it is.
 *
 * WHAT IT KEEPS, per hearth (keyed by the gate key it pins): the Nexus, the carried invite until it settles, the
 * latest grant, its WALLET of unspent invites, and a blinded batch it has sent and not yet finalized. Nothing
 * about whom it invites, and never a claim — the claim re-derives from its leaf seed.
 *
 * THE WALLET FILLS AT ONCE. Once a dial stands on a grant, the walker mints its whole allowance for that epoch in
 * ONE blind batch, never one invite on demand: mint time then says nothing about when an invite is handed out.
 * The batch is blinded against the public key of the hearth's signed act for that epoch — read off the Nexus's
 * board, the same act every walker reads — and kept durably before it is sent; the same batch is resent until
 * the hearth's answer finalizes. An answer whose proof does not hold under that key finalizes nothing.
 *
 * REFUSE BEFORE DESTROY. The invite is written durably BEFORE the first dial, and it stays until a dial that
 * presents the pushed GRANT gets the hearth's signed verdict. Until then every dial presents the token again:
 * the same claim earns the identical grant, so a lost push, a dropped socket or a corrupted grant never strands
 * the newcomer — the next dial recovers it. Once a grant-bearing dial stands, the invite is gone.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-invite
 */

import type { LeafIdentity, UnsignedPresented, LarSessionMsg } from "./auth-wire.js";
import { ed25519SignerFromSeed } from "./auth-wire.js";
import {
  decodeInvite, encodeInvite, redeemClaim, isHostingGrant, allowance, hostingActCid, blindWalkerBatch, finalizeWalkerBatch,
  type HostingAct, type HostingGrant, type InviteToken, type PendingMint,
} from "./hosting.js";

/** The session kind a hearth pushes a walker's grant on. */
export const HOSTING_GRANT_SESSION_KIND = "hosting/grant";
/** The session kinds of the walker's blind mint: the ask, and the hearth's answer. */
export const HOSTING_MINT_SESSION_KIND   = "hosting/mint";
export const HOSTING_MINTED_SESSION_KIND = "hosting/minted";

/** What a walker keeps for one hearth. */
export interface WalkRecord {
  readonly nexusAid: string;
  /** The carried invite, kept until a grant-bearing dial stands. */
  readonly invite?:  string;
  /** The latest grant the hearth pushed. */
  readonly grant?:   HostingGrant;
  /** Unspent invites, each with the epoch it was minted at. */
  readonly wallet?:  ReadonlyArray<{ readonly epoch: string; readonly token: InviteToken }>;
  /** A blinded batch sent and not yet finalized. */
  readonly pending?: PendingMint;
  /** The KEEP STUBS: a receipt per document this hearth carries for the walker — its address and its read-cap. */
  readonly carried?: ReadonlyArray<CarryReceipt>;
  /** The KEEP STUB: the opaque key the hearth carries this walker's documents under, presented on every carry
   *  and fetch so the carriage outlives a lapsed lineage. */
  readonly carryStub?: string;
  /** The hearth's notice stands: its carriage for this walker is marked for reclaim under pressure. */
  readonly atRisk?:  boolean;
}

/** One carried document's receipt: what the walker needs to find it again and open it. */
export interface CarryReceipt {
  readonly cid:     string;
  /** Hex read-cap — derived from the walker's own carry secret and the document; the hearth never sees it. */
  readonly readCap: string;
}

/** Where a walker keeps its records — IndexedDB in a browser, a file on a node. Keyed by the hearth's gate key. */
export interface WalkStore {
  read(gatePubKey: string): Promise<WalkRecord | null>;
  write(gatePubKey: string, record: WalkRecord): Promise<void>;
}

/** The walker's per-Nexus leaf: its verifying key and its signing seed (kept nowhere by this module). */
export interface WalkLeaf {
  readonly verifyingKey: string;
  readonly seed:         Uint8Array;
}

/**
 * Take a carried invite for the hearth it names: write it DURABLY before any dial. An invite for another gate, a
 * torn string, or a hearth this walker already holds a settled grant for leaves the store untouched. Returns
 * the record a dial should present from, or null when there is nothing to walk with.
 */
export async function takeInvite(store: WalkStore, carried: string): Promise<{ readonly gatePubKey: string; readonly record: WalkRecord } | null> {
  const invite = decodeInvite(carried);
  if (!invite) return null;
  const gatePubKey = invite.gatePubKey.toLowerCase();
  const held = await store.read(gatePubKey);
  if (held?.grant && !held.invite) return { gatePubKey, record: held };          // already walking here
  // A walker walking back in keeps its grant until the new one lands, and its carriage receipts and keep stub.
  const record: WalkRecord = {
    nexusAid: invite.nexusAid, invite: carried, ...(held?.grant ? { grant: held.grant } : {}),
    ...(held?.carried ? { carried: held.carried } : {}), ...(held?.carryStub ? { carryStub: held.carryStub } : {}),
    ...(held?.atRisk ? { atRisk: held.atRisk } : {}),
  };
  await store.write(gatePubKey, record);
  return { gatePubKey, record };
}

/**
 * What a dial presents for a record: the TOKEN while an invite is unsettled (the retry that recovers any lost
 * grant), else the GRANT. Null when the record holds neither.
 */
export function walkArm(record: WalkRecord, leaf: WalkLeaf): UnsignedPresented | null {
  if (record.invite) {
    const invite = decodeInvite(record.invite);
    if (!invite) return null;
    return {
      kind: "token", nexusAid: invite.nexusAid, token: invite.token,
      claim: redeemClaim(leaf.seed, invite.token.n), leaf: leaf.verifyingKey.toLowerCase(),
    };
  }
  if (record.grant) return { kind: "grant", grant: record.grant };
  return null;
}

/** The dial identity a walk presents: the base card and proof, the walk arm, and the leaf's signer. No edge. */
export function walkIdentity(base: LeafIdentity, record: WalkRecord, leaf: WalkLeaf): LeafIdentity | null {
  const presented = walkArm(record, leaf);
  if (!presented) return null;
  return { contactCard: base.contactCard, peerPubKey: base.peerPubKey, sign: base.sign, presented, leafSign: ed25519SignerFromSeed(leaf.seed) };
}

/** The walker's view of a dialed transport: its session, its re-presentation, and its proven peers. */
export interface WalkTransport {
  onSession(listener: (msg: LarSessionMsg) => void): () => void;
  sendSession(kind: string, body: unknown): boolean;
  represent(identity: LeafIdentity): void;
  on(event: "peer-candidate", listener: (e: { peerId: unknown }) => void): unknown;
  readonly identity: LeafIdentity;
}

/**
 * Ride a dialed transport as a walker. A `hosting/grant` push for this walker's leaf and Nexus is KEPT, and the
 * transport re-presents with it; when a dial presenting the GRANT is verified (a proven peer joins on it), the
 * invite is settled — deleted — and only the grant remains. Returns the unsubscribe.
 */
export function walkOver(opts: {
  readonly transport:  WalkTransport;
  readonly store:      WalkStore;
  readonly gatePubKey: string;
  readonly leaf:       WalkLeaf;
  readonly base:       LeafIdentity;
  /** The hearth's signed hosting act named by an epoch, read off the Nexus's board. Absent → no wallet fills. */
  readonly actFor?:    (epochCid: string) => Promise<HostingAct | null>;
}): () => void {
  const gate = opts.gatePubKey.toLowerCase();
  const leafKey = opts.leaf.verifyingKey.toLowerCase();
  const offSession = opts.transport.onSession((msg) => {
    if (msg.kind === HOSTING_MINTED_SESSION_KIND) { void finalize(msg.body); return; }
    if (msg.kind !== HOSTING_GRANT_SESSION_KIND) return;
    const grant = (msg.body as { grant?: unknown } | null)?.grant;
    if (!isHostingGrant(grant) || grant.leaf.toLowerCase() !== leafKey) return;
    void (async () => {
      const held = await opts.store.read(gate);
      if (!held || held.nexusAid.toLowerCase() !== grant.nexusAid.toLowerCase()) return;
      const { atRisk: _renewed, ...kept } = held;                               // a renewed grant clears the notice
      await opts.store.write(gate, { ...kept, grant });
      // Re-present under the grant: the dial that stands on it is the one that settles the invite.
      opts.transport.represent({
        contactCard: opts.base.contactCard, peerPubKey: opts.base.peerPubKey, sign: opts.base.sign,
        presented: { kind: "grant", grant }, leafSign: ed25519SignerFromSeed(opts.leaf.seed),
      });
    })();
  });
  opts.transport.on("peer-candidate", () => {
    const presented = opts.transport.identity.presented;
    if (presented?.kind !== "grant") return;
    void (async () => {
      const held = await opts.store.read(gate);
      if (!held) return;
      if (held.invite) {
        const { invite: _settled, ...rest } = held;
        await opts.store.write(gate, rest);
      }
      await fill();
    })();
  });

  /** Mint the whole allowance for the grant's epoch in one blind batch — or resend the batch already pending. */
  async function fill(): Promise<void> {
    const held = await opts.store.read(gate);
    const grant = held?.grant;
    if (!held || !grant || !opts.actFor) return;
    if (held.pending?.epoch === grant.epoch) {
      opts.transport.sendSession(HOSTING_MINT_SESSION_KIND, { blinded: held.pending.items.map((i) => i.blinded) });
      return;
    }
    if (held.wallet?.some((w) => w.epoch === grant.epoch)) return;            // this epoch's batch already stands
    const act = await opts.actFor(grant.epoch);
    if (!act || hostingActCid(act) !== grant.epoch) return;
    const count = allowance(grant, act.cap);
    if (count === 0) return;
    const pending = blindWalkerBatch(act, count);
    await opts.store.write(gate, { ...held, pending });                       // durable before it is sent
    opts.transport.sendSession(HOSTING_MINT_SESSION_KIND, { blinded: pending.items.map((i) => i.blinded) });
  }

  /** Finalize the hearth's answer into the wallet; an answer that does not finalize keeps the batch pending. */
  async function finalize(body: unknown): Promise<void> {
    const held = await opts.store.read(gate);
    const pending = held?.pending;
    if (!held || !pending || !opts.actFor) return;
    const answer = body as { evaluated?: unknown; proof?: unknown } | null;
    if (!Array.isArray(answer?.evaluated) || typeof answer?.proof !== "string") return;
    const act = await opts.actFor(pending.epoch);
    if (!act) return;
    let tokens: InviteToken[];
    try { tokens = finalizeWalkerBatch(act, pending, { evaluated: answer.evaluated as string[], proof: answer.proof }); }
    catch { return; }
    const { pending: _done, ...rest } = held;
    await opts.store.write(gate, { ...rest, wallet: [...(held.wallet ?? []), ...tokens.map((token) => ({ epoch: pending.epoch, token }))] });
  }
  return offSession;
}

/**
 * Hand one invite out of the wallet: the oldest unspent token, removed before it is returned, carried with the
 * hearth's gate key and Nexus. Null when the wallet holds none.
 */
export async function popInvite(store: WalkStore, gatePubKey: string, relay?: string): Promise<string | null> {
  const gate = gatePubKey.toLowerCase();
  const held = await store.read(gate);
  const next = held?.wallet?.[0];
  if (!held || !next) return null;
  await store.write(gate, { ...held, wallet: held.wallet!.slice(1) });
  return encodeInvite({ nexusAid: held.nexusAid, gatePubKey: gate, token: next.token, ...(relay ? { relay } : {}) });
}
