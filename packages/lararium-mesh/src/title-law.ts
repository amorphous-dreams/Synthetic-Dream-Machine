/**
 * title-law — a session-form URI never stands as a TITLE.
 *
 * `lar://alias:grant@host/path` names a speaker and a grant through its userinfo. In a record's TEXT that
 * reads lawful: a body takes a tier, a redaction and a tombstone. A title stands as a KEY, and a key takes
 * none of the three: a tombstone marks a record deleted and leaves its key standing, and a tombstone
 * written against an absent title MINTS the key. So a session-form title freezes alias × grant × host into
 * a key that replicates to every peer and outlives the grant it names
 * (`lar:///ha.ka.ba/lares/api/pono/lar-uri#/security`).
 *
 * THE TEST READS THE TITLE SLOT, NEVER THE TEXT, and it reads by parse: the first literal `@` inside an
 * authority terminates a userinfo and can terminate nothing else. A host that carries a percent-encoded
 * `@` (`%40`) would hide that boundary from this very test, so the scheme forbids it and this law refuses
 * it. A hostful title (`lar://host/path`) and a hostless one (`lar:///path`) both stand.
 *
 * ONE DOOR. Every record a document rests takes the stored shape (`stored-record.ts`, `storedRecord`), and
 * that constructor calls {@link assertStorableTitle}: a store write, a registry row and a board row all
 * refuse there. A store asserts once more ahead of its change, over every put and every tombstone (a
 * tombstone against an absent title mints the key), so a family refuses whole before any byte moves. No
 * verb, route or shore carries a check of its own. A reactor that answers per carrier reads
 * {@link storableTitleFault} ahead of its write and names the refusal in its row; the door still stands
 * behind it.
 *
 * The refusal REPORTS and never drops in silence: a verb answers it by name, and the wiki shore raises its
 * `unsaved` alert and keeps the record in the wiki where its author still sees it.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/lar-uri
 */

import { VerbRefusal } from "./verb-refusal.js";

/** The code a session-form title refuses under. */
export const SESSION_FORM_TITLE_CODE = "session-form-title";

/** The authority of a `lar:` URI: the span from `lar://` to the first `/`, `?` or `#`. Null for any other string. */
function larAuthorityOf(uri: string): string | null {
  if (uri.slice(0, 6).toLowerCase() !== "lar://") return null;
  const rest = uri.slice(6);
  const end = rest.search(/[/?#]/);
  return end === -1 ? rest : rest.slice(0, end);
}

/** The userinfo a `lar:` URI's authority carries ahead of its first literal `@`, or null where it carries none. */
export function larUserinfoOf(uri: string): string | null {
  const authority = larAuthorityOf(uri);
  if (authority === null) return null;
  const at = authority.indexOf("@");
  return at === -1 ? null : authority.slice(0, at);
}

/**
 * Why a title cannot stand as a storage key, or null where it can. A string that names no `lar://`
 * authority (a plain title, an address with `@` in its path) answers null: the law binds the authority's
 * userinfo slot and nothing else.
 */
export function storableTitleFault(title: string): string | null {
  const authority = larAuthorityOf(title);
  if (authority === null) return null;
  if (authority.includes("@")) {
    return `${SESSION_FORM_TITLE_CODE}: "${title}" carries a userinfo ahead of its host, and a session-form URI never stands as a title. Title the record by an address that names no speaker (lar://host/path or lar:///path) and keep the speaker's URI in its text.`;
  }
  if (/%40/i.test(authority)) {
    return `${SESSION_FORM_TITLE_CODE}: "${title}" hides a userinfo boundary behind a percent-encoded \`@\` in its host, which no lar: host may carry; the title refuses as a session form.`;
  }
  return null;
}

/** A store's refusal of a title that carries a userinfo. */
export class SessionFormTitleRefusal extends VerbRefusal {
  constructor(readonly title: string, message: string) {
    super(SESSION_FORM_TITLE_CODE, message);
  }
}

/** THE DOOR'S CHECK: throws {@link SessionFormTitleRefusal} for a title that cannot stand as a key. */
export function assertStorableTitle(title: string): void {
  const fault = storableTitleFault(title);
  if (fault !== null) throw new SessionFormTitleRefusal(title, fault);
}
