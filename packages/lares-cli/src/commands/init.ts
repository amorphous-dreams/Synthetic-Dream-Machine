/**
 * `lares init` — bootstrap a new Lararium node.
 *
 * Thin shim over `runInit` from @lararium/node. Idempotent; pass --force to
 * re-seed when genesis/social-bootstrap.json already lives on disk.
 *
 * Flags:
 *   --force        Re-seed even when bootstrap artifact exists.
 *   --storage DIR  Override Automerge NodeFS storage directory (else LAR_STORAGE env or default).
 *   --genesis DIR  Override genesis/ directory.
 */

import { runInit } from "@lararium/node";
import type { ParsedArgs } from "../parse-args.js";

export async function cmdInit(args: ParsedArgs): Promise<number> {
  const opts: Parameters<typeof runInit>[0] = {};
  if (args.flags["force"])      Object.assign(opts, { force: true });
  if (args.options["storage"])  Object.assign(opts, { storageDir: args.options["storage"] });
  if (args.options["genesis"])  Object.assign(opts, { genesisDir: args.options["genesis"] });
  await runInit(opts);
  return 0;
}
