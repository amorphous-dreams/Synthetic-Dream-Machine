/**
 * Each browser tab asks for its own unlock; the shared holder carries no unlock between tabs
 * (operator ruling, 2026-10-18; lar:///ha.ka.ba/lares/docs/stable-founding-road#/rulings, row B1).
 * The tree key rests in this page's memory alone (`browser-custody.ts`).
 *
 * A browser leaf holds a passphrase or paper slot before it holds a persona root. `secretMintDue`
 * asks for the first slot before the mint; the mint refuses `no-custody-slot` without one.
 * A first slot binds a passphrase or a paper sheet; a passkey binds only beside one (`browser-custody.ts`).
 *
 * Meme: lar:///ha.ka.ba/lararium/browser/browser-boot-custody
 */
import { ATTEMPT_BUDGET, attemptWarning } from "@lararium/mesh/attempt-budget";
import { type Credential } from "@lararium/mesh/keyslot-door";
import type { BrowserCustodyClear, UnsettledRecord } from "./browser-custody.js";
import {
  BrowserCustodyRefused,
  CLEAR_CUSTODY_CLEARS,
  CLEAR_CUSTODY_QUESTION,
  clearBrowserCustody,
  readBrowserCustody,
  sealBrowserKeystore,
  unlockBrowserCustody,
} from "./browser-custody.js";
import { heldUnnamedFace, standUnnamedFace } from "./browser-face-custody.js";

/** What this tab's boot asks the person for. `attempt` counts from 1 within one stand; from the second ask, `warning` carries
 *  the attempt budget's climbing words for the misses so far (attempt-budget.ts). */
export type CustodyAsk =
  | { readonly kind: "unlock"; readonly attempt: number; readonly of: number; readonly notes: readonly string[]; readonly warning?: string }
  | { readonly kind: "bind-first"; readonly why: "face-secret-mint-due" };

/** The person's answer: a route, or null when they decline. */
export type CustodyAnswer = Credential | null;

export type BootCustodyVerdict =
  | { readonly reading: "clear" }
  | { readonly reading: "held" }
  | { readonly reading: "opens"; readonly slot: string; readonly unsettled: readonly UnsettledRecord[] }
  | { readonly reading: "bound"; readonly slot: string; readonly unsettled: readonly UnsettledRecord[] }
  | { readonly reading: "declined" }
  | { readonly reading: "no-slot-opens"; readonly attempts: number; readonly attemptsLeft: 0; readonly warning: string; readonly notes: readonly string[] }
  | { readonly reading: "unreadable"; readonly why: string };

export interface StandBrowserCustodyOptions {
  readonly idbName: string;
  readonly ask: (question: CustodyAsk) => Promise<CustodyAnswer>;
  /** True when the boot is about to mint a face secret (a persona root, a face-scoped key, a per-Nexus key, a fleet-join or walk row) on a keystore that holds no slot. Default false. */
  readonly secretMintDue?: boolean;
  /** How many routes one stand tries before it answers `no-slot-opens`. A count, never a clock. Default `ATTEMPT_BUDGET` (five). */
  readonly attempts?: number;
}

export async function standBrowserCustody(opts: StandBrowserCustodyOptions): Promise<BootCustodyVerdict> {
  const attempts = opts.attempts ?? ATTEMPT_BUDGET;
  if (!Number.isSafeInteger(attempts) || attempts < 1) {
    throw new RangeError(`[browser-boot-custody] attempts must be a positive safe integer; got ${String(attempts)}`);
  }

  let status = await readBrowserCustody(opts.idbName);
  if (status.reading === "unreadable") return { reading: "unreadable", why: status.why };
  if (status.reading === "clear") {
    if (!opts.secretMintDue) return { reading: "clear" };
    const route = await opts.ask({ kind: "bind-first", why: "face-secret-mint-due" });
    if (route === null) return { reading: "declined" };
    // A FIRST SLOT NEVER STANDS ON A PASSKEY ALONE: the tree's first route is a passphrase or a paper sheet.
    if (route.kind === "passkey") throw new Error("keyslot: passkey-alone-refused");
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

  const asked = await askRoutes({
    attempts,
    ask: (q) => opts.ask({ kind: "unlock", ...q }),
    open: async (route) => {
      const opened = await unlockBrowserCustody(opts.idbName, [route]);
      return opened.reading === "opens" ? { opened: true, value: opened } : { opened: false, notes: opened.notes };
    },
  });
  if (asked.reading !== "opens") return asked;
  return { reading: "opens", slot: asked.value.slot, unsettled: asked.value.unsettled };
}

/** One unlock ask of a browser stand: the attempt (from 1), the budget, the last miss's notes, and from the second ask the
 *  attempt budget's climbing words for the misses so far. */
export interface RouteAsk { readonly attempt: number; readonly of: number; readonly notes: readonly string[]; readonly warning?: string }

/** What the asks came to: the route that opened (and what it opened), a decline, or the budget spent. */
export type RoutesAsked<R> =
  | { readonly reading: "opens"; readonly route: Credential; readonly value: R }
  | { readonly reading: "declined" }
  | { readonly reading: "no-slot-opens"; readonly attempts: number; readonly attemptsLeft: 0; readonly warning: string; readonly notes: readonly string[] };

/**
 * THE ONE ASK LOOP of every browser unlock (the boot's stand, a session's own unlock, a face's own unlock): up to `attempts`
 * routes (default `ATTEMPT_BUDGET`, five), each ask after a miss carrying the tries left in the climbing words, and the spent
 * reading carrying `attemptsLeft: 0` and the spent words.
 */
export async function askRoutes<R>(opts: {
  readonly attempts?: number;
  readonly ask: (question: RouteAsk) => Promise<Credential | null>;
  readonly open: (route: Credential) => Promise<{ readonly opened: true; readonly value: R } | { readonly opened: false; readonly notes: readonly string[] }>;
}): Promise<RoutesAsked<R>> {
  const attempts = opts.attempts ?? ATTEMPT_BUDGET;
  let notes: readonly string[] = [];
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const route = await opts.ask({ attempt, of: attempts, notes, ...(attempt > 1 ? { warning: attemptWarning(attempts - attempt + 1, "browser-stand", attempts) } : {}) });
    if (route === null) return { reading: "declined" };
    const opened = await opts.open(route);
    if (opened.opened) return { reading: "opens", route, value: opened.value };
    notes = opened.notes;
  }
  return { reading: "no-slot-opens", attempts, attemptsLeft: 0, warning: attemptWarning(0, "browser-stand", attempts), notes };
}

/**
 * THE FOUNDER'S TREE BINDS BEFORE ITS FIRST ROW: a founding asks its first bind once, and that one route binds the place tree
 * where it stands clear (or opens it where this thread holds no key) and stands the founder face's own tree beside it, unnamed
 * until the ceremony names its PersonaGroup (`browser-face-custody.ts` `standUnnamedFace`). An unnamed founder face this
 * thread already holds answers without an ask. Answers the unnamed face's key; refuses `no-custody-slot` by name where no door
 * asks or the person declines.
 */
export async function standFounderFace(opts: { readonly idbName: string; readonly ask?: (question: CustodyAsk) => Promise<CustodyAnswer> }): Promise<string> {
  const held = heldUnnamedFace(opts.idbName);
  if (held) return held;
  if (!opts.ask) throw new BrowserCustodyRefused("no-custody-slot", opts.idbName, "face-root", "the founding holds no custody door, so the founder face's tree cannot bind before its root mints");
  const route = await opts.ask({ kind: "bind-first", why: "face-secret-mint-due" });
  if (route === null) throw new BrowserCustodyRefused("no-custody-slot", opts.idbName, "face-root", "the person declined the founder face's first bind");
  if (route.kind === "passkey") throw new Error("keyslot: passkey-alone-refused");
  const place = await readBrowserCustody(opts.idbName);
  if (place.reading === "unreadable") throw new BrowserCustodyRefused("tree-unreadable", opts.idbName, undefined, place.why);
  if (place.reading === "clear") {
    try { await sealBrowserKeystore(opts.idbName, route); }
    catch (error) { if (!(error instanceof BrowserCustodyRefused) || error.reading !== "already-sealed") throw error; }
  }
  const now = await readBrowserCustody(opts.idbName);
  if (now.reading === "sealed" && !now.unlocked) {
    const opened = await unlockBrowserCustody(opts.idbName, [route]);
    if (opened.reading !== "opens") throw new BrowserCustodyRefused("no-custody-slot", opts.idbName, "face-root", "the founder's route opens no slot of this browser's place tree");
  }
  return (await standUnnamedFace(opts.idbName, route)).face;
}

/** What the clear-password verb answers: the confirm door's question, a declined route, or the clear's own reading. */
export type ClearCustodyVerbAnswer = BrowserCustodyClear | { readonly reading: "declined" };

/**
 * The clear-password verb (`custody-clear`, reached from the wiki's `tm-clear-password` road). The yes binds to the
 * scope its question named: before a literal yes over the very scope this act clears (`CLEAR_CUSTODY_CLEARS`) it
 * answers the true question and asks this tab's custody door nothing, so a person is asked for a route only once they
 * have agreed to clear exactly what clears; with that yes it asks the door for the route that opens the slot it clears.
 */
export async function clearCustodyVerb(opts: {
  readonly idbName: string;
  readonly confirmed: unknown;
  readonly clears: unknown;
  readonly askCustody?: (question: { readonly kind: "clear" }) => Promise<CustodyAnswer>;
}): Promise<ClearCustodyVerbAnswer> {
  if (opts.confirmed !== "yes" || opts.clears !== CLEAR_CUSTODY_CLEARS) return { reading: "asks", question: CLEAR_CUSTODY_QUESTION };
  if (!opts.askCustody) throw new Error("custody-clear: this page offers no custody door");
  const route = await opts.askCustody({ kind: "clear" });
  if (route === null) return { reading: "declined" };
  return clearBrowserCustody(opts.idbName, [route], () => true);
}
