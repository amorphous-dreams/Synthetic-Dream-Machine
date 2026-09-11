/**
 * lares-globals — type surface for the `$tw.lares` extension.
 *
 * The nalu-engine TW5 startup module installs `$tw.lares.enqueueNalu` and
 * friends. Other TS code (IslandAdaptor) reads `$tw.lares.isApplyingNalu`
 * as the cross-context echo guard. Shared shape lives here so both sides
 * stay aligned without duplicating inline `declare`s.
 */

import type { LarTiddlerChange } from "@lararium/mesh";
import type { PlaceMemeReceipt } from "../place-meme.js";
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
  normalize(text: string): NormalizeResult;
  check(text: string): MemeCheck;
  /** The root rendered through its target's template: mem · md · html · tid · json. Throws on an
   *  unknown target (naming the targets) and on an absent root (naming the URI). */
  project(uri: string, to: string): MemeProjection;
  /** The whole carrier the wiki's records recompose to, synchronous; null where no carrier root stands. */
  recompose(uri: string): string | null;
  /** The graded meme-ast over any text — the self-hosted grammar, callable from a widget, a filter, a module. */
  parse(uri: string, text: string, grammar?: GrammarRules): ParseMemeResult;
}

export interface LaresNaluAPI {
  enqueueNalu(change: LarTiddlerChange): void;
  flushNalu(budget?: number): void;
  isApplyingNalu(): boolean;
  naluPending(): number;
  /** Progressive-boot hydration checkpoint. The recipe calls beginHydration() ONCE right after
   *  enqueuing the seed replay — instead of a synchronous unbounded flush — so the seed drains
   *  frame-by-frame on the paced rail. whenSeedDrained() resolves the first time the queue empties
   *  after hydration begins (or at once if none began): the catch-up checkpoint the island awaits
   *  before arming live reactive behavior, so onEa still observes a fully-resident seed. */
  beginHydration(): void;
  whenSeedDrained(): Promise<void>;
  /** The IN-VM capture annotate (capture-annotate-vm startup): parse + harvest a turn IN-REALM with
   *  the full self-hosted grammar → the lar_* patch (+ lar_ast). The daemon wires this as the engine's
   *  annotate so all ast-parsing runs inside the TW5 engine, never the worker. */
  captureAnnotateVm(turnText: string, sourceFile?: string): Record<string, string | number>;
  /** The in-VM meme face (meme-face startup) — every meme law, under one name. */
  meme: LaresMemeFace;
}

export interface LaresTw5Extension {
  lares?: Partial<LaresNaluAPI> & Record<string, unknown>;
}
