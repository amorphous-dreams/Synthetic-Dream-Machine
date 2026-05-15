/**
 * command-dispatcher — TS-side subscriber that runs operator commands
 * delivered as command-tiddlers in the admin Automerge doc.
 *
 * Lifecycle of a command:
 *   1. CLI (or any operator surface) writes a command-tiddler via
 *      composite.put({ ...buildCommandTiddler({ ... }) }, origin).
 *   2. The admin doc syncs the new tiddler across the operator's federation
 *      (currently: same-process AutomergeDocStore subscribers).
 *   3. This dispatcher's subscriber sees the change. If status === "pending"
 *      and a handler is registered for the command name, the dispatcher
 *      patches status to "running", invokes the handler, then writes back
 *      "done" + result OR "error" + message.
 *   4. After the consumer acknowledges (read), the dispatcher tombstones
 *      the command tiddler. Durable audit lives in the session event-log
 *      as a separate "lares-command-event" tiddler.
 *
 * Forward note (UEFN-Verse ReactionEngine):
 *   Today the dispatcher subscribes inside one node process (one causal
 *   island). When the Verse-inspired ReactionEngine lands, the same
 *   dispatcher pattern federates: a ReactionEngine instance per causal
 *   island, watching tagged tiddlers across federated sync boundaries.
 *   Command-tiddlers will become one shape of reaction trigger among many
 *   (signal-tiddlers, alarm-tiddlers, recipe-deltas, …). Keep the handler
 *   registry shape ReactionEngine-friendly: handlers stay pure functions
 *   over (args, context) → result, with the dispatcher owning the
 *   transactional state machine.
 *
 * Architecture laws preserved:
 *   - TW5 vm primacy: handlers can themselves invoke vm action-widgets.
 *     The dispatcher is the demux, not the policy site (see B.4).
 *   - Web2 smell test: no HTTP/RPC; coordination is CRDT-native.
 *   - Capability hooks: handler signatures carry a `cap` parameter so
 *     verifyCapability checks can land at the right point without a
 *     refactor when S7 lands.
 */

import {
  type LarTiddlerRecord, type LarTiddlerChange, type ChangeOrigin,
  type CommandTiddler, type CompositeStore,
  parseCommandTiddler, buildRunningPatch,
  buildCommandEventTiddler,
  ADMIN_BAG_ID,
} from "@lararium/core";

/** Result shape for ctx.cap(...) calls — same shape as KeyhiveProvider.verify. */
export interface CapVerifyResult {
  readonly ok:      boolean;
  readonly reason?: string;
}

/** Curried verify closure — pre-bound to the requesting peer's DID. */
export type CapVerify = (access: "read" | "admin", bagUrl: string) => Promise<CapVerifyResult>;

/** Context passed to every handler. */
export interface CommandContext {
  /** Composite store for the admin VM — handlers may read/write tiddlers. */
  readonly admin:   CompositeStore;
  /** Parsed command, in case the handler needs metadata beyond args. */
  readonly command: CommandTiddler;
  /**
   * Capability gate — bound to the command's `requested-by` DID. Handlers
   * call ctx.cap("admin", bagUrl) and throw on !ok before performing
   * privileged operations. The dispatcher builds this closure per-command
   * from the keyhive provider and the parsed CommandTiddler.requestedBy.
   *
   * In single-operator deployments the operator's local CLI runs against
   * their own daemon; the daemon trusts admin-doc writes by virtue of
   * filesystem-local control. ctx.cap still returns ok=true for the
   * operator's own DID against their own bags, providing the correct
   * shape for future federated peers without changing handler code.
   */
  readonly cap:     CapVerify;
}

/** Handler shape: pure function over (args, context) → result. */
export type CommandHandler = (
  args:    Readonly<Record<string, unknown>>,
  context: CommandContext,
) => Promise<Record<string, unknown>>;

/** Registry of command-name → handler. Mutate via register(). */
export class CommandHandlerRegistry {
  private readonly handlers = new Map<string, CommandHandler>();

  register(commandName: string, handler: CommandHandler): void {
    if (this.handlers.has(commandName)) {
      throw new Error(`[command-dispatcher] duplicate handler for "${commandName}"`);
    }
    this.handlers.set(commandName, handler);
  }

  get(commandName: string): CommandHandler | undefined {
    return this.handlers.get(commandName);
  }

  has(commandName: string): boolean {
    return this.handlers.has(commandName);
  }

  list(): readonly string[] {
    return [...this.handlers.keys()].sort();
  }
}

/** Minimal capability-verifier shape the dispatcher binds to ctx.cap.
 *  Matches KeyhiveProvider.verify but kept structural so tests can stub
 *  without dragging in @lararium/keyhive. */
export interface CapabilityVerifier {
  verify(args: {
    presenter: string;
    bagUrl:    string;
    access:    "read" | "admin";
  }): Promise<CapVerifyResult>;
}

export interface CommandDispatcherOptions {
  /** Composite store wrapping the admin doc as its writable layer. */
  readonly admin:    CompositeStore;
  /** Handler registry. Pre-populate before calling start(). */
  readonly registry: CommandHandlerRegistry;
  /** Capability provider — handlers' ctx.cap closures bind through this.
   *  Optional today: when absent, ctx.cap returns ok=true (legacy
   *  "operator runs the node" gate). When present, real verification. */
  readonly verifier?: CapabilityVerifier;
}

/**
 * CommandDispatcher — subscribes to admin store changes, dispatches commands,
 * writes results, tombstones consumed commands.
 */
export class CommandDispatcher {
  private unsubscribe: (() => void) | null = null;
  /** Guards re-entry: a command currently in flight. */
  private readonly inFlight = new Set<string>();

  constructor(private readonly opts: CommandDispatcherOptions) {}

  start(): void {
    if (this.unsubscribe) return;
    this.unsubscribe = this.opts.admin.subscribe((change) => {
      this.onChange(change).catch((err) => {
        console.error("[command-dispatcher] handler crashed:", err);
      });
    });
    console.log(`[command-dispatcher] live — handlers: ${this.opts.registry.list().join(", ") || "(none)"}`);
  }

  stop(): void {
    if (this.unsubscribe) { this.unsubscribe(); this.unsubscribe = null; }
  }

  private async onChange(change: LarTiddlerChange): Promise<void> {
    if (!change.record) return;            // tombstone — nothing to dispatch
    if (change.origin.kind === "lares-command") return;  // our own writes
    const command = parseCommandTiddler(change.record);
    if (!command) return;
    if (command.status !== "pending") return;
    if (this.inFlight.has(command.requestId)) return;
    this.inFlight.add(command.requestId);
    try {
      await this.dispatch(command, change.record);
    } finally {
      this.inFlight.delete(command.requestId);
    }
  }

  private async dispatch(command: CommandTiddler, record: LarTiddlerRecord): Promise<void> {
    const handler = this.opts.registry.get(command.command);
    const origin: ChangeOrigin = { kind: "lares-command", requestId: command.requestId };

    if (!handler) {
      // No handler exists — write an error audit event, tombstone the cmd
      // signal. The CLI sees the log/<id> tiddler appear with status=error.
      await this.writeAuditEvent({
        command,
        status:       "error",
        errorMessage: `no handler registered for "${command.command}"`,
        origin,
      });
      await this.opts.admin.tombstone(record.title, origin);
      return;
    }

    // Transition the signal-tiddler to running — operators inspecting the
    // admin VM during a long-running command see this state.
    await this.patch(record, buildRunningPatch(), origin);

    // Build per-command cap closure, bound to the request's claimed
    // requestedBy DID. The verifier (KeyhiveProvider) does the real check.
    const verifier = this.opts.verifier;
    const cap: CapVerify = verifier
      ? (access, bagUrl) => verifier.verify({ presenter: command.requestedBy, bagUrl, access })
      : async () => ({ ok: true, reason: "no-verifier" });

    try {
      const result = await handler(command.args, {
        admin:   this.opts.admin,
        command,
        cap,
      });
      // Done path: write durable audit event, then tombstone the signal.
      // CLI's poll on log/<id> picks up the result; signal-tiddler vanishes.
      await this.writeAuditEvent({ command, status: "done", result, origin });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.writeAuditEvent({ command, status: "error", errorMessage: message, origin });
    }
    // In both done and error paths, the signal-tiddler has served its job.
    // The audit event under log/<id> is the durable record.
    await this.opts.admin.tombstone(record.title, origin);
  }

  /** Write a durable audit-event tiddler under @admin/log/<requestId>. The
   *  command-tiddler itself stays transient (consumer tombstones after read);
   *  the audit event is the operator's forensic trail. */
  private async writeAuditEvent(opts: {
    command:       CommandTiddler;
    status:        "done" | "error";
    result?:       Record<string, unknown>;
    errorMessage?: string;
    origin:        ChangeOrigin;
  }): Promise<void> {
    const event = buildCommandEventTiddler({
      requestId:    opts.command.requestId,
      command:      opts.command.command,
      args:         opts.command.args as Record<string, unknown>,
      status:       opts.status,
      requestedBy:  opts.command.requestedBy,
      ...(opts.result       !== undefined && { result:       opts.result }),
      ...(opts.errorMessage !== undefined && { errorMessage: opts.errorMessage }),
    });
    await this.opts.admin.put(event, opts.origin);
  }

  /** Merge a partial field patch onto the existing command record. */
  private async patch(
    record:  LarTiddlerRecord,
    patch:   Record<string, string>,
    origin:  ChangeOrigin,
  ): Promise<void> {
    const merged: LarTiddlerRecord = {
      title:     record.title,
      bag:       record.bag ?? ADMIN_BAG_ID,
      authority: record.authority ?? "lares-dispatcher",
      fields:    { ...record.fields, ...patch },
      ...(record.text     !== undefined && { text:     record.text }),
      ...(record.deleted  !== undefined && { deleted:  record.deleted }),
    };
    await this.opts.admin.put(merged, origin);
  }
}
