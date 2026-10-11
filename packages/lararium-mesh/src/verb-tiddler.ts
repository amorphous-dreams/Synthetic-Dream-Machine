/**
 * verb-tiddler — volatile verb invocation protocol for the daemon causal island.
 *
 * Two-tiddler contract:
 *
 *   verbs/<requestId>     VOLATILE scratch tiddler in lararium.local.vm.
 *                         Lives in the daemon TW5 wiki only. Never synced via
 *                         Automerge. Tombstoned by the dispatcher after the
 *                         outcome lands. Local intent lives here, not shared truth.
 *
 *   bags/daemon/outcomes/<id>  DURABLE outcome tiddler in the Automerge-backed
 *                         daemon bag. Written by the dispatcher on done/error.
 *                         Syncs to all vessels. CRDT convergence here IS the result.
 *                         Shared aftermath lives here.
 *
 * Verb invocation paths:
 *   Local (in-process):   placeVerb() → wiki.addTiddler() → TW5 change event
 *                         → dispatcher runs → outcome to bags/daemon/outcomes/
 *   Remote (CLI/vessels): vessel writes bags/daemon/summons/<id> to Automerge →
 *                         IslandAdaptor flows it into TW5 wiki →
 *                         dispatcher translates to volatile invocation → processes →
 *                         outcome to bags/daemon/outcomes/
 *
 * Batch contract:
 *   One invocation tiddler may carry N targets (tiddler URIs, file paths, edge resource
 *   URIs, or any string the handler interprets). The outcome always carries a
 *   results map. Single-result and atomic verbs use the conventional
 *   "summary" key so all observers read one durable payload grammar.
 *
 * Reaction Engine note (UEFN / kumu):
 *   Each lararium vessel runs its own daemon VM + VerbDispatcher. Invocations are
 *   vessel-local; outcomes sync via CRDT. When the Verse-inspired ReactionEngine
 *   matures, verb invocations become one shape of reaction trigger among many
 *   (event-signal tiddlers, alarm tiddlers, recipe-deltas). VerbReactor signatures
 *   are pure (args, context) → result — already ReactionEngine-compatible.
 *
 * Architecture laws:
 *   - Tiddler-format law: every invocation/outcome is a normal tiddler with lar: URI.
 *   - Web3 law: no HTTP/RPC control plane; verb submission routes through TW5 wiki
 *     events or Automerge sync — never a named server endpoint.
 *   - Causal-island law: each vessel's daemon VM owns its own volatile verb namespace.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/verb-tiddler
 */

import {
  DAEMON_BAG_ID, VOLATILE_VM_PREFIX,
  LARES_VERB_EVENT_TAG, LARES_VERB_TAG,
} from "./lar-uris.js";
import { sha256Hex, canonicalJsonBytes, defaultCryptoProvider, type DigestProvider } from "./crypto.js";
import { formatDigest } from "./agile-digest.js";
import type { LarTiddlerRecord } from "./tiddler-store.js";

// ── URI prefixes ───────────────────────────────────────────────────────────

/** Volatile verb invocation tiddlers — daemon TW5 wiki scratch, never synced. */
export const VERB_URI_PREFIX = `${VOLATILE_VM_PREFIX}verbs/`;

/** Automerge-backed verb summons — remote vessels write here; dispatcher translates
 *  to volatile invocation and tombstones after pickup. */
export const SUMMONS_URI_PREFIX = `${DAEMON_BAG_ID}/summons/`;

/** Durable outcome tiddlers — Automerge-backed, sync to all vessels. */
export const OUTCOME_URI_PREFIX = `${DAEMON_BAG_ID}/outcomes/`;

/** Result map key for single-result (no explicit targets) verbs. */
export const VERB_RESULT_KEY = "summary" as const;

// ── Task / receipt ontology — content-addressed surface ──────────────────────
// The pono attractor: a TASK = a content-addressed invocation
// fact living in a bag; the BAG carries the addressing geometry (its keyhive
// ring); a RECEIPT keys by the task it answers. The live verb/summons/outcome
// path migrates onto this surface per packages/EPIC-TASK-ONTOLOGY.md. Until
// then these compose alongside the running path, not replacing it.

export const TASK_KIND    = "task"    as const;
export const RECEIPT_KIND = "receipt" as const;

/** `lar:///ha.ka.ba/bags/<bag>/task/<cid>` — a content-addressed task (invocation) fact. */
export function taskUri(bagUri: string, contentId: string): string {
  return `${bagUri}/${TASK_KIND}/${contentId}`;
}

/** `lar:///ha.ka.ba/bags/<bag>/receipt/<task-cid>` — the receipt keyed by the task it answers (UCAN `ran`). */
export function receiptUri(bagUri: string, taskContentId: string): string {
  return `${bagUri}/${RECEIPT_KIND}/${taskContentId}`;
}

/**
 * taskContentId — the change-hash content-address of a task's identity tuple
 * `{subject, command, args, nonce}` (UCAN ontology: subject = the bag/resource
 * URI, command = the verb). Empty nonce → idempotent identity; a random nonce →
 * a fresh task. sha256 over canonical JSON — our native content-address; an
 * IPFS-CID projection at the peer boundary stays a later option (C). Async per
 * crypto law (routes through the platform CryptoProvider).
 *
 * The id rides ALGORITHM-TAGGED (`sha256:<hex>`), so a task identity carries its own
 * digest scheme and stays agile. The tag lives WITHIN the final URI path segment
 * (`…/receipt/sha256:<hex>`) — `larRoot` reads only the three-term root, so the deep
 * colon never touches the arity law; the same tuple still yields one deterministic id.
 */
export async function taskContentId(
  parts: { subject: string; command: string; args: Readonly<Record<string, unknown>>; nonce?: string },
  provider: DigestProvider = defaultCryptoProvider,
): Promise<string> {
  const canonical = { subject: parts.subject, command: parts.command, args: parts.args, nonce: parts.nonce ?? "" };
  return formatDigest("sha256", await sha256Hex(canonicalJsonBytes(canonical), provider));
}

// ── Receipt facts — single-writer durable request ledger (D1, P2.5 iter 4) ───
// The channel (uds-channel.ts) is the SOLE writer of a receipt fact: it writes
// `committed` at arbitrate, `abandoned` at EOF-drop/cancel, and `done`/`error`
// when it OBSERVES the outcome land. The worker never writes a fact — only the
// outcome tiddler, which the channel observes. One writer per field, so no two
// processes race a `state` transition.

/** Durable per-request fact tiddlers — `<daemon bag>/receipts/<requestId>`. */
export const RECEIPT_FACT_URI_PREFIX = `${DAEMON_BAG_ID}/receipts/`;

export type ReceiptFactState = "committed" | "abandoned" | "done" | "error" | "evicted";

/** One request's durable fact — the channel's read-through arbitration ledger. */
export interface ReceiptFact {
  readonly requestId:   string;
  readonly inputDigest: string;
  readonly effectKey?:  string;
  readonly state:       ReceiptFactState;
  /** Set once the fact reaches a terminal outcome; survives the `evicted` transition
   *  (eviction keeps digest, effect key and terminal — only the full outcome drops). */
  readonly terminal?:   "done" | "error";
  /** Per-vessel monotonic counter, assigned by the channel at commit/abandon or at
   *  first observation of a non-UDS-path outcome. Never a time (no-global-now). */
  readonly seq:         number;
}

function isReceiptFactState(v: unknown): v is ReceiptFactState {
  return v === "committed" || v === "abandoned" || v === "done" || v === "error" || v === "evicted";
}

/** Build a receipt-fact tiddler record for the channel's single-writer ledger. */
export function buildReceiptFact(fact: ReceiptFact): LarTiddlerRecord {
  const title = `${RECEIPT_FACT_URI_PREFIX}${fact.requestId}`;
  return {
    tiddler: {
      title,
      "request-id":   fact.requestId,
      "input-digest": fact.inputDigest,
      state:          fact.state,
      seq:            String(fact.seq),
      ...(fact.effectKey !== undefined && { "effect-key": fact.effectKey }),
      ...(fact.terminal  !== undefined && { terminal:     fact.terminal }),
    },
    meta: { authority: "lares-daemon-channel" },
  };
}

/** Parse a receipt-fact tiddler field bag. Returns null when the shape doesn't match
 *  (never throws — a torn fact reads as absent, never as a crash). */
export function parseReceiptFact(fields: Record<string, unknown>): ReceiptFact | null {
  const title = typeof fields["title"] === "string" ? fields["title"] : null;
  if (!title || !title.startsWith(RECEIPT_FACT_URI_PREFIX)) return null;

  const requestId   = typeof fields["request-id"]   === "string" ? fields["request-id"]   : null;
  const inputDigest = typeof fields["input-digest"] === "string" ? fields["input-digest"] : null;
  const state       = fields["state"];
  const seqRaw      = fields["seq"];
  const seq = typeof seqRaw === "string" ? Number.parseInt(seqRaw, 10)
            : typeof seqRaw === "number" ? seqRaw
            : NaN;

  if (!requestId || !inputDigest || Number.isNaN(seq) || !isReceiptFactState(state)) return null;

  const effectKey = typeof fields["effect-key"] === "string" ? fields["effect-key"] : undefined;
  const terminalRaw = fields["terminal"];
  const terminal = terminalRaw === "done" || terminalRaw === "error" ? terminalRaw : undefined;

  return {
    requestId, inputDigest, state, seq,
    ...(effectKey !== undefined && { effectKey }),
    ...(terminal  !== undefined && { terminal }),
  };
}

/**
 * The content digest over a verb's identity tuple — shared by the channel (arbitration:
 * same id + changed digest refuses `request-id-reused-with-changed-input`) and the worker
 * (digest-on-outcome: stamped onto the outcome tiddler so a later reader can re-check it
 * without re-walking the fact). Distinct from `taskContentId` (the content-addressed task
 * surface, keyed by {subject,command,args,nonce}) — this digest keys the CURRENT running
 * verb/summons/outcome path's request identity, {verb,args,requestedBy,effectKey}.
 */
export async function verbInputDigest(
  parts: { verb: string; args: Readonly<Record<string, unknown>>; requestedBy: string; effectKey?: string },
  provider: DigestProvider = defaultCryptoProvider,
): Promise<string> {
  const canonical = {
    verb: parts.verb, args: parts.args, requestedBy: parts.requestedBy,
    effectKey: parts.effectKey ?? "",
  };
  return formatDigest("sha256", await sha256Hex(canonicalJsonBytes(canonical), provider));
}

/**
 * The default receipt ring size — DERIVED, never a bare literal: a sustained rate of
 * one verb per minute, kept for a 30-day retention horizon, plus a 256-request burst
 * cushion for traffic above the sustained rate. `ratePerMin(1) × 60 × 24 × horizonDays(30)
 * + burst(256)` = 43,200 + 256 = 43,456 (luna-hearth decision 7's settled default).
 * `main.ts` reads an override from vessel config (`receipts.ring {ratePerMin, horizonDays,
 * burst}`); this constant is the floor when no config is present.
 */
export function ratedReceiptRing(opts?: { ratePerMin?: number; horizonDays?: number; burst?: number }): number {
  const ratePerMin  = opts?.ratePerMin  ?? 1;
  const horizonDays = opts?.horizonDays ?? 30;
  const burst       = opts?.burst       ?? 256;
  return ratePerMin * 60 * 24 * horizonDays + burst;
}

export const RECEIPT_RING_DEFAULT = ratedReceiptRing();

// ── Verb invocation shape ──────────────────────────────────────────────────

export type VerbStatus = "pending" | "running" | "done" | "error";

/**
 * Batch execution mode.
 *   best-effort — each target runs independently; outcome has per-target results.
 *   atomic       — all targets succeed or none; outcome has single ok/error.
 */
export type BatchMode = "best-effort" | "atomic";

/** Parsed verb invocation tiddler. Fields are string-typed (tiddler field law). */
export interface Verb {
  readonly requestId:   string;
  readonly title:       string;
  /** The verb-name — the action to enact. (Wire/tiddler field stays "verb"; parseVerb maps it here, avoiding Verb.verb recursion.) */
  readonly action:      string;
  /** Structured args — deserialized from JSON field. */
  readonly args:        Readonly<Record<string, unknown>>;
  /**
   * Generic target list. Each string is interpreted by the handler:
   *   - tiddler URI:   "lar:///ha.ka.ba/..."
   *   - file path:     "/abs/path/to/file.mem" or "relative/path"
   *   - internet URI:  "https://..."
   *   - any other id the handler understands
   * Empty list = no targets (args-only verb).
   */
  readonly targets:     readonly string[];
  readonly batchMode:   BatchMode;
  readonly status:      VerbStatus;
  readonly requestedBy: string;
  readonly requestedAt: string;
  /** Source device instance URI — Verse `fromUri` (papalohe edge origin). */
  readonly fromUri?:    string;
  /** Verse event name that triggered dispatch — maps to `reaction:listenable` payload.listenable. */
  readonly listenable?: string;
  /**
   * Audience / executor (UCAN `aud`, PROVISIONAL). When present, narrows the task to
   * ONE named vessel — the mint-once / addressed shape (run here, exactly once). When
   * absent, the holding bag's keyhive ring carries the addressing (any capable peer
   * in the ring may claim). Bag = the default geometry; `aud` = the narrowing.
   */
  readonly aud?:        string;
  /**
   * The content id of the EFFECT this verb would produce — the split's "attempt vs effect"
   * key (D1, P2.5 iter 4). `requestId` names THIS attempt (fresh per retry); `effectKey`
   * names what running it WOULD DO. The dispatcher indexes `<daemon bag>/effects/<effectKey>`:
   * a prior `done` under a DIFFERENT requestId with the same effectKey answers this attempt
   * with that prior result (`effect-of: <prior requestId>`) instead of re-running. Absent =
   * no dedup (every attempt is its own effect, today's behavior unchanged).
   */
  readonly effectKey?:  string;
}

// ── Outcome shape ──────────────────────────────────────────────────────────

export interface VerbTargetResult {
  readonly ok:      boolean;
  readonly output?: Record<string, unknown>;
  readonly error?:  string;
}

export interface OutcomeRecord extends LarTiddlerRecord {
  readonly tiddler: {
    readonly title:          string;
    readonly "request-id":   string;
    readonly verb:           string;
    readonly status:         "done" | "error";
    readonly "requested-by": string;
    readonly "completed-at": string;
    readonly cause:          string;
    readonly tags:           string;
    // JSON map of { targetOrSummaryKey → VerbTargetResult }
    readonly results?:       string;
    readonly "error-message"?: string;
    readonly "input-digest"?: string;
    readonly "effect-key"?:   string;
    readonly "effect-of"?:    string;
    [k: string]: unknown;
  };
}

export function concludeVerb(opts: {
  requestId:     string;
  verb:          string;
  status:        "done" | "error";
  requestedBy:   string;
  cause:         string;
  batchMode:     BatchMode;
  results?:      Record<string, VerbTargetResult>;
  errorMessage?: string;
  authority?:    string;
  /** Digest-on-outcome (D1): the worker stamps the request's input digest onto the
   *  outcome it writes, so a later reader can re-check reuse without re-walking the fact. */
  inputDigest?:  string;
  /** The effect this outcome indexes under `<daemon bag>/effects/<effectKey>` (worker's
   *  single-writer effect index). Absent = this outcome is not effect-indexed. */
  effectKey?:    string;
  /** Present when this outcome is a COPY of a prior attempt's result (effect dedup):
   *  names the prior requestId whose effect this one reused, rather than running. */
  effectOf?:     string;
}): LarTiddlerRecord {
  const title = `${OUTCOME_URI_PREFIX}${opts.requestId}`;
  const base = {
    title,
    tags:            LARES_VERB_EVENT_TAG,
    "request-id":    opts.requestId,
    verb:            opts.verb,
    status:          opts.status,
    "requested-by":  opts.requestedBy,
    "completed-at":  new Date().toISOString(),
    cause:           opts.cause,
  };
  return {
    tiddler: {
      ...base,
      results: JSON.stringify(opts.results ?? {}),
      ...(opts.errorMessage !== undefined && { "error-message": opts.errorMessage }),
      ...(opts.inputDigest  !== undefined && { "input-digest":  opts.inputDigest }),
      ...(opts.effectKey    !== undefined && { "effect-key":    opts.effectKey }),
      ...(opts.effectOf     !== undefined && { "effect-of":     opts.effectOf }),
    },
    meta: { authority: opts.authority ?? "lares-dispatcher" },
  };
}

// ── Builders ───────────────────────────────────────────────────────────────

/**
 * A fresh request id — 16 cryptographically-random bytes, base32-encoded. No time prefix: a request
 * id names an ATTEMPT, never a moment, and carrying `Date.now()` in it invited readers to treat
 * ordering or freshness as derivable from the id itself (it never was — see L1,
 * project_no_global_now_timers).
 */
export function newRequestId(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = "";
  for (const b of bytes) out += b.toString(32).padStart(2, "0");
  return out;
}

export function isVerbTitle(title: string): boolean {
  return title.startsWith(VERB_URI_PREFIX);
}

/** Build a volatile verb invocation tiddler for wiki.addTiddler() (local path). */
export function buildVerb(opts: {
  verb:        string;
  args:        Record<string, unknown>;
  requestedBy: string;
  targets?:    string[];
  batchMode?:  BatchMode;
  requestId?:  string;
  fromUri?:    string;
  listenable?: string;
  aud?:        string;
  effectKey?:  string;
}): Record<string, unknown> {
  const requestId = opts.requestId ?? newRequestId();
  const title     = `${VERB_URI_PREFIX}${requestId}`;
  return {
    title,
    tags:            LARES_VERB_TAG,
    verb:            opts.verb,
    args:            JSON.stringify(opts.args),
    targets:         JSON.stringify(opts.targets ?? []),
    "batch-mode":    opts.batchMode ?? "best-effort",
    "request-id":    requestId,
    status:          "pending",
    "requested-by":  opts.requestedBy,
    "requested-at":  new Date().toISOString(),
    ...(opts.fromUri    !== undefined && { "from-uri":   opts.fromUri }),
    ...(opts.listenable !== undefined && { listenable:   opts.listenable }),
    ...(opts.aud        !== undefined && { aud:          opts.aud }),
    ...(opts.effectKey  !== undefined && { "effect-key": opts.effectKey }),
  };
}

/** Build an Automerge verb-summons record for remote vessel submission. */
export function summon(opts: {
  verb:        string;
  args:        Record<string, unknown>;
  requestedBy: string;
  targets?:    string[];
  batchMode?:  BatchMode;
  requestId?:  string;
  authority?:  string;
  fromUri?:    string;
  listenable?: string;
  aud?:        string;
  effectKey?:  string;
}): LarTiddlerRecord {
  const requestId = opts.requestId ?? newRequestId();
  const title     = `${SUMMONS_URI_PREFIX}${requestId}`;
  return {
    tiddler: {
      title,
      tags:            LARES_VERB_TAG,
      verb:            opts.verb,
      args:            JSON.stringify(opts.args),
      targets:         JSON.stringify(opts.targets ?? []),
      "batch-mode":    opts.batchMode ?? "best-effort",
      "request-id":    requestId,
      status:          "pending",
      "requested-by":  opts.requestedBy,
      "requested-at":  new Date().toISOString(),
      ...(opts.fromUri    !== undefined && { "from-uri":   opts.fromUri }),
      ...(opts.listenable !== undefined && { listenable:   opts.listenable }),
      ...(opts.aud        !== undefined && { aud:          opts.aud }),
      ...(opts.effectKey  !== undefined && { "effect-key": opts.effectKey }),
    },
    meta: { authority: opts.authority ?? "lares-cli" },
  };
}

/** Parse a flat tiddler field bag (from wiki.getTiddler().fields or
 *  record.tiddler) into a Verb. Returns null when the shape doesn't match. */
export function parseVerb(fields: Record<string, unknown>): Verb | null {
  const title = typeof fields["title"] === "string" ? fields["title"] : null;
  if (!title) return null;
  if (!title.startsWith(VERB_URI_PREFIX) && !title.startsWith(SUMMONS_URI_PREFIX)) return null;

  const tag = fields["tags"];
  const tagsStr = Array.isArray(tag) ? tag.join(" ") : (typeof tag === "string" ? tag : "");
  if (!tagsStr.includes(LARES_VERB_TAG)) return null;

  const verb        = typeof fields["verb"]          === "string" ? fields["verb"]          : null;
  const requestId   = typeof fields["request-id"]    === "string" ? fields["request-id"]    : null;
  const status      = fields["status"];
  const requestedBy = typeof fields["requested-by"]  === "string" ? fields["requested-by"]  : "";
  const requestedAt = typeof fields["requested-at"]  === "string" ? fields["requested-at"]  : "";
  const batchMode   = fields["batch-mode"] === "atomic" ? "atomic" as const : "best-effort" as const;

  if (!verb || !requestId) return null;
  if (status !== "pending" && status !== "running" && status !== "done" && status !== "error") return null;

  let args: Record<string, unknown> = {};
  const argsRaw = typeof fields["args"] === "string" ? fields["args"] : "{}";
  try { args = JSON.parse(argsRaw); } catch { /* treat as empty */ }

  let targets: string[] = [];
  const targetsRaw = typeof fields["targets"] === "string" ? fields["targets"] : "[]";
  try {
    const parsed = JSON.parse(targetsRaw);
    if (Array.isArray(parsed)) targets = parsed.filter((t): t is string => typeof t === "string");
  } catch { /* treat as empty */ }

  const fromUri    = typeof fields["from-uri"]   === "string" ? fields["from-uri"]   : undefined;
  const listenable = typeof fields["listenable"] === "string" ? fields["listenable"] : undefined;
  const aud        = typeof fields["aud"]        === "string" ? fields["aud"]        : undefined;
  const effectKey  = typeof fields["effect-key"] === "string" ? fields["effect-key"] : undefined;

  return {
    requestId, title, action: verb, args, targets, batchMode, status, requestedBy, requestedAt,
    ...(fromUri    !== undefined && { fromUri }),
    ...(listenable !== undefined && { listenable }),
    ...(aud        !== undefined && { aud }),
    ...(effectKey  !== undefined && { effectKey }),
  };
}

export function buildRunningPatch(): Record<string, string> {
  return { status: "running", "started-at": new Date().toISOString() };
}
