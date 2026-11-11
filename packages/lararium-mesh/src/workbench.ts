/**
 * workbench — EVERY WIKI'S WORKING LAYER RESTS IN A REALM WORKBENCH (cabal-realm#/the-workbench). The daemon wiki alone keeps
 * its face-private working document (the AI-memory ruling).
 *
 * THE RULINGS (operator, 2026-11-11): "the multitude of faces reads as a private cabal for 1 human. Pattern integrities!";
 * "Personal can absorb the new caps."; "Unpono, rip out old code, enact the full new design, early-alpha law holds." One path
 * stands: a wiki's first stand under a face founds a private cabal of one (a glamour-less, announce-less cabal realm under the
 * seed charter whose Keyhive Document seats the owning face's PersonaGroup alone), and the wiki's working slot
 * (`wikis/<slug>/working`) resolves to that realm's workbench. A share row seats more faces in the same Document; it never
 * moves the address or the layer. A face's private margin over the shared layer rests in `personal`.
 *
 * WHAT THIS MODULE HOLDS (platform-blind, no key, no Keyhive):
 *   · the workbench's ADDRESS (`realmWorkbenchDocUrl`, deterministic-doc): a sibling of the realm's vouch board, derived
 *     from the realm id and the slug, so no member change moves it;
 *   · the vessel LEDGER rows that bind a slug to its realm, and the seats this vessel's own hand made there;
 *   · the REFUSALS: the daemon wiki stays face-private, a checkout-sourced slug never rests a shared private mirror, and one
 *     wiki never registers under two realms;
 *   · the wire DECIDER the protected-document guard asks for a workbench document (`realm-workbench`).
 *
 * WHY THE LEDGER, AND WHY NOT `noteRealm`. The vessel's own ledger (`edgeLedgerDocUrl`) keeps the relations this vessel
 * entered, where no other operator reads them. `noteRealm` stands a realm PLANE and reads its boards; a private cabal keeps
 * no vouch board, no announce row and no registration, so its slug notes under a `workbench` row of its own and the realm
 * planes never stand for it.
 *
 * NO GLOBAL NOW. Membership rides the realm Document's convergent add and revoke (Keyhive): no lease, no epoch, no counter.
 * A removal converges as its tombstone syncs; a hard cut forks the realm (a new realm id, so a new address).
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/cabal-realm#/the-workbench
 */
import type { LarDoc } from "./base-doc.js";
import { tiddlerText } from "./base-doc.js";
import { storedLarRecord } from "./stored-record.js";
import { ownEntry } from "./stored-value.js";
import { EDGE_LEDGER_PREFIX } from "./edge-ledger.js";
import { CABAL_REALM_RE } from "./realm-bag.js";
import { realmWorkbenchDocUrl } from "./deterministic-doc.js";
import { documentIdOfUrl } from "./sealed-rest.js";
import { DAEMON_WIKI_SLUG } from "./wiki-recipe.js";

export { realmWorkbenchDocUrl };

/** Why a share of a wiki through a workbench refuses, by name. */
export type WorkbenchRefusalReason =
  /** The daemon wiki (and each face's `daemon-<F>` folder) holds one face's memory: it never shares. */
  | "workbench-face-private"
  /** A wiki whose ledger rows name two realms: no realm stands for it until a person settles which. */
  | "workbench-two-realms"
  /** A slug whose source stands in the checkout projects to the tracked tree; a private shared mirror never rests there. */
  | "workbench-checkout-sourced"
  /** A realm id that reads as no cabal realm's (64 lower-case hex). */
  | "workbench-realm-malformed"
  /** A face the realm's Document does not hold writes nothing to its workbench. */
  | "workbench-not-a-member"
  /** A workspace name outside the name grammar. */
  | "workbench-workspace-malformed";

export class WorkbenchRefusal extends Error {
  override readonly name = "WorkbenchRefusal";
  constructor(readonly reason: WorkbenchRefusalReason, detail: string) { super(`${reason}: ${detail}`); }
}

/** Whether a slug names a face-private wiki: the daemon wiki, or one face's daemon folder. These never share. */
export function isFacePrivateSlug(slug: string): boolean {
  return slug === DAEMON_WIKI_SLUG || slug.startsWith(`${DAEMON_WIKI_SLUG}-`);
}

/** A workspace name: what the host shim binds under `/lar/workspaces/<name>` and a share row names. */
export const WORKSPACE_NAME_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;

/**
 * THE SHARE'S GATE, before any realm founds: the daemon slug refuses `workbench-face-private`, a slug sourced from the
 * checkout refuses `workbench-checkout-sourced`, and a workspace name outside the grammar refuses by name.
 */
export function requireWorkbenchShareable(input: { readonly slug: string; readonly checkoutSourced?: boolean; readonly workspace?: string | undefined }): void {
  if (isFacePrivateSlug(input.slug)) {
    throw new WorkbenchRefusal("workbench-face-private", `"${input.slug}" holds one face's memory (the daemon wiki): a named exception, it never shares`);
  }
  if (input.checkoutSourced === true) {
    throw new WorkbenchRefusal("workbench-checkout-sourced", `"${input.slug}" takes its source from the checkout, and a private shared wiki never projects into the tracked tree`);
  }
  if (input.workspace !== undefined && input.workspace !== "" && !WORKSPACE_NAME_RE.test(input.workspace)) {
    throw new WorkbenchRefusal("workbench-workspace-malformed", `"${input.workspace}" names no workspace (lower-case letters, digits, '.', '_' and '-')`);
  }
}

// ── THE LEDGER ROWS ─────────────────────────────────────────────────────────────────────────────

const realmScope = (realmId: string): string => {
  const id = realmId.trim().toLowerCase();
  if (!CABAL_REALM_RE.test(id)) throw new WorkbenchRefusal("workbench-realm-malformed", `"${realmId}" names no cabal realm (64 lower-case hex)`);
  return id;
};
const slugKey = (slug: string): string => encodeURIComponent(slug.normalize("NFC"));
const workbenchKey = (realm: string, slug: string): string => `${EDGE_LEDGER_PREFIX}${realm}/workbench/${slugKey(slug)}`;
const WORKBENCH_ROW = /^([0-9a-f]{64})\/workbench\/([^/]+)$/;

/** One slug the ledger binds to one realm's workbench. */
export interface WorkbenchBinding { readonly slug: string; readonly realmId: string; readonly docUrl: string }

/** Every workbench row the ledger holds, sorted by slug then realm. A slug two realms name appears twice (`ledgerWorkbenchRealm` refuses it). */
export function ledgerWorkbenches(ledger: LarDoc | undefined | null): WorkbenchBinding[] {
  const out: WorkbenchBinding[] = [];
  for (const [key, record] of Object.entries(ledger?.tiddlers ?? {})) {
    if (!key.startsWith(EDGE_LEDGER_PREFIX)) continue;
    const m = WORKBENCH_ROW.exec(key.slice(EDGE_LEDGER_PREFIX.length));
    if (!m) continue;
    const slug = decodeURIComponent(m[2]!);
    // A row reads only where its key and its text name the same slug: a stray write under the prefix binds nothing.
    if (tiddlerText(record) !== slug) continue;
    out.push({ slug, realmId: m[1]!, docUrl: realmWorkbenchDocUrl(m[1]!, slug) });
  }
  return out.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : a.realmId < b.realmId ? -1 : a.realmId > b.realmId ? 1 : 0));
}

/** Every realm the ledger binds a slug under: none, one, or (two replicas that each founded before they met) a conflict. */
export function ledgerWorkbenchRealms(ledger: LarDoc | undefined | null, slug: string): string[] {
  const want = slug.normalize("NFC");
  return ledgerWorkbenches(ledger).filter((b) => b.slug === want).map((b) => b.realmId);
}

/**
 * The ONE realm a slug's workbench stands in, or null where none. Two realms refuse `workbench-two-realms`: no tie-break picks
 * one (a tie never grants), and the wiki mounts no workbench until a person removes one row.
 */
export function ledgerWorkbenchRealm(ledger: LarDoc | undefined | null, slug: string): string | null {
  const realms = ledgerWorkbenchRealms(ledger, slug);
  if (realms.length > 1) throw new WorkbenchRefusal("workbench-two-realms", `"${slug}" registers under ${realms.length} realms (${realms.map((r) => r.slice(0, 12)).join(", ")}…); remove one row before the wiki mounts its workbench`);
  return realms[0] ?? null;
}

/**
 * Note that `slug`'s workbench stands in `realmId`. Call INSIDE a `handle.change()` callback. A slug the ledger already binds
 * to ANOTHER realm refuses `workbench-two-realms` and writes nothing; the same binding again writes nothing.
 */
export function noteWorkbench(draft: LarDoc, realmId: string, slug: string): void {
  const realm = realmScope(realmId);
  const held = ledgerWorkbenchRealms(draft, slug);
  if (held.some((r) => r !== realm)) throw new WorkbenchRefusal("workbench-two-realms", `"${slug}" already registers under realm ${held[0]!.slice(0, 12)}…; one wiki registers under one realm`);
  const key = workbenchKey(realm, slug);
  if (ownEntry(draft.tiddlers, key) === undefined) draft.tiddlers[key] = storedLarRecord(key, { text: slug.normalize("NFC") }, "workbench");
}

// ── THE SEATS THIS VESSEL'S HAND MADE ───────────────────────────────────────────────────────────

const seatKey = (realm: string, slug: string, face: string): string =>
  `${EDGE_LEDGER_PREFIX}${realm}/workbench-seat/${slugKey(slug)}/${encodeURIComponent(face)}`;

/**
 * Note a seat this vessel's own hand made in a workbench's realm: the face (its PersonaGroup) and the Keyhive agent the owner's
 * hive seated for it. The realm's Document stays the authority (content keys, the island's mount); the note lets the vessel's
 * wire guard decide on a thread with no hive, and lets a later landing revoke a face a row stopped naming. It never crosses:
 * the ledger reaches no other operator. Call INSIDE `handle.change()`.
 */
export function noteWorkbenchSeat(draft: LarDoc, realmId: string, slug: string, face: string, agentHex: string): void {
  const key = seatKey(realmScope(realmId), slug, face);
  if (tiddlerText(ownEntry(draft.tiddlers, key) as never) !== agentHex) draft.tiddlers[key] = storedLarRecord(key, { text: agentHex }, "workbench");
}

/** Drop a seat note (the face left the row; its revoke ran). Call INSIDE `handle.change()`. */
export function dropWorkbenchSeat(draft: LarDoc, realmId: string, slug: string, face: string): void {
  delete draft.tiddlers[seatKey(realmScope(realmId), slug, face)];
}

/** Every seat this vessel noted for a slug's workbench: face → the agent its owner's hive seated. */
export function workbenchSeats(ledger: LarDoc | undefined | null, realmId: string, slug: string): ReadonlyMap<string, string> {
  const prefix = `${EDGE_LEDGER_PREFIX}${realmScope(realmId)}/workbench-seat/${slugKey(slug)}/`;
  const out = new Map<string, string>();
  for (const [key, record] of Object.entries(ledger?.tiddlers ?? {})) {
    if (!key.startsWith(prefix)) continue;
    const agent = tiddlerText(record as never);
    if (agent) out.set(decodeURIComponent(key.slice(prefix.length)), agent);
  }
  return out;
}

/** Whether a face holds a noted seat in any workbench of a realm: the wire guard's reading on a thread with no hive. */
export function workbenchSeatHolds(ledger: LarDoc | undefined | null, realmId: string, face: string): boolean {
  const realm = realmScope(realmId);
  const tail = `/${encodeURIComponent(face)}`;
  return Object.keys(ledger?.tiddlers ?? {}).some((k) => k.startsWith(`${EDGE_LEDGER_PREFIX}${realm}/workbench-seat/`) && k.endsWith(tail));
}

/** The workbench documents the ledger names, by document id → realm id: the id map the protected-document guard classes. */
export function workbenchDocIds(ledger: LarDoc | undefined | null): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  for (const b of ledgerWorkbenches(ledger)) {
    const id = documentIdOfUrl(b.docUrl);
    if (id) out.set(id, b.realmId);
  }
  return out;
}

// ── THE WIRE DECIDER ────────────────────────────────────────────────────────────────────────────

/**
 * THE `realm-workbench` DECIDER the protected-document guard asks: a workbench document crosses to a peer only where the face
 * that peer proved stands a member of that workbench's realm NOW (the realm Document's roster, read live). A peer that proved
 * no face, a document no ledger row names, and a roster read that throws all withhold (fail closed).
 */
export function workbenchDecider(opts: {
  readonly realmOfDoc: (documentId: string) => string | null | undefined;
  readonly faceOfPeer: (peerId: string) => string | null | undefined;
  readonly holds: (realmId: string, face: string) => boolean | Promise<boolean>;
}): (peerId: string, documentId: string) => Promise<boolean> {
  return async (peerId, documentId) => {
    const realm = opts.realmOfDoc(documentId);
    const face = opts.faceOfPeer(peerId);
    if (!realm || !face) return false;
    try { return (await opts.holds(realm, face)) === true; } catch { return false; }
  };
}
