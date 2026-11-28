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
 *   bags/control/outcomes/<id>  DURABLE outcome tiddler in the Automerge-backed
 *                         daemon bag. Written by the dispatcher on done/error.
 *                         Syncs to all vessels. CRDT convergence here IS the result.
 *                         Shared aftermath lives here.
 *
 * Verb invocation paths:
 *   Local (in-process):   placeVerb() → wiki.addTiddler() → TW5 change event
 *                         → dispatcher runs → outcome to bags/control/outcomes/
 *   Remote (CLI/vessels): vessel writes bags/control/summons/<id> to Automerge →
 *                         IslandAdaptor flows it into TW5 wiki →
 *                         dispatcher translates to volatile invocation → processes →
 *                         outcome to bags/control/outcomes/
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

import { mintRandomId } from "./entropy-door.js";
import {
  CONTROL_HOME_ID, VOLATILE_VM_PREFIX,
  LARES_VERB_EVENT_TAG, LARES_VERB_TAG,
} from "./lar-uris.js";
import { sha256Hex, sha256HexBytesSync, canonicalJsonBytes, utf8Bytes, defaultCryptoProvider, type DigestProvider } from "./crypto.js";
import { formatDigest } from "./agile-digest.js";
import type { LarTiddlerRecord } from "./tiddler-store.js";
import type { ChoreReceiptMark } from "./chore-ask.js";

// ── URI prefixes ───────────────────────────────────────────────────────────

/** Volatile verb invocation tiddlers — daemon TW5 wiki scratch, never synced. */
export const VERB_URI_PREFIX = `${VOLATILE_VM_PREFIX}verbs/`;

/** Automerge-backed verb summons, resting in the vessel's control document (`control-home`); the dispatcher translates
 *  each to a volatile invocation and tombstones it after pickup. */
export const SUMMONS_URI_PREFIX = `${CONTROL_HOME_ID}/summons/`;

/** Durable outcome tiddlers, resting in the vessel's control document (`control-home`), never in a mirrored layer. */
export const OUTCOME_URI_PREFIX = `${CONTROL_HOME_ID}/outcomes/`;

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

// ── Control-document prefixes ───────────────────────────────────────────────
// No receipt fact rests anywhere: a same-id re-ask reads the vessel's answer ring (memory alone), the verdict row a
// write leaves, or the effect row an effect key names (lar:///ha.ka.ba/lararium/mesh/receipt-ledger).

/** Durable ward audits: `<control home>/ledger/ward/<id>`, in the vessel's control document. */
export const WARD_AUDIT_URI_PREFIX = `${CONTROL_HOME_ID}/ledger/ward/`;

/** The durable mailbox: `<control home>/mailbox/<wiki>/<id>`, in the vessel's control document. */
export const MAILBOX_URI_PREFIX = `${CONTROL_HOME_ID}/mailbox/`;

/** The effect index: `<control home>/effects/<effectKey>`, in the vessel's control document. */
export const EFFECT_URI_PREFIX = `${CONTROL_HOME_ID}/effects/`;

/**
 * The content digest over a verb's identity tuple — shared by the channel (arbitration:
 * same id + changed digest refuses `request-id-reused-with-changed-input`) and the worker
 * (digest-on-outcome: stamped onto the outcome tiddler so a later reader can re-check it
 * without re-walking the call). Distinct from `taskContentId` (the content-addressed task
 * surface, keyed by {subject,command,args,nonce}) — this digest keys the CURRENT running
 * verb/summons/outcome path's request identity, {verb,args,face,effectKey}.
 */
export async function verbInputDigest(
  parts: { verb: string; args: Readonly<Record<string, unknown>>; face?: string | undefined; effectKey?: string },
  provider: DigestProvider = defaultCryptoProvider,
): Promise<string> {
  const canonical = {
    verb: parts.verb, args: parts.args, face: parts.face ?? "",
    effectKey: parts.effectKey ?? "",
  };
  return formatDigest("sha256", await sha256Hex(canonicalJsonBytes(canonical), provider));
}

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
  readonly face?:      string;
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
    readonly face?: string;
    readonly verb:           string;
    readonly status:         "done" | "error";
    readonly "completed-at": string;
    readonly cause:          string;
    readonly tags:           string;
    // JSON map of { targetOrSummaryKey → VerbTargetResult }
    readonly results?:       string;
    readonly "error-message"?: string;
    readonly "input-digest"?: string;
    readonly "effect-key"?:   string;
    readonly "effect-of"?:    string;
    readonly "refusal"?:      string;
    [k: string]: unknown;
  };
}

/** AN OUTCOME NAMES NO REQUESTER (K20): the volatile invocation carries who asked; the daemon document keeps the verb, its status and its result, so no synced outcome pairs a requester with what it answered. */
export function concludeVerb(opts: {
  requestId:     string;
  verb:          string;
  face?: string;
  status:        "done" | "error";
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
  /** Machine-readable refusal reason (e.g. "beyond-profile") — additive alongside the
   *  human-readable `errorMessage`. Stamped as the `refusal` field. */
  refusal?:      string;
  /** The chore's receipt mark (the acting face, the asker's hand, its session): house-local, never a key, presenter or
   *  signature, so the outcome still names no requester. Stamped as the `chore` field, its JSON; read back through
   *  `choreReceiptMarkOf`. */
  chore?:        ChoreReceiptMark;
  /** The documents the handler changed and the heads each reached (`call-touches`), tagged at the change: the seat
   *  waits for those heads, flushes those documents and answers `owed` where one still waits unsealed. Stamped as the
   *  `touched` field, its JSON. */
  touched?:      Readonly<Record<string, readonly string[]>>;
}): LarTiddlerRecord {
  const title = `${OUTCOME_URI_PREFIX}${opts.requestId}`;
  const base = {
    title,
    tags:            LARES_VERB_EVENT_TAG,
    "request-id":    opts.requestId,
    verb:            opts.verb,
    status:          opts.status,
    "completed-at":  new Date().toISOString(),
    cause:           opts.cause,
  };
  return {
    tiddler: {
      ...base,
      results: JSON.stringify(opts.results ?? {}),
      ...(opts.errorMessage !== undefined && { "error-message": opts.errorMessage }),
      ...(opts.inputDigest  !== undefined && { "input-digest":  opts.inputDigest }),
      ...(opts.face !== undefined && { face: opts.face }),
      ...(opts.effectKey    !== undefined && { "effect-key":    opts.effectKey }),
      ...(opts.effectOf     !== undefined && { "effect-of":     opts.effectOf }),
      ...(opts.refusal      !== undefined && { refusal:         opts.refusal }),
      ...(opts.chore        !== undefined && { chore:           JSON.stringify(opts.chore) }),
      ...(opts.touched      !== undefined && { touched:         JSON.stringify(opts.touched) }),
    },
    meta: { authority: opts.authority ?? "lares-dispatcher" },
  };
}

// ── The verdict row: what an outcome rests as ─────────────────────────────────────────────────────

/** Past this many UTF-8 bytes a verdict row's `error-message` rests cut, with `error-sha256` naming the whole. */
export const OUTCOME_ERROR_BOUND = 1024;

/** The fields a verdict row carries over from the whole outcome as they stand. */
const VERDICT_FIELDS = ["title", "tags", "request-id", "verb", "face", "status", "input-digest", "effect-key", "effect-of", "refusal", "chore"] as const;

/** True where an outcome's `results` (its JSON, or the parsed map) answer a VISIT: the output carries `visit: true`. */
function resultsNameVisit(results: unknown): boolean {
  const output = ((results as Record<string, unknown> | null | undefined)?.[VERB_RESULT_KEY] as Record<string, unknown> | undefined)?.["output"];
  return output !== null && typeof output === "object" && (output as Record<string, unknown>)["visit"] === true;
}

/** `text` cut to at most `bound` UTF-8 bytes on a character's edge. */
function cutToBytes(text: string, bound: number): string {
  if (utf8Bytes(text).length <= bound) return text;
  let out = "";
  let used = 0;
  for (const ch of text) {
    const weight = utf8Bytes(ch).length;
    if (used + weight > bound) break;
    out += ch;
    used += weight;
  }
  return out;
}

/**
 * THE VERDICT ROW: what a whole outcome (`concludeVerb`) rests as in the control document. It keeps the request id, the
 * verb, the face, the status, the input digest, the effect key and `effect-of`, the refusal, the chore mark, an error
 * message bounded at {@link OUTCOME_ERROR_BOUND} bytes (`error-sha256` names the whole where the cut fell), a `visit` flag
 * where the output carried `visit: true`, and the measure of the body it left behind: `result-sha256` and `result-bytes`
 * over the canonical bytes of the results map. It carries no `results`, `touched`, `cause`, `batch-mode` or completion
 * stamp: a body answers its caller through the vessel's answer ring (`control-home` `answerRingOf`) and rests nowhere.
 *
 * A record that carries no `results` (a copy whose body already left, itself a verdict) keeps the measure it names.
 */
export function verdictRowOf(answer: LarTiddlerRecord): LarTiddlerRecord {
  const whole = answer.tiddler as Record<string, unknown>;
  const row: Record<string, unknown> = {};
  for (const key of VERDICT_FIELDS) if (whole[key] !== undefined) row[key] = whole[key];
  const error = whole["error-message"];
  if (typeof error === "string") {
    const cut = cutToBytes(error, OUTCOME_ERROR_BOUND);
    row["error-message"] = cut;
    if (cut !== error) row["error-sha256"] = sha256HexBytesSync(utf8Bytes(error));
    else if (typeof whole["error-sha256"] === "string") row["error-sha256"] = whole["error-sha256"];
  }
  const raw = whole["results"];
  if (typeof raw === "string") {
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { parsed = undefined; }
    // The measure covers the canonical bytes of the map where it parses, and the stored text where it will not.
    const bytes = parsed !== undefined ? canonicalJsonBytes(parsed) : utf8Bytes(raw);
    row["result-sha256"] = sha256HexBytesSync(bytes);
    row["result-bytes"] = String(bytes.length);
    if (resultsNameVisit(parsed)) row["visit"] = "true";
  } else {
    for (const key of ["result-sha256", "result-bytes", "visit"] as const) if (typeof whole[key] === "string") row[key] = whole[key];
  }
  return { tiddler: row as LarTiddlerRecord["tiddler"], ...(answer.meta !== undefined ? { meta: answer.meta } : {}) };
}

/** True where an outcome record rests as a verdict alone: it carries no `results`, so its body rode the answer ring. */
export function isVerdictRow(fields: Readonly<Record<string, unknown>>): boolean {
  return typeof fields["results"] !== "string";
}

/**
 * WHAT A BODY THAT LEFT ANSWERS: the verdict row's measure of it, and the cure. A body leaves the answer ring past its
 * bound or with the vessel's life; the act it answered stands either way, so the cure never re-runs a write by its id.
 */
export function releasedBodyOf(fields: Readonly<Record<string, unknown>>): { readonly released: true; readonly sha256?: string; readonly bytes?: number; readonly cure: string } {
  const bytes = typeof fields["result-bytes"] === "string" ? Number.parseInt(fields["result-bytes"], 10) : Number.NaN;
  return {
    released: true,
    ...(typeof fields["result-sha256"] === "string" ? { sha256: fields["result-sha256"] } : {}),
    ...(Number.isFinite(bytes) ? { bytes } : {}),
    cure: "the verdict stands and its result body left this vessel's memory (a restart, or newer answers past the ring's bound): run a read again, or run the ingest again under a fresh request id, to read a body",
  };
}

// ── Builders ───────────────────────────────────────────────────────────────

/**
 * A fresh request id — 16 cryptographically-random bytes, base32-encoded; refuses `entropy-absent` where the platform holds no `crypto.getRandomValues`. No time prefix: a request
 * id names an ATTEMPT, never a moment, and carrying `Date.now()` in it invited readers to treat
 * ordering or freshness as derivable from the id itself (it never was — see L1,
 * project_no_global_now_timers).
 */
export function newRequestId(): string {
  return mintRandomId();
}

export function isVerbTitle(title: string): boolean {
  return title.startsWith(VERB_URI_PREFIX);
}

/** Build a volatile verb invocation tiddler for wiki.addTiddler() (local path). */
export function buildVerb(opts: {
  verb:        string;
  args:        Record<string, unknown>;
  requestedBy: string;
  face?:       string;
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
    ...(opts.face       !== undefined && { face: opts.face }),
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
  const face       = typeof fields["face"] === "string" ? fields["face"] : undefined;

  return {
    requestId, title, action: verb, args, targets, batchMode, status, requestedBy, requestedAt,
    ...(fromUri    !== undefined && { fromUri }),
    ...(listenable !== undefined && { listenable }),
    ...(aud        !== undefined && { aud }),
    ...(effectKey  !== undefined && { effectKey }),
    ...(face       !== undefined && { face }),
  };
}

export function buildRunningPatch(): Record<string, string> {
  return { status: "running", "started-at": new Date().toISOString() };
}
