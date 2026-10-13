/**
 * who-face-cap — the isomorphic vessel cap that wires the WHO plane (identity federation).
 *
 * The identity sibling of meshPalaceCap: where the carriage cap wires the meshpalace FLOW-map (WHERE to
 * dial), this wires the per-Nexus WHO board (WHO a veiled-user is) — the two-key atom's two planes, two caps.
 * A vessel composing this cap materializes its Nexus's WHO board at the address `whoBoardDocUrl` derives,
 * layers the board WRITABLE so the relay syncs it, and NEVER announces a face of its own. Pulling
 * peers' cards into a HandleBook rides the returned component's `ingest`.
 *
 * Isomorphic and platform-blind, exactly like meshPalaceCap: a browser vessel composes the very same cap a
 * node does. The board carries no write-ACL — the self-certifying card is the trust (who-face), so an
 * openly-synced board stays forgery-proof. Requires the substrate (the composite to layer the board into).
 *
 * Canon: lar:///ha.ka.ba/lararium/docs/crossroads · lar:///ha.ka.ba/lares/api/pono/persona-circle#/the-vault
 */
import type { Repo, DocHandle } from "@automerge/automerge-repo";
import type { CapModule } from "./cap-compose.js";
import { AutomergeDocStore } from "./automerge-doc-store.js";
import { announceToWhoFace } from "./who-face.js";
import { ingestAnnounceDoc } from "./handle-announce.js";
import { materializeSharedLarDoc, whoBoardDocUrl } from "./deterministic-doc.js";
import type { HandleBook } from "./handle-book.js";
import type { HandleCard, CardVerdict } from "./handle-card.js";
import { nexusHandlesUri } from "./lar-uris.js";
import { type LarDoc } from "./base-doc.js";
import type { VesselCoreAssembly } from "./open-vessel-core.js";
import type { BagStowage } from "./bag-residency.js";

/** The WHO-plane cap-id — a vessel's #has-cap-stack names it to wire identity federation. */
export const WHO_FACE_CAP = "who-face" as const;

/** The substrate cap-id this cap layers into — a WIRE-STRING matched by VALUE (mesh can't import CORE_CAP). */
const SUBSTRATE_CAP_ID = "substrate";

/** The WHO board handle, an ingest that pulls its current cards into a recogniser's book, and the
 *  DELIBERATE announce. Resolving the board (recognition) and announcing a face (disclosure) stand as
 *  TWO acts — canon never collapses binding-the-vessels into announcing-the-identity, so a vessel may
 *  compose this cap, read every peer's card, and publish nothing. */
export interface WhoFaceComponent {
  readonly handle: DocHandle<LarDoc>;
  readonly ingest: (book: HandleBook) => Promise<Map<string, CardVerdict>>;
  /** Publish a card onto the board — a deliberate act the holder chooses, NEVER a boot side-effect. */
  readonly announce: (card: HandleCard) => void;
}

/**
 * whoFaceCap — materialize the Nexus's WHO board at its derived address, layer it writable (so the relay syncs it),
 * and expose `ingest` (recognition) + `announce` (disclosure). It takes NO card and publishes NOTHING:
 * composing a cap is binding, and binding never announces. `crossroadsHandle` stands unread (the board's
 * address derives from the key);
 * `nexusPubkey` scopes the board to one causal island.
 */
export function whoFaceCap(deps: {
  repo: Repo;
  crossroadsHandle: DocHandle<LarDoc>;
  nexusPubkey: string;
  residency?: BagStowage;
}): CapModule {
  return {
    id: WHO_FACE_CAP, requires: [SUBSTRATE_CAP_ID],
    build: async (resolve) => {
      const assembly = resolve<VesselCoreAssembly>(SUBSTRATE_CAP_ID);
      // The board's address DERIVES from the Nexus key: no pointer is read and none is written, so the
      // crossroads doc (writable by every admitted peer) never steers where the board lives.
      const board = await materializeSharedLarDoc(deps.repo, whoBoardDocUrl(deps.nexusPubkey), "board:who-face");
      const bagId = nexusHandlesUri(deps.nexusPubkey);
      // Written by NAME, never the default: the vessel alone names its working layer, and a capability's
      // layer composed after it must not take a bagless write.
      assembly.composite.addLayer({
        bagId, store: new AutomergeDocStore(board, bagId), writable: true, defaultWritable: false,
      });
      await deps.residency?.pin(bagId, "boot:who-face");
      return {
        handle: board,
        ingest: (book: HandleBook) => ingestAnnounceDoc(book, board.doc()!),
        announce: (card: HandleCard) => announceToWhoFace(board, card),
      };
    },
  };
}
