/**
 * critical-gate — THE CONFIRM GATE every critical procedure passes (lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift#/the-confirm-gate;
 * the operator's note, 2026-11-13: "critical procedures like `lares("vessel", "reset")` and its UX twin should get gated
 * behind an operator/user confirmation (like the pwd, etc)").
 *
 * A CRITICAL PROCEDURE destroys a place or a face on this device: the reset, and any door that burns as it does. The class
 * takes the gate, never one verb: a burn runs only on a PASS this module minted, and it mints one only for a confirmation
 * the device's holder gave in the ceremony document. A door that burns and spends no pass reads red
 * (`tests/critical-gate.test.ts`, the burn census), so the next destructive door inherits the gate.
 *
 * WHAT THE GATE ASKS follows how custody stands in this origin's stores, read afresh at every confirmation:
 *
 *   `bare`          nothing sealed here (no slot tree, no sealed row): the procedure's public typed phrase confirms.
 *   `held`          a slot tree stands and reads (a first passphrase bound, or a face bound or joined): the gate asks a
 *                   passphrase that opens custody here, and proves it by the unwrap alone. A vessel that stands LOCKED
 *                   proves as an unlocked one does: the slot tree rests in the clear beside the rows it wraps, and the proof
 *                   reads it and holds nothing (`@lararium/browser` `browser-custody-proof.ts`).
 *   `unverifiable`  sealed custody stands and no tree reads (torn, or a foreign shape): no passphrase can be judged here or
 *                   at any unlock, so the typed phrase confirms, under words that say what burns unopened.
 *
 * THE GATE LEARNS AND TELLS NOTHING OF WHAT STANDS OPEN. It reads rows at rest; it never asks whether a session holds an
 * unlock, and its answers read the same for a locked vessel and an unlocked one.
 *
 * A WRONG PASSPHRASE refuses `no-slot-opens`, mints no pass and leaves the ask standing. NO TALLY STANDS: no count of tries
 * rests anywhere and no clock locks the gate, since no stored number and no global now could decide a holder's return. The
 * KDF's own cost bounds each try, as it bounds each unlock.
 *
 * THE SECRET STAYS HERE. The passphrase leaves the ceremony document's field as bytes on a transferred buffer, to the proof
 * alone. No refusal, pass, signal or record carries a byte of it.
 *
 * NO HOUSE DOOR GATES THE PLATFORM. A holder who lost every passphrase keeps the browser's own clearing of this site's data,
 * which returns the vessel to its floor and which nothing here can ask. The ceremony says so in plain words.
 *
 * This module imports nothing: the ceremony document's graph stays its own directory.
 */

/** One critical procedure: the name its burn spends a pass under, and the public phrase a bare floor types. */
export interface CriticalProcedure { readonly name: string; readonly phrase: string }

/** How custody stands across this origin's stores, at rest. */
export type GateStanding = "bare" | "held" | "unverifiable";

/** What the gate asks for one standing: the public phrase, or a passphrase that opens custody here. */
export type GateDemand = "typed-phrase" | "passphrase" | "typed-phrase-unopened";

export function gateDemandOf(standing: GateStanding): GateDemand {
  return standing === "held" ? "passphrase" : standing === "unverifiable" ? "typed-phrase-unopened" : "typed-phrase";
}

/** The keystore rows the gate reads custody off, as `@lararium/browser` writes them (`tests/vessel-host-reset-gate.test.ts` welds them). */
export const GATE_KEYSTORE = "keystore";
export const GATE_PLACE_TREE_ROW = "custody-slots";
export const GATE_FACE_TREE_PREFIX = "face-slots/";
export const GATE_SEALED_PREFIXES: readonly string[] = ["sealed/", "face-sealed/", "ward/"];

/** One store's keystore row names, read: how many slot trees stand and how many sealed rows. */
export function custodyRowsOf(rows: readonly string[]): { readonly trees: number; readonly sealed: number } {
  return {
    trees: rows.filter((row) => row === GATE_PLACE_TREE_ROW || row.startsWith(GATE_FACE_TREE_PREFIX)).length,
    sealed: rows.filter((row) => GATE_SEALED_PREFIXES.some((prefix) => row.startsWith(prefix))).length,
  };
}

/** What the proof answers for one passphrase: it opens a tree here, it opens none, or no tree here reads. */
export type GateProof = "opens" | "no-slot-opens" | "unverifiable";

/** What the gate reaches: custody at rest, and the proof. Neither names what any session holds open. */
export interface GateEnv {
  /** The stores of this origin that hold a keystore, each with its custody rows counted. */
  readonly census: () => Promise<readonly { readonly store: string; readonly trees: number; readonly sealed: number }[]>;
  /** How many of those stores' slot trees read. Asked only where a tree stands. */
  readonly readable: (stores: readonly string[]) => Promise<number>;
  /** Whether the passphrase on `bytes` (UTF-8, transferred) opens a tree in `stores`. */
  readonly prove: (stores: readonly string[], bytes: ArrayBuffer) => Promise<GateProof>;
}

/** A refusal by name. The error carries the name and public words, never a byte of what was typed. */
export class GateRefused extends Error {
  override readonly name = "GateRefused";
  constructor(readonly refusal: string, reason: string) { super(`${refusal}: ${reason}`); }
}

/** Custody's standing and the stores that hold a tree, read afresh. */
export async function readGateStanding(env: GateEnv): Promise<{ readonly standing: GateStanding; readonly stores: readonly string[] }> {
  const census = await env.census();
  const treed = census.filter((s) => s.trees > 0).map((s) => s.store);
  if (treed.length > 0 && await env.readable(treed) > 0) return { standing: "held", stores: treed };
  return { standing: treed.length > 0 || census.some((s) => s.sealed > 0) ? "unverifiable" : "bare", stores: treed };
}

/** Whether what a person typed confirms a procedure's phrase: the phrase itself, whatever its case or outer spacing. */
export function typedConfirms(typed: string, phrase: string): boolean {
  return typed.trim().replace(/\s+/g, " ").toLowerCase() === phrase;
}

/** A pass: one confirmation, for one procedure, spent by one burn. */
export interface GatePass { readonly procedure: string; readonly by: GateDemand }
const standing = new WeakMap<object, string>();

/** A field the gate reads: its value, and the clear it takes. */
export interface GateField { value: string }

/**
 * PASS THE GATE for one procedure, on what the person typed into the ceremony's field. `painted` names the demand the form
 * showed: custody read afresh that asks something else refuses `gate-demand-moved`, and the form paints again. The field
 * clears before any proof runs.
 *
 *   typed phrase   the phrase confirms or refuses `gate-words-differ`.
 *   passphrase     the proof answers; `opens` passes, a wrong one refuses `no-slot-opens`, and trees that stopped reading
 *                  meanwhile refuse `gate-demand-moved`.
 */
export async function passCriticalGate(procedure: CriticalProcedure, env: GateEnv, field: GateField, painted: GateDemand): Promise<GatePass> {
  const typed = field.value;
  field.value = "";
  const read = await readGateStanding(env);
  const demand = gateDemandOf(read.standing);
  if (demand !== painted) throw new GateRefused("gate-demand-moved", "this browser's custody changed while the ceremony stood, so the gate asks again; nothing burned");
  if (demand === "passphrase") {
    if (typed.length === 0) throw new GateRefused("no-slot-opens", "no passphrase was typed; nothing burned");
    const encoded = new TextEncoder().encode(typed);
    const buffer = new ArrayBuffer(encoded.byteLength);
    new Uint8Array(buffer).set(encoded);
    encoded.fill(0);
    const proof = await env.prove(read.stores, buffer);
    if (proof === "unverifiable") throw new GateRefused("gate-demand-moved", "this browser's custody stopped reading while the ceremony stood, so the gate asks again; nothing burned");
    if (proof !== "opens") throw new GateRefused("no-slot-opens", "that passphrase opens no custody this browser holds; nothing burned, and the ask still stands");
  } else if (!typedConfirms(typed, procedure.phrase)) {
    throw new GateRefused("gate-words-differ", `the words differ; nothing burned. Type: ${procedure.phrase}`);
  }
  const pass: GatePass = Object.freeze({ procedure: procedure.name, by: demand });
  standing.set(pass, procedure.name);
  return pass;
}

/**
 * SPEND A PASS at the head of a burn: the pass this module minted, for this procedure, once. Anything else (no pass, a
 * hand-built one, another procedure's, one already spent) refuses `gate-unpassed` before the burn reads or moves anything.
 */
export function spendGatePass(pass: unknown, procedure: CriticalProcedure): void {
  const held = typeof pass === "object" && pass !== null ? standing.get(pass) : undefined;
  if (held !== procedure.name) throw new GateRefused("gate-unpassed", `"${procedure.name}" runs only on its own confirmation through the ceremony's gate; nothing burned`);
  standing.delete(pass as object);
}

/** The words the ceremony paints for one demand: what it asks, and the way back that no house door gates. */
export function gateWords(demand: GateDemand, procedure: CriticalProcedure): { readonly ask: string; readonly platform: string } {
  const platform = "A holder who lost every passphrase keeps the browser's own way: clearing this site's data in the browser's settings returns it to its floor, and nothing here can ask or block that.";
  if (demand === "passphrase") return { ask: "This browser holds custody, so the gate asks for a passphrase that opens it: this browser's own, or the passphrase of a face it holds.", platform };
  if (demand === "typed-phrase-unopened") return { ask: `This browser holds sealed custody that no passphrase can open here (its slot tree does not read), so no passphrase can be asked: what burns, burns unopened. To confirm, type: ${procedure.phrase}`, platform };
  return { ask: `This browser holds no custody yet, so typed words confirm. To confirm, type: ${procedure.phrase}`, platform };
}
