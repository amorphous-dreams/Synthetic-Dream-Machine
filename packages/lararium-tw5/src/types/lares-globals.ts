/**
 * lares-globals — type surface for the `$tw.lares` extension.
 *
 * The engine applies inbound changes synchronously; the shore installs the queue door.
 */

import type { LarTiddlerChange } from "@lararium/mesh";
import type { MemeListing, PlaceMemeReceipt } from "../place-meme.js";
import type { NormalizeResult } from "../meme-normalize.js";
import type { CarrierShape } from "../carrier-shape.js";
import type { CarrierEdge } from "../carrier-edges.js";
import type { MemeProjection } from "../meme-project.js";
import type { GrammarRules, ParseMemeResult } from "../meme-ast/index.js";
import type { MemeDiagnostic } from "../meme-ast/diagnostics.js";

/**
 * What `check(text)` reads off a carrier: its shape, the block-check verdict, the computed check, its
 * edges, and the grade `place` lands over the same text with the diagnostics behind it.
 */
export interface MemeCheck {
  readonly shape: CarrierShape;
  readonly check: "ok" | "mismatch" | "unchecked" | "torn";
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
  place(uri: string, text: string, base?: string | null): Promise<PlaceMemeReceipt>;
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

export interface LaresNaluAPI {
  applyNalu(change: LarTiddlerChange): void;
  enqueueNalu?: (change: LarTiddlerChange) => void;
  isApplyingNalu(): boolean;
  /** The IN-VM capture annotate (capture-annotate-vm startup): parse + harvest a turn IN-REALM with
   *  the full self-hosted grammar → the lar_* patch (+ lar_ast). The daemon wires this as the engine's
   *  annotate so all ast-parsing runs inside the TW5 engine, never the worker. */
  captureAnnotateVm(turnText: string, sourceFile?: string): Record<string, string | number>;
  /** The in-VM meme face (meme-face startup) — every meme law, under one name. */
  meme: LaresMemeFace;
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
