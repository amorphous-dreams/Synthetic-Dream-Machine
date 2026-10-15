/**
 * uds-channel — the co-located fast path of the lares↔lararium binding.
 *
 * The daemon already holds the WARM daemon replica and the worker VerbDispatcher.
 * A co-located `lares` CLI never needed its own leaf replica + sync-on-connect (the
 * ~3s/command tax) — it only needs to hand the daemon a capability-bearing
 * invocation and await the receipt. This Unix-domain socket carries exactly that:
 * the CLI writes one invocation line, the daemon writes the summons into its warm
 * daemon working doc (the SAME tiddler the worker reacts to from a WS peer), awaits the
 * durable bags/daemon/outcomes/<id> outcome, and returns it over the socket. Receipt facts land
 * in the daemon wiki's working document.
 *
 *   transport  = this socket (kernel-local, authority-agnostic)
 *   authority  = the invocation's requestedBy → the worker's verify-then-delegate
 *   record     = the CRDT outcome tiddler (unchanged — idempotent, re-queryable)
 *
 * Content routing (the co-located bypass): the CLI and the daemon worker share ONE
 * process, so the carriers (tiddler/meme/blob CONTENT in `args`) ride the DIRECT
 * worker channel (`placeVerb` → postMessage → the worker's volatile invocation),
 * NEVER the daemon Automerge doc. The daemon's own doc carries only the VERB-record's
 * durable OUTCOME/receipt (`bags/daemon/outcomes/<id>`, written by the dispatcher) — the
 * command's result, never its content. A remote peer that lacks the shared process
 * still writes a summons over WS sync (that path keeps content in the CRDT by
 * necessity — no channel bypasses the network); the co-located path skips it.
 *
 * THE CHANNEL SERVES ITS VESSEL'S CLAIM. The vessel claimed the store's rendezvous name before it opened its Repo
 * (`claimStore`), and that one socket answers here once the vessel serves verbs: no second bind, no instant when
 * the name stands free, and no unlink of a path some other holder answers at. Closing the channel refuses every
 * later caller by name while the vessel flushes; the claim itself lets go only with the vessel.
 *
 * Auth (v1): socket perms 0600 (owner-only) gate PRESENCE — only the operator's own
 * uid opens it; the requestedBy did rides the summons for cap-derivation. A signed
 * Ed25519 proof over the socket is the federation/attenuation hardening (follow-on);
 * the WS path keeps the full V3 gate for genuine remote peers.
 * See lar:///ha.ka.ba/lararium/api/lares-lararium-binding.
 */

import { type Socket } from "node:net";
import { PARK_LIMIT } from "./owned-store.js";
import type { DocHandle, Repo } from "@automerge/automerge-repo";
import {
  CompositeStore,
  NoWorkingLayerRefusal, newRequestId, OUTCOME_URI_PREFIX, type LarDoc,
  wikiSlotUri,
  RECEIPT_FACT_URI_PREFIX, RECEIPT_RING_DEFAULT, RECEIPT_RING_BYTES_DEFAULT, buildReceiptFact, parseReceiptFact, outcomeBytesOf,
  verbInputDigest, type ReceiptFact, type ReceiptFactDraft,
} from "@lararium/mesh";
// The adaptive-timeout SERVO (fail on a GRADIENT, never a cliff): a per-verb wait that GROWS with the
// observed durations and clamps FLOOR..CEIL. The machine-code work stays Python; this is the
// coordinator's PATIENCE, servo'd so a long-but-honest verb (a big-session capture, a refresh queued
// behind a capture pass) is never false-killed the way a fixed 30s cliff killed them.
import { adaptiveTimeoutMs, recordMineDuration, verbBudgetMs } from "@lararium/mempalace";
import type { StoreClaim } from "./owned-store.js";

export interface UdsChannelOptions {
  /** The daemon's warm daemon doc handle (result.daemon.daemonHandle). */
  readonly daemonHandle: DocHandle<LarDoc>;
  /** The daemon composite with its attached working layer established as default writable. */
  readonly composite: CompositeStore;
  /**
   * The DIRECT worker channel (result.daemon.placeVerb) — posts the invocation
   * (verb + `args` CONTENT) straight to the daemon worker over the MessageChannel,
   * so the carriers reach the dispatcher WITHOUT riding the daemon Automerge doc.
   * The worker still writes the durable outcome to `bags/daemon/outcomes/<id>`, which
   * this channel awaits via `daemonHandle`.
   */
  readonly placeVerb: (o: { verb: string; args: Record<string, unknown>; requestedBy: string; requestId: string; effectKey?: string }) => void;
  /** The vessel's claim on its store — the rendezvous socket (`/tmp/lares-<uid>/<digest>.sock`) both sides derive. */
  readonly claim: StoreClaim & { readonly holder: "vessel" };
  /**
   * The vessel's Automerge Repo — the receipt-fact ledger's own durability floor (D1). `arbitrate`
   * awaits `repo.flush()` AFTER writing a `committed`/`abandoned` fact and BEFORE this channel calls
   * `placeVerb` (or answers a cancel) — a crash between the commit and the save would otherwise
   * re-run an id this vessel already decided to run, or un-abandon one it already refused.
   */
  readonly repo: Pick<Repo, "flush">;
  /**
   * Override {@link RECEIPT_RING_DEFAULT} — the request-fact ledger's own retention ring. Past this
   * many tracked requests (any state), the channel evicts the OLDEST (lowest `seq`) fact to
   * `evicted` and drops its full durable outcome; a later read of an evicted id answers
   * `retention-gap`, never a silent re-run. `main.ts` resolves this from vessel config
   * (`receipts.ring {ratePerMin, horizonDays, burst}`) when present.
   */
  readonly ring?: number;
  /**
   * Override {@link RECEIPT_RING_BYTES_DEFAULT} — the ring's bound on what the kept outcomes WEIGH. Each landed
   * fact names the bytes of the outcome record it keeps; past this many bytes across them, the channel evicts the
   * oldest kept body (lowest `seq`) exactly as the count bound does, and never the body that just landed. `main.ts`
   * resolves this from the same vessel config (`receipts.ring {…, bytesPerOutcome}`).
   */
  readonly ringBytes?: number;
  /** Per-verb await budget (default 30s — recall cold-starts chromadb). */
  readonly timeoutMs?: number;
  readonly onLog?: (line: string) => void;
}

interface Invocation {
  verb: string;
  args?: Record<string, unknown>;
  requestedBy: string;
  requestId?: string;
  /** The caller's own budget, raising the servo's wait within this side's ceiling. Read, never trusted. */
  timeoutMs?: number;
  /**
   * The effect this attempt would produce (D1, P2.5 iter 4 commit 4) — a caller-side
   * CONTENT-ADDRESSED key, distinct from `requestId` (a fresh nonce per attempt). Forwarded
   * verbatim to `placeVerb` → the worker's `VesselPlaceVerbRequest.effectKey` (already wired,
   * commit 1/2) → the dispatcher's own effect index, which answers a repeat attempt under a
   * NEW requestId with the prior `done` outcome rather than running the handler twice. This
   * channel never reads it for arbitration (that stays keyed on `requestId` + the plain
   * verb/args/requestedBy digest) — only the worker-side effect index consults it.
   */
  effectKey?: string;
}

/** A read-only receipt query — `{op:"receipt", requestId}`. Never reaches `placeVerb`; see H1. */
interface ReceiptQuery { op: "receipt"; requestId: string; }
/** An explicit withdrawal — `{op:"cancel", requestId}` (M8). Where no fact stands for the id, marks it abandoned so
 *  a later dispatch attempt under the SAME id (a read-back, a retry) refuses rather than running. Answers the
 *  ledger's verdict for the id, as a receipt query would. */
interface CancelQuery { op: "cancel"; requestId: string; }

function isReceiptQuery(v: unknown): v is ReceiptQuery {
  return !!v && typeof v === "object" && (v as { op?: unknown }).op === "receipt" && typeof (v as { requestId?: unknown }).requestId === "string";
}
function isCancelQuery(v: unknown): v is CancelQuery {
  return !!v && typeof v === "object" && (v as { op?: unknown }).op === "cancel" && typeof (v as { requestId?: unknown }).requestId === "string";
}

/** What a `{op:"receipt"}` query answers — a READ, never a dispatch. See H1 fix item 3/6. */
export interface ReceiptAnswer {
  readonly requestId: string;
  /**
   * `abandoned`  — this vessel refused the request before commit (an EOF-drop or an explicit
   *                `cancel`); re-run to try again, never read back as a verdict on the act.
   * `committed`  — dispatched by THIS boot, no durable outcome has landed yet (still running; re-query).
   * `interrupted` — committed by an EARLIER boot, and no outcome landed before that boot ended: the
   *                effect may have landed in part. Re-run under a fresh request id.
   * `done`/`error` — the durable outcome, read back exactly as `runVerb` would have returned it.
   * `evicted`    — the receipt ring (D1) dropped this id's full outcome past its retention bound;
   *                its fact survives (digest, effect key, terminal) but the result body is gone.
   * `unknown`    — this vessel never arbitrated this id (a fresh process since dispatch, no
   *                durable outcome either) — the honest "no idea", never told as `error`.
   */
  readonly state: "abandoned" | "committed" | "interrupted" | "done" | "error" | "evicted" | "unknown";
  readonly results?: Record<string, unknown>;
  readonly errorMessage?: string;
  /** Additive, mirroring the socket's own direct-refusal shape — a terminal outcome's own
   *  machine-readable reason, when it carried one (D1 commit 1, mesh). */
  readonly refusal?: { readonly reason: string };
}

/**
 * The vessel's OWN wait for an outcome ended — never a verdict on whether the act ran (M2). The act
 * already committed (past the causal EOF check) by the time this fires; it may still be running, or
 * its outcome may already be sitting in the durable doc unread by this particular wait. Told back
 * over the wire as `{status:"unknown", requestId}`, NEVER `{status:"error"}` — an "error" told a CLI
 * caller the act failed when it may have succeeded.
 */
export class VesselWaitExpired extends Error {
  constructor(verb: string, readonly requestId: string, budgetMs: number) {
    super(`verb "${verb}" — this vessel's own wait ended after ${budgetMs}ms (adaptive); outcome unknown. Check request ${requestId}.`);
  }
}

/**
 * The DURABLE, single-writer request ledger (D1, P2.5 iter 4 — closes H1R + H4 + M1 + M3″). This
 * channel is the receipt fact's ONE writer: it writes `committed` at arbitrate, `abandoned` at
 * EOF-drop/cancel, and `done`/`error` when it OBSERVES the durable outcome land (any path — the
 * co-located worker or a remote summons). The worker never writes a fact, only the outcome tiddler
 * this channel observes — so no two processes ever race one fact's `state` field.
 *
 * A restart loses NOTHING: the fact backing this ledger lives in the composite's default writable
 * working layer (`RECEIPT_FACT_URI_PREFIX<requestId>`), read through an in-memory cache that is seeded from the
 * store on first use and kept warm by every write this process makes. H1R's proven bug — a
 * same-id, same-args reuse re-running after a restart, and a cancelled id's abandonment not
 * surviving one — closes because the fact this ledger reads back IS the fact a prior process wrote,
 * never a process-local Map that a restart wiped.
 *
 * The ring (M1) holds two bounds, and either evicts: it flips a fact to `evicted` (keeping digest, effect
 * key, terminal) and tombstones the full durable outcome. An evicted id answers `retention-gap`, never a
 * silent re-run and never a bare "unknown" that would invite one.
 *   · COUNT: past `ring` tracked requests (any state), the oldest `seq` leaves first.
 *   · BYTES: every landed fact names what its kept outcome weighs, and the ledger holds their sum. Past
 *     `ringBytes`, the oldest KEPT BODY leaves first. A fact that keeps no body (in flight, abandoned,
 *     interrupted) weighs nothing and stays, and the body that just landed stays for the caller awaiting it:
 *     a lone outcome heavier than the whole bound leaves when the next body lands.
 * The sum seeds from the facts themselves, so a restart reads the same weight a prior boot left.
 */
export class FactLedger {
  private readonly cache = new Map<string, ReceiptFact>();
  /** requestIds this ledger has read as TORN — a tiddler under {@link RECEIPT_FACT_URI_PREFIX} that
   *  {@link parseReceiptFact} rejects (an unreadable shape, never "never seen"). Distinct from
   *  absent: `get()` answers `"torn"` for these, never `null`, so a caller cannot mistake an
   *  unreadable record for a fresh id. */
  private readonly torn = new Set<string>();
  /** requestIds in ascending `seq` order — the eviction queue. Seeded from the store at first use,
   *  then kept current by every `record()` this process makes. */
  private readonly order: string[] = [];
  /** requestIds whose fact keeps an outcome body, in ascending `seq` order — the byte bound's eviction queue. */
  private readonly bodied: string[] = [];
  /** What each kept body weighs and where its fact sits in the order: the tally's own book, read by no other state. */
  private readonly weights = new Map<string, { readonly seq: number; readonly bytes: number }>();
  /** What the kept bodies weigh, summed: every entry of `weights`. */
  private heldBytes = 0;
  private nextSeq = 0;
  private seeded: Promise<void> | null = null;

  constructor(
    private readonly composite: CompositeStore,
    private readonly repo: Pick<Repo, "flush">,
    private readonly ring: number,
    private readonly bootEpoch: number,
    private readonly ringBytes: number = RECEIPT_RING_BYTES_DEFAULT,
    /** Where a ring pass that failed says so. The act that started the pass stands either way. */
    private readonly onRingFault: (line: string) => void = () => { /* quiet */ },
  ) {}

  /**
   * THE RING TENDS; IT NEVER DECIDES. A pass runs after an act already wrote and flushed its own fact, so a pass
   * that fails must not fail that act: a commit whose caller heard a refusal would stand durable and never run,
   * and a seed that threw would refuse every act for the life of the boot. The fault gets said once per pass,
   * the victim stays where it stood, and the next pass takes it up again.
   */
  private async tend(justLanded?: string): Promise<void> {
    try { await this.evictIfNeeded(justLanded); }
    catch (e) { this.onRingFault(`receipt ring pass failed, and the next act's pass retries it: ${e instanceof Error ? e.message : String(e)}`); }
  }

  /** The end of the last write this ledger began. Every act that changes a fact, a body or the tally takes its
   *  turn behind it. */
  private turn: Promise<unknown> = Promise.resolve();

  /**
   * ONE WRITER, ONE WRITE AT A TIME. An act reads a fact, writes it, flushes, and then moves the cache and the
   * tally; each of those awaits. Two acts that interleaved there could both read one prior fact, or let an
   * eviction land between another act's write and its cache update. So every public act that writes runs whole
   * before the next begins, in the order the calls arrived.
   */
  private inTurn<T>(act: () => Promise<T>): Promise<T> {
    const run = this.turn.then(act);
    this.turn = run.catch(() => { /* the caller reads the refusal; the next act still takes its turn */ });
    return run;
  }

  /** Count a fact's kept body into the tally, in `seq` order. A fact that keeps none adds nothing. */
  private hold(fact: ReceiptFact): void {
    if (fact.state !== "done" && fact.state !== "error") return;
    this.release(fact.requestId);
    let at = this.bodied.length;
    while (at > 0 && this.weights.get(this.bodied[at - 1]!)!.seq > fact.seq) at--;
    this.bodied.splice(at, 0, fact.requestId);
    this.weights.set(fact.requestId, { seq: fact.seq, bytes: fact.outcomeBytes });
    this.heldBytes += fact.outcomeBytes;
  }

  /** Take a request's body back out of the tally, whatever its fact reads: every pass of the byte bound that
   *  names a victim ends with that victim out of the queue, so the pass always ends. */
  private release(requestId: string): void {
    const held = this.weights.get(requestId);
    if (!held) return;
    this.weights.delete(requestId);
    this.bodied.splice(this.bodied.indexOf(requestId), 1);
    this.heldBytes -= held.bytes;
  }

  private static factTitle(requestId: string): string {
    return `${RECEIPT_FACT_URI_PREFIX}${requestId}`;
  }

  /** Receipt facts live in the default writable layer that receives them; the ledger reads no other layer. */
  private factStore() {
    const bagId = this.composite.defaultWritableBagId();
    const store = bagId ? this.composite.storeForBag(bagId) : null;
    if (!store) throw new NoWorkingLayerRefusal("The receipt ledger read", "Mount the daemon working slot before opening the UDS channel.");
    return store;
  }

  /** Seed the cache + eviction order + seq counter from the durable store, once. Every public
   *  method awaits this first, so a connection arriving before the scan finishes still reads a
   *  consistent (if momentarily blocked) ledger rather than a false "never seen". `nextSeq`
   *  advances past the HIGHEST raw `seq` field this scan reads — TORN OR NOT: a torn record still
   *  claimed that seq when some earlier process minted it, so a fresh mint here must never reuse
   *  it, even though the torn record itself never joins the cache/order (it is tracked in
   *  {@link torn} instead, and never seeds nor plays an eviction victim). */
  private ensureSeeded(): Promise<void> {
    if (this.seeded) return this.seeded;
    this.seeded = (async () => {
      const store = this.factStore();
      const titles = await store.listVisible();
      const facts: ReceiptFact[] = [];
      let maxRawSeq = -1;
      for (const title of titles) {
        if (!title.startsWith(RECEIPT_FACT_URI_PREFIX)) continue;
        const rec = await store.get(title);
        if (!rec) continue;
        const raw = rec.tiddler as Record<string, unknown>;
        const rawSeqField = raw["seq"];
        const rawSeq = typeof rawSeqField === "string" ? Number.parseInt(rawSeqField, 10)
                     : typeof rawSeqField === "number" ? rawSeqField
                     : NaN;
        if (!Number.isNaN(rawSeq) && rawSeq > maxRawSeq) maxRawSeq = rawSeq;
        const fact = parseReceiptFact(raw);
        if (fact) facts.push(fact);
        else this.torn.add(title.slice(RECEIPT_FACT_URI_PREFIX.length));
      }
      facts.sort((a, b) => a.seq - b.seq);
      // SETTLE AT SEED. A `committed` fact of an EARLIER boot can no longer complete: its worker's
      // invocation lived in that process's scratch. An outcome that landed unobserved promotes the
      // fact to that terminal; none reads `interrupted`. A fact of THIS boot stays `committed`.
      let settledAny = false;
      for (let i = 0; i < facts.length; i++) {
        const fact = facts[i]!;
        if (fact.state !== "committed" || fact.bootEpoch >= this.bootEpoch) continue;
        const landed = await this.composite.get(`${OUTCOME_URI_PREFIX}${fact.requestId}`);
        const status = landed && !landed.meta?.deleted ? (landed.tiddler as Record<string, unknown>)["status"] : undefined;
        const settled: ReceiptFact = landed && (status === "done" || status === "error")
          ? { ...fact, state: status, terminal: status, outcomeBytes: outcomeBytesOf(landed.tiddler as Record<string, unknown>) }
          : { ...fact, state: "interrupted" };
        await this.composite.put(buildReceiptFact(settled), { kind: "lares-verb", requestId: fact.requestId });
        facts[i] = settled;
        settledAny = true;
      }
      if (settledAny) await this.repo.flush();
      for (const fact of facts) { this.cache.set(fact.requestId, fact); this.order.push(fact.requestId); this.hold(fact); }
      this.nextSeq = maxRawSeq + 1;
      // A boot under tighter bounds than the last brings the ledger down to them before it answers anything.
      await this.tend();
    })();
    return this.seeded;
  }

  /** Read-through: cache first, then the durable fact store. Never arbitrates, never dispatches.
   *  Answers `"torn"` — distinct from `null` (absent, never seen) — for a tiddler under
   *  {@link RECEIPT_FACT_URI_PREFIX} that {@link parseReceiptFact} rejects: a reader that collapsed
   *  the two would read an unreadable record as a fresh id and run it unannounced. */
  async get(requestId: string): Promise<ReceiptFact | null | "torn"> {
    await this.ensureSeeded();
    if (this.torn.has(requestId)) return "torn";
    const cached = this.cache.get(requestId);
    if (cached !== undefined) return cached;
    const rec = await this.factStore().get(FactLedger.factTitle(requestId));
    if (!rec) return null;
    const fact = parseReceiptFact(rec.tiddler as Record<string, unknown>);
    if (fact) { this.cache.set(requestId, fact); return fact; }
    this.torn.add(requestId);
    return "torn";
  }

  /** Mint a NEW fact (committed, abandoned, or a first non-UDS-path observation) — assigns the next
   *  seq, writes it durably, flushes the repo (the durability floor BEFORE a caller may dispatch or
   *  this channel may answer), warms the cache, and runs the ring's own eviction check. */
  private async record(fact: ReceiptFactDraft): Promise<ReceiptFact> {
    await this.ensureSeeded();
    const full: ReceiptFact = { ...fact, seq: this.nextSeq++ };
    await this.composite.put(buildReceiptFact(full), { kind: "lares-verb", requestId: fact.requestId });
    await this.repo.flush();
    this.cache.set(fact.requestId, full);
    this.order.push(fact.requestId);
    this.hold(full);
    await this.tend(fact.requestId);
    return full;
  }

  /**
   * Arbitrate ONE winner per request id, DURABLY. `inputDigest` names the invocation's own content
   * (verb + args + requestedBy + effectKey, the worker's own `verbInputDigest` formula) — a reused
   * id whose digest DIFFERS from the fact already on record refuses by name
   * (`request-id-reused-with-changed-input`), never silently re-runs under borrowed trust in the id
   * alone. `abandoned` refuses on STATE ALONE, whatever the digest says — {@link cancel} is the ONE
   * writer that records no digest (an explicit withdrawal carries no content claim to compare);
   * every other fact this ledger ever writes carries one (early alpha, no legacy data, no shim —
   * absence never reads as "unverifiable", only as "cancelled"). A TORN fact (a receipt record
   * under this id that {@link parseReceiptFact} rejects) refuses `receipt-fact-torn` by name,
   * ahead of every other check, and is never written over — this ledger does not guess what a
   * prior process meant to record.
   */
  async arbitrate(requestId: string, inputDigest: string):
    | Promise<{ readonly verdict: "run" }
      | { readonly verdict: "refuse"; readonly reason: "abandoned" | "interrupted" | "already-committed" | "request-id-reused-with-changed-input" | "retention-gap" | "receipt-fact-torn" }> {
    return this.inTurn(async () => {
      const existing = await this.get(requestId);
      if (existing === "torn") return { verdict: "refuse", reason: "receipt-fact-torn" };
      if (existing) {
        if (existing.state === "evicted") return { verdict: "refuse", reason: "retention-gap" };
        if (existing.state === "abandoned") return { verdict: "refuse", reason: "abandoned" };
        if (existing.state === "interrupted") return { verdict: "refuse", reason: "interrupted" };
        if (existing.inputDigest !== inputDigest) return { verdict: "refuse", reason: "request-id-reused-with-changed-input" };
        return { verdict: "refuse", reason: "already-committed" };
      }
      await this.record({ requestId, inputDigest, state: "committed", bootEpoch: this.bootEpoch });
      return { verdict: "run" };
    });
  }

  /** The causal EOF-drop: this vessel never read the invocation in time to arbitrate it. A no-op
   *  when a fact already stands (committed, abandoned, or otherwise) — never overwrite a decision
   *  already made. Flushes durably before this returns (the drop itself never answers the caller —
   *  its socket is already gone — but a LATER read-back under the same id must find this fact). */
  async abandonDrop(requestId: string, inputDigest: string): Promise<void> {
    return this.inTurn(async () => {
      const existing = await this.get(requestId);
      if (existing) return;
      await this.record({ requestId, inputDigest, state: "abandoned" });
    });
  }

  /** An explicit `{op:"cancel"}` (M8) — withdraws WITHOUT recording a digest at all (no content
   *  claim to compare, by design — `arbitrate` refuses an `abandoned` fact on its state alone,
   *  never by digest). A no-op once a decision already stands: a cancel racing a dispatch that
   *  already won refuses to un-dispatch it, and a cancel racing a prior cancel/abandon leaves that
   *  fact exactly as it was. */
  async cancel(requestId: string): Promise<void> {
    return this.inTurn(async () => {
      const existing = await this.get(requestId);
      if (existing) return;
      await this.record({ requestId, state: "abandoned" });
    });
  }

  /**
   * Observe a terminal outcome landing (H1R/M1) — this channel's own subscription to the durable
   * outcome prefix calls this for EVERY `done`/`error` outcome it sees, on ANY path (the co-located
   * worker this channel dispatched, or a remote summons this channel never arbitrated at all). A
   * fact already on record is promoted to its terminal state (seq unchanged — observation never
   * mints a new attempt); an outcome with no prior fact at all (the non-UDS path) mints one fresh,
   * seeded with the digest the outcome itself stamped (digest-on-outcome, D1 commit 2 — every
   * outcome this early-alpha vessel ever writes carries one; no legacy data, no shim). A prior fact
   * that reached here with NO digest (the one `cancel`-abandoned shape) borrows the outcome's own
   * digest to promote, if the outcome carries one — a worker that still ran despite the withdrawal
   * is a real content claim, never fabricated. With neither side holding one, this observation is
   * refused by name rather than minting an ill-typed claim.
   */
  async observeOutcome(requestId: string, status: "done" | "error", inputDigest: string | undefined, outcomeBytes: number): Promise<void> {
    return this.inTurn(async () => {
      const existing = await this.get(requestId);
      if (existing === "torn") return; // never write over an unreadable fact — leave it torn, not guessed
      if (existing) {
        if (existing.state === "evicted") return; // already dropped
      // Already recorded, at this verdict and this measure. A body re-written under the same verdict gets
      // measured again, so the tally reads what the store holds.
      if (existing.state === status && existing.outcomeBytes === outcomeBytes) return;
        const digest = existing.inputDigest ?? inputDigest;
        if (digest === undefined) {
          // No digest on the standing fact (the `cancel`-abandoned shape) and none on the outcome
          // either — nothing to promote. Leave the abandoned verdict standing rather than mint an
          // ill-typed claim.
          return;
        }
        const updated: ReceiptFact = {
          requestId, seq: existing.seq, inputDigest: digest, state: status, terminal: status, outcomeBytes,
          ...(existing.effectKey !== undefined && { effectKey: existing.effectKey }),
          ...("bootEpoch" in existing && existing.bootEpoch !== undefined && { bootEpoch: existing.bootEpoch }),
        };
        await this.composite.put(buildReceiptFact(updated), { kind: "lares-verb", requestId });
        await this.repo.flush();
        this.cache.set(requestId, updated);
        this.hold(updated);
        await this.tend(requestId);
        return;
      }
      if (inputDigest === undefined) {
        // No prior fact and the outcome itself carries no digest to mint one from — this early-alpha
        // vessel never writes a done/error outcome without one, so a gap here reads as torn, not as
        // "unverifiable"; refuse the mint by name rather than fabricate a claim.
        return;
      }
      await this.record({ requestId, state: status, terminal: status, inputDigest, outcomeBytes });
    });
  }

  /** Drop one fact to `evicted` — keep its digest, effect key and terminal (a dedup/replay reader still needs
   *  those), tombstone the full durable outcome body, and take its weight out of the tally. A victim that never
   *  named a digest (the id a person cancelled before any request reached this vessel) leaves the same way and
   *  names none evicted: every fact past the ring reads `evicted`, whatever it read before. Answers whether it
   *  wrote. */
  private async evict(victimId: string): Promise<boolean> {
    const victim = this.cache.get(victimId);
    if (!victim || victim.state === "evicted") return false;
    const evicted: ReceiptFact = {
      requestId: victim.requestId, state: "evicted", seq: victim.seq,
      ...(victim.inputDigest !== undefined && { inputDigest: victim.inputDigest }),
      ...(victim.effectKey !== undefined && { effectKey: victim.effectKey }),
      ...(victim.terminal  !== undefined && { terminal:  victim.terminal }),
    };
    // THE BODY LEAVES FIRST, THEN THE FACT SAYS SO. A stop between the two leaves a landed fact with no body: its
    // receipt still answers its verdict, its weight still counts, and the next pass that reaches it finishes
    // the eviction. The other order would leave a body no fact answers for, outside every bound.
    const outcomeTitle = `${OUTCOME_URI_PREFIX}${victimId}`;
    for (const bagId of await this.composite.listBagsHolding(outcomeTitle)) {
      await this.composite.tombstoneInBag(bagId, outcomeTitle, { kind: "lares-verb", requestId: victimId });
    }
    await this.composite.put(buildReceiptFact(evicted), { kind: "lares-verb", requestId: victimId });
    this.release(victimId);
    this.cache.set(victimId, evicted);
    return true;
  }

  /**
   * Hold both bounds. COUNT: past `ring` tracked requests, the OLDEST (lowest `seq`) leaves the ring, so the
   * ring bounds storage and never lookups alone. BYTES: while the kept bodies weigh more than `ringBytes`, the
   * oldest kept body leaves. `justLanded` names the request whose fact this call follows: its body stays
   * through this pass, since its caller reads the outcome it just wrote.
   */
  private async evictIfNeeded(justLanded?: string): Promise<void> {
    let evictedAny = false;
    while (this.order.length > this.ring) {
      // The victim leaves the ring once its eviction ran whole: one that failed midway stays at the head, and
      // the next pass takes it up again.
      const victimId = this.order[0]!;
      if (await this.evict(victimId)) evictedAny = true;
      this.order.shift();
    }
    while (this.heldBytes > this.ringBytes) {
      const victimId = this.bodied.find((id) => id !== justLanded);
      if (victimId === undefined) break;
      if (await this.evict(victimId)) evictedAny = true;
      this.release(victimId);   // evicted or not, the victim left the queue: the pass ends
    }
    if (evictedAny) await this.repo.flush();
  }
}

/** The invocation's own content — what an honest reused id must match to re-read instead of re-run.
 *  The worker's own formula ({@link verbInputDigest}, mesh), so a request-id reuse compares against
 *  EXACTLY the digest the dispatcher itself would stamp onto the outcome — never a second, locally
 *  invented hash that could drift from it. */
function inputDigestOf(inv: Pick<Invocation, "verb" | "args" | "requestedBy" | "effectKey">): Promise<string> {
  return verbInputDigest({
    verb: inv.verb, args: inv.args ?? {}, requestedBy: inv.requestedBy,
    ...(inv.effectKey !== undefined && { effectKey: inv.effectKey }),
  });
}

export interface UdsChannel { close: () => void; }

/** One composition's seat on the verb socket: the ledger, the outcome reads and the dispatch bound to its daemon. */
export interface UdsSeat {
  readonly handle: (parsed: unknown, sock: Socket) => void;
  /**
   * Leave the socket. Resolves once every frame this seat was handed has its answer written (or its caller gone),
   * so the composition beneath it tears down under no request still reading its ledger or awaiting its worker.
   */
  readonly close: () => void | Promise<void>;
}

/** The floor's hold on the verb socket: it serves the claim once and outlives every composition. */
export interface UdsFront {
  /** Seat a composition; held callers are handed over in arrival order without another seat reading them first. */
  readonly attach: (seat: UdsSeat) => void;
  /**
   * Unseat it. New callers remain held until the next attach. Resolves once the seat's own `close` settles: every
   * frame already handed to it has answered, so nothing of the retiring composition still serves a caller.
   */
  readonly detach: () => Promise<void>;
  /** Refuse every caller and stop serving. */
  readonly close: () => void;
}

export function serveUdsFront(a: {
  readonly claim: StoreClaim & { readonly holder: "vessel" };
  readonly onLog?: (line: string) => void;
  readonly onFrame?: (parsed: unknown, sock: Socket) => boolean;
  readonly holdLimit?: number;
}): UdsFront {
  type Held = { parsed: unknown; sock: Socket; onClose: () => void };
  const held: Held[] = [];
  let seat: UdsSeat | null = null;
  let stopped = false;
  const refusal = (sock: Socket) => {
    try { sock.end(JSON.stringify({ status: "error", errorMessage: "the vessel recomposes — run again", refusal: { reason: "recomposing" } }) + "\n"); } catch { /* gone */ }
  };
  const hand = (parsed: unknown, sock: Socket): void => {
    if (stopped) return refusal(sock);
    if (a.onFrame?.(parsed, sock)) return;
    if (seat) return seat.handle(parsed, sock);
    const entry: Held = { parsed, sock, onClose: () => {
      const i = held.indexOf(entry);
      if (i !== -1) held.splice(i, 1);
    } };
    sock.once("close", entry.onClose);
    held.push(entry);
    if (held.length > (a.holdLimit ?? PARK_LIMIT)) {
      const oldest = held.shift()!;
      oldest.sock.off("close", oldest.onClose);
      refusal(oldest.sock);
    }
  };
  a.claim.serve((sock: Socket) => {
    let buf = "";
    let read = true;
    sock.setEncoding("utf8");
    sock.on("data", (chunk: string) => {
      if (!read) return;
      buf += chunk;
      const nl = buf.indexOf("\n");
      if (nl === -1) return;
      read = false;
      let parsed: unknown;
      try { parsed = JSON.parse(buf.slice(0, nl)); }
      catch { try { sock.end(JSON.stringify({ status: "error", errorMessage: "bad invocation json" }) + "\n"); } catch { /* gone */ } return; }
      hand(parsed, sock);
    });
  });
  a.onLog?.(`uds verb-channel on ${a.claim.socketPath} (perms 0600)`);
  return {
    attach: (next) => {
      if (stopped) throw new Error("UDS front is closed");
      if (seat) throw new Error("UDS front already has a seat");
      seat = next;
      for (const entry of held.splice(0)) {
        entry.sock.off("close", entry.onClose);
        if (!entry.sock.destroyed) next.handle(entry.parsed, entry.sock);
      }
    },
    detach: async () => {
      const old = seat;
      seat = null;
      await old?.close();
    },
    close: () => {
      if (stopped) return;
      stopped = true;
      void seat?.close();
      seat = null;
      for (const entry of held.splice(0)) {
        entry.sock.off("close", entry.onClose);
        refusal(entry.sock);
      }
      a.claim.refuse(`the vessel (pid ${process.pid}) on this store stops — run again once it has gone`);
    },
  };
}

export function makeUdsSeat(opts: UdsChannelOptions): UdsSeat {
  const { daemonHandle, claim } = opts;
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const log = opts.onLog ?? (() => { /* quiet */ });

  // Outcomes remain in the explicit daemon bag; bagless receipt facts use the attached working layer.
  const composite = opts.composite;
  if (composite.defaultWritableBagId() !== wikiSlotUri("daemon", "working")) {
    throw new NoWorkingLayerRefusal("Opening the UDS channel", "Mount the daemon working slot (wikis/daemon/working) as the default writable first.");
  }

  // The DURABLE arbitration ledger (D1, H1R+H4+M1+M3″) — one winner per request id, backed by the
  // receipt-fact tiddler this channel alone writes; a restart reads the SAME fact a prior process
  // wrote, closing H1R (a same-id reuse re-running after restart) and H4 (a cancelled id's
  // abandonment not surviving one).
  const ledger = new FactLedger(composite, opts.repo, opts.ring ?? RECEIPT_RING_DEFAULT, claim.bootEpoch, opts.ringBytes ?? RECEIPT_RING_BYTES_DEFAULT, log);

  const readOutcomeFor = async (requestId: string): Promise<Record<string, unknown> | null> => {
    const event = await composite.get(`${OUTCOME_URI_PREFIX}${requestId}`);
    if (!event || event.meta?.deleted) return null;
    const fields = event.tiddler as Record<string, string>;
    const status = fields["status"];
    if (status !== "done" && status !== "error") return null;
    let results: unknown;
    if (typeof fields["results"] === "string" && fields["results"].length > 0) {
      try { results = JSON.parse(fields["results"]); } catch { /* malformed — leave */ }
    }
    return {
      status, requestId,
      ...(results !== undefined ? { results } : {}),
      ...(fields["error-message"] !== undefined ? { errorMessage: fields["error-message"] } : {}),
      // D1 commit 1 (mesh)'s additive `concludeVerb({refusal})` — a terminal outcome's own
      // machine-readable reason (e.g. "retention-gap", stamped by the tw5 dispatcher's
      // evicted-effect guard), told back in the SAME additive shape the socket's own direct
      // refusals already use (`fail()` below), never as a second, differently-shaped field.
      ...(typeof fields["refusal"] === "string" ? { refusal: { reason: fields["refusal"] } } : {}),
      // D1 effect-dedup (P2.5 iter 6, G2): the worker's own `concludeVerb({effectOf})` names the
      // PRIOR requestId whose effect this outcome answers under a fresh attempt — surfaced here so
      // every reader of a terminal outcome (a fresh dispatch's own await, OR a legitimate
      // concurrent re-read of an id this process already committed) can tell a dedup answer from a
      // verb this attempt actually ran.
      ...(typeof fields["effect-of"] === "string" ? { effectOf: fields["effect-of"] } : {}),
    };
  };

  /** Await the durable outcome for `requestId` — NEVER places a verb. Shared by a fresh dispatch's
   *  own wait and by a legitimate concurrent re-read of an id this process already committed. */
  const awaitOutcome = async (verb: string, requestId: string, askedTimeoutMs?: number): Promise<Record<string, unknown>> => {
    return await new Promise<Record<string, unknown>>((resolve, reject) => {
      let settled = false;
      // MONOTONIC, NEVER Date.now(): an elapsed-duration measurement that fed the adaptive servo from a
      // wall-clock epoch read could be dragged by an NTP step or a manual clock set mid-run — the law
      // binds even a local, liveness-only measurement to a monotonic source (`performance.now()`), not
      // only a cross-process safety gate.
      const t0 = performance.now();
      const settle = (fn: () => void) => { if (!settled) { settled = true; cleanup(); fn(); } };
      // Only a COMPLETION teaches the servo (a timeout/hang never records → can't drag the EWMA to CEIL).
      const check = () => { void readOutcomeFor(requestId).then((r) => { if (r) settle(() => { recordMineDuration(verb, performance.now() - t0); resolve(r); }); }); };
      const onChange = () => check();
      daemonHandle.on("change", onChange);
      // Fail on a GRADIENT: the wait grows with this verb's learned durations (EWMA·K, clamped
      // FLOOR..CEIL) — headroom for an honest long verb, while a real hang still dies within CEIL.
      // The INVOCATION's own ask raises it within that bound: the servo cannot learn that a first
      // bulk pass runs long until one completes, so a caller that knows must be able to say so.
      //
      // THIS TIMER IS THIS SIDE'S OWN LOCAL LIVENESS, NEVER A VERDICT ON THE ACT (M2). The caller
      // already committed the dispatch (past the causal EOF check AND the ledger's own arbitrate);
      // a verb still running when this wait ends keeps running regardless, and its outcome still
      // lands for a later read — by a fresh connection's own wait, or a `{op:"receipt"}` query. So
      // this rejects with {@link VesselWaitExpired}, NEVER a bare `Error` the connection handler
      // would otherwise retell as `{status:"error"}` — this side's own impatience is not the act's verdict.
      const budget = verbBudgetMs({
        ...(typeof askedTimeoutMs === "number" ? { asked: askedTimeoutMs } : {}),
        adaptive: adaptiveTimeoutMs(verb),
        floor: timeoutMs,
      });
      const timer = setTimeout(() => settle(() => reject(new VesselWaitExpired(verb, requestId, budget))), budget);
      const cleanup = () => { daemonHandle.off("change", onChange); clearTimeout(timer); };
      check(); // the outcome may already exist (idempotent re-submission)
    });
  };

  // Hand the invocation (verb + args CONTENT) to the daemon worker over the DIRECT
  // MessageChannel (placeVerb → the worker's volatile invocation), then await the
  // durable outcome via the daemon doc's own change event. The carriers NEVER enter
  // The daemon's Automerge doc — only the worker-written outcome (bags/daemon/outcomes/<id>)
  // lands there. A co-located CLI shares the worker's process, so the CRDT summons
  // (the remote-peer transport) would be a pointless content-bloating round-trip.
  const runVerb = async (inv: Invocation, requestId: string): Promise<Record<string, unknown>> => {
    opts.placeVerb({
      verb:        inv.verb,
      args:        inv.args ?? {},
      requestedBy: inv.requestedBy,
      requestId,
      ...(inv.effectKey !== undefined && { effectKey: inv.effectKey }),
    });
    return awaitOutcome(inv.verb, requestId, inv.timeoutMs);
  };

  /** Answer a `{op:"receipt"}` query (H1, now durable) — a READ, built from the fact ledger plus
   *  the durable outcome doc; NEVER calls `placeVerb`. The outcome doc wins over a bare `committed`
   *  fact (still running, or an outcome this fact hasn't yet observed) and over an `abandoned` one
   *  (a record that landed on another road) — never over `evicted`, whose record the ring dropped. */
  const answerReceipt = async (requestId: string): Promise<ReceiptAnswer> => {
    const fact = await ledger.get(requestId);
    if (fact === "torn") {
      return {
        requestId, state: "error",
        errorMessage: `this vessel's receipt for request ${requestId} is unreadable — mint a fresh request id`,
        refusal: { reason: "receipt-fact-torn" },
      };
    }
    if (fact && fact.state === "evicted") return { requestId, state: "evicted" };
    // AN OUTCOME THAT STANDS ANSWERS, even under an `abandoned` fact: a summons under an id this channel refused
    // may have run on its own road, and a record that landed says so whether or not the fact caught up with it.
    const outcome = await readOutcomeFor(requestId);
    if (outcome) {
      const status = outcome["status"] as "done" | "error";
      return {
        requestId, state: status,
        ...(outcome["results"] !== undefined ? { results: outcome["results"] as Record<string, unknown> } : {}),
        ...(outcome["errorMessage"] !== undefined ? { errorMessage: outcome["errorMessage"] as string } : {}),
        ...(outcome["refusal"] !== undefined ? { refusal: outcome["refusal"] as { reason: string } } : {}),
      };
    }
    if (fact?.state === "abandoned") return { requestId, state: "abandoned" };
    if (fact?.terminal) return { requestId, state: fact.terminal }; // the fact reached done/error but the outcome body itself is unreadable right now
    if (fact?.state === "interrupted") return { requestId, state: "interrupted" };
    return { requestId, state: fact?.state === "committed" ? "committed" : "unknown" };
  };

  // Observe every terminal outcome landing in the durable doc, on ANY path (D1, H1R+M1). The
  // single-writer fact ledger promotes/mints the matching fact here — never inside the worker,
  // never inside `arbitrate` itself — so a remote peer's summons-dispatched verb (one this channel
  // never arbitrated) still leaves a fact this vessel can answer `{op:"receipt"}` against.
  const unsubOutcomes = composite.subscribe((change) => {
    if (!change.record || !change.title.startsWith(OUTCOME_URI_PREFIX)) return;
    // A tombstoned outcome still carries the fields it held; a retraction observes no outcome.
    if (change.record.meta?.deleted) return;
    const requestId = change.title.slice(OUTCOME_URI_PREFIX.length);
    const fields = change.record.tiddler as Record<string, unknown>;
    const status = fields["status"];
    if (status !== "done" && status !== "error") return;
    const inputDigest = typeof fields["input-digest"] === "string" ? fields["input-digest"] : undefined;
    void Promise.resolve().then(() => ledger.observeOutcome(requestId, status, inputDigest, outcomeBytesOf(fields))).catch(
      (e) => log(`receipt-fact observation failed for ${requestId}: ${e instanceof Error ? e.message : String(e)}`),
    );
  });

  // EVERY FRAME THIS SEAT HOLDS, until its answer leaves or its caller goes. A seat that closes waits these out:
  // a request mid-arbitration or mid-wait finishes against the ledger and worker it started on.
  // `arbitrating` counts the frames still inside their own digest / ledger turn, so a caller that hangs up early
  // never lets the seat read as drained while its abandonment still writes.
  const inFlight = new Set<Socket>();
  let arbitrating = 0;
  let drained: (() => void) | null = null;
  const idle = (): boolean => inFlight.size === 0 && arbitrating === 0;
  const settleOne = (sock: Socket): void => {
    if (inFlight.delete(sock) && idle()) drained?.();
  };
  const handle = (parsed: unknown, sock: Socket): void => {
    inFlight.add(sock);
    sock.once("finish", () => settleOne(sock));   // this side wrote its answer
    sock.once("close",  () => settleOne(sock));   // or the caller went away
    if (sock.destroyed || sock.writableFinished) settleOne(sock);
    const fail = (msg: string, reason?: string) => {
      try { sock.end(JSON.stringify({ status: "error", errorMessage: msg, ...(reason !== undefined && { refusal: { reason } }) }) + "\n"); } catch { /* gone */ }
    };
    const answerUnknown = (requestId: string) => { try { sock.end(JSON.stringify({ status: "unknown", requestId }) + "\n"); } catch { /* gone */ } };
      // READ-ONLY QUERIES NEVER REACH `placeVerb` (H1 fix item 3).
      // BOTH DOORS BELOW COUNT AS WORK THE SEAT WAITS OUT: a caller that hangs up while its cancel still writes, or
      // while its read still holds the ledger, never lets the seat read as drained under them.
      const tended = (work: Promise<void>): void => {
        arbitrating += 1;
        void work.finally(() => { arbitrating -= 1; if (idle()) drained?.(); });
      };
      if (isReceiptQuery(parsed)) {
        tended(answerReceipt(parsed.requestId).then(
          (answer) => { try { sock.end(JSON.stringify(answer) + "\n"); } catch { /* gone */ } },
          (err)    => fail(err instanceof Error ? err.message : String(err)),
        ));
        return;
      }
      if (isCancelQuery(parsed)) {
        // Durable (M8, D1): the abandonment fact flushes BEFORE this channel answers, so a later
        // read-back under the same id — even after a restart — meets the withdrawal, never a fresh
        // "never seen" that would invite a second dispatch to run it after all.
        //
        // THE ANSWER CARRIES THE VESSEL'S OUTCOME, NEVER THE CALLER'S ABANDONMENT RETOLD
        // (lar:///ha.ka.ba/lararium/mesh/receipt-ledger#/three-receipts). The cancel line already states that its
        // caller withdrew. What it asks back: the verdict this vessel holds for the id after the cancel took its
        // turn. A cancel that met no fact reads `abandoned`; one that met a commit reads what the vessel holds for
        // that act, which runs on.
        tended(ledger.cancel(parsed.requestId).then(() => answerReceipt(parsed.requestId)).then(
          (answer) => { try { sock.end(JSON.stringify(answer) + "\n"); } catch { /* gone */ } },
          (err) => fail(err instanceof Error ? err.message : String(err)),
        ));
        return;
      }

      const inv = parsed as Invocation;
      if (!inv.verb || !inv.requestedBy) return fail("verb + requestedBy required");
      const requestId = inv.requestId ?? newRequestId();
      // H1′: DEFER DISPATCH, NOT SYNCHRONOUSLY. A vessel frozen between the caller's write and this
      // read can thaw well after the caller gave up and destroyed its own end — its FIN/RST sits
      // queued right behind this very `data` event, undelivered only because this process could not
      // run at all. A dispatch made SYNCHRONOUSLY inside this handler runs the verb before that
      // notification ever gets its own turn. ONE `setImmediate` is not enough: `data` and the
      // underlying EOF can land in two separate libuv poll passes (the data chunk resolves this read,
      // the FIN surfaces only on the NEXT one) — measured live, a single deferred tick still saw
      // `readableEnded: false` for an already-half-closed peer. Nesting a second `setImmediate` lets
      // that extra poll pass run first. A live caller never half-closes before its own answer, so an
      // end seen here always means abandonment.
      arbitrating += 1;
      setImmediate(() => setImmediate(() => { void (async () => {
        // The worker's own digest formula (`verbInputDigest`, mesh) — async, so computed inside
        // this deferred tick rather than synchronously in the `data` handler above.
        const inputDigest = await inputDigestOf(inv);
        if (sock.destroyed || sock.readableEnded) {
          // H1, now DURABLE: this id is recorded ABANDONED (flushed) before this vessel lets go of
          // the connection, so a LATER connection carrying the SAME request id (a read-back, a
          // retry) — even across a restart — meets the ledger's refusal instead of a bare "never
          // seen" that a second dispatch would then run unannounced.
          await ledger.abandonDrop(requestId, inputDigest);
          log(`dropped a hung-up "${inv.verb}" invocation (request ${requestId}) — the caller's own socket had already ended before this vessel could read it; refusing rather than running it unannounced, and recording the refusal durably so a later read-back under the same id cannot re-dispatch it`);
          return;
        }
        // THE WINNER AT THE INSTANT OF GIVING UP: this causal EOF check, plus the ledger's own
        // arbitrate just below, are the ONLY abandonment this vessel arbitrates before dispatch — no
        // wall-clock deadline competes with either. Past a "run" verdict the act COMMITS: `runVerb`
        // calls `placeVerb` unconditionally, and nothing after this line may un-dispatch it. A
        // caller's own later-expiring local wait (`local-connector.ts`'s `LocalWaitExpired`) never
        // reaches back here to cancel; it only stops ITS OWN wait and reads the receipt back later,
        // by the same request id, through `{op:"receipt"}` — never through a second dispatch attempt.
        // `arbitrate` itself writes the `committed` fact and FLUSHES before returning "run" — the
        // durability floor sits BEFORE `runVerb`/`placeVerb` below, never after.
        const verdict = await ledger.arbitrate(requestId, inputDigest);
        if (verdict.verdict === "refuse" && verdict.reason === "already-committed") {
          // A genuine concurrent re-read of an id THIS process already dispatched OR a same-digest
          // dispatch attempt reaching a fact a PRIOR process already drove to `done`/`error` (H1R,
          // across a restart) — answer the existing outcome, never a second `placeVerb`.
          awaitOutcome(inv.verb, requestId, inv.timeoutMs).then(
            (outcome) => { try { sock.end(JSON.stringify(outcome) + "\n"); } catch { /* gone */ } },
            (err)     => { if (err instanceof VesselWaitExpired) return answerUnknown(requestId); fail(err instanceof Error ? err.message : String(err)); },
          );
          return;
        }
        if (verdict.verdict === "refuse") {
          const why = verdict.reason === "abandoned"
            ? `this vessel already refused request ${requestId} before commit — mint a fresh request id`
            : verdict.reason === "interrupted"
            ? `this vessel stopped while request ${requestId} ran — it may have landed in part; mint a fresh request id`
            : verdict.reason === "retention-gap"
            ? `this vessel's receipt ring evicted request ${requestId} before it could be re-read — mint a fresh request id`
            : verdict.reason === "receipt-fact-torn"
            ? `this vessel's receipt for request ${requestId} is unreadable — mint a fresh request id`
            : `request ${requestId} was already used with different arguments — mint a fresh request id`;
          return fail(why, verdict.reason);
        }
        runVerb(inv, requestId).then(
          (outcome) => { try { sock.end(JSON.stringify(outcome) + "\n"); } catch { /* gone */ } },
          (err) => {
            if (err instanceof VesselWaitExpired) return answerUnknown(requestId); // M2: never told as {status:"error"}
            fail(err instanceof Error ? err.message : String(err));
          },
        );
      })().finally(() => { arbitrating -= 1; if (idle()) drained?.(); }); }));
  };

  return {
    handle,
    close: async () => {
      if (!idle()) await new Promise<void>((resolve) => { drained = resolve; });
      unsubOutcomes();
    },
  };
}

export function startUdsChannel(opts: UdsChannelOptions): UdsChannel {
  const front = serveUdsFront({ claim: opts.claim, ...(opts.onLog ? { onLog: opts.onLog } : {}) });
  front.attach(makeUdsSeat(opts));
  return { close: () => front.close() };
}
