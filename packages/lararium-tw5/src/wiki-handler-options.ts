/**
 * wiki-handler-options — the shared option contract for the whole-wiki verb reactors.
 *
 * Reactor implementations live one per sub-file (wiki-mint/residency/compose/draft-handlers);
 * the tw5 index exports them directly. This file holds ONLY the option interfaces they share —
 * the re-export hub it grew from collapsed (YIN).
 */

import type { Repo, CompositeStore, KahuReachSource, SlotReach } from "@lararium/mesh";
import type { CatalogAccessor } from "./catalog-accessor.js";
import type { ResidencyOpPost } from "./worker-data-verbs.js";

export interface WikiHandlerOptions {
  readonly composite: CompositeStore;
  /** Catalog accessor — wiki oracles live in the catalog registry (access≠load). */
  readonly catalog:   CatalogAccessor;
  /** Worker→main poster — open-wiki alerts the wiki being switched away from. */
  readonly post:      ResidencyOpPost;
}

/** Options for handlers that need raw repo access to mint new docs.
 *  `catalog` is the one catalog-driven accessor (access≠load): the registry
 *  doc itself via `catalog.handle()`, any registered bag via `catalog.find()`
 *  — one accessor for every verb, no separate catalogHandle / islandHandle. */
export interface WikiMintHandlerOptions {
  readonly repo:        Repo;
  readonly catalog:     CatalogAccessor;
  /** The system plane: a system wiki's canon doc and default recipe stand here. A system slug mints nothing. */
  readonly oracle?:     CatalogAccessor;
  /** The live doc url of a house canon bag THIS vessel holds, from the Kahu realm's standing registration; null where it
   *  holds none (a vessel outside the Kahu cabal). A house canon wiki's canon doc rests in the Kahu realm, never in the catalog. */
  readonly systemCanonUrl?: (bagUri: string) => Promise<string | null>;
  /** The VESSEL's DID (`0x`+verifying key) — the PLACE that asks. Distinct from the persona
   *  root (the human), which signs delegation edges and never rides a verb request. */
  readonly vesselDid: () => Promise<string> | string;
  readonly rootDir:     string;
  /**
   * Register a freshly-minted wiki bag's Keyhive Document + delegate admin —
   * called for each new canon/draft bag in the same act as the mint, so a new
   * wiki's bags are born WITH their cap (no cap-denied window). Opaque: the
   * keyhive-holding daemon supplies it; tw5 stays keyhive-free. The arg is the
   * lar: BAG URL (the cap-gate's verify key), never the automerge doc url.
   */
  readonly registerBag?: (bagUrl: string) => Promise<void>;
  /**
   * THE VEIL FLOOR'S MINT (the-veil-ladder#/the-base-model): present where the vessel wears no face and holds its own key
   * open. The new wiki's catalog row then carries `face-reach = vessel-only` and `minted-by`, and `nameCanon` files the canon
   * document as the vessel's own BEFORE its first byte rests (the mark and the seal travel together). Absent: a face mints.
   */
  readonly veilFloor?: { readonly mintedBy: string; readonly nameCanon: (slug: string, documentId: string, url: string) => Promise<void> };
  /**
   * THE ONE DRAFT RESOLVER (`resolveSlotDoc`, seated in the keyhive-holding daemon): the wiki's draft
   * doc — the PersonaGroup × fingerprint binding when the vessel holds a seat, else the device floor
   * keyed by the vessel DID — and which of the two it reached. Every site that names the draft doc
   * (wiki init, prune-stale, meme put --recipe, the mounts) reads through it; none keys its own.
   */
  readonly resolveDraftDoc: (slug: string) => Promise<{ readonly url: string; readonly reach: SlotReach }>;
}

/** prune-stale additionally reads the operator's draft oracle off the daemon
 *  composite; init-wiki shares the mint options without needing it. */
export interface PruneStaleOptions extends WikiMintHandlerOptions {
  readonly composite: CompositeStore;
}

/** Options for recipe-composition operations (add-bag / remove-bag). Pono web3:
 *  the user recipe lives in catalog (registry) — read+written via the accessor
 *  (access≠load); residency commanded via daemon:residency-op. The daemon never
 *  mounts/unmounts a live wiki's composite layer; the recipe change syncs and each
 *  island reconciles its own mount set. */
export interface WikiComposeOptions {
  readonly catalog: CatalogAccessor;
  /** The system plane: a system wiki's default recipe stands here; the first edit adopts it into the catalog. */
  readonly oracle?: CatalogAccessor;
  readonly post:    ResidencyOpPost;
}

export interface DraftHandlerOptions {
  readonly composite: CompositeStore;
  /** The vessel's source of the Kahu predicate's facts; a draft into a house canon bag asks it first. Absent → a stranger. */
  readonly kahuReach?: KahuReachSource;
}

/**
 * THE SHELL A FACE'S MINT LEFT, as `retire-wiki` reaches it (the keyhive-holding daemon supplies each port; tw5 stays
 * keyhive-free). Every port acts for the WORN face alone. A read port that cannot read THROWS: no fault ever reads as empty.
 */
export interface WikiShellPorts {
  /** Every realm the vessel's ledger binds the slug's workbench under, and the worn face's own derived cabal of one. */
  owner(slug: string): Promise<{ readonly bound: readonly string[]; readonly own: string }>;
  /** Who else reaches the shell: the faces (other than the worn one) the ledger seats in its workbench, and the share rows naming the slug. */
  shared(slug: string): Promise<{ readonly seats: readonly string[]; readonly shares: readonly string[] }>;
  /** How many live records the face's working (workbench), draft and personal layers of the slug hold; a layer no document stands for reads 0. */
  contents(slug: string): Promise<WikiShellCounts>;
  /** Delete every record in those three layers' documents (a forced retire only), so a later mint at the same address opens empty. */
  clear(slug: string): Promise<void>;
  /** Drop the face's draft and personal slot binding rows for the slug: the titles dropped. */
  unbindSlots(slug: string): Promise<readonly string[]>;
  /** Drop the ledger's rows binding the slug to the face's own cabal: the realm and the titles dropped. */
  unbind(slug: string): Promise<{ readonly realmId: string | null; readonly ledgerRows: readonly string[] }>;
  /** Forget the face's Keyhive bindings of these shell bags (never a canon bag): the bags whose binding stood. */
  forget(bags: readonly string[]): Promise<readonly string[]>;
}

/** The live records each layer of a shell holds. */
export interface WikiShellCounts { readonly working: number; readonly draft: number; readonly personal: number }

/** Options for `retire-wiki`: the catalog (the face's half takes the removal) and the shell's ports. */
export interface WikiRetireOptions {
  readonly catalog: CatalogAccessor;
  readonly shell:   WikiShellPorts;
}
