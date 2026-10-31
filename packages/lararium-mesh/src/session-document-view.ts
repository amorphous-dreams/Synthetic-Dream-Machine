/**
 * session-document-view — what a session's island may ask its own vessel for.
 *
 * A correctly routed holder protects nothing once an island can fetch any document. So a session island never
 * takes unrestricted Repo sync: it takes this view, and the view gates five things: document announcements,
 * fetches, writes, catalog resolution and content-addressed reads. The view sits BESIDE the share verdict
 * (`federation-gate`): the verdict decides what a PEER may fetch across the wire; the view decides what a
 * SESSION may ask the vessel it rides.
 *
 * The invariants:
 *   · THE VIEW ANSWERS FROM THE SESSION'S OWN FACETS. Its owner states the facets once, at the open. Nothing a
 *     caller supplies later (a document address, a plane address, a catalog name, a peer ID) widens them.
 *   · ONE TABLE DECIDES A WRITE: the capability profile against the facet's layer. A bag reaches a session
 *     read-only; a move into a bag runs as an owner-side verb, never as an island's sync write.
 *   · THE GATE RIDES THE CARRIER. The sync leg judges every message that crosses the island's port, in both
 *     directions, under a peer ID the VIEW minted. An island that announces any other ID loses its leg.
 *   · A REFUSED FETCH READS AS ABSENCE. A document beyond the facets answers `doc-unavailable`, the answer a
 *     document nobody holds draws, so a refusal tells the island nothing about what stands.
 *   · A CATALOG NAME RESOLVES FROM THE FACETS ALONE. The vessel's catalog document never joins them, so no
 *     name of another face's plane reaches the island.
 *   · A CONTENT ADDRESS OPENS NOTHING BY ITSELF. Content reads for a session when the facets name it or a
 *     document the session may read references it, and only a well-formed address ever gets that far: a
 *     string that names a path reaches no store.
 *   · THE ISLAND'S REPLICA STAYS EPHEMERAL. The leg announces the island as an ephemeral peer with no storage
 *     ID; the vessel's owner alone persists.
 *   · A CLOSED VIEW ANSWERS NOTHING. Closing drops the leg and every gate refuses from then on.
 *
 * Pure but for the Repo it attaches to: no key, no signer, no I/O of its own, no timer, no clock.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/session-contract#/the-document-view
 */
import { interpretAsDocumentId, type AutomergeUrl, type NetworkAdapterInterface, type Repo } from "@automerge/automerge-repo";
import { defaultCryptoProvider } from "./crypto.js";
import { GatedSyncLeg, LEG_PASS, PortSyncAdapter, carriesChanges, type LegMessage, type LegRefusal, type LegVerdict, type SyncLegGate } from "./gated-sync-leg.js";
import { isCapabilityProfile, refuseBeyondProfile, type CapabilityProfile, type ProfileRefusal } from "./session-contract.js";
import { seatIslandPeer } from "./island-repo.js";

/** A programming fault against the view: malformed facets, an unknown profile, a second leg. */
export class SessionViewError extends Error {}

/**
 * The layer a facet document stands in. `oracle` names the system floor; `library` a bag a recipe composes;
 * `canon` the wiki's own bag; `working`, `personal` and `draft` the wiki's live layers; `plane` one of the
 * face's own planes.
 */
export const FACET_LAYERS = ["oracle", "library", "canon", "working", "personal", "draft", "plane"] as const;
export type FacetLayer = (typeof FACET_LAYERS)[number];

/** The five things the view gates. */
export const VIEW_VERBS = ["announce", "fetch", "write", "catalog", "content"] as const;
export type ViewVerb = (typeof VIEW_VERBS)[number];

/**
 * THE ONE WRITE TABLE: the layers each profile may write. No profile writes `oracle`, `library` or `canon`:
 * those reach a session read-only. A seat writes the working layer alone; the watcher ingests into the
 * working layer and surfaces drafts.
 */
const WRITE_LAYERS: Readonly<Record<CapabilityProfile, ReadonlySet<FacetLayer>>> = Object.freeze({
  face:   new Set<FacetLayer>(["working", "personal", "draft", "plane"]),
  verb:   new Set<FacetLayer>(["working", "personal", "draft", "plane"]),
  ingest: new Set<FacetLayer>(["working", "draft"]),
  seat:   new Set<FacetLayer>(["working"]),
});
/** The layers some profile may write: a write to any other layer refuses as `read-only-layer` for every hand. */
const WRITABLE_LAYERS: ReadonlySet<FacetLayer> = new Set(Object.values(WRITE_LAYERS).flatMap((layers) => [...layers]));

/** One document a session may reach: the name it resolves under, its address, and its layer. */
export interface DocumentFacet {
  readonly name:     string;
  readonly document: string;               // an Automerge URL or a bare document ID
  readonly layer:    FacetLayer;
}

/** What a session's owner states at the open. */
export interface SessionDocumentFacets {
  readonly documents: readonly DocumentFacet[];
  /** Content addresses the session may read outright (the engine core and the plugins its recipe selects). */
  readonly content:   readonly string[];
}

export const VIEW_REFUSALS = ["view-closed", "beyond-facets", "read-only-layer", "beyond-profile"] as const;
export type ViewRefusalName = (typeof VIEW_REFUSALS)[number];
export type ViewRefusal =
  | { readonly ok: false; readonly refusal: Exclude<ViewRefusalName, "beyond-profile">; readonly verb: ViewVerb }
  | ProfileRefusal;
export type ViewVerdict = { readonly ok: true } | ViewRefusal;
export type ViewCatalogAnswer = { readonly ok: true; readonly documentUrl: string } | ViewRefusal;

/** A content address as this house spells one: a bare sha256 in hex, or a digest under its algorithm's tag.
 *  Nothing else names content, so nothing else reaches a store: no path, no separator, no empty name. */
const CONTENT_ADDRESS = /^(?:[a-z0-9]{1,16}:)?[0-9a-fA-F]{64}$/;

const OK: ViewVerdict = Object.freeze({ ok: true });
const refuse = (refusal: Exclude<ViewRefusalName, "beyond-profile">, verb: ViewVerb): ViewRefusal => Object.freeze({ ok: false, refusal, verb });

export interface SessionDocumentViewOptions {
  readonly profile: CapabilityProfile;
  readonly facets:  SessionDocumentFacets;
  /**
   * Does the document at `documentId` reference the content at `cid`? The owner answers from its own replica.
   * The view asks it for the session's readable documents alone. Absent: only the facets' own content reads.
   */
  readonly referencesContent?: (documentId: string, cid: string) => boolean;
  /** Each refusal the view or its leg answers, for the owner's own accounting. */
  readonly onRefusal?: (refusal: LegRefusal | (ViewRefusal & { readonly subject: string })) => void;
  /** Mints the island's peer ID. Tests alone supply it. */
  readonly mintPeerId?: () => string;
  /** The most bytes one message from the island may carry. Absent: the leg's own bound. */
  readonly maxInboundBytes?: number;
}

interface Held { readonly layer: FacetLayer; readonly url: string }

/**
 * One session's scoped document view. The owner opens it when a surface mounts, hands the island the view's
 * `peerId`, attaches the island's port through `attach`, and closes it when the surface or the session ends.
 */
export class SessionDocumentView {
  readonly profile: CapabilityProfile;
  /** The one peer ID this view's leg admits. The island's Repo announces it. */
  readonly peerId: string;
  readonly #documents = new Map<string, Held>();                 // document ID → what the session holds of it
  readonly #names = new Map<string, string>();                   // catalog name → document ID
  readonly #content: ReadonlySet<string>;
  readonly #referencesContent: ((documentId: string, cid: string) => boolean) | null;
  readonly #onRefusal: SessionDocumentViewOptions["onRefusal"] | null;
  readonly #maxInboundBytes: number | undefined;
  #leg: GatedSyncLeg | null = null;
  #detach: (() => void) | null = null;
  #closed = false;
  #resolveClosed: (() => void) | null = null;
  readonly #whenClosed: Promise<void> = new Promise((resolve) => { this.#resolveClosed = resolve; });

  constructor(opts: SessionDocumentViewOptions) {
    if (!isCapabilityProfile(opts.profile)) throw new SessionViewError("profile-unknown");
    this.profile = opts.profile;
    const facets = opts.facets;
    if (typeof facets !== "object" || facets === null || !Array.isArray(facets.documents) || !Array.isArray(facets.content)) {
      throw new SessionViewError("facets-malformed");
    }
    for (const facet of facets.documents) {
      if (typeof facet?.name !== "string" || facet.name.length === 0 || !(FACET_LAYERS as readonly string[]).includes(facet.layer)) {
        throw new SessionViewError("facets-malformed");
      }
      let documentId: string;
      try { documentId = interpretAsDocumentId(facet.document as AutomergeUrl); } catch { throw new SessionViewError("facets-malformed"); }
      // One document stands in ONE layer: a second facet that names it under another layer would let the
      // looser layer's write bound answer for the stricter one.
      const held = this.#documents.get(documentId);
      if (held && held.layer !== facet.layer) throw new SessionViewError("facet-layer-ambiguous");
      // One name resolves to ONE document.
      const named = this.#names.get(facet.name);
      if (named !== undefined && named !== documentId) throw new SessionViewError("facet-name-ambiguous");
      this.#documents.set(documentId, { layer: facet.layer, url: `automerge:${documentId}` });
      this.#names.set(facet.name, documentId);
    }
    if (!facets.content.every((cid) => typeof cid === "string" && cid.length > 0)) throw new SessionViewError("facets-malformed");
    this.#content = new Set(facets.content);
    this.#referencesContent = opts.referencesContent ?? null;
    this.#onRefusal = opts.onRefusal ?? null;
    this.#maxInboundBytes = opts.maxInboundBytes;
    const peerId = (opts.mintPeerId ?? (() => `session-island-${defaultCryptoProvider.randomUUID()}`))();
    if (typeof peerId !== "string" || peerId.length === 0) throw new SessionViewError("peer-id-absent");
    this.peerId = peerId;
  }

  get closed(): boolean { return this.#closed; }

  /** Settles when the view closes. A waiter that outlives its view reads the close and stops waiting. */
  whenClosed(): Promise<void> { return this.#whenClosed; }

  // ── The five gates ────────────────────────────────────────────────────────────────────────────

  /** May the vessel announce this document to the session, or send it one byte of it? */
  announce(document: string): ViewVerdict { return this.#read("announce", document); }

  /** May the session fetch this document? */
  fetch(document: string): ViewVerdict { return this.#read("fetch", document); }

  /** May the session write this document? The profile and the facet's layer decide, by the one table. */
  write(document: string): ViewVerdict { return this.#note(this.#judgeWrite(document), String(document)); }

  /** The documents this session may write, by URL: what an island's settle counts, and nothing else. */
  writableDocuments(): string[] {
    if (this.#closed) return [];
    const layers = WRITE_LAYERS[this.profile];
    return [...this.#documents.values()].filter((held) => layers.has(held.layer)).map((held) => held.url);
  }

  /** Resolve a catalog name. The answer comes from the session's own facets, or refuses. */
  catalog(name: string): ViewCatalogAnswer {
    if (this.#closed) return this.#note(refuse("view-closed", "catalog"), String(name));
    const documentId = typeof name === "string" ? this.#names.get(name) : undefined;
    if (documentId === undefined) return this.#note(refuse("beyond-facets", "catalog"), String(name));
    return Object.freeze({ ok: true, documentUrl: this.#documents.get(documentId)!.url });
  }

  /** May the session read the content at this address? */
  content(cid: string): ViewVerdict {
    if (this.#closed) return this.#note(refuse("view-closed", "content"), String(cid));
    if (typeof cid !== "string" || !CONTENT_ADDRESS.test(cid)) return this.#note(refuse("beyond-facets", "content"), String(cid));
    if (this.#content.has(cid)) return OK;
    if (this.#referencesContent) {
      for (const documentId of this.#documents.keys()) {
        let referenced = false;
        try { referenced = this.#referencesContent(documentId, cid) === true; } catch { referenced = false; }
        if (referenced) return OK;
      }
    }
    return this.#note(refuse("beyond-facets", "content"), cid);
  }

  // ── The sync leg ──────────────────────────────────────────────────────────────────────────────

  /**
   * Attach the island's port to `repo` through this view. One view carries one leg: a second attach throws.
   * The leg admits the view's own peer ID alone.
   */
  attach(repo: Repo, mainPort: MessagePort): void {
    this.attachAdapter(repo, new PortSyncAdapter(mainPort));
  }

  /** `attach` over any adapter that reaches the island. */
  attachAdapter(repo: Repo, inner: NetworkAdapterInterface): void {
    if (this.#closed) throw new SessionViewError("view-closed");
    if (this.#leg) throw new SessionViewError("leg-already-attached");
    const leg = new GatedSyncLeg(
      inner, this.#gate(), (refusal) => { this.#onRefusal?.(refusal); },
      this.#maxInboundBytes !== undefined ? { maxInboundBytes: this.#maxInboundBytes } : {},
    );
    this.#leg = leg;
    repo.networkSubsystem.addNetworkAdapter(leg);
    // The view's own peer is the house's island peer (road `P26`): the share verdict reads it in-process by this proof alone.
    const unseat = seatIslandPeer(repo, this.peerId);
    this.#detach = () => { unseat(); repo.networkSubsystem.removeNetworkAdapter(leg); };
  }

  /** End the view: the leg stands down and every gate refuses from here on. */
  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    const detach = this.#detach;
    this.#leg = null;
    this.#detach = null;
    detach?.();                                            // removes the leg from the Repo, which disconnects it
    this.#resolveClosed?.();
  }

  // ── Private ───────────────────────────────────────────────────────────────────────────────────

  #gate(): SyncLegGate {
    const refused = (verdict: ViewVerdict, answerUnavailable = false): LegVerdict =>
      verdict.ok ? LEG_PASS : { pass: false, reason: verdict.refusal, ...(answerUnavailable ? { answerUnavailable: true } : {}) };
    // The verdicts below read the tables directly: the leg's own sink reports each refusal once.
    const reads = (document: string): ViewVerdict => this.#judgeRead("fetch", document);
    const writes = (document: string): ViewVerdict => this.#judgeWrite(document);
    return {
      farEndEphemeral: true,
      admitPeer: (peerId) => !this.#closed && peerId === this.peerId,
      inbound: (message: LegMessage): LegVerdict => {
        if (message.documentId === undefined) return { pass: false, reason: "kind-not-carried" };
        switch (message.type) {
          case "request":
          case "sync": {
            const read = reads(message.documentId);
            if (!read.ok) return refused(read, true);
            // The bytes get decoded only where the answer turns on them: a document the session may write
            // passes whole, and a read-only one passes while its message carries no change.
            const write = writes(message.documentId);
            if (write.ok) return LEG_PASS;
            return carriesChanges(message) ? refused(write) : LEG_PASS;
          }
          // An ephemeral message fans out to every peer that shares the document: a write in all but name.
          case "ephemeral": {
            const read = reads(message.documentId);
            return read.ok ? refused(writes(message.documentId)) : refused(read);
          }
          case "doc-unavailable": return refused(reads(message.documentId));
          default: return { pass: false, reason: "kind-not-carried" };
        }
      },
      outbound: (message: LegMessage): LegVerdict => {
        if (message.documentId === undefined) return { pass: false, reason: "kind-not-carried" };
        switch (message.type) {
          case "request":
          case "sync":
          case "ephemeral":
          case "doc-unavailable": return refused(reads(message.documentId));
          default: return { pass: false, reason: "kind-not-carried" };
        }
      },
    };
  }

  #read(verb: "announce" | "fetch", document: string): ViewVerdict {
    return this.#note(this.#judgeRead(verb, document), String(document));
  }

  #judgeRead(verb: "announce" | "fetch", document: string): ViewVerdict {
    const held = this.#held(verb, document);
    return "ok" in held ? held : OK;
  }

  /** THE WRITE DECISION, for the public gate and the leg alike. */
  #judgeWrite(document: string): ViewVerdict {
    const held = this.#held("write", document);
    if ("ok" in held) return held;
    if (WRITE_LAYERS[this.profile].has(held.layer)) return OK;
    return WRITABLE_LAYERS.has(held.layer) ? refuseBeyondProfile(this.profile, "write") : refuse("read-only-layer", "write");
  }

  #held(verb: ViewVerb, document: string): Held | ViewRefusal {
    if (this.#closed) return refuse("view-closed", verb);
    let documentId: string;
    try { documentId = interpretAsDocumentId(document as AutomergeUrl); } catch { return refuse("beyond-facets", verb); }
    return this.#documents.get(documentId) ?? refuse("beyond-facets", verb);
  }

  #note<T extends ViewVerdict | ViewCatalogAnswer>(answer: T, subject: string): T {
    if (!answer.ok) this.#onRefusal?.({ ...answer, subject });
    return answer;
  }
}
