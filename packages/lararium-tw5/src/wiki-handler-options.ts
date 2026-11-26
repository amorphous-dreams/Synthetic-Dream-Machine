/**
 * wiki-handler-options — the shared option contract for the whole-wiki verb reactors.
 *
 * Reactor implementations live one per sub-file (wiki-mint/residency/compose/draft-handlers);
 * the tw5 index exports them directly. This file holds ONLY the option interfaces they share —
 * the re-export hub it grew from collapsed (YIN).
 */

import type { Repo } from "@lararium/mesh/automerge";
import type { CompositeStore } from "@lararium/mesh/composite-store";
import type { KahuReachSource } from "@lararium/mesh/kahu-canon-reach";
import type { SlotReach } from "@lararium/mesh/wiki-recipe";
import type { CarriedEffectRecord, RetireOutcome } from "@lararium/mesh/shell-leaving-record";
import type { CatalogAccessor } from "./catalog-accessor.js";
import type { ResidencyOpPost } from "./worker-data-verbs.js";

/** Options for handlers that need raw repo access to mint new docs.
 *  `catalog` is the one catalog-driven accessor (access≠load): the registry
 *  doc itself via `catalog.handle()`, any registered bag via `catalog.find()`
 *  — one accessor for every verb, no separate catalogHandle / islandHandle. */
export interface WikiMintHandlerOptions {
  readonly repo:        Repo;
  readonly catalog:     CatalogAccessor;
  /** The system plane: a house-canon wiki's canon doc and default recipe stand here. A system slug mints nothing. */
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
   * Whether the asking face's hive already holds a bag (`registerBag` ran for it before). Present, an init over a shell a
   * partial init left registers exactly the bags still missing, and a re-init registers none; absent, or answering null (no
   * hive stands to read), only a fresh mint registers.
   */
  readonly bagRegistered?: (bagUrl: string) => Promise<boolean | null>;
  /**
   * STAND THE WIKI'S WORKBENCH for the asking face (`faceWorkbenchRealm` with mint): the realm that seats its hive, else its own
   * private cabal of one, founded once (`founded` says whether this call founded it). A refusal (another face's realm holds the
   * slug's workbench) throws, and the init names it in its answer. Absent (the veil floor, a test), the first mount stands it.
   */
  readonly workbench?: (slug: string) => Promise<{ readonly realmId: string | null; readonly founded: boolean }>;
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
  /** The system plane: a house-canon wiki's default recipe stands here; the first edit adopts it into the catalog. */
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
  /** How many live records the face's working (workbench), draft and personal layers of the slug hold, the house's effect records
   *  counted apart from the authored ones; a layer no document stands for reads 0. */
  contents(slug: string): Promise<WikiShellCounts>;
  /** The house's effect records those three layers hold, each with the layer it rests in and its fields exactly as stored: what
   *  a retire carries out before it erases them. A read that faults throws. */
  effects(slug: string): Promise<readonly CarriedEffectRecord[]>;
  /**
   * CARRY THE RECORD OF LEAVING (residency-model#/effect-record-surface): write `records` into the retirement record for `slug`
   * (`retiredShellUri`) in the worn face's durable home, its daemon wiki working layer, with `outcome` appended, and read the
   * row back. Answers where the records went (`title`, `bag`), how many this retire carried, and how many the write added to the
   * record (0: every one already stood; the retire's outcome still appends). A home that holds no durable document, a write that
   * faults, a read-back missing any record, or a carried title standing under other fields THROWS: the retire then erases nothing.
   */
  carry(slug: string, records: readonly CarriedEffectRecord[], outcome: Omit<RetireOutcome, "face">): Promise<RetiredShellCarry>;
  /** Where `carry` would land the records for `slug`, or null where no durable home stands (a dry run names it). */
  carryHome(slug: string): Promise<{ readonly title: string; readonly bag: string } | null>;
  /** Delete records in those three layers' documents: every authored record where `authored` (a forced retire), and the effect
   *  records named in `effects` (the ones a carry landed), so a later mint at the same address opens empty. An effect record no
   *  carry named stays where it rests. */
  clear(slug: string, what: { readonly authored: boolean; readonly effects: readonly string[] }): Promise<void>;
  /** Drop the face's draft and personal slot binding rows for the slug: the titles dropped. */
  unbindSlots(slug: string): Promise<readonly string[]>;
  /** Drop the ledger's rows binding the slug to the face's own cabal: the realm and the titles dropped. */
  unbind(slug: string): Promise<{ readonly realmId: string | null; readonly ledgerRows: readonly string[] }>;
  /** Forget the face's Keyhive bindings of these shell bags (never a canon bag): the bags whose binding stood. */
  forget(bags: readonly string[]): Promise<readonly string[]>;
}

/**
 * The live records each layer of a shell holds. `working`, `draft` and `personal` count AUTHORED records (what a person or a
 * seat wrote); `effects` counts the house's own effect records across the three layers (a gated ingest's residency row): a row
 * that reads back exactly as the effect recorder writes it for a bag that layer's ledger holds (its title under that bag's
 * `ledger/residency/`, its `bag` field naming that bag, no text, no field beside the schema). The shape alone proves nothing, so
 * no hand's door writes a residency ledger (`refuseEffectLedgerWrite`): audit the house minted, which a retire carries out into the
 * face's retirement record (`retiredShellUri`) before the shell leaves, unforced.
 */
export interface WikiShellCounts { readonly working: number; readonly draft: number; readonly personal: number; readonly effects: number }

/** Where a retire's carry landed the shell's effect records. */
export interface RetiredShellCarry { readonly title: string; readonly bag: string; readonly records: number; readonly added: number }

/** Options for `retire-wiki`: the catalog (the face's half takes the removal) and the shell's ports. */
export interface WikiRetireOptions {
  readonly catalog: CatalogAccessor;
  readonly shell:   WikiShellPorts;
}
