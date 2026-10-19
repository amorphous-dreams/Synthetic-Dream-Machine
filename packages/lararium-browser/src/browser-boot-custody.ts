/**
 * Each browser tab asks for its own unlock; the shared holder carries no unlock between tabs
 * (operator ruling, 2026-10-18; lar:///ha.ka.ba/lares/docs/stable-founding-road#/rulings, row B1).
 * The VK rests in this page's memory alone (`browser-custody.ts`).
 *
 * A browser leaf holds a passphrase or paper slot before it holds a persona root. `secretMintDue`
 * asks for the first slot before the mint; the mint refuses `no-custody-slot` without one.
 * This module names no passkey kind: the passkey road stays with the operator.
 *
 * Meme: lar:///ha.ka.ba/lararium/browser/browser-boot-custody
 */
import type { Credential } from "@lararium/mesh";
import type { BrowserCustodyClear, UnsettledRow } from "./browser-custody.js";
import {
  BrowserCustodyRefused,
  CLEAR_CUSTODY_QUESTION,
  clearBrowserCustody,
  readBrowserCustody,
  sealBrowserKeystore,
  unlockBrowserCustody,
} from "./browser-custody.js";

/** What this tab's boot asks the person for. `attempt` counts from 1 within one stand. */
export type CustodyAsk =
  | { readonly kind: "unlock"; readonly attempt: number; readonly of: number; readonly notes: readonly string[] }
  | { readonly kind: "bind-first"; readonly why: "face-secret-mint-due" };

/** The person's answer: a route, or null when they decline. */
export type CustodyAnswer = Credential | null;

export type BootCustodyVerdict =
  | { readonly reading: "clear" }
  | { readonly reading: "held" }
  | { readonly reading: "opens"; readonly slot: string; readonly unsettled: readonly UnsettledRow[] }
  | { readonly reading: "bound"; readonly slot: string; readonly unsettled: readonly UnsettledRow[] }
  | { readonly reading: "declined" }
  | { readonly reading: "no-slot-opens"; readonly attempts: number; readonly notes: readonly string[] }
  | { readonly reading: "unreadable"; readonly why: string };

export interface StandBrowserCustodyOptions {
  readonly idbName: string;
  readonly ask: (question: CustodyAsk) => Promise<CustodyAnswer>;
  /** True when the boot is about to mint a face secret (a persona root, a face-scoped key, a per-Nexus key, a fleet-join or walk row) on a keystore that holds no slot. Default false. */
  readonly secretMintDue?: boolean;
  /** How many routes one stand tries before it answers `no-slot-opens`. A count, never a clock. Default 3. */
  readonly attempts?: number;
}

export async function standBrowserCustody(opts: StandBrowserCustodyOptions): Promise<BootCustodyVerdict> {
  const attempts = opts.attempts ?? 3;
  if (!Number.isSafeInteger(attempts) || attempts < 1) {
    throw new RangeError(`[browser-boot-custody] attempts must be a positive safe integer; got ${String(attempts)}`);
  }

  let status = await readBrowserCustody(opts.idbName);
  if (status.reading === "unreadable") return { reading: "unreadable", why: status.why };
  if (status.reading === "clear") {
    if (!opts.secretMintDue) return { reading: "clear" };
    const route = await opts.ask({ kind: "bind-first", why: "face-secret-mint-due" });
    if (route === null) return { reading: "declined" };
    try {
      const bound = await sealBrowserKeystore(opts.idbName, route);
      return { reading: "bound", slot: bound.slot, unsettled: bound.unsettled };
    } catch (error) {
      if (!(error instanceof BrowserCustodyRefused) || error.reading !== "already-sealed") throw error;
      status = await readBrowserCustody(opts.idbName);
    }
  }

  if (status.reading === "unreadable") return { reading: "unreadable", why: status.why };
  if (status.reading === "clear") {
    throw new Error(`[browser-boot-custody] the slot tree cleared after another tab sealed "${opts.idbName}"`);
  }
  if (status.unlocked) return { reading: "held" };

  let notes: readonly string[] = [];
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const route = await opts.ask({ kind: "unlock", attempt, of: attempts, notes });
    if (route === null) return { reading: "declined" };
    const opened = await unlockBrowserCustody(opts.idbName, [route]);
    if (opened.reading === "opens") {
      return { reading: "opens", slot: opened.slot, unsettled: opened.unsettled };
    }
    notes = opened.notes;
  }
  return { reading: "no-slot-opens", attempts, notes };
}

/** What the clear-password verb answers: the confirm door's question, a declined route, or the clear's own reading. */
export type ClearCustodyVerbAnswer = BrowserCustodyClear | { readonly reading: "declined" };

/**
 * The clear-password verb (`custody-clear`, reached from the wiki's `tm-clear-password` road). Before the literal yes it
 * answers the question and asks this tab's custody door nothing, so a person is asked for a route only once they have
 * agreed to the clear; with the yes it asks the door for the route that opens the slot it clears.
 */
export async function clearCustodyVerb(opts: {
  readonly idbName: string;
  readonly confirmed: unknown;
  readonly askCustody?: (question: { readonly kind: "clear" }) => Promise<CustodyAnswer>;
}): Promise<ClearCustodyVerbAnswer> {
  if (opts.confirmed !== "yes") return { reading: "asks", question: CLEAR_CUSTODY_QUESTION };
  if (!opts.askCustody) throw new Error("custody-clear: this page offers no custody door");
  const route = await opts.askCustody({ kind: "clear" });
  if (route === null) return { reading: "declined" };
  return clearBrowserCustody(opts.idbName, [route], () => true);
}
