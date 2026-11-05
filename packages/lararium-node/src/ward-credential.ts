/**
 * ward-credential — THE HAND'S ROUTE FOR ONE WARD ACT, carried from the place a person typed it to the act that opens the ward.
 *
 * A ward act (every act that reads a face's root seed: a daemon or kahua promote-commit, a kāpae-lower, the swarm's house cap and
 * push go, and every act that changes who belongs to the face or what it trusts) opens the face's ward key fresh from a human route.
 * The route rides as a `WardCredential`: an opaque token only `wardCredential` mints, over the credentials a person presented for
 * THIS act. It is never cached: the act that receives one drops it when it settles, and no module holds one between acts. Without
 * one, a root-reading act refuses `ward-needs-fresh-unlock` before any key opens.
 *
 * Where the route comes from is the caller's door: a TTY prompt in the CLI (`ward-needs-tty` refuses an environment variable and a
 * piped stdin), the per-act ward worker in a browser, the founding's own route while a face is born. A store verb never carries the
 * route itself (a verb's arguments get hashed into a receipt): the route rides ONE custody frame (`op: "ward"`), the door parks it
 * under a random one-use TICKET, and the verb names the ticket (`wardTicket`). A sealed act rides the custody door already, so it
 * carries the route in its own `ward` argument.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness#/the-ward
 */
import { isWardBoundWiki, type Credential, type SlotSpec } from "@lararium/mesh";
import { WardNeedsFreshUnlock } from "./custody-holder.js";

declare const wardBrand: unique symbol;
/** One act's human route to a face's ward. Opaque; only `wardCredential` mints one. */
export interface WardCredential { readonly [wardBrand]: true }

const routes = new WeakMap<WardCredential, readonly Credential[]>();

/** Mint the token for one act over the credentials a person presented for it. A passkey never rides it. */
export function wardCredential(credentials: readonly Credential[]): WardCredential {
  if (!Array.isArray(credentials) || credentials.length === 0) throw new WardNeedsFreshUnlock("an empty route");
  const token = Object.freeze({}) as WardCredential;
  routes.set(token, Object.freeze(credentials.map((c) => Object.freeze({ ...c })) as Credential[]));
  return token;
}

/** The credentials a token carries; a missing or hand-built token refuses `ward-needs-fresh-unlock` by name. */
export function wardCredentialsOf(ward: WardCredential | undefined | null, what = "this act"): readonly Credential[] {
  const held = ward ? routes.get(ward) : undefined;
  if (!held) throw new WardNeedsFreshUnlock(what);
  return held;
}

/**
 * The ward token a FOUNDING carries from the route it was born under: its passphrase pins, as credentials. A paper pin rides the
 * founding as a confirmed token that names no sheet, so a paper-only founding carries no ward token here and its first root act
 * asks the sheets again.
 */
export function wardCredentialOfRoute(slots: readonly SlotSpec[]): WardCredential | null {
  const passphrases = slots.flatMap((s) => s.pins.flatMap((p) => (p.kind === "passphrase" ? [{ kind: "passphrase" as const, passphrase: p.passphrase }] : [])));
  return passphrases.length > 0 ? wardCredential(passphrases) : null;
}

/** Read the `ward` argument a daemon verb carries (the CLI's ward door fills it): an array of passphrase or paper credentials. */
export function wardCredentialOfArgs(raw: unknown): WardCredential | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const creds: Credential[] = [];
  for (const c of raw as unknown[]) {
    if (!c || typeof c !== "object") return undefined;
    const r = c as Record<string, unknown>;
    if (r["kind"] === "passphrase" && typeof r["passphrase"] === "string" && r["passphrase"].length > 0) creds.push({ kind: "passphrase", passphrase: r["passphrase"] });
    else if (r["kind"] === "paper" && Array.isArray(r["sheets"]) && r["sheets"].every((x) => typeof x === "string")) creds.push({ kind: "paper", sheets: r["sheets"] as string[] });
    else return undefined;
  }
  return wardCredential(creds);
}

// ── the unlock act's own route ───────────────────────────────────────────────────────────────────────────────────────

/**
 * THE UNLOCK ACT CARRIES ITS ROUTE FOR ITS OWN LENGTH. A face unlock is a hand act: the person typed the face's route for it. The
 * composition that unlock stands (its boot dial among it) may issue the founder's own certificate at a scope it dials for the
 * first time, a ward act, under that same route. The token lives exactly as long as the unlock act (`duringUnlockAct`), and only
 * the founder certificate's default root door reads it (`unlockActWard`); nothing holds it after the act settles.
 */
let unlockAct: WardCredential | null = null;
export async function duringUnlockAct<T>(ward: WardCredential, act: () => Promise<T>): Promise<T> {
  const prior = unlockAct;
  unlockAct = ward;
  try { return await act(); } finally { unlockAct = prior; }
}
export function unlockActWard(): WardCredential | undefined { return unlockAct ?? undefined; }

// ── the one-use ticket a store verb names ────────────────────────────────────────────────────────────────────────────

/** The most tickets parked at once: a caller that parked and left never builds a store of routes. */
const TICKETS_HELD = 4;
const tickets = new Map<string, WardCredential>();

/** Park one act's route under a random ticket; the oldest falls out past `TICKETS_HELD`. */
export function parkWardTicket(ward: WardCredential): string {
  wardCredentialsOf(ward, "a parked route");
  const ticket = Array.from(globalThis.crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
  tickets.set(ticket, ward);
  while (tickets.size > TICKETS_HELD) tickets.delete(tickets.keys().next().value!);
  return ticket;
}

/** Take the route a ticket names, once: the ticket leaves on its first read, whatever the act then does. */
export function takeWardTicket(raw: unknown): WardCredential | undefined {
  if (typeof raw !== "string" || !/^[0-9a-f]{64}$/.test(raw)) return undefined;
  const ward = tickets.get(raw);
  tickets.delete(raw);
  return ward;
}

/** Drop every parked ticket (a lock, a stand-down). */
export function dropWardTickets(): void { tickets.clear(); }

// ── which store verbs are ward acts ───────────────────────────────────────────────────────────────────────────────────

/**
 * The store verbs that read a face's root seed: each is a ward act and names a ticket (`wardTicket`). The rule is one table: every
 * act that changes who belongs to the face or what it trusts, and the daemon realm's bound acts (seat-harness#/the-ward).
 */
const WARD_VERBS: ReadonlySet<string> = new Set([
  "kapae-lower", "swarm-cap-set", "swarm-share-set", "swarm-go-issue",
  "kahua-lift", "kahua-withdraw", "kahua-carry", "intent-root",
  "handle-publish", "handle-burn", "handle-rotate", "handle-attest",
  "persona-lease", "nexus-publish", "fleet-join-answer",
  // A take stands a late dial, where the founder's certificate at a new Nexus is a ward act (it issues inside the row's route).
  "nexus-admit-take",
]);
export function storeVerbNeedsWard(verb: string, args: Readonly<Record<string, unknown>>): boolean {
  if (verb === "promote-commit") return isWardBoundWiki(typeof args["wiki"] === "string" && args["wiki"].length > 0 ? args["wiki"] : "daemon");
  // A realm hand signs as its leaf at that realm; only the holder's own act signs with the face root.
  if (verb === "edge-kapae") return typeof args["realm"] !== "string";
  return WARD_VERBS.has(verb);
}

// ── the seated gatherer: a person at this process's terminal ─────────────────────────────────────────────────────────────

/**
 * WHO ASKS WHEN AN ACT CARRIES NO ROUTE. A CLI process seats a gatherer that reads one ward act's route from its own TTY
 * (`ward-needs-tty` refuses an environment variable and a pipe) or, under a root a harness staged, answers the published test
 * route by name; a test fixture seats its synthetic route. A daemon seats none, so an act that reaches it with no route refuses
 * `ward-needs-fresh-unlock`. The gatherer asks once per act and keeps nothing (the face route's own pattern, `face-route`).
 */
export type WardGatherer = (what: string) => Promise<readonly Credential[]>;
let gatherer: WardGatherer | null = null;
export function seatWardGatherer(gather: WardGatherer | null): void { gatherer = gather; }
export function wardGathererSeated(): boolean { return gatherer !== null; }
/** Ask the seated gatherer for one act's route; refuses `ward-needs-fresh-unlock` where none is seated. */
export async function gatherSeatedWardRoute(what: string): Promise<readonly Credential[]> {
  if (!gatherer) throw new WardNeedsFreshUnlock(what);
  return gatherer(what);
}

/** The act's own token, else one the seated gatherer asks for this act, else none. */
export async function wardOrGather(ward: WardCredential | undefined | null, what: string): Promise<WardCredential | undefined> {
  if (ward) return ward;
  if (!gatherer) return undefined;
  return wardCredential(await gatherer(what));
}
