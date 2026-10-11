/**
 * uds-channel — the co-located fast path of the lares↔lararium binding.
 *
 * The daemon already holds the WARM daemon replica and the worker VerbDispatcher.
 * A co-located `lares` CLI never needed its own leaf replica + sync-on-connect (the
 * ~3s/command tax) — it only needs to hand the daemon a capability-bearing
 * invocation and await the receipt. This Unix-domain socket carries exactly that:
 * the CLI writes one invocation line, the daemon writes the summons into its warm
 * daemon doc (the SAME tiddler the worker reacts to from a WS peer), awaits the
 * durable bags/daemon/outcomes/<id> receipt, and returns it over the socket.
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

import type { Socket } from "node:net";
import type { DocHandle, Repo } from "@automerge/automerge-repo";
import {
  DAEMON_BAG_ID, AutomergeDocStore, CompositeStore,
  newRequestId, OUTCOME_URI_PREFIX, type LarDoc,
  RECEIPT_FACT_URI_PREFIX, RECEIPT_RING_DEFAULT, buildReceiptFact, parseReceiptFact,
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
  /**
   * The DIRECT worker channel (result.daemon.placeVerb) — posts the invocation
   * (verb + `args` CONTENT) straight to the daemon worker over the MessageChannel,
   * so the carriers reach the dispatcher WITHOUT riding the daemon Automerge doc.
   * The worker still writes the durable outcome to `bags/daemon/outcomes/<id>`, which
   * this channel awaits via `daemonHandle`.
   */
  readonly placeVerb: (o: { verb: string; args: Record<string, unknown>; requestedBy: string; requestId: string; effectKey?: string }) => void;
  /** The vessel's claim on its store — the rendezvous socket (`/tmp/lares-<uid>/<digest>.sock`) both sides derive. */
  readonly claim: StoreClaim;
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
/** An explicit withdrawal — `{op:"cancel", requestId}` (M8). Marks the id abandoned so a later
 *  dispatch attempt under the SAME id (a read-back, a retry) refuses rather than running. */
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
   * `committed`  — dispatched, no durable outcome has landed yet (still running, or lost to a
   *                restart before it could write one — indistinguishable from here; re-query).
   * `done`/`error` — the durable outcome, read back exactly as `runVerb` would have returned it.
   * `evicted`    — the receipt ring (D1) dropped this id's full outcome past its retention bound;
   *                its fact survives (digest, effect key, terminal) but the result body is gone.
   * `unknown`    — this vessel never arbitrated this id (a fresh process since dispatch, no
   *                durable outcome either) — the honest "no idea", never told as `error`.
   */
  readonly state: "abandoned" | "committed" | "done" | "error" | "evicted" | "unknown";
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
 * A restart loses NOTHING: the fact backing this ledger lives in the Automerge-backed daemon bag
 * (`RECEIPT_FACT_URI_PREFIX<requestId>`), read through an in-memory cache that is seeded from the
 * store on first use and kept warm by every write this process makes. H1R's proven bug — a
 * same-id, same-args reuse re-running after a restart, and a cancelled id's abandonment not
 * surviving one — closes because the fact this ledger reads back IS the fact a prior process wrote,
 * never a process-local Map that a restart wiped.
 *
 * The ring (M1): past `ring` tracked requests (any state, oldest `seq` first), the ledger evicts —
 * flips the fact to `evicted` (keeping digest, effect key, terminal) and tombstones the full durable
 * outcome. An evicted id answers `retention-gap`, never a silent re-run and never a bare "unknown"
 * that would invite one.
 */
class FactLedger {
  private readonly cache = new Map<string, ReceiptFact>();
  /** requestIds this ledger has read as TORN — a tiddler under {@link RECEIPT_FACT_URI_PREFIX} that
   *  {@link parseReceiptFact} rejects (an unreadable shape, never "never seen"). Distinct from
   *  absent: `get()` answers `"torn"` for these, never `null`, so a caller cannot mistake an
   *  unreadable record for a fresh id. */
  private readonly torn = new Set<string>();
  /** requestIds in ascending `seq` order — the eviction queue. Seeded from the store at first use,
   *  then kept current by every `record()` this process makes. */
  private readonly order: string[] = [];
  private nextSeq = 0;
  private seeded: Promise<void> | null = null;

  constructor(
    private readonly composite: CompositeStore,
    private readonly repo: Pick<Repo, "flush">,
    private readonly ring: number,
  ) {}

  private static factTitle(requestId: string): string {
    return `${RECEIPT_FACT_URI_PREFIX}${requestId}`;
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
      const titles = await this.composite.listVisible();
      const facts: ReceiptFact[] = [];
      let maxRawSeq = -1;
      for (const title of titles) {
        if (!title.startsWith(RECEIPT_FACT_URI_PREFIX)) continue;
        const rec = await this.composite.get(title);
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
      for (const fact of facts) { this.cache.set(fact.requestId, fact); this.order.push(fact.requestId); }
      this.nextSeq = maxRawSeq + 1;
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
    const rec = await this.composite.get(FactLedger.factTitle(requestId));
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
    await this.evictIfNeeded();
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
      | { readonly verdict: "refuse"; readonly reason: "abandoned" | "already-committed" | "request-id-reused-with-changed-input" | "retention-gap" | "receipt-fact-torn" }> {
    const existing = await this.get(requestId);
    if (existing === "torn") return { verdict: "refuse", reason: "receipt-fact-torn" };
    if (existing) {
      if (existing.state === "evicted") return { verdict: "refuse", reason: "retention-gap" };
      if (existing.state === "abandoned") return { verdict: "refuse", reason: "abandoned" };
      if (existing.inputDigest !== inputDigest) return { verdict: "refuse", reason: "request-id-reused-with-changed-input" };
      return { verdict: "refuse", reason: "already-committed" };
    }
    await this.record({ requestId, inputDigest, state: "committed" });
    return { verdict: "run" };
  }

  /** The causal EOF-drop: this vessel never read the invocation in time to arbitrate it. A no-op
   *  when a fact already stands (committed, abandoned, or otherwise) — never overwrite a decision
   *  already made. Flushes durably before this returns (the drop itself never answers the caller —
   *  its socket is already gone — but a LATER read-back under the same id must find this fact). */
  async abandonDrop(requestId: string, inputDigest: string): Promise<void> {
    const existing = await this.get(requestId);
    if (existing) return;
    await this.record({ requestId, inputDigest, state: "abandoned" });
  }

  /** An explicit `{op:"cancel"}` (M8) — withdraws WITHOUT recording a digest at all (no content
   *  claim to compare, by design — `arbitrate` refuses an `abandoned` fact on its state alone,
   *  never by digest). A no-op once a decision already stands: a cancel racing a dispatch that
   *  already won refuses to un-dispatch it, and a cancel racing a prior cancel/abandon leaves that
   *  fact exactly as it was. */
  async cancel(requestId: string): Promise<void> {
    const existing = await this.get(requestId);
    if (existing) return;
    await this.record({ requestId, state: "abandoned" });
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
  async observeOutcome(requestId: string, status: "done" | "error", inputDigest: string | undefined): Promise<void> {
    const existing = await this.get(requestId);
    if (existing === "torn") return; // never write over an unreadable fact — leave it torn, not guessed
    if (existing) {
      if (existing.terminal === status || existing.state === "evicted") return; // already recorded / already dropped
      const digest = existing.inputDigest ?? inputDigest;
      if (digest === undefined) {
        // No digest on the standing fact (the `cancel`-abandoned shape) and none on the outcome
        // either — nothing to promote. Leave the abandoned verdict standing rather than mint an
        // ill-typed claim.
        return;
      }
      const updated: ReceiptFact = { ...existing, inputDigest: digest, state: status, terminal: status };
      await this.composite.put(buildReceiptFact(updated), { kind: "lares-verb", requestId });
      await this.repo.flush();
      this.cache.set(requestId, updated);
      return;
    }
    if (inputDigest === undefined) {
      // No prior fact and the outcome itself carries no digest to mint one from — this early-alpha
      // vessel never writes a done/error outcome without one, so a gap here reads as torn, not as
      // "unverifiable"; refuse the mint by name rather than fabricate a claim.
      return;
    }
    await this.record({ requestId, state: status, terminal: status, inputDigest });
  }

  /** Past `ring` tracked requests, drop the OLDEST (lowest `seq`) to `evicted` — keep its digest,
   *  effect key and terminal (a dedup/replay reader still needs those), but tombstone the full
   *  durable outcome body so the ring actually bounds storage, not just lookups. `evicted` is a
   *  digest-REQUIRED state (it names a claim this ledger arbitrated or observed) — a victim that
   *  never arbitrated one (the one `cancel`-abandoned, no-digest shape) carries nothing to tombstone
   *  either, so it drops out of the ring untouched, its `abandoned` verdict left standing. */
  private async evictIfNeeded(): Promise<void> {
    let evictedAny = false;
    while (this.order.length > this.ring) {
      const victimId = this.order.shift();
      if (victimId === undefined) break;
      const victim = this.cache.get(victimId);
      if (!victim || victim.state === "evicted" || victim.inputDigest === undefined) continue;
      const evicted: ReceiptFact = {
        requestId: victim.requestId, state: "evicted", seq: victim.seq, inputDigest: victim.inputDigest,
        ...(victim.effectKey !== undefined && { effectKey: victim.effectKey }),
        ...(victim.terminal  !== undefined && { terminal:  victim.terminal }),
      };
      await this.composite.put(buildReceiptFact(evicted), { kind: "lares-verb", requestId: victimId });
      await this.composite.tombstone(`${OUTCOME_URI_PREFIX}${victimId}`, { kind: "lares-verb", requestId: victimId });
      this.cache.set(victimId, evicted);
      evictedAny = true;
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

export function startUdsChannel(opts: UdsChannelOptions): UdsChannel {
  const { daemonHandle, claim } = opts;
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const log = opts.onLog ?? (() => { /* quiet */ });

  // The composite over the warm daemon handle. It reads the durable outcome tiddler back through
  // it (never writes the summons here; the carriers ride the direct worker channel, off the CRDT) —
  // and it is ALSO the receipt-fact ledger's own writable layer (D1): this channel is the fact's
  // sole writer, so the one composite serves both the read and the write side of the ledger.
  const composite = new CompositeStore();
  composite.addLayer({
    bagId:    DAEMON_BAG_ID,
    store:    new AutomergeDocStore(daemonHandle, DAEMON_BAG_ID),
    writable: true,
  });

  // The DURABLE arbitration ledger (D1, H1R+H4+M1+M3″) — one winner per request id, backed by the
  // receipt-fact tiddler this channel alone writes; a restart reads the SAME fact a prior process
  // wrote, closing H1R (a same-id reuse re-running after restart) and H4 (a cancelled id's
  // abandonment not surviving one).
  const ledger = new FactLedger(composite, opts.repo, opts.ring ?? RECEIPT_RING_DEFAULT);

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
   *  fact (still running, or an outcome this fact hasn't yet observed) — never over `abandoned` or
   *  `evicted`, which are this ledger's own terminal verdicts. */
  const answerReceipt = async (requestId: string): Promise<ReceiptAnswer> => {
    const fact = await ledger.get(requestId);
    if (fact === "torn") {
      return {
        requestId, state: "error",
        errorMessage: `this vessel's receipt for request ${requestId} is unreadable — mint a fresh request id`,
        refusal: { reason: "receipt-fact-torn" },
      };
    }
    if (fact) {
      if (fact.state === "abandoned") return { requestId, state: "abandoned" };
      if (fact.state === "evicted")   return { requestId, state: "evicted" };
    }
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
    if (fact?.terminal) return { requestId, state: fact.terminal }; // the fact reached done/error but the outcome body itself is unreadable right now
    return { requestId, state: fact?.state === "committed" ? "committed" : "unknown" };
  };

  // Observe every terminal outcome landing in the durable doc, on ANY path (D1, H1R+M1). The
  // single-writer fact ledger promotes/mints the matching fact here — never inside the worker,
  // never inside `arbitrate` itself — so a remote peer's summons-dispatched verb (one this channel
  // never arbitrated) still leaves a fact this vessel can answer `{op:"receipt"}` against.
  const unsubOutcomes = composite.subscribe((change) => {
    if (!change.record || !change.title.startsWith(OUTCOME_URI_PREFIX)) return;
    const requestId = change.title.slice(OUTCOME_URI_PREFIX.length);
    const fields = change.record.tiddler as Record<string, unknown>;
    const status = fields["status"];
    if (status !== "done" && status !== "error") return;
    const inputDigest = typeof fields["input-digest"] === "string" ? fields["input-digest"] : undefined;
    void ledger.observeOutcome(requestId, status, inputDigest).catch(
      (e) => log(`receipt-fact observation failed for ${requestId}: ${e instanceof Error ? e.message : String(e)}`),
    );
  });

  claim.serve((sock: Socket) => {
    let buf = "";
    sock.setEncoding("utf8");
    const fail = (msg: string, reason?: string) => {
      try { sock.end(JSON.stringify({ status: "error", errorMessage: msg, ...(reason !== undefined && { refusal: { reason } }) }) + "\n"); } catch { /* gone */ }
    };
    const answerUnknown = (requestId: string) => { try { sock.end(JSON.stringify({ status: "unknown", requestId }) + "\n"); } catch { /* gone */ } };
    sock.on("data", (chunk: string) => {
      buf += chunk;
      const nl = buf.indexOf("\n");
      if (nl === -1) return;          // one invocation per connection, line-delimited
      const line = buf.slice(0, nl);
      buf = "";
      let parsed: unknown;
      try { parsed = JSON.parse(line); } catch { return fail("bad invocation json"); }

      // READ-ONLY QUERIES NEVER REACH `placeVerb` (H1 fix item 3).
      if (isReceiptQuery(parsed)) {
        void answerReceipt(parsed.requestId).then(
          (answer) => { try { sock.end(JSON.stringify(answer) + "\n"); } catch { /* gone */ } },
          (err)    => fail(err instanceof Error ? err.message : String(err)),
        );
        return;
      }
      if (isCancelQuery(parsed)) {
        // Durable (M8, D1): the abandonment fact flushes BEFORE this channel answers, so a later
        // read-back under the same id — even after a restart — meets the withdrawal, never a fresh
        // "never seen" that would invite a second dispatch to run it after all.
        void ledger.cancel(parsed.requestId).then(
          () => { try { sock.end(JSON.stringify({ requestId: parsed.requestId, state: "abandoned" } satisfies ReceiptAnswer) + "\n"); } catch { /* gone */ } },
          (err) => fail(err instanceof Error ? err.message : String(err)),
        );
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
      })(); }));
    });
  }, (why) => log(why));
  log(`uds verb-channel on ${claim.socketPath} (perms 0600)`);

  return {
    close: () => {
      unsubOutcomes();
      claim.refuse(`the vessel (pid ${process.pid}) on this store stops — run again once it has gone`);
    },
  };
}
