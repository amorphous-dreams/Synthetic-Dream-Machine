/**
 * stay-home — THE ONE PREDICATE for a title no door reads or writes: the temp and state namespaces, the control and secret homes,
 * `cap/**` (`offerWithheldTitle`), the device-local filter (`localFilter`), and the volatile VM plane, the daemon's own scratch and
 * verb trail (`lar:///lararium.local.vm/…`). The tiddler door's gate and reader view and the internal meme reads all read it.
 *
 * Runs daemon-side (a plain module, never a plugin tiddler).
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/tiddler-verbs
 */

import { isVolatileVmUri, offerWithheldTitle } from "@lararium/mesh";
import { localFilter } from "./record-port-projection.js";

/** True for a title that stays home: it answers no read and takes no write at any door. */
export const staysHome = (title: string): boolean => offerWithheldTitle(title) || localFilter(title) || isVolatileVmUri(title);
