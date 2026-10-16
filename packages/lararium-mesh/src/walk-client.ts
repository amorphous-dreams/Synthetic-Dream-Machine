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
 * Each fill first drops every token of an epoch the hearth no longer holds live, and a hand-out takes the newest.
 * The batch is blinded against the public key of the hearth's signed act for that epoch — read off the hearth's
 * hosting doc, the same act every walker reads — and kept durably before it is sent; the same batch is resent until
 * the hearth's answer finalizes. An answer whose proof does not hold under that key finalizes nothing.
 *
 * REFUSE BEFORE DESTROY. The invite is written durably BEFORE the first dial, and it stays until a dial that
 * presents the pushed GRANT gets the hearth's signed verdict. Until then every dial presents the token again:
 * the same claim earns the identical grant, so a lost push, a dropped socket or a corrupted grant never strands
 * the newcomer — the next dial recovers it. Once a grant-bearing dial stands, the invite is gone.
 *
 * ONE RECORD, ONE HAND AT A TIME. Every change to a record runs as ONE store `update`: the store reads the standing
 * record, the client decides over it, and the store writes, with no other hand between. The client holds no
 * snapshot across an await and writes none back, so a grant that lands while an invite leaves the wallet keeps
 * both changes. A hand-out answers the token its own update removed.
 *
 * A STORE THAT REFUSES COSTS ONE MESSAGE. A session frame or a proven peer starts work nobody awaits. A store that
 * refuses there (a vessel whose key rests locked, a record that does not open) drops that one message and says so
 * through the `onFault` port; the next presentation recovers a lost grant by its token.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-invite
 */

import type { LeafIdentity, UnsignedPresented, LarSessionMsg } from "./auth-wire.js";
import { ed25519SignerFromSeed } from "./auth-wire.js";
import {
  decodeInvite, encodeInvite, redeemClaim, isHostingGrant, isInviteToken, allowance, hostingActCid, blindWalkerBatch, finalizeWalkerBatch,
  hostingActsFromBoard, verifyHostingAct,
  type HostingAct, type HostingGrant, type InviteToken, type PendingMint,
} from "./hosting.js";
import type { LarDoc } from "./base-doc.js";

/** The session kind a hearth pushes a walker's grant on. */
export const HOSTING_GRANT_SESSION_KIND = "hosting/grant";
/** The session kinds of the walker's blind mint: the ask, and the hearth's answer. */
export const HOSTING_MINT_SESSION_KIND   = "hosting/mint";
export const HOSTING_MINTED_SESSION_KIND = "hosting/minted";

/** What a walker keeps for one hearth. */
export interface WalkRecord {
  readonly nexusAid: string;
  /** Where the hearth's relay answers (`ws(s)://host[:port]/ws`), when an invite named it — kept past the
   *  invite's settling, so a vessel that dials by its own records knows where to dial again. */
  readonly relay?:   string;
  /** The carried invite, kept until a grant-bearing dial stands. */
  readonly invite?:  string;
  /** The latest grant the hearth pushed. */
  readonly grant?:   HostingGrant;
  /** Unspent invites, each with the epoch it was minted at. */
  readonly wallet?:  ReadonlyArray<{ readonly epoch: string; readonly token: InviteToken }>;
  /** A blinded batch sent and not yet finalized. */
  readonly pending?: PendingMint;
  /** The walker's own receipts: one per document this hearth carries for it — its address, its reference and its key. */
  readonly carried?: ReadonlyArray<CarryReceipt>;
  /** The hearth's notice stands: its carriage for this walker is marked for reclaim under pressure. */
  readonly atRisk?:  boolean;
}

/** One carried document's receipt: what the walker needs to find it again and open it. The walker writes it
 *  with its own hands before the sealed value leaves, so the receipt authorizes its own address. */
export interface CarryReceipt {
  /** The sealed value's address: `blake3:` over its ciphertext. */
  readonly cid: string;
  /** The document's logical reference: lower-case hex SHA-256 of its plaintext. */
  readonly ref: string;
  /** Hex of this document's own key, which the walker's carry secret and the document's digest derive; the
   *  hearth never sees it, and it opens no other document. */
  readonly key: string;
}

const DIGEST = /^[0-9a-f]{64}$/;
const BLAKE3_CID = /^blake3:[0-9a-f]{64}$/;
const RECORD_FIELDS: ReadonlySet<string> = new Set(["nexusAid", "relay", "invite", "grant", "wallet", "pending", "carried", "atRisk"]);

function plainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
/** Thirty-two bytes as lower-case hex: a nonce, a blind, a blinded element, a tweaked key, an epoch, a digest. */
const digest = (v: unknown): v is string => typeof v === "string" && DIGEST.test(v);

/**
 * Whether `v` reads as ONE whole walk record: every field it holds wears its own shape, and it holds no field this
 * record does not name. A store checks what it read with this before it hands a record to the client, so a wallet
 * that holds anything but tokens, a pending batch missing its blinds or a receipt missing its key never reaches a
 * hand-out or a dial.
 */
export function isWalkRecord(v: unknown): v is WalkRecord {
  if (!plainObject(v)) return false;
  for (const field of Object.keys(v)) if (!RECORD_FIELDS.has(field)) return false;
  if (typeof v["nexusAid"] !== "string" || v["nexusAid"].length === 0) return false;
  if (v["relay"] !== undefined && (typeof v["relay"] !== "string" || v["relay"].length === 0)) return false;
  if (v["invite"] !== undefined && (typeof v["invite"] !== "string" || decodeInvite(v["invite"]) === null)) return false;
  if (v["grant"] !== undefined && !isHostingGrant(v["grant"])) return false;
  if (v["atRisk"] !== undefined && typeof v["atRisk"] !== "boolean") return false;
  const wallet = v["wallet"];
  if (wallet !== undefined && !(Array.isArray(wallet) && wallet.every((w: unknown) =>
    plainObject(w) && Object.keys(w).length === 2 && typeof w["epoch"] === "string" && DIGEST.test(w["epoch"]) && isInviteToken(w["token"])))) return false;
  const pending = v["pending"];
  if (pending !== undefined && !(plainObject(pending) && Object.keys(pending).length === 3 &&
    typeof pending["epoch"] === "string" && DIGEST.test(pending["epoch"]) && digest(pending["tweakedKey"]) &&
    Array.isArray(pending["items"]) && pending["items"].length > 0 && pending["items"].every((it: unknown) =>
      plainObject(it) && Object.keys(it).length === 3 && digest(it["n"]) && digest(it["blind"]) && digest(it["blinded"])))) return false;
  const carried = v["carried"];
  if (carried !== undefined && !(Array.isArray(carried) && carried.every((r: unknown) =>
    plainObject(r) && Object.keys(r).length === 3 && typeof r["cid"] === "string" && BLAKE3_CID.test(r["cid"]) &&
    typeof r["ref"] === "string" && DIGEST.test(r["ref"]) && typeof r["key"] === "string" && DIGEST.test(r["key"])))) return false;
  return true;
}

/**
 * Where a walker keeps its records — IndexedDB in a browser, a sealed row on a node. Keyed by the hearth's gate key.
 * The store holds no bare write: a record changes through `update` alone.
 */
export interface WalkStore {
  read(gatePubKey: string): Promise<WalkRecord | null>;
  /**
   * Read the standing record, decide, and write, as ONE act: no other hand lands between the read and the write.
   * `decide` runs once, synchronously, over the standing record (`null` when none stands) and answers the record
   * to keep, or `null` to leave the store as it stands. Resolves with the record it wrote, or `null` when it wrote
   * none. A store that cannot read the standing record whole rejects before `decide` runs.
   */
  update(gatePubKey: string, decide: (held: WalkRecord | null) => WalkRecord | null): Promise<WalkRecord | null>;
}

/** Where the walk client's unawaited work failed: the message it dropped, and the store's (or the transport's) refusal. */
export interface WalkFault {
  readonly at:    "grant" | "settle" | "minted" | "notice";
  readonly error: unknown;
}

/** Tell the fault port; a port that throws costs nothing further. */
export function tellWalkFault(onFault: (fault: WalkFault) => void, at: WalkFault["at"], error: unknown): void {
  try { onFault({ at, error }); } catch { /* the port's own fault stays with the port */ }
}

/** The walker's per-Nexus leaf: its verifying key and its signing seed (kept nowhere by this module). */
export interface WalkLeaf {
  readonly verifyingKey: string;
  readonly seed:         Uint8Array;
}

/**
 * Take a carried invite for the hearth it names: write it DURABLY before any dial. A torn string, a hearth this
 * walker already holds a settled grant for, or a hearth it walks at in another Nexus leaves the store untouched.
 * Returns the record a dial should present from, or null when there is nothing to walk with.
 */
export async function takeInvite(store: WalkStore, carried: string): Promise<{ readonly gatePubKey: string; readonly record: WalkRecord } | null> {
  const invite = decodeInvite(carried);
  if (!invite) return null;
  const gatePubKey = invite.gatePubKey.toLowerCase();
  const out: { stands: WalkRecord | null } = { stands: null };
  await store.update(gatePubKey, (held) => {
    // One record serves one hearth in one Nexus: an invite for another Nexus at a hearth already walked at
    // keeps nothing, since a grant and receipts of one Nexus never ride a record that names another.
    if (held && held.nexusAid.toLowerCase() !== invite.nexusAid.toLowerCase()) return null;
    if (held?.grant && !held.invite) { out.stands = held; return null; }             // already walking here
    // A walker walking back in keeps its grant until the new one lands, and its carriage receipts.
    const relay = invite.relay ?? held?.relay;
    const record: WalkRecord = {
      nexusAid: invite.nexusAid, invite: carried, ...(relay ? { relay } : {}), ...(held?.grant ? { grant: held.grant } : {}),
      ...(held?.carried ? { carried: held.carried } : {}), ...(held?.atRisk ? { atRisk: held.atRisk } : {}),
    };
    out.stands = record;
    return record;
  });
  return out.stands ? { gatePubKey, record: out.stands } : null;
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
  /**
   * What the transport presents now. The sealed gate adapter presents a face, not a walk, so it carries none:
   * the WALKER ROUTE IS SHUT BY NAME at the cutover (`walker-route-shut`) and a transport without an identity
   * settles no invite. A walker transport that does carry one rides as before until the route is rebuilt.
   */
  readonly identity?: LeafIdentity;
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
  /** The hearth's signed hosting act named by an epoch, read off the hearth's hosting doc. Absent → no wallet fills. */
  readonly actFor?:    (epochCid: string) => Promise<HostingAct | null>;
  /** Told each message this walk dropped because its store, its act read or its transport refused. */
  readonly onFault:    (fault: WalkFault) => void;
}): () => void {
  const gate = opts.gatePubKey.toLowerCase();
  const leafKey = opts.leaf.verifyingKey.toLowerCase();
  /** Start work nobody awaits; its refusal reaches the fault port and no farther. */
  const unawaited = (at: WalkFault["at"], work: () => Promise<void>): void => {
    void (async () => { await work(); })().catch((error: unknown) => tellWalkFault(opts.onFault, at, error));
  };
  const offSession = opts.transport.onSession((msg) => {
    if (msg.kind === HOSTING_MINTED_SESSION_KIND) { unawaited("minted", () => finalize(msg.body)); return; }
    if (msg.kind !== HOSTING_GRANT_SESSION_KIND) return;
    const grant = (msg.body as { grant?: unknown } | null)?.grant;
    if (!isHostingGrant(grant) || grant.leaf.toLowerCase() !== leafKey) return;
    unawaited("grant", async () => {
      const kept = await opts.store.update(gate, (held) => {
        if (!held || held.nexusAid.toLowerCase() !== grant.nexusAid.toLowerCase()) return null;
        const { atRisk: _renewed, ...rest } = held;                             // a renewed grant clears the notice
        return { ...rest, grant };
      });
      if (!kept) return;
      // Re-present under the grant: the dial that stands on it is the one that settles the invite.
      opts.transport.represent({
        contactCard: opts.base.contactCard, peerPubKey: opts.base.peerPubKey, sign: opts.base.sign,
        presented: { kind: "grant", grant }, leafSign: ed25519SignerFromSeed(opts.leaf.seed),
      });
    });
  });
  opts.transport.on("peer-candidate", () => {
    const presented = opts.transport.identity?.presented;
    if (presented?.kind !== "grant") return;
    unawaited("settle", async () => {
      await opts.store.update(gate, (held) => {
        if (!held?.invite) return null;
        const { invite: _settled, ...rest } = held;
        return rest;
      });
      await fill();
    });
  });

  /**
   * Prune the wallet to the hearth's two live epochs — the grant's epoch and the act it rolled from — then mint the
   * whole allowance for the grant's epoch in one blind batch, or resend the batch already pending. A token from an
   * epoch the hearth no longer holds can only meet silence, so the wallet never keeps one to hand out.
   */
  async function fill(): Promise<void> {
    if (!opts.actFor) return;
    const grant = (await opts.store.read(gate))?.grant;
    if (!grant) return;
    const act = await opts.actFor(grant.epoch);
    if (!act || hostingActCid(act) !== grant.epoch) return;
    const live = new Set([grant.epoch, ...(act.prev ? [act.prev] : [])]);
    const out: { send: PendingMint | null } = { send: null };
    await opts.store.update(gate, (held) => {
      // The act read above waited; a record whose grant moved to another epoch meanwhile fills on its own dial.
      if (!held?.grant || held.grant.epoch !== grant.epoch) return null;
      const stale = held.wallet?.some((w) => !live.has(w.epoch)) === true;
      const pruned: WalkRecord = stale ? { ...held, wallet: held.wallet!.filter((w) => live.has(w.epoch)) } : held;
      const keep = stale ? pruned : null;
      if (pruned.pending?.epoch === grant.epoch) { out.send = pruned.pending; return keep; }
      if (pruned.wallet?.some((w) => w.epoch === grant.epoch)) return keep;     // this epoch's batch already stands
      const count = allowance(held.grant, act.cap);
      if (count === 0) return keep;
      out.send = blindWalkerBatch(act, count);
      return { ...pruned, pending: out.send };                                      // durable before it is sent
    });
    if (out.send) opts.transport.sendSession(HOSTING_MINT_SESSION_KIND, { blinded: out.send.items.map((i) => i.blinded) });
  }

  /**
   * Finalize the hearth's answer into the wallet; an answer that does not finalize keeps the batch pending. The
   * tokens land only while the batch they finalize still stands pending, so a second answer to one batch adds none.
   */
  async function finalize(body: unknown): Promise<void> {
    if (!opts.actFor) return;
    const answer = body as { evaluated?: unknown; proof?: unknown } | null;
    if (!Array.isArray(answer?.evaluated) || typeof answer?.proof !== "string") return;
    const pending = (await opts.store.read(gate))?.pending;
    if (!pending) return;
    const act = await opts.actFor(pending.epoch);
    if (!act) return;
    let tokens: InviteToken[];
    try { tokens = finalizeWalkerBatch(act, pending, { evaluated: answer.evaluated as string[], proof: answer.proof }); }
    catch { return; }
    await opts.store.update(gate, (held) => {
      if (!held?.pending || !sameBatch(held.pending, pending)) return null;
      const { pending: _done, ...rest } = held;
      return { ...rest, wallet: [...(held.wallet ?? []), ...tokens.map((token) => ({ epoch: pending.epoch, token }))] };
    });
  }
  return offSession;
}

/** Whether two pending batches name the same blinded nonces at the same epoch. */
function sameBatch(a: PendingMint, b: PendingMint): boolean {
  return a.epoch === b.epoch && a.items.length === b.items.length && a.items.every((it, i) => it.blinded === b.items[i]!.blinded);
}

/** The slice of a document handle `hostingActOn` reads: its current doc, and its change events. */
export interface HostingDocHandle {
  doc(): LarDoc | undefined;
  on(event: "change", listener: () => void): unknown;
  off(event: "change", listener: () => void): unknown;
}

/**
 * The hearth's signed act for `epochCid`, read off its hosting doc — waiting up to `withinMs` for the doc to sync
 * when the act has not landed yet. A walker's dial and the doc's sync start together, so the grant that names a
 * fresh epoch can arrive before the act does; the wait is the walker's patience, never a causal reading. Only an
 * act whose CID is the epoch and whose own leaf signs it is returned.
 */
export async function hostingActOn(handle: HostingDocHandle, epochCid: string, withinMs: number): Promise<HostingAct | null> {
  const find = async (): Promise<HostingAct | null> => {
    for (const act of hostingActsFromBoard(handle.doc())) {
      if (hostingActCid(act) === epochCid && (await verifyHostingAct(act))) return act;
    }
    return null;
  };
  const now = await find();
  if (now || withinMs <= 0) return now;
  return new Promise((resolve) => {
    let settled = false;
    const done = (act: HostingAct | null): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      handle.off("change", onChange);
      resolve(act);
    };
    // A read that throws answers nothing for that change; the patience above still ends the wait.
    const look = (): void => { void find().then((act) => { if (act) done(act); }, () => undefined); };
    const onChange = (): void => look();
    const timer = setTimeout(() => done(null), withinMs);
    handle.on("change", onChange);
    look();
  });
}

/**
 * Hand one invite out of the wallet: the NEWEST unspent token — the one minted at the latest epoch, which stays
 * live longest — removed by the same store update that reads it, carried with the hearth's gate key and Nexus.
 * Null when the wallet holds none; a store that refuses the update rejects, and no token leaves.
 */
export async function popInvite(store: WalkStore, gatePubKey: string, relay?: string): Promise<string | null> {
  const gate = gatePubKey.toLowerCase();
  const out: { handed: { readonly nexusAid: string; readonly token: InviteToken } | null } = { handed: null };
  await store.update(gate, (held) => {
    const next = held?.wallet?.[held.wallet.length - 1];
    if (!held || !next) return null;
    out.handed = { nexusAid: held.nexusAid, token: next.token };
    return { ...held, wallet: held.wallet!.slice(0, -1) };
  });
  const { handed } = out;
  return handed ? encodeInvite({ nexusAid: handed.nexusAid, gatePubKey: gate, token: handed.token, ...(relay ? { relay } : {}) }) : null;
}
