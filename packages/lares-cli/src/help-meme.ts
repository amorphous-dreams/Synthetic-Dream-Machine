/**
 * help-meme — the WIKI REACH behind `lares <door> --help --meme`.
 *
 * A verb door's help names the meme standing behind it (`command-help.ts`, `meme:`); this reach READS that
 * meme. It writes no reader of its own: the URI goes straight to `cmdMeme`, the same mouth `lares meme get`
 * uses, which rides the daemon `meme-get` verb. So the fetch runs wherever the vessel runs — phone, node,
 * browser — for any vessel holding the cap, and the help path itself touches no filesystem.
 *
 * A DOOR THAT NAMES NO MEME SAYS SO AND EXITS CLEAN. Naming no record describes the registry, not a fault:
 * refusing with an error code would teach an operator that `--meme` broke when nothing did.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/handoff
 */

import { memeForDoor } from "./command-help.js";
import { cmdMeme } from "./commands/meme.js";
import type { ParsedArgs } from "./parse-args.js";

/** The meme reader this reach hands the URI to — injectable so a test never dials a daemon. */
export type MemeReader = (args: ParsedArgs) => Promise<number>;

/**
 * Read the meme behind one verb door. Returns 0 when the door names none (with a plain word on stderr),
 * else whatever the meme rail returns.
 */
export async function reachHelpMeme(door: string, args: ParsedArgs, read: MemeReader = cmdMeme): Promise<number> {
  const uri = memeForDoor(door);
  if (!uri) {
    console.error(`lares ${door}: this door names no meme — its help above is the whole record.`);
    return 0;
  }
  // The same argument shape `lares meme get <uri>` parses: the door's flags never ride along, so a
  // `--help` on the help call cannot re-enter the meme door's own help.
  const passthrough: ParsedArgs = {
    command:    "meme",
    positional: ["get", uri],
    options:    {},
    flags:      args.flags["json"] === true ? { json: true } : {},
  };
  return await read(passthrough);
}
