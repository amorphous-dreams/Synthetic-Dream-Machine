/**
 * key-class — THE VESSEL'S KEY CENSUS. The vocabulary (`KEY_CLASSES`, `isKeyClass`) lives in mesh; this file
 * reads the identity dir and names every key-bearing file by class for `vault status`.
 *
 * TWO AXES, AND NEITHER ANSWERS FOR THE OTHER. `class` names WHAT KIND OF SECRET a file holds; `atRest`
 * names WHO HOLDS IT AT REST. They are genuinely independent, and one class spans both regimes: three
 * files read `class: "seed"` — `recovery-device-share-h{N}.bin`, `seal-reserve-mine-share.bin`, and
 * `.persona-group-root-…-h{N}.json` — and only the first two ride the vault's at-rest seal lifecycle.
 *
 * WHY THE SECOND AXIS, RATHER THAN A SPLIT CLASS. A hand that writes "re-seal every `seed`-class carrier
 * under the new passphrase" and iterates a one-axis census either writes over a file the lifecycle does not
 * own, or SKIPS it silently and reports "all seeds re-sealed" over a cleartext root. A sweep over a class
 * that names two regimes reports success on what it skipped. `class` is not wrong — it is INCOMPLETE, so
 * the cure adds the missing axis and leaves the class alone. Same shape as presence ⊥ readability in
 * `readArchiveOpening`, and as custody ⊥ materialization in the civic cap model.
 *
 * THE CUSTODY FACT IS DERIVED, NEVER HAND-SPELLED PER FILENAME. The authority on "the vault holds this at
 * rest" is the vault's own carrier enumeration, which lives once in `vault-carriers` and which
 * `archive-passphrase` reads for the very same set. A hand-list here would be a SECOND derivation of one
 * fact, and it would drift in both expensive directions (a governed carrier the census omits gets skipped
 * by a sweep that reports success; a carrier the census invents gets written over by a sweep no rotate
 * owns). `key-class.test` pins the agreement in BOTH directions so the drift cannot return.
 */

import { existsSync, readdirSync } from "node:fs";

// The vocabulary lives once, in mesh; the node re-exports it beside the census that reads the identity dir.
import { KEY_CLASSES, isKeyClass, type KeyClass } from "@lararium/mesh";
import { vaultCarrierMap, type CarrierName } from "./vault-carriers.js";
export { KEY_CLASSES, isKeyClass, type KeyClass };

/**
 * Who holds a key AT REST — the custody axis, orthogonal to `class`.
 *
 * `sealed`    — the vault's at-rest seal lifecycle GOVERNS this file: `vault seal` seals it, `rotate`
 *               re-seals it, `repair` reconciles it, `status` reports its state, and `export` refuses to
 *               land on it. It names GOVERNANCE, not the bytes standing there this instant: a vessel under
 *               the cleartext policy holds bare bytes in a governed carrier, and that CURRENT byte state is
 *               a third fact, reported per-carrier by `archiveSealStatus().carriers[name].state`. The
 *               `carrier` field below is the join key between the two.
 * `cleartext` — NO seal lifecycle reaches this file. It rides the identity dir's file mode and nothing else.
 */
export type KeyAtRest = "sealed" | "cleartext";

/** One key the vessel holds, by name and class; the file that carries it, for the operator's eye. */
export interface KeyCensusEntry {
  readonly name:  string;
  readonly class: KeyClass;
  readonly file:  string;
  /** The CUSTODY axis — see `KeyAtRest`. Derived from the vault's own enumeration, never hand-spelled. */
  readonly atRest: KeyAtRest;
  /**
   * WHICH vault carrier holds it, when one does; `null` when none does. Null STATES "no carrier owed" — it
   * never loses one, because `atRest` already carries that fact and the two are derived in one step. The
   * name joins this entry to `archiveSealStatus().carriers`, so an operator reading a custody fact can
   * reach the byte-state fact beside it without either output guessing at the other.
   */
  readonly carrier: CarrierName | null;
}

/**
 * Census the identity dir: every key-bearing file, named and classed, with its custody. A card is PUBLIC
 * and never listed. An absent or unreadable dir names no keys and faults nothing — the status line still
 * renders.
 */
export function vesselKeyCensus(identityDir: string): KeyCensusEntry[] {
  let names: string[];
  try { names = existsSync(identityDir) ? readdirSync(identityDir) : []; } catch { return []; }
  // ONE ASK, ONE ANSWER: the vault names which files it governs in THIS dir, and every entry's custody
  // reads off that map. Nothing below spells a carrier filename of its own.
  const governed = vaultCarrierMap(identityDir);
  const custody = (file: string): Pick<KeyCensusEntry, "atRest" | "carrier"> => {
    const carrier = governed.get(file);
    return carrier ? { atRest: "sealed", carrier } : { atRest: "cleartext", carrier: null };
  };
  const out: KeyCensusEntry[] = [];
  const add = (name: string, cls: KeyClass, file: string): void => {
    out.push({ name, class: cls, file, ...custody(file) });
  };
  for (const f of names.sort()) {
    if (/^\.vessel-key(-[^.]+)?\.json$/.test(f))                    add("vessel-key", "device-minted", f);
    else if (f === "veil-archive.bin")                              add("veil", "device-minted", f);
    else if (f === "keyhive-archive.bin")                           add("keyhive-archive", "device-minted", f);
    else {
      const root = /^\.persona-group-root(?:-[^.]+?)?-h(\d+)\.json$/.exec(f);
      if (root)                                                     add(`persona-root-${`h${root[1]}`}`, "seed", f);
      else if (/^recovery-device-share-h\d+\.bin$/.test(f))         add(f.replace(/\.bin$/, ""), "seed", f);
      else if (f === "seal-reserve-mine-share.bin")                 add("seal-reserve-mine-share", "seed", f);
    }
  }
  return out;
}
