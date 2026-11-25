/**
 * slot-doc-resolver — THE ONE resolver of a wiki's instance-slot docs (draft · working · personal).
 *
 * Every site that names one of these docs reads through here: the wiki island's slot grants
 * (`resolveBinding`), the host's wiki-slot mount (through the daemon proxy), `meme put --recipe`,
 * `prune-stale`, `wiki init`, and the daemon's own late-attached working layer. One slug on one
 * vessel resolves to ONE doc per slot from every call site.
 *
 * The law (`resolveSlotDoc`, @lararium/mesh): the PersonaGroup × recipe-fingerprint binding WHEN the
 * vessel holds a seated PersonaGroup cap, ELSE the device floor — and the record says which
 * (`face-reach`). It never refuses for want of a group.
 *
 *   draft    — face binding when seated; else the FLOOR doc keyed by the vessel DID in the catalog
 *              registry (`wikiDraftDocKey`: `wikis/{slug}/drafts/{did}`, `face-reach: vessel-only`).
 *   working  — EVERY WIKI BUT THE DAEMON'S rests its working layer in the wiki's REALM WORKBENCH (cabal-realm#/the-workbench):
 *              the face's first stand founds a private cabal of one (`workbenchRealm`, mint) and the vessel ledger notes it;
 *              the slot then reads the realm's fixed address (`realmWorkbenchDocUrl`). A share seats more faces in the same
 *              Document and never moves the address. ONE workbench stands for a wiki on a vessel: a face no realm seats
 *              mounts none where another face of the vessel already stands the wiki, and a face that holds no writer's
 *              seat (seated `read`, or nowhere) writes its own `personal` layer (`writeSlot`). A vessel with no face stands
 *              the VEIL FLOOR's own document instead, where its floor key stands (`floor/slot/<slug>/working` in the
 *              place's daemon document, the-veil-ladder#/the-base-model), sealed under the floor's rest key; where it does
 *              not stand (a locked floor, a herm that derives none) no working layer stands and a mint refuses `no-face`. A seat that lands lifts the
 *              floor's rows into the workbench (`liftFloor`). The daemon wiki keeps its face-private device slot
 *              (`deviceScoped`), the AI-memory ruling.
 *   personal — the PersonaGroup × fingerprint binding when seated, the vessel's own when not
 *
 * Lives in @lararium/keyhive because the mint sequence needs keyhive (`registerBag` + `delegate`).
 *
 * Canon: lar:///ha.ka.ba/lararium/api/personal-slot · lar:///ha.ka.ba/lares/api/pono/recipe-layer-model
 */

import { CONTROL_HOME_ID, DRAFT_BINDINGS_PREFIX, PERSONAL_BINDINGS_PREFIX, slotBindingKey } from "@lararium/mesh/lar-uris";
import { FloorUnavailable, floorRegistryOf, type FloorRegistry } from "@lararium/mesh/floor-registry";
import { floorDaemonSlotTitle, floorSlotTitle } from "@lararium/mesh/device-daemon-docs";
import {
  computeRecipeFingerprint,
  resolveSlotDoc,
  wikiBagUri,
  wikiDraftDocKey,
  type SlotReach,
  type WikiSlotKind,
} from "@lararium/mesh/wiki-recipe";
import { emptyLarDoc, mutableLarRecord, tiddlerText, type LarDoc } from "@lararium/mesh/base-doc";
import { realmWorkbenchDocUrl } from "@lararium/mesh/deterministic-doc";
import { mintVesselDocumentId } from "@lararium/mesh/secret-home";
import { storedLarRecord } from "@lararium/mesh/stored-record";
import { requireLarDid, didFromVerifyingKey } from "@lararium/mesh/lar-did";
import { pointMint } from "@lararium/mesh/mint-census";
import { type CompositeStore } from "@lararium/mesh/composite-store";
import * as A from "@automerge/automerge";
import { catalogCanonAddress, type CatalogAccessor } from "@lararium/tw5";
import type { CapabilityProvider } from "./capability-provider.js";
import type { FaceBagDoor } from "./face-bag-door.js";
import { resolveOrMintBinding, type BindingKind, type DocMinter } from "./resolve-binding.js";
import { liftVesselOnlyIntoFace, type LiftRepo, type LiftResult } from "./anon-lift.js";

/** The Automerge-repo surface the resolver needs: mint (`create`) and the floor mint's readiness. */
export interface SlotDocRepo extends DocMinter {
  create<T = LarDoc>(initialValue: T): { readonly url: string; readonly documentId: string; whenReady?(): Promise<unknown> };
}

/**
 * The layer a face's saves of a wiki land in: `working` where it holds a writer's seat in the workbench (or the veil floor's own
 * working document stands), `personal` where a seated face holds none (seated `read`, or seated nowhere while another face
 * of the vessel stands the wiki), and null where no layer takes a write (a locked floor).
 */
export type WikiWriteSlot = "working" | "personal" | null;

/** The kinds of a wiki's slot the veil floor stands a document of its own for (`floor/slot/<slug>/<kind>`). */
export type FloorSlotKind = "working" | "draft" | "personal";

export interface SlotDocResolverArgs {
  /** How long the floor lift waits on a silent floor document before it names it and skips it (default: the house document-ready bound). */
  readonly liftReadBoundMs?: number;
  readonly repo: SlotDocRepo;
  readonly deviceScoped?: (slug: string) => boolean;
  /**
   * THE HEARTH'S DAEMON WORKING DOCUMENT (road row `L4f`): the url the worn face's signed log names for this device, handed
   * only by a vessel that crosses to its own hearth (the island's grant, `IslandGrants.hearthWorkingUrl`). Where it answers
   * one, the face's working device slot mounts that document; null or absent, the slot stays this device's own.
   */
  readonly hearthWorking?: () => string | null;
  readonly control?: CompositeStore;
  /**
   * THE FLOOR'S REGISTRY (`floorRegistryOf` over the daemon composite): where the floor's own documents take their names,
   * gated on the floor's rest key. Absent, this resolver stands no floor document and its floor acts refuse `floor-unkeyed`
   * (a lit sibling's resolver holds none).
   */
  readonly floor?: FloorRegistry;
  /** Name a device slot's document to the vessel's sealed map BEFORE its first byte moves (`announceSlotDoc`). */
  readonly announceDevice?: (kind: Exclude<WikiSlotKind, "temp">, documentId: string) => void;
  /**
   * Name a VEIL FLOOR wiki slot's document to the vessel's sealed map before its first byte moves: the vessel owns it, so it
   * files held and seals under the floor's rest key (`announceSlotDoc` with `floor`).
   */
  readonly announceFloor?: (slug: string, kind: FloorSlotKind, documentId: string) => void;
  /**
   * Name a face's WORKBENCH document to the vessel's sealed map before its first byte moves (`announceSlotDoc`): the address
   * derives from the realm, so it reads before the document materializes, and no save of it lands ahead of its bag's naming.
   */
  readonly announceWorking?: (slug: string, url: string) => void;
  /** The Lift carried a veil-minted wiki's canon in place: tell the vessel, which re-files its seal under the face (`announceLiftedDoc`). */
  readonly announceLifted?: (slug: string, documentId: string) => void;
  /** The daemon-bag composite — binding records live here. */
  readonly daemonStore: CompositeStore;
  /** Absent at the faceless floor: a floor document carries no Keyhive registration. */
  readonly keyhive?: CapabilityProvider;
  /** The user registry — floor docs and user wikis' canon urls. Null when the vessel holds no catalog grant. */
  readonly catalog: CatalogAccessor | null;
  /** The vessel DID, the one spelling (`didFromVerifyingKey`) — the floor key derives from it. */
  readonly vesselDid: () => string | Promise<string>;
  readonly mintedByHex: () => string;
  /** The labels the faceless floor gave its documents, so a lit face lifts them (`anon-lift`). */
  readonly floorMinter?: () => { readonly mintedByHex: string; readonly vesselDid: string };
  readonly personaGroupId?: string | undefined;
  /** Read the veil seat without taking a grant. */
  readonly faceSeated?: () => Promise<boolean>;
  readonly seatSettled?: () => Promise<void>;
  readonly faceDoor?: FaceBagDoor;
  /**
   * THE WORKBENCH PORT (cabal-realm#/the-workbench): the realm a wiki's working layer rests in under THIS face, read off the
   * vessel's own ledger where the face's hive holds a seat in the realm's Document; with `mint`, a wiki that holds no realm yet
   * founds its private cabal of one under the face's hive. Null where no realm answers (no mint, or no seat for this face).
   */
  readonly workbenchRealm?: (slug: string, mint: boolean) => Promise<string | null>;
  /**
   * Whether a write from THIS face founds the wiki's workbench (`workbenchFoundsOnWrite`): no realm seats the face and the
   * vessel's ledger binds the slug under no other face's realm. Such a face writes `working`, and the write's mint founds.
   */
  readonly workbenchFounds?: (slug: string) => Promise<boolean>;
  /**
   * Whether THIS face holds a writer's seat in the wiki's workbench (`workbenchWriterSeat`). Absent, a face that mounts a
   * workbench writes it (a rig with no roster). A face that answers false writes its `personal` layer of the wiki.
   */
  readonly workbenchWrites?: (slug: string) => Promise<boolean>;
  /** Find or materialize the workbench document at its fixed address, and rest it. */
  readonly workbenchDoc?: (url: string, slug: string) => Promise<{ readonly documentId: string }>;
}

/** A wiki's working slot stands no workbench here: no face (`no-face`), or the floor's lift asked for one no realm answers (`no-workbench`). */
export class WorkingSlotRefusal extends Error {
  override readonly name = "WorkingSlotRefusal";
  constructor(readonly reason: string, detail: string) { super(`working slot: ${reason}: ${detail}`); }
}

export interface SlotDoc {
  readonly url: string;
  readonly reach: SlotReach;
}

export interface SlotDocResolver {
  /**
   * Every instance slot's doc for a wiki, by fingerprint — the mount's call. `workingUrl` reads null where the vessel wears no
   * face: a faceless floor stands no wiki working layer (`no-face`), so the mount lays none and the wiki's writes refuse by name.
   */
  bindings(fingerprint: string, recipeTrace: RecipeTrace, slug: string): Promise<{ personalUrl: string; draftUrl: string; workingUrl: string | null; writeSlot?: "personal" }>;
  /** The layer this face's saves of `slug` land in (`WikiWriteSlot`), read without a mint. */
  writeSlot(slug: string): Promise<WikiWriteSlot>;
  /** One slot's doc by slug. `mint:false` reads what stands and returns null when nothing does. */
  slotDoc(slug: string, kind: WikiSlotKind, opts?: { mint?: boolean }): Promise<SlotDoc | null>;
  /** The ONE draft resolver: `slotDoc(slug, "draft")`, minting on absent — never null. */
  draft(slug: string): Promise<SlotDoc>;
  /** The anon-veil lift (`anon-lift`): everything this vessel minted at the floor moves under the seated face. Idempotent. */
  liftFloor(): Promise<LiftResult>;
}

type RecipeTrace = { readonly wikiDocId: string; readonly libraryBagDocIds: readonly string[] };

const PREFIX_OF: Record<"draft" | "personal", { prefix: string; kind: BindingKind }> = {
  draft:    { prefix: DRAFT_BINDINGS_PREFIX,    kind: "draft-binding" },
  personal: { prefix: PERSONAL_BINDINGS_PREFIX, kind: "personal-binding" },
};

export function makeSlotDocResolver(args: SlotDocResolverArgs): SlotDocResolver {
  const seated = async (): Promise<boolean> =>
    args.personaGroupId ? await (args.faceSeated?.() ?? Promise.resolve(true)) : false;
  // A resolver handed no floor registry fails closed: its floor reads as one that derives no key.
  const floorRegistry: FloorRegistry = args.floor ?? floorRegistryOf(args.daemonStore, undefined);

  /**
   * THE MOUNT'S TRACE IS THE TRACE. A wiki the vessel has mounted this session fingerprinted the canon
   * doc it actually holds (`bindings`, the mount's call); every later site — a verb, a `where`, an
   * action — reuses that trace, never re-deriving it from a registry pointer that can move under a
   * running session (a shared oracle plane a peer's founding rewrites). A wiki never mounted this
   * session derives its trace from the vessel catalog, where every bag pointer rides.
   */
  const mounted = new Map<string, { fingerprint: string; recipeTrace: RecipeTrace }>();

  const wikiUrlOf = async (slug: string): Promise<string> => {
    const key = wikiBagUri(slug);
    // A house canon wiki keys on the Kahu realm's standing document, or on its floor address where the vessel holds none
    // (`catalogCanonAddress`): no catalog row names house canon.
    const url = args.catalog ? await catalogCanonAddress(args.catalog, key).catch(() => null) : null;
    if (!url) throw new Error(`slot-doc: wiki "${slug}" registers no canon doc in any registry plane — run \`lares wiki init ${slug}\` first`);
    return url;
  };

  /**
   * The binding row that STANDS for this resolver's face, read without a mint: the face's own row (`slotBindingKey` under its
   * group), or the floor's row while no seat stands or the Lift has not moved it.
   */
  const standingBinding = async (kind: "draft" | "personal", fingerprint: string): Promise<SlotDoc | null> => {
    const prefix = PREFIX_OF[kind].prefix;
    const own = args.personaGroupId ? await args.daemonStore.get(slotBindingKey(prefix, fingerprint, args.personaGroupId)) : null;
    const floorRow = tiddlerText(own) ? null : await args.daemonStore.get(slotBindingKey(prefix, fingerprint));
    const rec = tiddlerText(own) ? own : floorRow && floorRow.tiddler["face-reach"] !== "face" ? floorRow : null;
    const url = tiddlerText(rec);
    return url ? { url, reach: rec?.tiddler["face-reach"] === "face" ? "face" : "vessel-only" } : null;
  };

  /** The PersonaGroup × fingerprint binding (mint-on-absent) — vessel-key when unseated. */
  const binding = async (kind: "draft" | "personal", fingerprint: string, recipeTrace: RecipeTrace): Promise<SlotDoc> => {
    const r = await resolveOrMintBinding({
      kind: PREFIX_OF[kind].kind, prefix: PREFIX_OF[kind].prefix, fingerprint, recipeTrace,
      repo: args.repo, daemonStore: args.daemonStore, ...(args.keyhive ? { keyhive: args.keyhive } : {}),
      ...(args.personaGroupId ? { personaGroupId: args.personaGroupId } : {}),
      ...(args.faceDoor ? { faceDoor: args.faceDoor } : {}),
      ...(args.faceSeated ? { faceSeated: args.faceSeated } : {}),
      ...(args.seatSettled ? { seatSettled: args.seatSettled } : {}),
      mintedByHex: args.mintedByHex(),
    });
    return { url: r.url, reach: r.reach };
  };

  /** The draft FLOOR doc — keyed by the vessel DID in the catalog registry; minted on absent. */
  const floor = async (slug: string, mint: boolean): Promise<string | null> => {
    // WHERE THE FLOOR'S REST KEY STANDS, the draft rests in a floor document the floor's registry names
    // (`floor/slot/<slug>/draft`), sealed under that key as the working layer's does. The catalog names it nowhere.
    if (floorStands()) return (await floorSlot(slug, "draft", mint))?.url ?? null;
    const catalog = args.catalog;
    if (!catalog) throw new Error(`slot-doc: the draft floor for "${slug}" needs the catalog registry, and this vessel holds no catalog grant`);
    const key = wikiDraftDocKey(slug, requireLarDid(await args.vesselDid(), "slot-doc floor"));
    const existing = await catalog.urlOf(key);
    if (existing || !mint) return existing;
    const handle = args.repo.create<LarDoc>(emptyLarDoc());
    await handle.whenReady?.();
    await args.repo.flush([handle.documentId]);
    const catalogHandle = await catalog.handle();
    catalogHandle.change((doc) => {
      doc.tiddlers[key] = storedLarRecord(key, {
        text: handle.url,
        kind: "oracle",
        "face-reach": "vessel-only",
        "minted-by": args.mintedByHex(),
      }, "slot-doc:floor");
    });
    pointMint(handle.url);   // the catalog names it: the mint census reads no cap mint here
    return handle.url;
  };

  /** The workbench documents this resolver materialized, so one process materializes each once. */
  const stood = new Set<string>();
  /**
   * THE ONE PATH: a wiki's working layer rests in its realm workbench. A face stands it; a vessel with no face stands none. With
   * `mint`, a wiki that holds no realm founds its private cabal of one, and the workbench document materializes at its fixed
   * address and rests before the slot answers.
   */
  const workingDoc = async (slug: string, mint: boolean): Promise<SlotDoc | null> => {
    // leaf-fleet (Leaf-Finisher): a face pinned and not yet seated stands the floor's working layer, as a faceless vessel does.
    if (!args.personaGroupId || !args.workbenchRealm || !(await seated())) {
      // No face: the veil floor's own document where the floor's rest key stands, and none where it does not.
      const floorDoc = await floorWorking(slug, mint);
      if (floorDoc || !mint) return floorDoc;
      throw new WorkingSlotRefusal("no-face", `"${slug}" rests its working layer in a realm workbench, and a realm seats a face: this vessel wears none`);
    }
    // NO REALM ANSWERS: no mint, or another face of the vessel stands the wiki and seats this face nowhere. No working layer
    // stands for this face, and its saves rest in its own `personal` layer (`writeSlot`).
    const realmId = await args.workbenchRealm(slug, mint);
    if (!realmId) return null;
    const url = realmWorkbenchDocUrl(realmId, slug);
    // THE NAMING LEADS THE FIRST BYTE: the vessel's map names this document under the face's working bag before it materializes.
    args.announceWorking?.(slug, url);
    if (mint && args.workbenchDoc && !stood.has(url)) {
      const handle = await args.workbenchDoc(url, slug);
      await args.repo.flush([handle.documentId]);
      stood.add(url);
    }
    return { url, reach: "face" };
  };

  /**
   * THE PERSONAL LAYER. A seated face holds it by binding (PersonaGroup × fingerprint). With no seat, where the floor's
   * rest key stands, it rests in a floor document the floor's registry names (`floor/slot/<slug>/personal`); the Lift
   * carries it under the face's binding when a seat lands. A floor with no key keeps the faceless binding row.
   */
  const personalDoc = async (slug: string, fingerprint: string, recipeTrace: RecipeTrace): Promise<SlotDoc> => {
    if (!(await seated()) && floorStands()) return (await floorSlot(slug, "personal", true))!;
    return binding("personal", fingerprint, recipeTrace);
  };

  /**
   * A seated face's write layer: `working` where it holds a writer's seat in a workbench that answers, and where no workbench
   * stands for the wiki on this vessel, so the face's own write founds one (`workbenchFounds`); `personal` otherwise.
   */
  const seatedWriteSlot = async (slug: string, working: SlotDoc | null): Promise<"working" | "personal"> => {
    if (working === null) return (await args.workbenchFounds?.(slug)) === true ? "working" : "personal";
    return (args.workbenchWrites ? await args.workbenchWrites(slug) : true) ? "working" : "personal";
  };

  const draftDoc = async (slug: string, fingerprint: string, recipeTrace: RecipeTrace): Promise<SlotDoc> =>
    resolveSlotDoc({
      seated,
      faceDoc:  async () => (await binding("draft", fingerprint, recipeTrace)).url,
      floorDoc: async () => (await floor(slug, true))!,
    });

  const traceOf = async (slug: string): Promise<{ fingerprint: string; recipeTrace: RecipeTrace }> => {
    const known = mounted.get(slug);
    if (known) return known;
    const recipeTrace = { wikiDocId: await wikiUrlOf(slug), libraryBagDocIds: [] as readonly string[] };
    return { fingerprint: await computeRecipeFingerprint(recipeTrace), recipeTrace };
  };

  const deviceMints = new Map<string, Promise<SlotDoc>>();
  const deviceSlot = async (kind: Exclude<WikiSlotKind, "temp">, mint: boolean): Promise<SlotDoc | null> => {
    // leaf-fleet (Leaf-Finisher): A FACE PINNED AND NOT YET SEATED keeps the floor's slot. Its own slot would seal under a
    // session that stands only once the face seats, so its bytes would wait in memory and a reload would lose them; the
    // floor's slot rests under the floor's key, and the Lift carries it into the face's slot when the seat lands.
    const owner = args.personaGroupId && await seated() ? args.personaGroupId : null;
    // A FACE'S SLOT takes its name in the control document (it mints with the face); THE FLOOR'S takes its name in the floor
    // registry, in the place's daemon document, and refuses by name where the floor's rest key does not stand.
    let names: { readonly title: string; get(): Promise<string | null>; put(url: string): Promise<void> };
    if (owner !== null) {
      if (!args.control) throw new Error("slot-doc: device-scoped slots require control store");
      const control = args.control;
      const title = `${CONTROL_HOME_ID}/daemon-slot/${kind}/${encodeURIComponent(owner)}`;
      names = {
        title,
        get: async () => tiddlerText(await control.get(title)),
        put: async (url) => { await control.put(mutableLarRecord(title, { text: url, kind: "oracle", "face-reach": "vessel-only" }, "slot-doc:device"), { kind: "lares-verb", requestId: "slot-doc:device" }); },
      };
    } else {
      const registry = floorRegistry;
      const title = floorDaemonSlotTitle(kind);
      names = { title, get: () => registry.get(title), put: (url) => registry.put(title, { text: url }, "slot-doc:device") };
    }
    const title = names.title;
    const named = await names.get();
    // AT ITS OWN HEARTH A LEAF MOUNTS THE HEARTH'S WORKING DOCUMENT (road row `L4f`): the vessel hands the document its worn
    // face's signed log names for this device, and the face's working slot answers it. The control row takes that name (the
    // vessel's sealed map hears the id first), so the document files under the face that owns the slot and seals under its
    // key like a slot minted here; a slot this device stood before the name arrived stays in the repo, unnamed by the row.
    const hearth = owner !== null && kind === "working" ? (args.hearthWorking?.() ?? null) : null;
    if (hearth) {
      if (named !== hearth) {
        args.announceDevice?.(kind, hearth.replace(/^automerge:/, ""));
        await names.put(hearth);
      }
      return { url: hearth, reach: "vessel-only" };
    }
    if (named) return { url: named, reach: "vessel-only" };
    if (!mint) return null;
    const pending = deviceMints.get(title);
    if (pending) return pending;
    const created = (async (): Promise<SlotDoc> => {
      const existing = await names.get();
      if (existing) return { url: existing, reach: "vessel-only" };
      // NAMED BEFORE ITS FIRST BYTE: the id mints ahead, the vessel's sealed map hears it (the device slot seals under the
      // lit face, or under the floor's rest key at the floor), its registry names it, and only then does the document
      // stand and rest.
      const minter = args.repo;
      if (typeof minter.import !== "function") {
        const created = minter.create<LarDoc>(emptyLarDoc());
        args.announceDevice?.(kind, created.documentId);
        await created.whenReady?.();
        await minter.flush([created.documentId]);
        await names.put(created.url);
        pointMint(created.url);
        return { url: created.url, reach: "vessel-only" };
      }
      const documentId = mintVesselDocumentId();
      args.announceDevice?.(kind, documentId);
      await names.put(`automerge:${documentId}`);
      const handle = minter.import(A.save(A.from(emptyLarDoc() as unknown as Record<string, unknown>)), { docId: documentId as never });
      await handle.whenReady?.();
      await args.repo.flush([handle.documentId]);
      return { url: handle.url, reach: "vessel-only" };
    })();
    deviceMints.set(title, created);
    try { return await created; } finally { deviceMints.delete(title); }
  };

  /**
   * THE VEIL FLOOR'S WORKING LAYER (the-veil-ladder#/the-base-model; the one slot-doc law: "never refuses for want of a
   * group"). A vessel that wears no face and whose floor key stands stands a wiki's working layer in a floor document
   * the floor registry names (`floor/slot/<slug>/working`), named before its first byte, exactly as the daemon wiki's
   * floor device slot stands. A vessel whose floor key does not stand (a locked hearth, a herm that derives none)
   * stands none and answers null. The Lift moves its rows into the face's realm workbench when a seat lands (`anon-lift`).
   */
  const floorMints = new Map<string, Promise<SlotDoc | null>>();
  /** Whether the floor's rest key stands on this vessel now (its registry refuses nothing). */
  const floorStands = (): boolean => floorRegistry.refusal() === null;
  const floorWorking = (slug: string, mint: boolean): Promise<SlotDoc | null> => floorSlot(slug, "working", mint);
  /** One floor document of a wiki, by kind: the working layer, the draft, or the personal layer. One law names all three. */
  const floorSlot = async (slug: string, kind: FloorSlotKind, mint: boolean): Promise<SlotDoc | null> => {
    const registry = floorRegistry;
    const title = floorSlotTitle(slug, kind);
    let named: string | null;
    // THE GATE RESTS ON THE FLOOR'S OWN KEY, never on a host's name and never on a control document: the registry answers
    // only where the floor's rest key stands. A locked hearth refuses `vessel-locked` and a place that derives no floor key
    // (a herm, which never unlocks) refuses `floor-unkeyed`; either refusal means no floor stands, and nothing mints.
    // Any other fault of the registry surfaces as itself.
    try { named = await registry.get(title); }
    catch (error) { if (error instanceof FloorUnavailable) return null; throw error; }
    if (named) return { url: named, reach: "vessel-only" };
    if (!mint) return null;
    const pending = floorMints.get(title);
    if (pending) return pending;
    const created = (async (): Promise<SlotDoc | null> => {
      const again = await registry.get(title);
      if (again) return { url: again, reach: "vessel-only" };
      const name = (url: string) => registry.put(title, { text: url, "minted-by": args.mintedByHex() }, "slot-doc:floor");
      const minter = args.repo;
      if (typeof minter.import !== "function") {
        const doc = minter.create<LarDoc>(emptyLarDoc());
        args.announceFloor?.(slug, kind, doc.documentId);
        await name(doc.url);
        pointMint(doc.url);
        await doc.whenReady?.();
        await minter.flush([doc.documentId]);
        return { url: doc.url, reach: "vessel-only" };
      }
      const documentId = mintVesselDocumentId();
      args.announceFloor?.(slug, kind, documentId);
      await name(`automerge:${documentId}`);
      const handle = minter.import(A.save(A.from(emptyLarDoc() as unknown as Record<string, unknown>)), { docId: documentId as never });
      await handle.whenReady?.();
      await args.repo.flush([handle.documentId]);
      return { url: handle.url, reach: "vessel-only" };
    })();
    floorMints.set(title, created);
    try { return await created; } finally { floorMints.delete(title); }
  };

  const slotDoc = async (slug: string, kind: WikiSlotKind, opts?: { mint?: boolean }): Promise<SlotDoc | null> => {
    await args.seatSettled?.();
    if (kind === "temp") return null;
    const mint = opts?.mint ?? true;
    if (args.deviceScoped?.(slug)) return deviceSlot(kind, mint);
    // The working kind derives from the face and the wiki's slug, never from the recipe's trace.
    if (kind === "working") return workingDoc(slug, mint);
    const { fingerprint, recipeTrace } = await traceOf(slug);
    if (kind === "draft") {
      if (mint) return draftDoc(slug, fingerprint, recipeTrace);
      if (await seated()) {
        const standing = await standingBinding("draft", fingerprint);
        return standing ? { url: standing.url, reach: "face" } : null;
      }
      const url = await floor(slug, false);
      return url ? { url, reach: "vessel-only" } : null;
    }
    if (mint) return kind === "personal" ? personalDoc(slug, fingerprint, recipeTrace) : binding(kind, fingerprint, recipeTrace);
    if (kind === "personal" && !(await seated()) && floorStands()) return floorSlot(slug, "personal", false);
    return standingBinding(kind, fingerprint);
  };

  return {
    bindings: async (fingerprint, recipeTrace, slug) => {
      await args.seatSettled?.();
      mounted.set(slug, { fingerprint, recipeTrace });
      if (args.deviceScoped?.(slug)) {
        const personal = (await deviceSlot("personal", true))!;
        const draft = (await deviceSlot("draft", true))!;
        const working = (await deviceSlot("working", true))!;
        return { personalUrl: personal.url, draftUrl: draft.url, workingUrl: working.url };
      }
      const personal = await personalDoc(slug, fingerprint, recipeTrace);
      const draft    = await draftDoc(slug, fingerprint, recipeTrace);
      // THE FACELESS FLOOR: a realm seats a face, so no workbench stands here. Where the floor's rest key stands, the
      // veil floor stands the wiki's working layer in its own floor document (`floorWorking`); where it does not (a locked
      // floor, a herm that derives none), the wiki boots on its canon, draft and personal alone with no default writable.
      if (!args.personaGroupId || !args.workbenchRealm || !(await seated())) return { personalUrl: personal.url, draftUrl: draft.url, workingUrl: (await floorWorking(slug, true))?.url ?? null };
      // A SEATED FACE: the workbench that seats it, or none where another face of the vessel stands the wiki. A face that
      // holds no writer's seat writes its `personal` layer, and the mount hears so (`writeSlot`).
      const working  = await workingDoc(slug, true);
      const personalWrites = (await seatedWriteSlot(slug, working)) === "personal";
      return { personalUrl: personal.url, draftUrl: draft.url, workingUrl: working?.url ?? null, ...(personalWrites ? { writeSlot: "personal" as const } : {}) };
    },
    writeSlot: async (slug) => {
      await args.seatSettled?.();
      if (args.deviceScoped?.(slug)) return "working";
      if (!args.personaGroupId || !args.workbenchRealm || !(await seated())) return floorStands() ? "working" : null;
      return seatedWriteSlot(slug, await workingDoc(slug, false));
    },
    slotDoc,
    draft: async (slug) => (await slotDoc(slug, "draft"))!,
    liftFloor: async () => {
      if (!args.faceDoor || !args.personaGroupId || !(await seated())) return { moved: [], finished: [], skipped: [], skippedDocs: [] };   // no seat, nothing to lift into
      const repo = args.repo as unknown as Partial<LiftRepo>;
      if (typeof repo.find !== "function" || typeof repo.delete !== "function") throw new Error("slot-doc: the lift needs a repo that finds and deletes documents");
      return liftVesselOnlyIntoFace({
        repo: args.repo as unknown as LiftRepo, daemonStore: args.daemonStore, catalog: args.catalog, faceDoor: args.faceDoor,
        mintedByHex: args.mintedByHex(), vesselDid: String(await args.vesselDid()), personaGroupId: args.personaGroupId,
        ...(args.liftReadBoundMs !== undefined ? { readBoundMs: args.liftReadBoundMs } : {}),
        ...(args.floorMinter ? { floor: args.floorMinter() } : {}),
        // THE WORKING FLOOR lifts into the face's realm workbench, stood on ask (`workingDoc` with mint).
        ...(args.floor && args.workbenchRealm ? { working: { floor: args.floor, workbench: async (slug: string) => {
          const stood = await workingDoc(slug, true);
          if (!stood) throw new WorkingSlotRefusal("no-workbench", `no realm answers for "${slug}" under this face (another face of the vessel stands its workbench, and seats this face nowhere)`);
          return stood.url;
        } } } : {}),
        // THE FLOOR'S DRAFT AND PERSONAL LAYER lift into the face's own binding of that kind, stood on ask.
        ...(args.floor ? { faceLayers: { floor: args.floor, faceSlot: async (slug: string, kind: "draft" | "personal") => {
          const trace = await traceOf(slug).catch(() => null);   // the mount's trace where this session mounted the wiki
          return trace ? (await binding(kind, trace.fingerprint, trace.recipeTrace)).url : null;
        } } } : {}),
        // THE DAEMON WIKI'S FLOOR MEMORY lifts into the face's own device slot of each kind (face-private).
        ...(args.floor ? { daemon: { floor: args.floor, faceSlot: async (kind: "working" | "personal" | "draft") => (await deviceSlot(kind, true))!.url } } : {}),
        // THE CANON OF A WIKI THE VEIL MINTED stays where it stands; the vessel re-files its seal on this word.
        ...(args.floor ? { canon: { floor: args.floor, lifted: (slug: string, documentId: string) => { args.announceLifted?.(slug, documentId); } } } : {}),
        traceOf: (slug) => traceOf(slug).catch(() => null),
      });
    },
  };
}

/** One LIT face as the lit set's slot resolvers read it: its group, its own hive and door, and its own workbench port. */
export interface LitFaceSlotSpec {
  readonly group: string;
  /** The face's own atom key: its slots' `minted-by` label and DID, as a lit worn face labels its own (never the place key). */
  readonly atomKey: string;
  readonly keyhive?: CapabilityProvider;
  readonly faceDoor?: FaceBagDoor;
  /** The workbench port under THIS face: a realm answers only where the face's hive holds a seat in the realm's Document. */
  readonly workbenchRealm?: (slug: string, mint: boolean) => Promise<string | null>;
  /** Whether THIS face holds a writer's seat in a wiki's workbench. */
  readonly workbenchWrites?: (slug: string) => Promise<boolean>;
  /** Whether a write from THIS face founds a wiki's workbench (no realm seats it, and the ledger binds the slug nowhere else). */
  readonly workbenchFounds?: (slug: string) => Promise<boolean>;
}

/** The lit set's slot resolvers: one per lit face, each under that face's own group, secret, hive and door. */
export interface LitFaceSlotDocs {
  /** The resolver for one lit face (cached by group; a face that changes its inputs drops first). */
  of(spec: LitFaceSlotSpec): SlotDocResolver;
  /** A face left the lit set: its resolver drops, and nothing of it resolves until it lights again. */
  drop(group: string): void;
}

/**
 * THE LIT SET'S SLOTS (sealed-store#/the-lit-set): every LIT face resolves its own instance slots under its OWN group, hive and
 * door, never the worn face's. A lit sibling stands no floor document, so its resolver takes no floor registry. A sibling's working slot reads the realm workbench its own hive holds a seat in, and its daemon
 * wiki's device slots stand under the sibling's group in the control document (`daemon-slot/<kind>/<group>`), so each face's
 * memory lands in its own documents. A lit face is seated by being lit: its hive holds its group.
 */
export function litFaceSlotDocs(base: Omit<SlotDocResolverArgs, "floor" | "personaGroupId" | "faceDoor" | "keyhive" | "faceSeated" | "seatSettled" | "workbenchRealm" | "workbenchWrites" | "workbenchFounds" | "mintedByHex" | "vesselDid">): LitFaceSlotDocs {
  const byGroup = new Map<string, SlotDocResolver>();
  return {
    of(spec) {
      const known = byGroup.get(spec.group);
      if (known) return known;
      const resolver = makeSlotDocResolver({
        ...base,
        personaGroupId: spec.group,
        mintedByHex: () => spec.atomKey,
        vesselDid: () => didFromVerifyingKey(spec.atomKey),
        faceSeated: async () => true,
        ...(spec.keyhive ? { keyhive: spec.keyhive } : {}),
        ...(spec.faceDoor ? { faceDoor: spec.faceDoor } : {}),
        ...(spec.workbenchRealm ? { workbenchRealm: spec.workbenchRealm } : {}),
        ...(spec.workbenchWrites ? { workbenchWrites: spec.workbenchWrites } : {}),
        ...(spec.workbenchFounds ? { workbenchFounds: spec.workbenchFounds } : {}),
      });
      byGroup.set(spec.group, resolver);
      return resolver;
    },
    drop(group) { byGroup.delete(group); },
  };
}
