/**
 * social-doc — Automerge doc shapes for the social plane.
 *
 * Social plane = three root docs parallel to the content Tiga (ha/ka/ba):
 *
 *   @identities  IdentitiesDoc  — stable principal records
 *   @groups      GroupsDoc      — collective authority + durable membership
 *   @sessions    SessionsDoc    — live operator-agent session docs
 *
 * Each social doc uses the same tiddler-store convention as LarariumDoc / LaresDoc:
 *   - `tiddlers` Record<title, MutableLarRecord>
 *   - self-reference tiddler: tiddlers[SOCIAL_DOC_URI].text = automerge: URL
 *   - oracle tiddler in LarariumDoc.tiddlers[SOCIAL_DOC_URI].text = automerge: URL
 *
 * Bag law: bag ID = lar: URI of the owning doc (IDENTITIES_DOC_URI, etc.)
 *
 * Social docs have no child-doc layer at M21.  Sessions may acquire a pos-2
 * child-doc slot (lar:///ha.ka.ba/@sessions/@{sessionSlug}) in a later milestone.
 *
 * Meme: lar:///ha.ka.ba/@lararium/core/v0.1/social-doc
 */

import type { MutableLarRecord } from "./meme-store-doc.js";

// ---------------------------------------------------------------------------
// IdentitiesDoc — stable principal records
// ---------------------------------------------------------------------------

export interface IdentityRecord {
  /** Stable stable DID or local principal identifier. */
  readonly did:         string;
  /** Human-readable display name for UX. */
  readonly displayName: string;
  /** ISO 8601 creation timestamp. */
  readonly createdAt:   string;
  /** Principal kind: operator, agent, service, device. */
  readonly kind:        "operator" | "agent" | "service" | "device";
}

export interface IdentitiesDoc {
  readonly schemaVersion: string;
  /** Tiddler oracle tiddlers: self-ref + any cross-doc pointers. */
  readonly tiddlers?:     Record<string, Readonly<MutableLarRecord>>;
  /** Principal records keyed by DID. */
  readonly principals?:   Record<string, IdentityRecord>;
}

export function emptyIdentitiesDoc(): IdentitiesDoc {
  return { schemaVersion: "0.1", tiddlers: {}, principals: {} };
}

// ---------------------------------------------------------------------------
// GroupsDoc — collective authority + durable membership
// ---------------------------------------------------------------------------

export interface GroupRecord {
  readonly id:          string;
  readonly displayName: string;
  readonly createdAt:   string;
  /** DID list of current members. */
  readonly memberDids:  readonly string[];
}

export interface GroupsDoc {
  readonly schemaVersion: string;
  readonly tiddlers?:     Record<string, Readonly<MutableLarRecord>>;
  readonly groups?:       Record<string, GroupRecord>;
}

export function emptyGroupsDoc(): GroupsDoc {
  return { schemaVersion: "0.1", tiddlers: {}, groups: {} };
}

// ---------------------------------------------------------------------------
// SessionsDoc — live operator-agent session docs
// ---------------------------------------------------------------------------

export interface SessionRecord {
  readonly id:          string;
  readonly operatorDid: string;
  readonly agentId:     string;
  readonly startedAt:   string;
  readonly state:       "active" | "closed";
}

export interface SessionsDoc {
  readonly schemaVersion: string;
  readonly tiddlers?:     Record<string, Readonly<MutableLarRecord>>;
  readonly sessions?:     Record<string, SessionRecord>;
}

export function emptySessionsDoc(): SessionsDoc {
  return { schemaVersion: "0.1", tiddlers: {}, sessions: {} };
}
