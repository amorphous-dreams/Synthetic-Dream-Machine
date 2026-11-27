/**
 * lares-globals — type surface for the `$tw.lares` extension.
 *
 * The engine applies inbound changes synchronously; the shore installs the queue door.
 */

import type { LarTiddlerChange } from "@lararium/mesh/tiddler-store";
import type { MemeListing, PlaceMemeOwed, PlaceMemeReceipt } from "../place-meme.js";
import type { NormalizeResult } from "../meme-normalize.js";
import type { CarrierShape } from "../carrier-shape.js";
import type { CarrierEdge } from "../carrier-edges.js";
import type { MemeProjection } from "../meme-project.js";
import type { GrammarRules, ParseMemeResult } from "../meme-ast/index.js";
import type { MemeDiagnostic } from "../meme-ast/diagnostics.js";
import type { AffordRoutes } from "../affordance-read.js";
import type { CallPlan } from "../modules/call.js";

/**
 * What `check(text)` reads off a carrier: its shape, the block-check verdict, the computed check, its
 * edges, and the grade `place` lands over the same text with the diagnostics behind it.
 */
export interface MemeCheck {
  readonly shape: CarrierShape;
  readonly check: "ok" | "head-unbound" | "mismatch" | "unchecked" | "torn";
  /** The check the framed body should carry, or null where no framed body stands. */
  readonly bcc: string | null;
  readonly edges: readonly CarrierEdge[];
  readonly grade: PlaceMemeReceipt["grade"];
  readonly diagnostics: readonly MemeDiagnostic[];
}

/**
 * `$tw.lares.meme` — the in-VM face (meme-face startup): every meme law bound to the live `$tw.wiki`.
 * A wiki-side caller gets the placement, the read, the pure laws and the projection with no binary.
 */
export interface LaresMemeFace {
  /** Place a framed meme through the Confluence gate; `base` = the canonical hash last read. */
  place(uri: string, text: string, base?: string | null): Promise<PlaceMemeReceipt | PlaceMemeOwed>;
  /** The whole meme recomposed + the canonical hash a writer hands back; null under no record. */
  read(uri: string): Promise<{ text: string; canonicalHash: string } | null>;
  /** Every meme root the wiki holds with its canonical hash; `tree` nests each root's slot tree. */
  list(opts?: { readonly tree?: boolean }): Promise<MemeListing[]>;
  /** Remove the whole group (root · `#slot` · `/path`); a stale `base` answers `conflict` and moves nothing. */
  remove(uri: string, base?: string | null): Promise<{ decision: "removed" | "absent" | "conflict"; tombstoned: readonly string[]; canonicalHash?: string }>;
  normalize(text: string): NormalizeResult;
  check(text: string): MemeCheck;
  /** The root rendered through its target's template: mem · md · html · tid · json. `opts.dialect`/
   *  `opts.tongue` weave the `md` target alone (RFC 7764 variant / BCP 47 tongue); given for any
   *  other target, or naming an unknown dialect, this throws. Throws too on an unknown target
   *  (naming the targets) and on an absent root (naming the URI). */
  project(uri: string, to: string, opts?: { dialect?: string; tongue?: string }): MemeProjection;
  /** The whole carrier the wiki's records recompose to, synchronous; null where no carrier root stands. */
  recompose(uri: string): string | null;
  /** The graded meme-ast over any text — the self-hosted grammar, callable from a widget, a filter, a module. */
  parse(uri: string, text: string, grammar?: GrammarRules): ParseMemeResult;
}

/**
 * `$tw.lares.afford` — the console skin of every affordance carrier the wiki holds (afford-face startup). The read verbs render
 * the skin templates and print through `console.groupCollapsed`; `routes` reads the live stack's routes. Nothing on it admits;
 * a call runs through `$tw.lares.call`.
 */
export interface LaresAffordFace {
  /** The carriers' bare addresses, a t2/t3 wildcard narrowing them (`oracle.*`); a t1 wildcard throws by name. */
  list(pattern?: string): string[];
  /** The has-stack line. */
  line(address: string): string;
  /** One slot's lines (`#/takes` or `takes`). */
  slot(address: string, slot: string): string[];
  /** Every slot, in loop order. */
  whole(address: string): string[];
  /** The routes the live stack spells (`routesOf`): per surface, spelling to address; the carrier each address reads from. */
  routes(): AffordRoutes;
}

/**
 * `$tw.lares.call` — THE ONE CALL (call startup): a verb word, a skin spelling or an address, and named params, resolved
 * through the live routes, bound against the live `#/takes`, dispatched through `callDoor`, and answered with the carrier
 * receipt on the has line.
 */
export type LaresCall = (verb: string, params?: Record<string, unknown>) => Promise<Record<string, unknown>>;

/** `$tw.lares.callDoor` — the host's seat of the address-to-reactor registry: it runs one bound plan and answers the reactor's answer. */
export type LaresCallDoor = (plan: CallPlan) => Promise<Record<string, unknown>>;

export interface LaresNaluAPI {
  applyNalu(change: LarTiddlerChange): void;
  /** The crest door: `run`'s applies land as one crest, one wiki dispatch (`nalu-engine.ts`). */
  applyNaluCrest?<T>(run: () => T): T;
  enqueueNalu?: (change: LarTiddlerChange) => void;
  isApplyingNalu(): boolean;
  /** The in-VM meme face (meme-face startup) — every meme law, under one name. */
  meme: LaresMemeFace;
  /** The in-VM affordance face (afford-face startup) — the console skin of every affordance carrier. */
  afford: LaresAffordFace;
  /** The one call (call startup) — every verb, every address, one shape. */
  call: LaresCall;
  /** The host's seat of the reactor registry the call dispatches through; absent, a call answers its bound plan. */
  callDoor: LaresCallDoor;
  /** The host-door ask a mounted camera installs (tw5-projection) for the root-services startup. */
  serviceDoor: LaresServiceDoor;
}

/** The arguments a host door carries: primitives only, as `lar:service` reads them. */
export type LaresServiceArgs = Readonly<Record<string, string | number | boolean>>;

/**
 * `$tw.lares.serviceDoor` — the island's door to the surface's host services (dreamdom#/host-services).
 * `ask` posts one `lar:service` and calls `settle` once with `"ok"` or a named refusal: at once when the
 * surface's manifest lacks the kind, else when the surface's `lar:service-result` lands.
 */
export interface LaresServiceDoor {
  ask(kind: string, args: LaresServiceArgs, settle: (status: string) => void): void;
}

export interface LaresTw5Extension {
  lares?: Partial<LaresNaluAPI> & Record<string, unknown>;
}
