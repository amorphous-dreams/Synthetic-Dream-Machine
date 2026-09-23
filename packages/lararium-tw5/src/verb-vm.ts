/**
 * verb-vm — volatile verb invocation lifecycle for the daemon causal island.
 *
 * Manages the in-TW5-wiki invocation tiddlers (volatile scratch, never synced)
 * and writes durable outcome tiddlers to the Automerge-backed daemon bag.
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/verb-vm
 */

import type { BatchMode, CompositeStore, Verb } from "@lararium/mesh";
import {
  DAEMON_BAG_ID, VERB_RESULT_KEY, concludeVerb, buildVerb, buildRunningPatch,
  canonicalJsonBytes, sha256HexBytesSync,
} from "@lararium/mesh";
import type { TW5Engine } from "./tw5-vm.js";

// ── audit-doc write-amplification cure (the dd4da8481 class, a new site) ────────────────────────────
//
// A verb's durable outcome (`writeOutcome` below → `bags/daemon/outcomes/<id>`) embeds the handler's
// FULL return value under `results[summary].output` — for a batch verb (e.g. INGEST) that means a
// per-carrier result array, unbounded across a corpus seed (214 entries measured for one lararium
// ingest). That array lands in an Automerge doc that syncs to every vessel and never shrinks — the
// SAME write-amplification class the FLOW-map carried (4571c394b), at a new site (the audit bag).
//
// Cure: any top-level array field in the outcome's `output` that crosses AUDIT_ARRAY_CAP entries is
// replaced by a BOUNDED summary — count, a per-"decision"/"grade" tally, a content-hash of the full
// array (so a full-detail re-derivation stays possible/verifiable), and a small sample — never the
// full body. Below the cap, the array rides FAITHFULLY (a small outcome needs no compaction; a caller
// polling for a normal-sized ingest's outcome still reads exact per-carrier detail).
//
// Read-path note: the co-located CLI (`lararium-node/src/uds-channel.ts`) reads this SAME durable
// `results` field back as its own printed/returned answer — there is no separate "live response"
// distinct from the stored doc for that path. So capping the durable field also caps what a
// large-batch CLI invocation prints; that is the intended trade (a durable receipt the mesh must
// carry forever cannot hold an unbounded per-run body) — the CLI still gets faithful detail for any
// outcome at or under the cap, and a bounded summary + verifiable hash above it, never silence.

const AUDIT_ARRAY_CAP = 32;

/** The bounded stand-in for an oversized array field — a summary, not the body. */
export interface BoundedArraySummary {
  readonly boundedArrayCount: number;
  readonly tallies: Readonly<Record<string, number>>;
  readonly sha256: string;
  readonly sample: readonly unknown[];
}

function tallyBy(items: readonly unknown[], key: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const raw = item && typeof item === "object" ? (item as Record<string, unknown>)[key] : undefined;
    const k = typeof raw === "string" ? raw : "unknown";
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

function boundArray(items: readonly unknown[]): BoundedArraySummary {
  return {
    boundedArrayCount: items.length,
    tallies: tallyBy(items, "decision"),
    sha256:  sha256HexBytesSync(canonicalJsonBytes(items)),
    sample:  items.slice(0, 3),
  };
}

/**
 * Cap any top-level array field of `result` past `AUDIT_ARRAY_CAP` entries — the durable-outcome
 * shape the write-amplification cure applies to. Exported for the CLI's read-path (and tests) to
 * recognize a bounded field via `boundedArrayCount`, distinct from a genuine small array.
 */
export function boundOutcomeOutput(
  result: Record<string, unknown>, cap: number = AUDIT_ARRAY_CAP,
): Record<string, unknown> {
  const bounded: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(result)) {
    bounded[key] = Array.isArray(value) && value.length > cap ? boundArray(value) : value;
  }
  return bounded;
}

export interface VerbPlacement {
  readonly verb:        string;
  readonly args:        Record<string, unknown>;
  readonly requestedBy: string;
  readonly targets?:    string[];
  readonly batchMode?:  BatchMode;
  readonly requestId?:  string;
  readonly fromUri?:    string;
  readonly listenable?: string;
}

export function placeVerb(tw5: TW5Engine, opts: VerbPlacement): string {
  const fields = buildVerb(opts);
  const Tiddler = tw5.$tw.Tiddler;
  tw5.$tw.wiki.addTiddler(new Tiddler(fields));
  return fields["request-id"] as string;
}

export function patchVerb(tw5: TW5Engine, title: string, patch: Record<string, string>): void {
  const wiki = tw5.$tw.wiki;
  const existing = wiki.getTiddler(title) as { fields: Record<string, unknown> } | undefined;
  if (!existing) return;
  const Tiddler = tw5.$tw.Tiddler;
  wiki.addTiddler(new Tiddler({ ...existing.fields, ...patch }));
}

export function removeVerb(tw5: TW5Engine, title: string): void {
  tw5.$tw.wiki.deleteTiddler(title);
}

export async function writeOutcome(
  daemon: CompositeStore,
  opts: {
    invocation:    Verb;
    status:        "done" | "error";
    result?:       Record<string, unknown>;
    errorMessage?: string;
  },
): Promise<void> {
  const origin = { kind: "lares-verb" as const, requestId: opts.invocation.requestId };
  const outcome = concludeVerb({
    requestId:   opts.invocation.requestId,
    verb:        opts.invocation.action,
    status:      opts.status,
    requestedBy: opts.invocation.requestedBy,
    cause:       opts.invocation.title,
    batchMode:   opts.invocation.batchMode,
    results: {
      [VERB_RESULT_KEY]: {
        ok: opts.status === "done",
        ...(opts.result       !== undefined && { output: boundOutcomeOutput(opts.result) }),
        ...(opts.errorMessage !== undefined && { error:  opts.errorMessage }),
      },
    },
    ...(opts.errorMessage !== undefined && { errorMessage: opts.errorMessage }),
  });
  await daemon.put(outcome, origin, { bag: DAEMON_BAG_ID });
}

/**
 * Render any thrown value to a readable message. A non-Error throw (a plain object,
 * e.g. a `{ok:false,reason}` verify result) yields its message/reason/error field,
 * else a compact JSON — never the bare "[object Object]" cast.
 */
function errorText(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const o = err as Record<string, unknown>;
    for (const k of ["message", "reason", "error"]) {
      if (typeof o[k] === "string" && o[k]) return o[k] as string;
    }
    try { return JSON.stringify(err); } catch { /* circular — fall through */ }
  }
  return String(err);
}

export async function dispatchVerb(
  tw5: TW5Engine,
  daemon: CompositeStore,
  invocation: Verb,
  run: () => Promise<Record<string, unknown>>,
): Promise<void> {
  patchVerb(tw5, invocation.title, buildRunningPatch());

  try {
    const result = await run();
    await writeOutcome(daemon, { invocation, status: "done", result });
  } catch (err) {
    await writeOutcome(daemon, { invocation, status: "error", errorMessage: errorText(err) });
  }

  removeVerb(tw5, invocation.title);
}
