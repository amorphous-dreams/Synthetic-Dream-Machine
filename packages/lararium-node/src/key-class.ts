/**
 * key-class — THE VESSEL'S KEY CENSUS. The vocabulary (`KEY_CLASSES`, `isKeyClass`) lives in mesh; this file
 * names every key-bearing file in the identity home by class for `vault status`.
 *
 * THE CENSUS READS THE ONE CARRIER TABLE (`vault-carriers`). It spells no filename of its own: a row that
 * carries a key names its class there, and every entry here derives from a row. A second list of key
 * filenames would drift from the table in both expensive directions — a key the census omits gets skipped
 * by a sweep that reports success, and a key the census invents gets written over by an act nobody owns.
 *
 * THREE AXES, AND NONE ANSWERS FOR ANOTHER.
 *   `class`   — WHAT KIND OF SECRET the file holds (`device-minted` · `seed` · `cloud-synced`).
 *   `custody` — WHERE THE VK HOLDS IT (`floor` · `floor-plain` · `hot` · `cold`), the table's class.
 *   `atRest`  — whether the passphrase seal lifecycle governs it, with `carrier` naming which carrier.
 * One class spans several custodies: three files read `class: "seed"` and all three rest `cold`, yet only
 * two of them ride the passphrase lifecycle. A sweep keyed on one axis reports success on what another
 * axis says it skipped.
 */

// The vocabulary lives once, in mesh; the node re-exports it beside the census that reads the identity dir.
import { KEY_CLASSES, isKeyClass, type KeyClass } from "@lararium/mesh";
import { identityCarrierCensus, type CarrierName, type CustodyClass } from "./vault-carriers.js";
export { KEY_CLASSES, isKeyClass, type KeyClass };

/**
 * Whether the passphrase seal lifecycle governs a key — orthogonal to `class` and to `custody`.
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
  /** Where the VK holds it — the carrier table's class for the row this file matched. */
  readonly custody: CustodyClass;
  /** The passphrase seal lifecycle's governance — see `KeyAtRest`. Derived from the same row. */
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
 * Census the identity home: every key-bearing file, named and classed, with its custody. A card is PUBLIC
 * and carries no key, so it never lists. An absent or unreadable home names no keys and faults nothing — the
 * status line still renders.
 */
export function vesselKeyCensus(identityDir: string): KeyCensusEntry[] {
  const out: KeyCensusEntry[] = [];
  for (const e of identityCarrierCensus(identityDir)) {
    if (e.keyClass === null) continue;
    const atRest: KeyAtRest = e.lifecycle ? "sealed" : "cleartext";
    out.push({ name: e.name, class: e.keyClass, file: e.file, custody: e.custody, atRest, carrier: e.lifecycle });
  }
  return out;
}
