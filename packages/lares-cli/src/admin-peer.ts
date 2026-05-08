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
  buildCommandTiddler, parseCommandTiddler, COMMAND_URI_PREFIX,
  type MemeStoreDoc, type CommandTiddler,
} from "@lararium/core";
import { repoRoot } from "@lares/lares";

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

  const adapter = new WebSocketClientAdapter(`ws://${host}:${port}`);
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
  /** True (default) tombstones the command-tiddler after reading the result. */
  readonly tombstoneAfterRead?: boolean;
}

export interface SubmitResult {
  readonly status:       "done" | "error";
  readonly result?:      Record<string, unknown>;
  readonly errorMessage?: string;
  readonly requestId:    string;
}

/**
 * Write a command-tiddler, poll the admin doc until the dispatcher writes
 * status=done|error, then optionally tombstone the command tiddler.
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
  const tombstone = opts.tombstoneAfterRead ?? true;

  const cmdRecord = buildCommandTiddler({ command, args, requestedBy });
  const requestId = (cmdRecord.fields as Record<string, string>)["request-id"]!;

  await peer.composite.put(cmdRecord, { kind: "operator-import", sessionId: `lares-cli-${requestId}` });

  const start = Date.now();
  let last: CommandTiddler | null = null;
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, pollMs));
    const current = await peer.composite.get(cmdRecord.title);
    if (!current) continue;
    const parsed = parseCommandTiddler(current);
    if (!parsed) continue;
    last = parsed;
    if (parsed.status === "done" || parsed.status === "error") break;
  }

  if (!last || (last.status !== "done" && last.status !== "error")) {
    throw new Error(`command "${command}" timed out after ${timeoutMs}ms`);
  }

  if (tombstone) {
    await peer.composite.tombstone(cmdRecord.title, {
      kind: "operator-import", sessionId: `lares-cli-${requestId}-cleanup`,
    });
  }

  return {
    status:    last.status,
    requestId,
    ...(last.result       !== undefined && { result:       last.result }),
    ...(last.errorMessage !== undefined && { errorMessage: last.errorMessage }),
  };
}

// Re-export so commands don't need a separate import path.
export { COMMAND_URI_PREFIX };
