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
 * under a random one-use REF bound to the act it names (verb and arguments), and the verb names the ref (`wardRef`). A sealed act rides the custody door already, so it
 * carries the route in its own `ward` argument.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness#/the-ward
 */
import { createHash, randomBytes } from "node:crypto";
import { isWardBoundWiki, WardRefused, type Credential, type SlotSpec } from "@lararium/mesh";
import { WardNeedsFreshUnlock } from "./custody-holder.js";

declare const wardBrand: unique symbol;
/** One act's human route to a face's ward. Opaque; only `wardCredential` mints one. */
export interface WardCredential { readonly [wardBrand]: true }

const routes = new WeakMap<WardCredential, readonly Credential[]>();

/** Mint the token for one act over the human route (passphrases, paper sheets) a person presented for it. A passkey refuses here. */
export function wardCredential(credentials: readonly Credential[]): WardCredential {
  if (!Array.isArray(credentials) || credentials.length === 0) throw new WardNeedsFreshUnlock("an empty route");
  if (credentials.some((c) => (c as { kind: unknown }).kind !== "passphrase" && (c as { kind: unknown }).kind !== "paper")) {
    throw new WardRefused("ward-passkey-refused", "a ward route is a passphrase or a paper sheet; a passkey rides an authenticator vendor's registry");
  }
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

// ── the one-use ticket a store verb names ────────────────────────────────────────────────────────────────────────────

/** The most tickets parked at once: a caller that parked and left never builds a store of routes. */
const TICKETS_HELD = 4;

/** What a ticket binds: the verb and a digest of its arguments (the session's own face keys and the ref itself left out). */
export interface WardBind { readonly verb: string; readonly args: Readonly<Record<string, unknown>> }

/** The keys a binding reads apart: the ticket's own ref (never bound), and the face keys, bound as ONE face (see below). */
const UNBOUND_KEYS = new Set(["wardRef", "wardTicket", "face", "handleIndex"]);

/** A canonical digest of one act's verb and arguments: the same act spells the same digest, whatever order its keys came in. */
export function wardBindDigest(bind: WardBind): string {
  const canon = (v: unknown): unknown => Array.isArray(v) ? v.map(canon)
    : v && typeof v === "object" ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, canon((v as Record<string, unknown>)[k])])) : v;
  const args = Object.fromEntries(Object.entries(bind.args).filter(([k]) => !UNBOUND_KEYS.has(k)));
  // THE FACE BINDS TOO, as one value: the face the act names (`face`, else `handleIndex`), so a ref parked for one face spends on no
  // other. A session lends a row both keys at the same ordinal, so the CLI, the row and a summoned verb all read the same face.
  const face = bind.args["face"] ?? bind.args["handleIndex"] ?? null;
  const conflict = bind.args["face"] != null && bind.args["handleIndex"] != null && bind.args["face"] !== bind.args["handleIndex"]
    ? bind.args["handleIndex"] : null;
  return createHash("sha256").update(JSON.stringify({ verb: bind.verb, face, conflict, args: canon(args) })).digest("hex");
}

const tickets = new Map<string, { readonly ward: WardCredential; readonly verb: string; readonly digest: string }>();

/**
 * Park one act's route under a random REF, bound to that act: its verb and the digest of its arguments. The ref is a name, not a
 * key: it may ride a verb's arguments (and so the daemon document, on a summoned verb) because only the act it names can spend it.
 * The oldest falls out past `TICKETS_HELD`.
 */
export function parkWardTicket(ward: WardCredential, bind: WardBind | { readonly verb: string; readonly digest: string }): string {
  wardCredentialsOf(ward, "a parked route");
  const ref = randomBytes(32).toString("hex");
  tickets.set(ref, { ward, verb: bind.verb, digest: "digest" in bind ? bind.digest : wardBindDigest(bind) });
  while (tickets.size > TICKETS_HELD) tickets.delete(tickets.keys().next().value!);
  return ref;
}

/**
 * Take the route a ref names for the act at hand, once. The ticket leaves on its first read whatever follows; a read by any act
 * other than the one it was parked for (another verb, other arguments) refuses `ward-ticket-mismatch` and the ticket burns.
 */
export function takeWardTicket(raw: unknown, use: WardBind): WardCredential | undefined {
  if (typeof raw !== "string" || !/^[0-9a-f]{64}$/.test(raw)) return undefined;
  const parked = tickets.get(raw);
  tickets.delete(raw);
  if (!parked) return undefined;
  if (parked.verb !== use.verb || parked.digest !== wardBindDigest(use)) {
    throw new WardRefused("ward-ticket-mismatch", `a ticket parked for "${parked.verb}" was spent on another act; it burned`);
  }
  return parked.ward;
}

/** Drop every parked ticket (a lock, a stand-down). */
export function dropWardTickets(): void { tickets.clear(); }

// ── which store verbs are ward acts ───────────────────────────────────────────────────────────────────────────────────

/**
 * The store verbs that read a face's root seed: each is a ward act and names a bound ref (`wardRef`). The rule is one table: every
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
  // A co-signing device's approve opens its own ward for the face (seat-harness#/the-swarm-slices); a deny releases nothing.
  if (verb === "intent-answer") return args["deny"] !== true;
  if (verb === "promote-commit") return isWardBoundWiki(typeof args["wiki"] === "string" && args["wiki"].length > 0 ? args["wiki"] : "daemon");
  // A realm hand signs as its leaf at that realm; only the holder's own act signs with the face root.
  if (verb === "edge-kapae") return typeof args["realm"] !== "string";
  return WARD_VERBS.has(verb);
}

/**
 * The ward acts a co-sign gate holds (seat-harness#/the-swarm-slices): the gate's judgement needs no root, so the row runs first
 * with no route, and the route gets asked only where the act will run (its signer names `ward-needs-fresh-unlock`). On a face of
 * two devices with no answer, nobody types a passphrase only to read `ward-awaiting-cosign`. An answer runs first too: only an
 * approve of a ward act opens the co-signing device's ward, so an answer to any other ask asks no route.
 */
const GATED_WARD_VERBS: ReadonlySet<string> = new Set(["kapae-lower", "swarm-cap-set", "swarm-go-issue", "intent-answer"]);
export function storeVerbGatesFirst(verb: string): boolean { return GATED_WARD_VERBS.has(verb); }

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
