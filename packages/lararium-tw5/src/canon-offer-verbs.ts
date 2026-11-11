/**
 * canon-offer-verbs — the daemon island's skins of the ONE offering door (`@lararium/mesh` `canon-offer`): `offer-make`,
 * `offer-list`, `offer-show` and `offer-promote`. The daemon behaviour registers them on node and browser alike, so both hosts
 * run this file and the mesh's decisions; only the ports bind here, each by capability:
 *
 *   · `source`      — the face's own working layer for the canon bag's wiki (`wikis/<slug>/working`, its realm workbench),
 *                     reached by access, never mounted; the face's read cap on it gates the offer;
 *   · `canon`       — the house-canon bag's live document, read by access (a read asks nothing);
 *   · `canonWrite`  — the same document, written ONLY after `requireKahuReach` clears for the bag (the vessel's Kahu source);
 *   · `board`       — the Nexus's offer table (`canonOfferDocUrl`), beside the Kahu realm and never in it; the Nexus reads off
 *                     the shore's charter (node), else the call's own `nexus` (a browser page, whose island reads no charter);
 *   · `signer`      — the lit face's atom: an offer and a retire each seal under the face that made it.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/offering#/the-canon-offer
 */
import {
  CanonOfferRefused, VerbRefusal, bagUri, isHouseCanonBag, offerCanonRecords, promoteCanonOffer, readCanonOffers, requireKahuReach,
  showCanonOffer, workingLayerOfCanon,
  type CanonOfferBoard, type CanonOfferPorts, type OfferSigner,
} from "@lararium/mesh";
import { makeBagAccess, type ActionHandlerOptions } from "./action-handler.js";
import type { VerbReactor } from "./verb-dispatcher.js";

/** What a host lends the offer verbs beyond the bag reach: the Nexus, its offer table, and the lit face's signer. */
export interface CanonOfferVerbOptions extends ActionHandlerOptions {
  /** The Nexus this vessel stands in (its charter), or null where none stands. */
  readonly nexus:  () => Promise<string | null>;
  /** The Nexus's offer table. */
  readonly board:  (nexus: string) => Promise<CanonOfferBoard>;
  /** The lit face's atom and its PersonaGroup; null at a faceless floor. */
  readonly signer: () => { readonly face: string; readonly atom: OfferSigner } | null;
}

/** The verb names, one owner. */
export const CANON_OFFER_VERBS = ["offer-make", "offer-list", "offer-show", "offer-promote"] as const;

const canonBagOf = (v: unknown): string => {
  const raw = typeof v === "string" ? v.trim() : "";
  if (raw === "") throw new VerbRefusal("offer-incomplete", "offer-incomplete: name the house-canon bag (`bag`: a slug or lar:///ha.ka.ba/bags/<slug>)");
  return raw.startsWith("lar:") ? raw : bagUri(raw);
};

/**
 * The Nexus a door acts toward: the shore's charter where one stands (node), else the Nexus the caller names (a browser page names
 * the one its floor card or joined face holds, since its island reads no charter). A named Nexus other than the charter's refuses.
 */
async function portsOf(opts: CanonOfferVerbOptions, args: Readonly<Record<string, unknown>>): Promise<CanonOfferPorts> {
  const shore = await opts.nexus();
  const named = typeof args["nexus"] === "string" && args["nexus"].trim() !== "" ? args["nexus"].trim() : null;
  if (shore !== null && named !== null && named !== shore) throw new CanonOfferRefused("offer-foreign-nexus", `this vessel's charter stands in ${shore.slice(0, 18)}…, not ${named.slice(0, 18)}…`);
  const nexus = shore ?? named;
  if (nexus === null) throw new CanonOfferRefused("offer-no-nexus", "this vessel stands in no Nexus charter and the call named none, so it reaches no offer table");
  const access = makeBagAccess(opts);
  return { nexus, board: await opts.board(nexus), canon: async (bag) => access.read(bag).catch(() => null) };
}

/** Run a door, answering a named refusal as data (`refusal`, `why`), the way the action verbs answer theirs. */
async function answered(run: () => Promise<Record<string, unknown>>): Promise<Record<string, unknown>> {
  try { return { ok: true, ...(await run()) }; }
  catch (err) {
    if (err instanceof CanonOfferRefused) return { ok: false, refusal: err.refusal, why: err.message };
    throw err;
  }
}

/** `offer-make { bag, titles }` — the lit face offers records from its working layer toward a house-canon bag. */
export function makeOfferMakeReactor(opts: CanonOfferVerbOptions): VerbReactor {
  return async (args, ctx) => answered(async () => {
    const bag = canonBagOf(args["bag"]);
    if (!isHouseCanonBag(bag)) throw new CanonOfferRefused("offer-not-canon", `${bag} names no house-canon bag; an offer goes toward house canon alone`);
    const titles = Array.isArray(args["titles"]) ? (args["titles"] as unknown[]).filter((t): t is string => typeof t === "string") : [];
    const working = workingLayerOfCanon(bag)!;
    const proof = await ctx.cap("read", working);
    if (!proof.ok) throw new VerbRefusal("cap-denied", `cap-denied: read on ${working} required (${proof.reason ?? "no reason"})`);
    const face = opts.signer();
    if (face === null) throw new VerbRefusal("waking-floor", "waking-floor: light a face before it offers; an offer seals under the face that makes it");
    const ports = await portsOf(opts, args);
    const source = await makeBagAccess(opts).read(working).catch(() => null);
    if (source === null) throw new CanonOfferRefused("offer-not-in-source", `${working} reaches no working layer here`);
    const out = await offerCanonRecords({ ...ports, source, signer: face.atom, face: face.face }, { bag, titles });
    return { cid: out.offer.cid, landed: out.landed, bag, nexus: ports.nexus, records: out.offer.body.records.map((r) => ({ title: r.title, digest: r.digest, base: r.base })) };
  });
}

/** `offer-list { bag?, all? }` — the offers the table counts, each record's freshness read now. Reads alone. */
export function makeOfferListReactor(opts: CanonOfferVerbOptions): VerbReactor {
  return async (args) => answered(async () => {
    const ports = await portsOf(opts, args);
    const bag = typeof args["bag"] === "string" && args["bag"] !== "" ? canonBagOf(args["bag"]) : undefined;
    const out = await readCanonOffers(ports, { ...(bag !== undefined ? { bag } : {}), all: args["all"] === true });
    return { nexus: ports.nexus, offers: out.offers.map((o) => ({ ...o })), setAside: out.setAside.length };
  });
}

/** `offer-show { cid }` — one offer, each record's freshness and field diff against canon now. Reads alone. */
export function makeOfferShowReactor(opts: CanonOfferVerbOptions): VerbReactor {
  return async (args) => answered(async () => {
    const cid = typeof args["cid"] === "string" ? args["cid"] : "";
    const ports = await portsOf(opts, args);
    return { nexus: ports.nexus, ...(await showCanonOffer(ports, cid)) };
  });
}

/** `offer-promote { cid, overFresher? }` — the steward's hand: the Kahu reach first, then the canon write and the retire. */
export function makeOfferPromoteReactor(opts: CanonOfferVerbOptions): VerbReactor {
  return async (args, ctx) => answered(async () => {
    const cid = typeof args["cid"] === "string" ? args["cid"] : "";
    const face = opts.signer();
    if (face === null) throw new VerbRefusal("waking-floor", "waking-floor: light the steward's face before it promotes");
    const ports = await portsOf(opts, args);
    const access = makeBagAccess(opts);
    const requestId = String((ctx.invocation as { requestId?: unknown }).requestId ?? "offer-promote");
    const out = await promoteCanonOffer({
      ...ports, steward: face.atom,
      requireReach: (bag) => requireKahuReach(bag, opts.kahuReach, "offer promote"),
      canonWrite: async (bag) => {
        const store = await access.write(bag);
        return store ? { put: (record) => store.put(record, { kind: "lares-verb", requestId }) } : null;
      },
    }, { cid, overFresher: args["overFresher"] === true });
    return { ...out, nexus: ports.nexus };
  });
}

/** Register the four offer verbs on a registry. */
export function registerCanonOfferVerbs(
  registry: { register(name: string, reactor: VerbReactor, spec?: { summary: string; surfaces: readonly string[] }): void },
  opts: CanonOfferVerbOptions,
  surfaces: { readonly cli: string; readonly agent: string },
): void {
  registry.register("offer-make", makeOfferMakeReactor(opts), { summary: "Offer records from the lit face's working layer toward a house-canon bag: a signed offer on the Nexus's offer table; canon stays unmoved.", surfaces: [surfaces.cli, surfaces.agent] });
  registry.register("offer-list", makeOfferListReactor(opts), { summary: "List the offers on the Nexus's offer table, each record's freshness against canon now (\"canon is fresher\" warns); nothing writes.", surfaces: [surfaces.cli, surfaces.agent] });
  registry.register("offer-show", makeOfferShowReactor(opts), { summary: "Show one offer: each record's freshness and its field diff against canon now; nothing writes.", surfaces: [surfaces.cli, surfaces.agent] });
  registry.register("offer-promote", makeOfferPromoteReactor(opts), { summary: "Promote one offer into house canon under the steward's Kahu hand, retiring it by a record keyed to its CID; a moved base takes overFresher.", surfaces: [surfaces.cli] });
}
