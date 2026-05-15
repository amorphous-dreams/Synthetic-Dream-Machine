/**
 * admin-peer — connect the CLI to a running `lares serve` daemon as an
 * Automerge-repo WebSocket peer, then submit command-tiddlers and await
 * results through the admin doc.
 *
 * Why peer-not-RPC: command-tiddlers + a CRDT sync channel preserve the
 * web3-only invariant. The CLI looks like any other peer of the operator's
 * federation; the daemon's dispatcher reacts to the same admin-doc changes
 * it would react to from a TW5 vm widget or a future ReactionEngine.
 *
 * Attach mode only (operator-chosen for B.5): the CLI requires a daemon to
 * be up at the configured port. Ephemeral in-process boot is deferred to a
 * later sprint when contention rules around NodeFS storage are addressed.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Repo, type AutomergeUrl, type DocHandle } from "@automerge/automerge-repo";
import { WebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";
import {
  ADMIN_BAG_ID, AutomergeDocStore, CompositeStore,
  buildCommandTiddler, COMMAND_URI_PREFIX, COMMAND_EVENT_URI_PREFIX,
  type MemeStoreDoc,
} from "@lararium/core";
import { repoRoot } from "@lares/core";

export interface AdminPeerHandle {
  readonly repo:      Repo;
  readonly composite: CompositeStore;
  readonly admin:     DocHandle<MemeStoreDoc>;
  readonly disconnect: () => Promise<void>;
}

export interface ConnectOptions {
  /** Daemon port (default: LAR_PORT or 8080). */
  readonly port?: number;
  /** Daemon host (default: 127.0.0.1). */
  readonly host?: string;
  /**
   * Override path to social-bootstrap.json. Defaults to the path `lares init`
   * writes (packages/lararium-node/genesis/social-bootstrap.json).
   */
  readonly bootstrapPath?: string;
  /** Connect timeout in ms (default 3000). */
  readonly timeoutMs?: number;
}

function readAdminUrl(bootstrapPath: string): string {
  const raw = readFileSync(bootstrapPath, "utf8");
  const plugin = JSON.parse(raw);
  const inner = JSON.parse(plugin.text);
  const url   = inner?.tiddlers?.[ADMIN_BAG_ID]?.text;
  if (typeof url !== "string") {
    throw new Error(`admin AutomergeUrl missing from ${bootstrapPath}`);
  }
  return url;
}

/** Connect to the daemon, sync the admin doc, return helpers. */
export async function connectAdminPeer(opts: ConnectOptions = {}): Promise<AdminPeerHandle> {
  const port = opts.port ?? Number(process.env["LAR_PORT"] ?? 8080);
  const host = opts.host ?? "127.0.0.1";
  const bootstrap = opts.bootstrapPath ?? join(
    repoRoot, "packages", "lararium-node", "genesis", "social-bootstrap.json",
  );
  const timeout = opts.timeoutMs ?? 3000;
  const adminUrl = readAdminUrl(bootstrap);

  const adapter = new WebSocketClientAdapter(`ws://${host}:${port}/ws`);
  const repo    = new Repo({ network: [adapter] });

  // Wait for ready or fail fast.
  await Promise.race([
    adapter.whenReady(),
    new Promise<never>((_, rej) => setTimeout(
      () => rej(new Error(`could not reach lares daemon at ws://${host}:${port}`)),
      timeout,
    )),
  ]);

  const admin = await repo.find<MemeStoreDoc>(adminUrl as AutomergeUrl);
  await admin.whenReady();

  const composite = new CompositeStore();
  composite.addLayer({
    bagId:    ADMIN_BAG_ID,
    store:    new AutomergeDocStore(admin, ADMIN_BAG_ID),
    writable: true,
  });

  const disconnect = async (): Promise<void> => {
    await repo.flush();
    adapter.disconnect();
  };

  return { repo, composite, admin, disconnect };
}

export interface SubmitOptions {
  /** Polling interval in ms (default 100). */
  readonly pollMs?:   number;
  /** Total timeout in ms (default 10000). */
  readonly timeoutMs?: number;
}

export interface SubmitResult {
  readonly status:       "done" | "error";
  readonly result?:      Record<string, unknown>;
  readonly errorMessage?: string;
  readonly requestId:    string;
}

/**
 * Write a command-tiddler signal, poll for the durable log/<requestId>
 * audit-event tiddler appearing — its appearance IS the "done" signal.
 *
 * Under the split contract: signal-tiddler under cmd/<id> is fire-and-
 * forget; the dispatcher tombstones it. CLI never tombstones; a CLI crash
 * leaves no namespace residue.
 */
export async function submitCommand(
  peer:        AdminPeerHandle,
  command:     string,
  args:        Record<string, unknown>,
  requestedBy: string,
  opts:        SubmitOptions = {},
): Promise<SubmitResult> {
  const pollMs    = opts.pollMs    ?? 100;
  const timeoutMs = opts.timeoutMs ?? 10000;

  const cmdRecord = buildCommandTiddler({ command, args, requestedBy });
  const requestId = (cmdRecord.fields as Record<string, string>)["request-id"]!;
  const logTitle  = `${COMMAND_EVENT_URI_PREFIX}${requestId}`;

  await peer.composite.put(cmdRecord, { kind: "operator-import", sessionId: `lares-cli-${requestId}` });

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, pollMs));
    const event = await peer.composite.get(logTitle);
    if (!event || event.deleted) continue;
    const fields = event.fields as Record<string, string>;
    const status = fields["status"];
    if (status !== "done" && status !== "error") continue;

    let result: Record<string, unknown> | undefined;
    if (typeof fields["result"] === "string" && fields["result"].length > 0) {
      try { result = JSON.parse(fields["result"]); } catch { /* malformed — leave undefined */ }
    }
    const errorMessage = fields["error-message"];
    return {
      status:    status as "done" | "error",
      requestId,
      ...(result       !== undefined && { result }),
      ...(errorMessage !== undefined && { errorMessage }),
    };
  }

  throw new Error(`command "${command}" timed out after ${timeoutMs}ms`);
}

// Re-export so commands don't need a separate import path.
export { COMMAND_URI_PREFIX };
