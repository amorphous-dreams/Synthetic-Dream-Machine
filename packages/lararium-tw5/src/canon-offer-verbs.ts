/**
 * canon-offer-verbs — the daemon island's skins of the ONE offering door (`@lararium/mesh` `canon-offer`): `offer-make`,
 * `offer-list`, `offer-show` and `offer-promote`. The daemon behaviour registers them on node and browser alike, so both hosts
 * run this file and the mesh's decisions; only the ports bind here, each by capability:
 *
 *   · `source`      — the face's view above canon for the canon bag's wiki: its own `personal` layer over the workbench it
 *                     may read (`wikis/<slug>/personal`, `wikis/<slug>/working`), each reached by access, never mounted, and
 *                     each gated by the face's read cap on it. A face that holds no seat in the workbench offers from its
 *                     `personal` layer alone (cabal-realm#/the-workbench);
 *   · `canon`       — the house-canon bag's live document: the Kahu realm's standing document where the vessel names one
 *                     (`canonStoreOf`), read by access otherwise (a read asks nothing);
 *   · `canonWrite`  — the same document, written ONLY after `requireKahuReach` clears for the bag (the vessel's Kahu source);
 *   · `board`       — the Nexus's offer table (`canonOfferDocUrl`), beside the Kahu realm and never in it; the Nexus reads off
 *                     the shore's charter (node), else the call's own `nexus` (a browser page, whose island reads no charter);
 *   · `signer`      — the lit face's offer key at the Nexus it offers toward (`nexusOfferSigner`): an offer seals under a key
 *                     scoped to that Nexus and names no PersonaGroup and no atom key.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/offering#/the-canon-offer
 */
import {
  AutomergeDocStore, CanonOfferRefused, VerbRefusal, bagUri, findOrThrow, isHouseCanonBag, offerCanonRecords, resolveHouseCanon, promoteCanonOffer, readCanonOffers, requireKahuReach,
  showCanonOffer, workingLayerOfCanon,
  type CanonOfferBoard, type CanonOfferPorts, type LarTiddlerStore, type OfferSeat, type OfferSigner,
} from "@lararium/mesh";
import { makeBagAccess, type ActionHandlerOptions } from "./action-handler.js";
import type { VerbReactor } from "./verb-dispatcher.js";

/** What a host lends the offer verbs beyond the bag reach: the Nexus, its offer table, and the lit face's signer. */
export interface CanonOfferVerbOptions extends ActionHandlerOptions {
  /** The Nexus this vessel stands in (its charter), or null where none stands. */
  readonly nexus:  () => Promise<string | null>;
  /** The Nexus's offer table. */
  readonly board:  (nexus: string) => Promise<CanonOfferBoard>;
  /** The lit face's offer key at a Nexus (`nexusOfferSigner` over the face's atom seed); null at a faceless floor. */
  readonly signer: () => ((nexus: string) => OfferSigner) | null;
  /**
   * The seat of the Nexus's charter this vessel holds, read by name and never opened (its key, its epoch, the lineage that proves
   * it); null where it holds none. A host that lends no reader (a browser page, which holds no seat row) promotes nothing.
   */
  readonly seat?:  () => Promise<OfferSeat | null>;
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
  return { nexus, board: await opts.board(nexus), canon: async (bag) => canonStoreOf(opts, bag).catch(() => null) };
}

/**
 * HOUSE CANON'S ONE DOCUMENT. Where the vessel names the Kahu realm's standing document for a bag (`reach.systemCanonUrl`), the
 * offer doors read and write THAT document: the one the charter seat's retire and the floor cut read (`nodeCanonStore`). A
 * registry row that names another document for the bag never answers here, so a promotion never lands where its retire cannot
 * see it. A vessel whose realm names none (a rig, a page with no realm reach) reaches the bag by access, as every action verb does.
 */
async function canonStoreOf(opts: CanonOfferVerbOptions, bag: string): Promise<LarTiddlerStore | null> {
  const reach = opts.reach;
  const answer = await resolveHouseCanon<LarTiddlerStore>(bag, { realm: reach?.systemCanonUrl, row: () => makeBagAccess(opts).read(bag) });
  if (answer === null) return null;
  if ("row" in answer) return answer.row;
  return new AutomergeDocStore(await findOrThrow(reach!.repo, answer.realm, `${bag} (the Kahu realm's live canon)`), bag);
}

/** Run a door, answering a named refusal as data (`refusal`, `why`), the way the action verbs answer theirs. */
async function answered(run: () => Promise<Record<string, unknown>>): Promise<Record<string, unknown>> {
  try { return { ok: true, ...(await run()) }; }
  catch (err) {
    if (err instanceof CanonOfferRefused) return { ok: false, refusal: err.refusal, why: err.message };
    throw err;
  }
}

/**
 * THE OFFER'S SOURCE: the face's `personal` layer over the workbench it may read, as the wiki's own stack reads them. The
 * first layer that holds a record of a title answers it, a tombstone included (it shadows the layer beneath); a layer the
 * face holds no read on, or that reaches no document here, drops out. Null where neither layer answers.
 */
async function offerSourceOf(opts: CanonOfferVerbOptions, working: string, cap: (access: "read", bag: string) => Promise<{ ok: boolean; reason?: string }>): Promise<{ readonly source: Pick<LarTiddlerStore, "get" | "listVisible">; readonly bags: readonly string[] } | { readonly denied: string }> {
  const personal = working.replace(/\/working$/, "/personal");
  const layers: Array<{ bag: string; store: LarTiddlerStore }> = [];
  let denied = "";
  for (const bag of [personal, working]) {
    const proof = await cap("read", bag);
    if (!proof.ok) { if (bag === working) denied = proof.reason ?? "no reason"; continue; }
    const store = await makeBagAccess(opts).read(bag).catch(() => null);
    if (store) layers.push({ bag, store });
  }
  if (layers.length === 0) return { denied };
  const get: LarTiddlerStore["get"] = async (title) => {
    for (const layer of layers) { const held = await layer.store.get(title); if (held) return held; }
    return null;
  };
  return {
    bags: layers.map((l) => l.bag),
    source: {
      get,
      listVisible: async () => {
        const titles = new Set<string>();
        for (const layer of layers) for (const title of await layer.store.listVisible()) titles.add(title);
        const out: string[] = [];
        for (const title of titles) { const held = await get(title); if (held && !held.meta?.deleted) out.push(title); }
        return out.sort();
      },
    },
  };
}

/** `offer-make { bag, titles }` — the lit face offers records from its own view above canon (personal over the workbench) toward a house-canon bag. */
export function makeOfferMakeReactor(opts: CanonOfferVerbOptions): VerbReactor {
  return async (args, ctx) => answered(async () => {
    const bag = canonBagOf(args["bag"]);
    if (!isHouseCanonBag(bag)) throw new CanonOfferRefused("offer-not-canon", `${bag} names no house-canon bag; an offer goes toward house canon alone`);
    const titles = Array.isArray(args["titles"]) ? (args["titles"] as unknown[]).filter((t): t is string => typeof t === "string") : [];
    const working = workingLayerOfCanon(bag)!;
    const face = opts.signer();
    if (face === null) throw new VerbRefusal("waking-floor", "waking-floor: light a face before it offers; an offer seals under the face that makes it");
    const ports = await portsOf(opts, args);
    const reached = await offerSourceOf(opts, working, ctx.cap);
    if ("denied" in reached) {
      if (reached.denied) throw new VerbRefusal("cap-denied", `cap-denied: read on ${working} required (${reached.denied})`);
      throw new CanonOfferRefused("offer-not-in-source", `${working} reaches no working layer here, and this face holds no personal layer of the wiki`);
    }
    const out = await offerCanonRecords({ ...ports, source: reached.source, signer: face(ports.nexus) }, { bag, titles });
    return { cid: out.offer.cid, landed: out.landed, bag, source: reached.bags, nexus: ports.nexus, records: out.offer.body.records.map((r) => ({ title: r.title, digest: r.digest, base: r.base })) };
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

/**
 * `offer-promote { cid, overFresher? }` — the steward's Kahu hand: the reach first, then the charter seat this vessel holds
 * (`offer-retire-unseated` where it holds none: the law stands HERE, for every caller of the verb), then the canon write. The
 * retire seals under that seat's key, which rests outside this island, so it rides the store door (`offer-retire`; `lares meme
 * offer promote` runs both); until it lands the offer reads open and a replay writes nothing. The answer names the canon
 * document's heads after the write (`canonHeads`), which the retire's door waits on.
 *
 * ONE CANON STORE, RESOLVED ONCE, READ OR REFUSED. The decision and the write ride the same store, and a resolution that fails
 * refuses `offer-canon-unread`: a promotion never reads a failed canon read as "canon holds no such record", which would land an
 * offered record as new over one another hand added. (The listings keep their soft read: they write nothing.)
 */
export function makeOfferPromoteReactor(opts: CanonOfferVerbOptions): VerbReactor {
  return async (args, ctx) => answered(async () => {
    const cid = typeof args["cid"] === "string" ? args["cid"] : "";
    const ports = await portsOf(opts, args);
    const requestId = String((ctx.invocation as { requestId?: unknown }).requestId ?? "offer-promote");
    const stores = new Map<string, Promise<LarTiddlerStore | null>>();
    const canonOf = (bag: string): Promise<LarTiddlerStore | null> => {
      let store = stores.get(bag);
      if (store === undefined) {
        store = canonStoreOf(opts, bag).catch((err: unknown) => {
          throw new CanonOfferRefused("offer-canon-unread", `${bag}'s canon document did not answer a read (${err instanceof Error ? err.message : String(err)}), so the promotion decided nothing and wrote nothing; run it again`);
        });
        stores.set(bag, store);
      }
      return store;
    };
    const out = await promoteCanonOffer({
      ...ports,
      canon: canonOf,
      requireReach: (bag) => requireKahuReach(bag, opts.kahuReach, "offer promote"),
      seat: async () => (opts.seat ? opts.seat() : null),
      canonWrite: async (bag) => {
        const store = await canonOf(bag);
        return store ? {
          put: (record) => store.put(record, { kind: "lares-verb", requestId }),
          heads: () => (store as { headsNow?: () => readonly string[] | null }).headsNow?.() ?? null,
        } : null;
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
  registry.register("offer-promote", makeOfferPromoteReactor(opts), { summary: "Promote one offer into house canon under the steward's Kahu hand, on a vessel that holds a seat of the Nexus's charter; a moved base takes overFresher. The seat's retire follows on the store door (offer-retire).", surfaces: [surfaces.cli] });
}
