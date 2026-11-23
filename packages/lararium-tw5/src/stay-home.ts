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
 * THE HOUSE'S ALERTS READ, NAMED, KIND BY KIND: a title under `$:/temp/lares/alert/` carries what the house raises for whoever
 * reads the wiki. The read door opens only the kinds `ALERT_READS` names, and of each only the fields it names; every other
 * kind stays home whole (a parallel draft holds the draft's own words, an unrouted save its body, a handler refusal an error
 * that may quote one), and so does every write. An alert that names a record answers only a reader of that record's bag
 * (`alertNamedTitles`, gated in the reader's view), and an alert leaves with every secret shape redacted (`redactedAlertFields`).
 * #444's owed outside read rides this exception; the meme lens never reads an alert (an alert holds no meme).
 */
export const HOUSE_ALERT_PREFIX = "$:/temp/lares/alert/";

/** The fields every open kind reads; a kind adds its own. */
const ALERT_BASE_FIELDS = ["title", "text", "tags", "alert-kind"] as const;

/**
 * THE KINDS THE READ DOOR OPENS, each with the fields it reads and the record titles it names (the title after the kind, or a
 * field's list). A kind absent here stays home.
 */
export const ALERT_READS: Readonly<Record<string, { readonly fields: readonly string[]; readonly names: (rest: string, fields: Readonly<Record<string, unknown>>) => string[] }>> = Object.freeze({
  // A refusal names an engine's module, plugin or prompt (`refused/<kind>/<title>`), never a record a bag holds.
  "refused":        { fields: [], names: () => [] },
  // The root stands absent by the alert's own meaning; the orphans it lists stand, each in its bag.
  "meme-orphan":    { fields: ["orphans"], names: (_rest, f) => titleList(f["orphans"]) },
  "unsaved":        { fields: [], names: (rest) => [rest] },
  "landing-failed": { fields: [], names: (rest) => [rest] },
  "engine-waiting": { fields: ["cause"], names: () => [] },
  "reboot-pending": { fields: ["cause"], names: () => [] },
  "boot-fault":     { fields: ["component"], names: () => [] },
});

/** A TiddlyWiki title list (`a [[b c]] d`) read into its titles. */
function titleList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== "string") return [];
  const out: string[] = [];
  for (const m of value.matchAll(/\[\[([^\]]*)\]\]|(\S+)/g)) out.push(m[1] ?? m[2]!);
  return out;
}

/**
 * The title's path after the prefix with its dot segments resolved, or null where it climbs out of the prefix. A title that
 * names a `.` or `..` segment never reads as the alert it resolves to: only a title that already stands resolved opens.
 */
function alertRest(title: string): string | null {
  if (!title.startsWith(HOUSE_ALERT_PREFIX)) return null;
  const parts: string[] = [];
  for (const seg of title.slice(HOUSE_ALERT_PREFIX.length).split("/")) {
    if (seg === ".") continue;
    if (seg === "..") { if (parts.length === 0) return null; parts.pop(); continue; }
    parts.push(seg);
  }
  const rest = parts.join("/");
  return rest === "" || HOUSE_ALERT_PREFIX + rest !== title ? null : rest;
}

/** The kind an alert title names (its first segment), with the rest, or null where the title opens no alert. */
function alertKind(title: string): { readonly kind: string; readonly rest: string } | null {
  const rest = alertRest(title);
  if (rest === null) return null;
  const at = rest.indexOf("/");
  return at < 0 ? { kind: rest, rest: "" } : { kind: rest.slice(0, at), rest: rest.slice(at + 1) };
}

/** True for an alert the house raised under the prefix, its path standing resolved. */
export const isHouseAlert = (title: string): boolean => alertRest(title) !== null;

/** True for an alert whose kind the read door opens (`ALERT_READS`). */
export const isOpenAlert = (title: string): boolean => { const k = alertKind(title); return k !== null && Object.hasOwn(ALERT_READS, k.kind); };

/** True for a title no READ answers: what stays home, the open alert kinds aside. Writes still read `staysHome` whole. */
export const withheldFromReads = (title: string): boolean => staysHome(title) && !isOpenAlert(title);

/** The record titles an open alert names: its reader must read the bag of each, or the alert reads absent. */
export function alertNamedTitles(title: string, fields: Readonly<Record<string, unknown>>): string[] {
  const k = alertKind(title);
  if (k === null || !Object.hasOwn(ALERT_READS, k.kind)) return [];
  return ALERT_READS[k.kind]!.names(k.rest, fields).filter((t) => t !== "");
}

/**
 * AN ALERT LEAVES WITH ITS OPEN FIELDS ALONE, REDACTED: the fields its kind opens, each string redacted of every secret shape
 * and each list element-wise (`@lararium/mesh` `redactSecretShapes`, strict at this door: no fixture stands, bare minted hex
 * and every private-key block go). Answers the fields to stand in the alert's place, or null where its kind opens none.
 */
export function redactedAlertFields(title: string, fields: Readonly<Record<string, unknown>>): Record<string, unknown> | null {
  const k = alertKind(title);
  if (k === null || !Object.hasOwn(ALERT_READS, k.kind)) return null;
  const strict = { allow: [], mintedHex: true, everyKeyBlock: true } as const;
  const clean = (v: string): string => redactSecretShapes(v, strict).text;
  const out: Record<string, unknown> = {};
  for (const name of [...ALERT_BASE_FIELDS, ...ALERT_READS[k.kind]!.fields]) {
    const value = fields[name];
    if (name === "title") { out[name] = title; continue; }
    if (typeof value === "string") out[name] = clean(value);
    else if (Array.isArray(value)) out[name] = value.map((v) => (typeof v === "string" ? clean(v) : v));
  }
  return out;
}
