/**
 * command-tiddler — CRDT-native protocol for operator commands.
 *
 * Operators (and operator-process surfaces like the `lares` CLI) ride this
 * protocol to ask a Lararium node to do work without piercing the local-first
 * boundary with HTTP/RPC. A command lives as one tiddler in the admin
 * Automerge doc:
 *
 *   title:  lar:///ha.ka.ba/@lararium/@admin/cmd/<requestId>
 *   tag:    lar:///ha.ka.ba/tags/lares-command
 *   fields: { command, args, request-id, status, result, requested-by, requested-at }
 *
 * Two-tiddler contract (clarified post-S5.8):
 *   cmd/<requestId>   THIN signal-tiddler. Carries only state-machine status
 *                     (pending → running) and the call args. NEVER carries
 *                     the result. The dispatcher tombstones it as soon as
 *                     the audit-event lands. CLIs do NOT tombstone — they
 *                     never need to.
 *   log/<requestId>   DURABLE audit-event tiddler. Holds the full result OR
 *                     error, plus timing and provenance. CLIs poll for THIS
 *                     tiddler appearing — its appearance IS the "done"
 *                     signal. Survives forever as the forensic trail.
 *
 * This split dissolves the crash-safety bug from the earlier shape (CLI
 * died mid-flight → cmd/ namespace stayed dirty). Now: the dispatcher
 * owns cleanup of cmd/, the log/ tiddler is the consumer's source of truth
 * for the result, and a CLI crash leaves no namespace residue.
 *
 * Forward note (UEFN ReactionEngine): once the Verse-inspired ReactionEngine
 * lands, this protocol generalizes — the dispatcher pattern federates across
 * causal-island bounds, and command-tiddlers become one shape of reaction
 * trigger among many. The shape here was chosen to be ReactionEngine-friendly
 * (declarative tag, status-state-machine fields, idempotent retry by
 * request-id).
 *
 * Architecture laws preserved:
 *   - Tiddler-format law: command lives as a normal tiddler, lar: URI title.
 *   - Web2 smell test: no HTTP/RPC; coordination flows through the CRDT.
 *   - Tag carries a lar: URI; the title syncs across peers.
 */

import { ADMIN_BAG_ID } from "./lar-uris.js";
import type { LarTiddlerRecord } from "@lararium/types";

/** Tag every command tiddler carries. Tags are vm-side metadata and do not
 *  leak across the sync boundary; the title is the load-bearing identifier. */
export const LARES_COMMAND_TAG = "lar:///ha.ka.ba/tags/lares-command";

/** All command tiddler titles share this prefix. */
export const COMMAND_URI_PREFIX = `${ADMIN_BAG_ID}/cmd/`;

/** Durable audit-event tiddlers live under this prefix in the admin doc.
 *  Every successful command produces one; operators inspect them as the
 *  forensic trail. Tagged lar:///ha.ka.ba/tags/lares-command-event for vm-side filters. */
export const COMMAND_EVENT_URI_PREFIX = `${ADMIN_BAG_ID}/log/`;
export const LARES_COMMAND_EVENT_TAG  = "lar:///ha.ka.ba/tags/lares-command-event";

/** Build a durable audit-event record for a completed command. */
export function buildCommandEventTiddler(opts: {
  requestId:    string;
  command:      string;
  args:         Record<string, unknown>;
  status:       "done" | "error";
  result?:      Record<string, unknown>;
  errorMessage?: string;
  requestedBy:  string;
  authority?:   string;
}): LarTiddlerRecord {
  const title = `${COMMAND_EVENT_URI_PREFIX}${opts.requestId}`;
  return {
    tiddler: {
      title,
      tags:           LARES_COMMAND_EVENT_TAG,
      "request-id":  opts.requestId,
      command:        opts.command,
      args:           JSON.stringify(opts.args),
      status:         opts.status,
      ...(opts.result       !== undefined && { result: JSON.stringify(opts.result) }),
      ...(opts.errorMessage !== undefined && { "error-message": opts.errorMessage }),
      "requested-by": opts.requestedBy,
      "completed-at": new Date().toISOString(),
    },
    meta: { authority: opts.authority ?? "lares-dispatcher" },
  };
}

/** Lifecycle states. The dispatcher transitions pending → running → done|error. */
export type CommandStatus = "pending" | "running" | "done" | "error";

/** Shape of a parsed command. Fields stay string-typed — tiddler fields are
 *  string-only, structured payloads land as JSON-stringified `args` / `result`. */
export interface CommandTiddler {
  readonly requestId:    string;
  readonly title:        string;
  readonly command:      string;
  readonly args:         Readonly<Record<string, unknown>>;
  readonly status:       CommandStatus;
  readonly result?:      Readonly<Record<string, unknown>>;
  readonly errorMessage?: string;
  readonly requestedBy:  string;
  readonly requestedAt:  string;
}

/**
 * Generate a sortable, monotonic request id. Format: <millis-base32>-<random>.
 * Lexicographically increases with time so listing the cmd/ namespace orders
 * naturally. Dep-free; ULID-grade entropy is overkill for in-flight commands.
 */
export function newRequestId(): string {
  const ms = Date.now().toString(32).padStart(9, "0");
  let rand = "";
  for (let i = 0; i < 8; i++) rand += Math.floor(Math.random() * 32).toString(32);
  return `${ms}-${rand}`;
}

/** True when the tiddler title looks like a command-tiddler URI. */
export function isCommandTitle(title: string): boolean {
  return title.startsWith(COMMAND_URI_PREFIX);
}

/** Build a fresh command-tiddler record ready for composite.put. */
export function buildCommandTiddler(opts: {
  command:     string;
  args:        Record<string, unknown>;
  requestedBy: string;
  requestId?:  string;
  authority?:  string;
}): LarTiddlerRecord {
  const requestId = opts.requestId ?? newRequestId();
  const title     = `${COMMAND_URI_PREFIX}${requestId}`;
  return {
    tiddler: {
      title,
      tags:           LARES_COMMAND_TAG,
      command:        opts.command,
      args:           JSON.stringify(opts.args),
      "request-id":  requestId,
      status:         "pending",
      "requested-by": opts.requestedBy,
      "requested-at": new Date().toISOString(),
    },
    meta: { authority: opts.authority ?? "lares-cli" },
  };
}

/** Parse a tiddler record into a CommandTiddler. Returns null when the
 *  record does not match the command-tiddler shape — used by the dispatcher
 *  subscriber to filter incoming changes. */
export function parseCommandTiddler(record: LarTiddlerRecord): CommandTiddler | null {
  if (!isCommandTitle(record.tiddler.title)) return null;
  const fields = record.tiddler as Record<string, string | string[] | undefined>;
  const tag = fields["tags"];
  const tagsString = Array.isArray(tag) ? tag.join(" ") : (typeof tag === "string" ? tag : "");
  if (!tagsString.includes(LARES_COMMAND_TAG)) return null;

  const command   = typeof fields["command"]      === "string" ? fields["command"]      : null;
  const argsRaw   = typeof fields["args"]         === "string" ? fields["args"]         : "{}";
  const requestId = typeof fields["request-id"]   === "string" ? fields["request-id"]   : null;
  const status    = fields["status"];
  const requestedBy = typeof fields["requested-by"] === "string" ? fields["requested-by"] : "";
  const requestedAt = typeof fields["requested-at"] === "string" ? fields["requested-at"] : "";

  if (!command || !requestId) return null;
  if (status !== "pending" && status !== "running" && status !== "done" && status !== "error") return null;

  let args: Record<string, unknown> = {};
  try { args = JSON.parse(argsRaw); } catch { /* malformed; treat as empty */ }

  let result: Record<string, unknown> | undefined;
  const resultRaw = fields["result"];
  if (typeof resultRaw === "string" && resultRaw.length > 0) {
    try { result = JSON.parse(resultRaw); } catch { /* leave undefined */ }
  }

  const errorMessage = typeof fields["error-message"] === "string" ? fields["error-message"] : undefined;

  return {
    requestId, title: record.tiddler.title, command, args, status,
    requestedBy, requestedAt,
    ...(result       !== undefined && { result }),
    ...(errorMessage !== undefined && { errorMessage }),
  };
}

/** Build the field patch that transitions a command to running state. */
export function buildRunningPatch(): Record<string, string> {
  return { status: "running", "started-at": new Date().toISOString() };
}

// buildDonePatch / buildErrorPatch removed under the split contract — the
// signal-tiddler never carries result/error data. Done/error state lives in
// the durable log/<requestId> tiddler (buildCommandEventTiddler) and the
// signal-tiddler gets tombstoned by the dispatcher once the log lands.
