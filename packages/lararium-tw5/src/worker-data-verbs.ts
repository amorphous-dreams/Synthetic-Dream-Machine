/**
 * worker-data-verbs — read-only data-plane reactors that run IN the daemon worker.
 *
 * Sovereign-worker model (lararium-canonical-model, project-sovereign-worker-model):
 * the data-plane lives in the worker, registered via makeDaemonBehavior's `wireWorkerVerbs`
 * hook over the IslandContext, riding the dispatcher's verify-then-delegate gate for free.
 *
 * Two shapes here, per the grounded read/command rule:
 *  - READS (where · resolve · list-wikis) — read the worker's OWN synced replica
 *    (ctx.composite over syncPort); zero round-trip to main.
 *  - MUTATOR (register-cold) — gate in-worker, then COMMAND the
 *    main-resident BagStowage fire-and-forget via daemon:residency-op (policy
 *    decides in the worker; the main mechanism executes).
 * Runtime-only reads (residency `stats`) stay at the resource (main) — no askMain.
 */

import { tiddlerText, type LarDoc } from "@lararium/mesh/base-doc";
import {
  mkDaemonResidencyOp,
  mkDaemonWikiAlert,
  type DaemonMsg_ResidencyOp,
  type DaemonMsg_WikiAlert,
} from "@lararium/mesh/island-protocol";
import { bagStackFromRec } from "@lararium/mesh/bag-stack-from-rec";
import { recipeUri } from "@lararium/mesh/lar-uris";
import { wikiBagUri, wikiSlotUri, type WikiSlotKind } from "@lararium/mesh/wiki-recipe";
import { WARD_AUDIT_URI_PREFIX } from "@lararium/mesh/verb-tiddler";
import { type CompositeStore } from "@lararium/mesh/composite-store";
import { type LarTiddlerRecord } from "@lararium/mesh/tiddler-store";
import { type Repo } from "@lararium/mesh/automerge";
import { ownEntry } from "@lararium/mesh/stored-value";
import { plainEntries, plainField, storedDeleted } from "@lararium/mesh/stored-value";
import { houseCanonBagsSeated } from "@lararium/mesh/kahu-canon-reach";
import { houseCanonUrl, resolveHouseCanon } from "@lararium/mesh/house-canon-doc";
import { HOME_WIKI_TITLE, readHomeWikiSlug } from "./home-wiki.js";
import type { VerbReactor } from "./verb-dispatcher.js";
import { findOrThrow, makeCatalogAccessor, type CatalogAccessor } from "./catalog-accessor.js";
import type { IngestAlert } from "./action-handler.js";

/** True for a draft floor's registry key (`wikis/<slug>/drafts/<did>`) — a doc the slot walk names. */
function isDraftFloorKey(key: string): boolean {
  return /^lar:\/\/\/ha\.ka\.ba\/wikis\/[^/]+\/drafts\//.test(key);
}

/** The slug a registry key names when it is a wiki's CANON bag (`bags/<slug>`), else null. */
function wikiSlugOfBagUri(bagUri: string): string | null {
  const m = /^lar:\/\/\/ha\.ka\.ba\/bags\/([^/]+)$/.exec(bagUri);
  return m ? m[1]! : null;
}

/** Registry options for access-based reads: the daemon reaches ANY registered bag
 *  across both oracle planes (catalog user + oracle system) without mounting it. */
export interface RegistryReach {
  repo:       Repo;
  catalogUrl: string | null;
  /** The lit face's own catalog laid over `catalogUrl` (sealed-store#/owed, U1). */
  faceCatalogUrl?: string | null;
  oracleUrl:  string | null;
  /** A registered wiki's INSTANCE slot doc (draft · working · personal) by THE ONE slot-doc
   *  resolver — null when none stands. Absent = `where` reaches the registry planes alone. */
  slotDocUrl?: (slug: string, kind: WikiSlotKind, opts: { mint: boolean }) => Promise<string | null>;
  /** A house canon bag's live document, which rests in the Kahu realm (no registry plane names it). */
  systemCanonUrl?: (bag: string) => Promise<string | null>;
}

/** Titles in a registry doc that point at a resolvable doc (an `automerge:` URL) —
 *  the bags/wikis/drafts the accessor can reach. */
function listRegisteredDocUris(doc: LarDoc | undefined): string[] {
  const out: string[] = [];
  for (const [title, rec] of Object.entries(doc?.tiddlers ?? {})) {
    const text = tiddlerText(rec);
    if (text && text.startsWith("automerge:") && plainField(rec, "kind") !== "private-synced") out.push(title);
  }
  return out;
}

/** A fire-and-forget poster for worker→main commands: residency-op (register-cold) and wiki-alert (reboot-pending notice to affected live islands). */
export type ResidencyOpPost = (msg: DaemonMsg_ResidencyOp | DaemonMsg_WikiAlert) => void;
let _opSeq = 0;

/** Build a residency mutator reactor: gate the verb in-worker, command main's manager. */
function residencyVerb(op: "register-cold", post: ResidencyOpPost): VerbReactor {
  return async (args) => {
    const bagId  = typeof args["url"] === "string" ? args["url"] : "";
    if (!bagId) throw new Error("args.url is required");
    post(mkDaemonResidencyOp({ requestId: `resop-${++_opSeq}`, op, bagId }));
    // Policy granted in-worker (keyhive-gated); main's BagStowage executes.
    return { url: bagId, op, commanded: true };
  };
}

/** `register-cold` — mark a bag known-but-not-loaded. */
export const makeRegisterColdReactor = (post: ResidencyOpPost): VerbReactor => residencyVerb("register-cold", post);

/** `where` — global membership query: which registered bags hold a tiddler.
 *  Access≠load: the daemon reaches
 *  EVERY registered bag across both oracle planes (catalog user + oracle
 *  system) plus its mounted composite — no mounting required. Returns membership.
 *  `scope` names the horizon: THIS operator's registry, never the DreamNet
 *  universe (no global now). Cascade-`primaryBag` only means something inside a
 *  recipe — it lives in `resolve`, recipe-scoped; here `primaryBag` is just the
 *  first holder found (membership convenience, not a cascade verdict). */
export function makeWhereReactor(composite: CompositeStore, reach?: RegistryReach): VerbReactor {
  return async (args) => {
    const tiddler = typeof args["tiddler"] === "string" ? args["tiddler"] : "";
    if (!tiddler) throw new Error("args.tiddler is required");
    // Fast base: the mounted composite (cascade order preserved here).
    const holding = new Set<string>(await composite.listBagsHolding(tiddler));
    // Extend by ACCESS across both registry planes — reach each registered doc.
    const planes = [reach?.catalogUrl, reach?.oracleUrl].filter((u): u is string => !!u);
    for (const planeUrl of planes) {
      if (!reach?.repo) break;
      const accessor = makeCatalogAccessor(reach.repo, planeUrl, planeUrl === reach.catalogUrl ? reach.faceCatalogUrl : null);
      const regDoc   = (await accessor.handle().catch(() => null))?.doc();
      for (const bagUri of listRegisteredDocUris(regDoc)) {
        const mounted = holding.has(bagUri) || composite.hasBag(bagUri);
        // A draft FLOOR doc (`wikis/<slug>/drafts/<did>`) answers under its slot name below, never its key.
        if (!mounted && !isDraftFloorKey(bagUri)) {
          const h   = await accessor.find(bagUri).catch(() => null);
          const rec = ownEntry(h?.doc()?.tiddlers, tiddler);
          if (rec && !storedDeleted(rec)) holding.add(bagUri);
        }
        // A registered WIKI's live instance slots — the docs THE ONE slot-doc resolver names (the
        // same docs its island mounts), reached by access, never mounted here. This probe must still
        // run when the wiki's canon bag is mounted: membership of that bag says nothing about its
        // typed working/personal/draft slots.
        const slug = wikiSlugOfBagUri(bagUri);
        if (!slug || !reach.slotDocUrl) continue;
        for (const kind of ["draft", "working", "personal"] as const) {
          const url = await reach.slotDocUrl(slug, kind, { mint: false }).catch(() => null);
          if (!url) continue;
          const sh  = await findOrThrow(reach.repo, url, `${wikiSlotUri(slug, kind)}`).catch(() => null);
          const sr  = ownEntry(sh?.doc()?.tiddlers, tiddler);
          if (sr && !storedDeleted(sr)) holding.add(wikiSlotUri(slug, kind));
        }
      }
    }
    // The house canon bags rest in the Kahu realm: no registry plane lists them, so each is reached by its realm row.
    // Its live wiki slots answer first (the layer a write lands in), then the canon document itself.
    if (reach?.repo && reach.systemCanonUrl) {
      for (const bagUri of houseCanonBagsSeated()) {
        const slug = wikiSlugOfBagUri(bagUri);
        if (slug && reach.slotDocUrl) {
          for (const kind of ["draft", "working", "personal"] as const) {
            const slotUrl = await reach.slotDocUrl(slug, kind, { mint: false }).catch(() => null);
            if (!slotUrl) continue;
            const sh  = await findOrThrow(reach.repo, slotUrl, `${wikiSlotUri(slug, kind)}`).catch(() => null);
            const sr  = ownEntry(sh?.doc()?.tiddlers, tiddler);
            if (sr && !storedDeleted(sr)) holding.add(wikiSlotUri(slug, kind));
          }
        }
        if (holding.has(bagUri) || composite.hasBag(bagUri)) continue;
        const url = await reach.systemCanonUrl(bagUri).catch(() => null);
        const h   = url ? await findOrThrow(reach.repo, url, bagUri).catch(() => null) : null;
        const rec = ownEntry(h?.doc()?.tiddlers, tiddler);
        if (rec && !storedDeleted(rec)) holding.add(bagUri);
      }
    }
    const bags = [...holding];
    return { tiddler, bags, primaryBag: bags[0] ?? null, scope: "operator-registry" };
  };
}

/** `resolve` — Residency Model coordinate-inspection: live manifestations + tombstones. */
export function makeResolveReactor(composite: CompositeStore): VerbReactor {
  return async (args) => {
    const tiddler = typeof args["tiddler"] === "string" ? args["tiddler"] : "";
    if (!tiddler) throw new Error("args.tiddler is required");
    const live       = await composite.resolveAll(tiddler);
    const tombstones = await composite.listKapaeBags(tiddler);
    const top = await composite.resolveLayered(tiddler);
    const hiddenBy = top?.record.meta?.deleted ? top.bagId : null;
    const manifestations = live.map((entry) => {
      const changeId = entry.record.meta?.changeId;
      return changeId !== undefined ? { bagId: entry.bagId, changeId } : { bagId: entry.bagId };
    });
    return { tiddler, manifestations, tombstones, hiddenBy, winningBag: hiddenBy ? null : live[0]?.bagId ?? null };
  };
}

/** `list-wikis` — enumerate the wikis registered in the catalog (oracle tiddlers).
 *  Reads the catalog plane via the accessor (access≠load) — the registry is NOT a loaded
 *  composite layer, so the accessor reads it directly, never through the composite. */
export function makeListWikisReactor(catalog: CatalogAccessor, sysPlane?: CatalogAccessor, systemCanonUrl?: (bagUri: string) => Promise<string | null>): VerbReactor {
  return async () => {
    // `canon: "floor"` names WHY a system row carries no document: no Kahu realm document answers this face (it holds no Kahu
    // reach) and no catalog row names one, so the wiki reads its canon through the floor snapshot (`floorCanonAddress`), which
    // no document stands behind. A house canon outside the Kahu cabal reads so by design, never as a seat gap.
    const wikis: Array<{ slug: string; uri: string; automergeUrl: string | null; kind: string; composition?: "own" | "default"; defaultDiffers?: boolean; canon?: "floor" }> = [];
    const cat = await catalog.handle();
    const catTiddlers: Record<string, LarTiddlerRecord> = Object.fromEntries(plainEntries(cat.doc()?.tiddlers));
    // System wikis — oracle-plane recipes (the lares/lararium quine system bags) carry the DEFAULT.
    // The vessel's own catalog record for the same slug is its composition: the row lists ONCE, as
    // the system row, and reads `composition: "own"` with whether the own stack differs from the default.
    const systemSlugs = new Set<string>();
    if (sysPlane) {
      const sys = await sysPlane.handle();
      const recipePrefix = recipeUri("oracle", "");
      for (const [title, rec] of plainEntries(sys.doc()?.tiddlers)) {
        if (!title.startsWith(recipePrefix)) continue;
        if (rec.meta?.deleted) continue;
        const slug = title.slice(recipePrefix.length);
        if (!slug || slug.includes("/")) continue;
        const bagUri = wikiBagUri(slug);
        const own = catTiddlers[recipeUri("catalog", slug)];
        const automergeUrl = houseCanonUrl(await resolveHouseCanon<string>(bagUri, { realm: systemCanonUrl, row: () => catalog.urlOf(bagUri) }));
        const row: (typeof wikis)[number] = { slug, uri: bagUri, automergeUrl, kind: "system", composition: "default", ...(automergeUrl === null ? { canon: "floor" as const } : {}) };
        if (own && !own.meta?.deleted) {
          row.composition = "own";
          row.defaultDiffers = bagStackFromRec(own).join(" ") !== bagStackFromRec(rec).join(" ");
        }
        systemSlugs.add(slug);
        wikis.push(row);
      }
    }
    // User wikis — the catalog RECIPE entries `wiki init` writes (`catalog/recipes/{slug}`).
    const userRecipePrefix = recipeUri("catalog", "");
    const userRows: typeof wikis = [];
    for (const [title, rec] of Object.entries(catTiddlers)) {
      if (!title.startsWith(userRecipePrefix)) continue;
      if (rec.meta?.deleted) continue;               // skip tombstones (listVisible parity)
      const slug = title.slice(userRecipePrefix.length);
      if (!slug || slug.includes("/") || systemSlugs.has(slug)) continue;
      const bagUri = wikiBagUri(slug);
      userRows.push({ slug, uri: bagUri, automergeUrl: await catalog.urlOf(bagUri), kind: "user" });
    }
    return { wikis: [...userRows, ...wikis] };
  };
}

// ── ward-alert — the disk ward's signal surfaces in the daemon VM ────────────
//
// A wiki island's projector refused a write (sovereign-island disk ward,
// disk-projection#write-ward). The signal rides the generic worker.event →
// placeVerb bridge into the daemon VM, which (a) writes a DURABLE audit record
// into the composite's default writable working layer and (b) injects a
// $:/tags/Alert into the operator's currently PINNED VM via the existing
// wiki-alert rail (kind "disk-ward"). No cap-gate: the signal originates from
// the island's own mechanism, grants nothing, and only writes audit + alert.

/** Register as "ward-alert". `post` = ctx.post (DaemonMsg_WikiAlert rides it). */
export function makeWardAlertReactor(
  composite: CompositeStore,
  control: CompositeStore,
  post: (msg: DaemonMsg_WikiAlert) => void,
): VerbReactor {
  return async (args) => fileWardRefusal(composite, control, post, args);
}

/**
 * FILE ONE WARD REFUSAL, directly — the same act the "ward-alert" verb performs, reachable by a
 * caller that already stands INSIDE the worker and holds no verb invocation to dispatch.
 *
 * The archive-floor write is that caller: it refuses three frames from the reactor's own registry, so
 * routing its refusal back out through a verb envelope would mint a hop with nothing on the far end.
 * ONE body, two doors — the reactor wraps this, and nothing here reads a `VerbContext`.
 */
export async function fileWardRefusal(
  composite: CompositeStore,
  /** The vessel's control document as a store (`controlStoreOf`): the audit row rests there, never in a wiki layer. */
  control: CompositeStore,
  post: (msg: DaemonMsg_WikiAlert) => void,
  args: Readonly<Record<string, unknown>>,
): Promise<Record<string, unknown>> {
  {
    const bagId  = typeof args["bagId"]  === "string" ? args["bagId"]  : "(unknown bag)";
    const uri    = typeof args["uri"]    === "string" ? args["uri"]    : "(unknown uri)";
    const reason = typeof args["reason"] === "string" ? args["reason"] : "(no reason)";
    // WHICH WARD REFUSED. The disk projector is one caller among others: the
    // M3 archive-floor write files its own refusals here rather than minting a fourth rail
    // (`archive-floor-write`, waking-floor). A seal refusal recorded as a disk-ward refusal would
    // send an operator to the wrong mechanism, so the LEDGER record and the operator-facing message
    // name the ward that actually refused. Absent → "disk-ward", the disk projector's ward.
    //
    // THE WIRE KIND STAYS `disk-ward` DELIBERATELY. `kind`/`cause` are Rail A's TRANSPORT names, and
    // the residency delivery keys off them (`hooks.alertArgs?.(kind)`, the browser drop diagnostics).
    // Varying them here would be minting a fourth rail under the name of reusing one.
    const wardKind = typeof args["wardKind"] === "string" && args["wardKind"] ? args["wardKind"] : "disk-ward";
    const headline = wardKind === "disk-ward"
      ? `Disk ward refused a write (${bagId})`
      : `${wardKind} refused a write (${bagId})`;
    const ts     = new Date().toISOString();
    // A KEYED ALERT CARRIES ITS KEY in the `key` field (a bag's pending-removal set names one, folded by the
    // projector). The key names the audit row and the live alert, so one keyed condition files one row however often
    // the rail hears of it, two show two alerts, and a resolution clears exactly its own.
    const key = typeof args["key"] === "string" && /^[0-9a-f]{8,64}$/.test(args["key"]) ? args["key"] : null;
    const slug   = readHomeWikiSlug(await composite.get(HOME_WIKI_TITLE));

    if (key !== null && args["resolved"] === true) {
      if (slug) post(mkDaemonWikiAlert({ wikiSlug: slug, message: `${headline}: resolved`, cause: "disk-ward", kind: "disk-ward", key, clear: true }));
      return { cleared: key, alerted: slug ?? "none", bagId, uri };
    }

    // (a) Durable audit in the vessel's control document: append-only, never coalesced, never in a mirrored layer.
    // A keyed row carries its key as its title and lands on ENTERING the condition, once.
    const auditTitle = `${WARD_AUDIT_URI_PREFIX}${key ?? crypto.randomUUID()}`;
    if (key === null || (await control.get(auditTitle)) === null) {
      await control.put(
        { tiddler: { title: auditTitle, "alert-kind": wardKind, bag: bagId, uri, reason, ts, ...(key !== null ? { key } : {}), ...(typeof args["rule"] === "string" && args["rule"] ? { rule: args["rule"] } : {}) }, meta: { authority: "disk-ward" } },
        { kind: "lares-verb", requestId: `ward-${ts}` },
      );
    }

    // (b) Alert the face's home wiki (its home preference record in the daemon wiki's working layer, read at light). A row filed for the record
    // alone (`auditOnly`) raises no alert: nothing awaits anyone.
    if (args["auditOnly"] === true) return { audited: auditTitle, alerted: "none", bagId, uri };
    if (slug) {
      post(mkDaemonWikiAlert({
        wikiSlug: slug,
        message:  `${headline}: ${reason}`,
        cause:    "disk-ward",
        kind:     "disk-ward",
        ...(key !== null ? { key } : {}),
      }));
    }
    return { audited: auditTitle, alerted: slug ?? "none", bagId, uri };
  }
}

// ── ingest-alert — a wave's render warnings surface in the operator's pinned VM ────────────
//
// An INGEST wave the daemon island runs answers a render carrier on its rung (rendered-derives.ts); the rungs that warn
// raise one alert per (rung, render title) over the same wiki-alert rail the ward rides, and a render that reads settled
// clears it. The pinned VM stands it at `$:/temp/lares/alert/<kind>/<key>`, tagged `$:/tags/Alert`.

/** The `alert` rail for the daemon island's action verbs: each alert rides to the active wiki, none where none stands. */
export function makeIngestAlertRail(composite: CompositeStore, post: (msg: DaemonMsg_WikiAlert) => void): (alert: IngestAlert) => Promise<void> {
  return async (alert) => {
    const slug = readHomeWikiSlug(await composite.get(HOME_WIKI_TITLE));
    if (!slug) return;
    post(mkDaemonWikiAlert({ wikiSlug: slug, message: alert.message, cause: "ingest", kind: alert.kind, key: alert.key, ...(alert.clear ? { clear: true } : {}) }));
  };
}
