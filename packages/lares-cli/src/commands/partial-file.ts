/**
 * partial-file — the file half of the two-vault door: check an `--out` before any act runs, and write the partial
 * a person carries to the other vault. The contract door (`nexus.ts`) and the kapae door (`nexus-kapae-cmd.ts`)
 * both import it, each handing in its own refusal class, so a refusal reads as that door's own.
 *
 * This module holds no reference back into either door; the dependency runs one way, parent to child.
 */
import { accessSync, constants as fsConstants, existsSync, statSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { atomicWriteFileSync } from "@lararium/node";

/** What a partial write answers: the path it landed at, or null with the error that stopped it. */
export interface PartialWritten { readonly path: string | null; readonly error?: string }

/**
 * Refuse an `--out` the write could not take BEFORE the act runs: a landed act whose grown partial never reached
 * its file would strand the other vault (a retry here reads replay). The input file stays as the person carried it.
 * `refuse` builds the door's own refusal Error from the message.
 */
export function partialOutOrRefuse(refuse: (msg: string) => Error, out: string, from?: string): string {
  if (from !== undefined && resolvePath(out) === resolvePath(from)) throw refuse(`--out names the partial you carried (${from}); name another file, so the carried one stays as it came`);
  const dir = dirname(resolvePath(out));
  if (!existsSync(dir)) throw refuse(`--out ${out}: its directory does not exist, so the partial could not land there`);
  if (existsSync(out) && statSync(out).isDirectory()) throw refuse(`--out ${out} names a directory; name a file`);
  try { accessSync(dir, fsConstants.W_OK); } catch { throw refuse(`--out ${out}: its directory refuses a write`); }
  return out;
}

/**
 * Write one partial file a person carries to the other vault; it holds public material alone. A write that fails
 * after the act ran never hides the act: the step still reports, and prints the partial for the person to carry.
 */
export function writePartialFile(path: string, partial: unknown): PartialWritten {
  try { atomicWriteFileSync(path, `${JSON.stringify(partial, null, 2)}\n`, `${path}.writing`); return { path }; }
  catch (err) { return { path: null, error: `--out ${path}: ${err instanceof Error ? err.message : String(err)}` }; }
}
