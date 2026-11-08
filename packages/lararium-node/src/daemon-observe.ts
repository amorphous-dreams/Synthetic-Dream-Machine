/**
 * daemon-observe — the ONE-WAY, read-only render of the daemon bag (`bags/daemon`) under
 * `<projections>/observe/daemon/`.
 *
 * The daemon bag stays the CRDT-only control plane: its titles, `DAEMON_BAG_ID` and `isControlPlaneUri` hold as they
 * stand, and the ordinary disk projector never mirrors it. This writer gives an operator something to READ: each record
 * under the bag path lands as one JSON file at `<observe>/<path under the bag>.json`, rewritten as the record moves and
 * removed as it leaves.
 *
 * NOTHING COMES BACK. The writer keeps no agreement record (no Synced-tree row), stands no take-disk door, and reads
 * nothing off the disk; the ingest path refuses any file under `<projections>/observe` by name
 * (`isObserveProjectionPath`). An edit to an observe file changes nothing in the store, and the record's next move
 * writes over it.
 *
 * WHAT NEVER LANDS. The cap family (`bags/daemon/cap/**`, raw Keyhive event bytes) stays out whole. In every record
 * that lands, a field whose NAME matches {@link REDACTED_FIELD} reads `<redacted>` — at the top level and inside any
 * field whose value parses as a JSON object or list (the outcome, mailbox, delegate and face-row payloads carry theirs
 * there).
 *
 * One toggle governs it: `projection.observeDaemon` in `<root>/config/config.json`, ON when absent.
 */

import { readdirSync, rmdirSync, unlinkSync, mkdirSync } from "node:fs";
import { dirname, join, resolve as resolvePath, sep } from "node:path";
import { DAEMON_BAG_ID, type LarTiddlerStore } from "@lararium/mesh";
import { confineMirrorWrite } from "./bag-paths.js";
import { atomicWriteFileSync } from "./fs-atomic.js";
import { PROJECTION_FILE_MODE } from "./disk-projector.js";

/** A field NAME the observe render withholds: its value reads `<redacted>`. */
export const REDACTED_FIELD = /secret|passphrase|seed|private|token|key-bytes/i;
/** The value a withheld field reads. */
export const REDACTED = "<redacted>";
/** The family that never lands: raw Keyhive cap events. */
const CAP_FAMILY = "cap";

/** Whether the config toggles the observe render on: `projection.observeDaemon`, ON when absent. A non-boolean throws. */
export function observeDaemonEnabled(cfg: { readonly projection?: unknown }): boolean {
  const projection = cfg.projection;
  if (projection === undefined) return true;
  if (projection === null || typeof projection !== "object" || Array.isArray(projection)) throw new Error("[lares config] projection must be an object");
  const value = (projection as { observeDaemon?: unknown }).observeDaemon;
  if (value === undefined) return true;
  if (typeof value !== "boolean") throw new Error("[lares config] projection.observeDaemon must be a boolean");
  return value;
}

/** The path a daemon title renders at, relative to the observe root, or null for a title that never lands. */
export function observeRelPath(title: string): string | null {
  const prefix = `${DAEMON_BAG_ID}/`;
  if (!title.startsWith(prefix)) return null;
  const rest = title.slice(prefix.length).split("#")[0]!;
  const segments = rest.split("/");
  if (segments.length === 0 || segments[0] === CAP_FAMILY) return null;
  if (segments.some((seg) => seg.length === 0 || seg === "." || seg === ".." || /[\\\0]/.test(seg))) return null;
  return `${segments.join("/")}.json`;
}

/** Withhold every field whose name matches {@link REDACTED_FIELD}, walking objects, lists and JSON-bearing strings. */
export function redactFields(value: unknown, depth = 0): unknown {
  if (depth > 32) return value;
  if (Array.isArray(value)) return value.map((v) => redactFields(v, depth + 1));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) =>
      [k, REDACTED_FIELD.test(k) ? REDACTED : redactFields(v, depth + 1)]));
  }
  if (typeof value === "string") {
    const trimmed = value.trimStart();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try { return JSON.stringify(redactFields(JSON.parse(value), depth + 1)); } catch { /* prose that opens with a brace stays prose */ }
    }
  }
  return value;
}

/** The bytes one record renders as. */
export function observeBody(fields: Record<string, unknown>): string {
  return `${JSON.stringify(redactFields(fields), null, 2)}\n`;
}

/** A mounted observe render: stop it, or wait until every change it heard has landed. */
export interface DaemonObserve {
  readonly stop: () => void;
  readonly idle: () => Promise<void>;
}

/**
 * Mount the observe render of `store` (the daemon bag's own store) under `observeRoot`. The first pass renders every
 * landing record; each later change rewrites or removes its one file. Writes run one at a time, in arrival order.
 */
export function mountDaemonObserve(store: LarTiddlerStore, observeRoot: string): DaemonObserve {
  const root = resolvePath(observeRoot);
  let chain: Promise<void> = Promise.resolve();
  let stopped = false;
  const land = (title: string): void => {
    const rel = observeRelPath(title);
    if (rel === null) return;
    chain = chain.then(async () => {
      if (stopped) return;
      const gate = confineMirrorWrite(root, rel);
      if (!gate.ok) { console.error(`[daemon-observe] refused ${title}: ${gate.reason}`); return; }
      const record = await store.get(title.split("#")[0]!);
      if (stopped) return;
      if (!record || record.meta?.deleted) { removeAt(root, gate.path); return; }
      mkdirSync(dirname(gate.path), { recursive: true });
      atomicWriteFileSync(gate.path, observeBody(record.tiddler), `${gate.path}.lar-tmp-${process.pid}`, { mode: PROJECTION_FILE_MODE });
    }).catch((err: unknown) => { console.error(`[daemon-observe] ${title}: ${err instanceof Error ? err.message : String(err)}`); });
  };
  const unsubscribe = store.subscribe((change) => land(change.title));
  chain = chain.then(async () => { for (const title of await store.listVisible()) land(title); });
  return {
    stop: () => { stopped = true; unsubscribe(); },
    idle: async () => { let seen: Promise<void>; do { seen = chain; await seen; } while (seen !== chain); },
  };
}

/** Remove one observe file and the dirs it leaves empty, never above the observe root. */
function removeAt(root: string, path: string): void {
  try { unlinkSync(path); } catch { return; }
  for (let dir = dirname(path); dir.startsWith(root + sep); dir = dirname(dir)) {
    try { if (readdirSync(dir).length > 0) return; rmdirSync(dir); } catch { return; }
  }
}

/** The observe file a title renders at under `observeRoot`, or null for one that never lands (tests, the CLI). */
export function observeFileOf(observeRoot: string, title: string): string | null {
  const rel = observeRelPath(title);
  return rel === null ? null : join(observeRoot, rel);
}
