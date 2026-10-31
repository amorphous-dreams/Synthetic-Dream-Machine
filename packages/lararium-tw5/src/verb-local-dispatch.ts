/**
 * verb-local-dispatch — run a single verb invocation against a VerbTable with cap verification.
 *
 * Called by VerbDispatcher for every invocation that resolves to a local handler.
 * Capability verification: keyhive integration lands here without handler changes.
 *
 * Isomorphic: no Node or browser platform APIs. Runs in any sovereign Worker.
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/verb-local-dispatch
 */

import {
  DAEMON_BAG_ID,
  isSystemCanonBag,
  type CapabilityAccess,
  type CapabilityVerifyResult,
  type CapabilityVerifier,
  type CompositeStore,
  type Verb,
} from "@lararium/mesh";
import { wikiSlugOfBag } from "@lararium/mesh";
import type { SessionWorn, VerbReactor, VerbTable } from "./verb-dispatcher.js";

export type CapVerify = (access: CapabilityAccess, bagUrl: string) => Promise<CapabilityVerifyResult>;

export interface RunLocalVerbOptions {
  readonly daemon:    CompositeStore;
  readonly registry:  VerbTable;
  readonly signal?:   AbortSignal;
  readonly verifier?: CapabilityVerifier;
  readonly presenterOf?: (invocation: Verb) => string;
  /** True for a verb the vessel's own presence channel took. */
  readonly localOf?: (invocation: Verb) => boolean;
  /** The face a session wore for this ask, as the vessel's main thread booked it; absent where none. */
  readonly wornOf?: (invocation: Verb) => SessionWorn | undefined;
}

export function makeCapVerify(verifier: CapabilityVerifier | undefined, requestedBy: string, local = false): CapVerify {
  return verifier
    ? (access, bagUrl) => verifier.verify({ presenter: requestedBy, bagUrl, access, ...(local ? { channel: "local" as const } : {}) })
    : async () => ({ ok: true, reason: "no-verifier" });
}

/**
 * deriveRoutedCap — the capability a routed verb requires, derived at the WORKER
 * gate BEFORE it delegates the verb to main (verify-then-delegate; the keyholder
 * worker verifies, then main trusts the worker→main channel as the capability —
 * see project_verification_placement).
 *
 * Conservative by construction so the gate NEVER under-protects: access defaults
 * to "admin" (admin ⊇ read, so a read-only verb merely over-gates in alpha, which
 * a per-verb table refines later); the target bag derives from the common arg
 * shapes; absent one it falls back to the daemon bag (must-hold-admin-here).
 */
export function deriveRoutedCap(invocation: Verb): { access: CapabilityAccess; bagUrl: string } {
  const a = invocation.args as Record<string, unknown>;
  const pick = (k: string): string | null => (typeof a[k] === "string" ? (a[k] as string) : null);
  // A hand asking to keep a realm-carried book seals its ask under its own worn face; the book is the realm's, and
  // the stewards' consent on the realm doc decides. The ask therefore answers to the asking vessel's own ground.
  if (invocation.action === "realm-bag" && a["join"] === true) return { access: "admin", bagUrl: DAEMON_BAG_ID };
  const bagUrl = pick("bagUrl") ?? pick("toBag") ?? pick("dest") ?? pick("bag") ?? pick("targetBag") ?? DAEMON_BAG_ID;
  return { access: "admin", bagUrl };
}

/**
 * The bags a routed verb names INSIDE its envelope (`wiki-act` carries its real destination and source in `args.args`):
 * the ones `deriveRoutedCap` never reads. The gate asks the Kahu predicate about each system canon one.
 */
export function routedInnerBags(invocation: Verb): string[] {
  const outer = invocation.args as Record<string, unknown>;
  const inner = outer["args"];
  if (inner === null || typeof inner !== "object" || Array.isArray(inner)) return [];
  const a = inner as Record<string, unknown>;
  const bags: string[] = [];
  for (const k of ["to-bag", "from-bag", "bag", "toBag", "fromBag"]) {
    const v = a[k];
    if (typeof v === "string" && !bags.includes(v)) bags.push(v);
  }
  return bags;
}

/**
 * True for a routed envelope that addresses a wiki (`wiki-act` names its wiki and carries its act inside `args.args`):
 * main acts on that wiki's bags under worker trust, so the table's fence asks first. A face row addresses no wiki;
 * the store door acts on the face its session wears, so a sibling's session routes it.
 */
export function routedAddressesWiki(invocation: Verb): boolean {
  const a = invocation.args as Record<string, unknown>;
  const inner = a["args"];
  return typeof a["wiki"] === "string" || (inner !== null && typeof inner === "object" && !Array.isArray(inner));
}

/**
 * The wiki a routed `wiki-act` aims at, by the same reading the main handler uses to choose its island: the envelope's
 * own `wiki`, else a MOVE's source slot, else the destination slot. The daemon wiki stands on the daemon's own reach and
 * a bag outside the wiki slots names none, so both read null (nothing to mount).
 */
export function routedWikiSlug(invocation: Verb): string | null {
  if (invocation.action !== "wiki-act") return null;
  const outer = invocation.args as Record<string, unknown>;
  const inner = outer["args"] !== null && typeof outer["args"] === "object" && !Array.isArray(outer["args"]) ? outer["args"] as Record<string, unknown> : {};
  const slot = (bag: unknown): string | null => {
    if (typeof bag !== "string" || !/^lar:\/\/\/ha\.ka\.ba\/wikis\/[^/]+\/(?:temp|draft|personal|working)$/.test(bag)) return null;
    return wikiSlugOfBag(bag);
  };
  const verb = typeof outer["verb"] === "string" ? (outer["verb"] as string).toUpperCase() : "";
  const wikiVerb = verb === "LOAD" || verb === "MOVE" || verb === "COPY" || verb === "ADD";
  const slug = typeof outer["wiki"] === "string" && outer["wiki"]
    ? outer["wiki"] as string
    : (verb === "MOVE" ? slot(inner["from-bag"]) : null) ?? (wikiVerb ? slot(inner["to-bag"] ?? inner["bag"]) : null);
  return slug && slug !== "daemon" ? slug : null;
}

/**
 * THE ROUTED VERB'S GATE, the one place the keyholder island clears a verb before main (and a wiki island behind it)
 * trusts it: the cap `deriveRoutedCap` names, then — for a verifier that carries the Kahu predicate — the predicate for
 * every system canon bag the envelope names inside its args. A refusal throws and the verb is never routed. The wiki
 * island's own clearance (`kahuReachClearedAtGate`) is a composition option set in code at the island's behavior, never a
 * field the envelope can carry, so nothing a caller sends lifts it.
 */
export async function gateRoutedVerb(invocation: Verb, verifier: CapabilityVerifier, presenter: string, local: boolean): Promise<void> {
  const { access, bagUrl } = deriveRoutedCap(invocation);
  const proof = await verifier.verify({ presenter, bagUrl, access, ...(local ? { channel: "local" as const } : {}) });
  if (!proof.ok) {
    throw new Error(`[verb-dispatcher] capability denied for routed verb "${invocation.action}" (bag=${bagUrl}, access=${access}): ${proof.reason ?? "no grant"}`);
  }
  // Every inner bag clears its own cap, its grade read off the act the envelope carries: only a COPY reads its source
  // (a copy out of canon stays open to a reader); a MOVE deletes at its source, and any other act takes the outer
  // access. A bag named twice takes the stronger grade.
  const outer = invocation.args as Record<string, unknown>;
  const innerArgs = outer["args"];
  const innerVerb = typeof outer["verb"] === "string" ? (outer["verb"] as string).toUpperCase() : "";
  const readOnly = new Set<string>();
  if (innerVerb === "COPY" && innerArgs !== null && typeof innerArgs === "object" && !Array.isArray(innerArgs)) {
    const a = innerArgs as Record<string, unknown>;
    const elsewhere = new Set(["to-bag", "bag", "toBag"].map((k) => a[k]).filter((v): v is string => typeof v === "string"));
    for (const k of ["from-bag", "fromBag"]) { const v = a[k]; if (typeof v === "string" && !elsewhere.has(v)) readOnly.add(v); }
  }
  for (const bag of routedInnerBags(invocation)) {
    if (bag === bagUrl) continue;
    const need: CapabilityAccess = readOnly.has(bag) ? "read" : access;
    const inner = await verifier.verify({ presenter, bagUrl: bag, access: need, ...(local ? { channel: "local" as const } : {}) });
    if (!inner.ok) throw new Error(`[verb-dispatcher] capability denied for routed verb "${invocation.action}" (bag=${bag}, access=${need}): ${inner.reason ?? "no grant"}`);
  }
  if (verifier.kahuReach) {
    // System canon takes the Kahu hand wherever the act writes or deletes; a COPY's read-only source asks none.
    for (const bag of routedInnerBags(invocation)) if (isSystemCanonBag(bag) && !readOnly.has(bag)) await verifier.kahuReach(bag, invocation.action, presenter);
  }
}

export async function runLocalVerb(invocation: Verb, opts: RunLocalVerbOptions): Promise<Record<string, unknown>> {
  const handler: VerbReactor | undefined = opts.registry.get(invocation.action);

  if (!handler) {
    throw new Error(`no handler registered for "${invocation.action}"`);
  }

  const presenter = opts.presenterOf?.(invocation) ?? invocation.requestedBy;
  const local = opts.localOf?.(invocation) ?? false;
  const cap = makeCapVerify(opts.verifier, presenter, local);
  const worn = opts.wornOf?.(invocation);
  return handler(invocation.args, { daemon: opts.daemon, invocation, cap, presenter, local, ...(worn ? { worn } : {}), ...(opts.signal ? { signal: opts.signal } : {}) });
}
