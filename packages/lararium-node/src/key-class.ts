/**
 * key-class — THE VESSEL'S KEY CENSUS. The vocabulary (`KEY_CLASSES`, `isKeyClass`) lives in mesh; this file
 * reads the identity dir and names every key-bearing file by class for `vault status`.
 */

import { existsSync, readdirSync } from "node:fs";

// The vocabulary lives once, in mesh; the node re-exports it beside the census that reads the identity dir.
import { KEY_CLASSES, isKeyClass, type KeyClass } from "@lararium/mesh";
export { KEY_CLASSES, isKeyClass, type KeyClass };

/** One key the vessel holds, by name and class; the file that carries it, for the operator's eye. */
export interface KeyCensusEntry {
  readonly name:  string;
  readonly class: KeyClass;
  readonly file:  string;
}

/**
 * Census the identity dir: every key-bearing file, named and classed. A card is PUBLIC and never listed.
 * An absent or unreadable dir names no keys and faults nothing — the status line still renders.
 */
export function vesselKeyCensus(identityDir: string): KeyCensusEntry[] {
  let names: string[];
  try { names = existsSync(identityDir) ? readdirSync(identityDir) : []; } catch { return []; }
  const out: KeyCensusEntry[] = [];
  for (const f of names.sort()) {
    if (/^\.vessel-key(-[^.]+)?\.json$/.test(f))                   out.push({ name: "vessel-key", class: "device-minted", file: f });
    else if (f === "veil-archive.bin")                              out.push({ name: "veil",       class: "device-minted", file: f });
    else if (f === "keyhive-archive.bin")                           out.push({ name: "keyhive-archive", class: "device-minted", file: f });
    else {
      const root = /^\.persona-group-root(?:-[^.]+?)?-h(\d+)\.json$/.exec(f);
      if (root)                                                     out.push({ name: `persona-root-h${root[1]}`, class: "seed", file: f });
      else if (/^recovery-device-share-h\d+\.bin$/.test(f))       out.push({ name: f.replace(/\.bin$/, ""), class: "seed", file: f });
      else if (f === "seal-reserve-mine-share.bin")                 out.push({ name: "seal-reserve-mine-share", class: "seed", file: f });
    }
  }
  return out;
}
