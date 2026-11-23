/**
 * stay-home — THE ONE PREDICATE for a title no door reads or writes: the temp and state namespaces, the control and secret homes,
 * `cap/**` (`offerWithheldTitle`), the device-local filter (`localFilter`), and the volatile VM plane, the daemon's own scratch and
 * verb trail (`lar:///lararium.local.vm/…`). The tiddler door's gate and reader view and the internal meme reads all read it.
 *
 * Runs daemon-side (a plain module, never a plugin tiddler).
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/tiddler-verbs
 */

import { isVolatileVmUri, offerWithheldTitle, redactSecretShapes } from "@lararium/mesh";
import { localFilter } from "./record-port-projection.js";

/** True for a title that stays home: it answers no read and takes no write at any door. */
export const staysHome = (title: string): boolean => offerWithheldTitle(title) || localFilter(title) || isVolatileVmUri(title);

/**
 * THE HOUSE'S ALERTS READ, NAMED: a title under `$:/temp/lares/alert/` carries what the house raises for whoever reads the wiki
 * (a refused module, an orphaned slot, an unsaved write), the same words the wiki's own alert bar shows its face. It stays home
 * for every write (the house raises and clears it, never a door), yet the one read door reads it, so a seat or a hand outside
 * the browser sees what the house says (#444's owed outside read). Every other temp title still stays home.
 */
export const HOUSE_ALERT_PREFIX = "$:/temp/lares/alert/";

/** True for an alert the house raised: the one temp title the read door reads. */
export const isHouseAlert = (title: string): boolean => title.startsWith(HOUSE_ALERT_PREFIX) && title.length > HOUSE_ALERT_PREFIX.length;

/** True for a title no READ answers: what stays home, the house's alerts aside. Writes still read `staysHome` whole. */
export const withheldFromReads = (title: string): boolean => staysHome(title) && !isHouseAlert(title);

/**
 * AN ALERT LEAVES REDACTED: every string field of a house alert reads with each secret-shaped string redacted (the one scan,
 * `@lararium/mesh` `redactSecretShapes`, the list the keep guards with). The prefix reads at the door, so a secret a raise
 * quoted (a token in a fault, a key in a refused body) never crosses it; the engine keeps the alert as the house raised it.
 * Answers the fields to stand in its place, or null where no field holds a shape.
 */
export function redactedAlertFields(fields: Readonly<Record<string, unknown>>): Record<string, string> | null {
  const over: Record<string, string> = {};
  for (const [name, value] of Object.entries(fields)) {
    if (typeof value !== "string") continue;
    const { text, redacted } = redactSecretShapes(value);
    if (redacted > 0) over[name] = text;
  }
  return Object.keys(over).length > 0 ? over : null;
}
