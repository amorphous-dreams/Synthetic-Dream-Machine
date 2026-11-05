/**
 * CapabilityRecord — the ONE record a vessel hands an island AT CONSTRUCTION.
 *
 * The vessel holds the authority (its store, its cid plane, its fleet board, its key); an island holds only what its
 * record carries. No process-global setter stands behind it: two vessels in one process hand their islands two
 * records, and a capability one vessel stands never reaches another's island. A member the vessel never stands reads
 * absent, and an ask that needs it refuses by name.
 *
 *   receipt       ask for a durability receipt: resolves once every named document rests in the vessel's store, the
 *                 heads the island holds named beside it. Replaces the "rest door".
 *   cas           the bytes a cid names, or null (a miss stays a miss).
 *   dyad          the vessel's reading of one device edge on one fleet root.
 *   custodyWrite  seal bytes under the vessel key (the daemon island's archive exports cross here).
 *
 * The vessel MAY stand a member after it constructs the island (the transport stands late): the island reads the
 * member from ITS record at ask time, never from shared module state.
 *
 * Canon: lar:///ha.ka.ba/lares/docs/pono/test-recut-road
 */
import type { EdgeStanding } from "./edge-kapae.js";
import type { CustodyWriteCarrier } from "./island-protocol.js";

/** The vessel's answer to an island's receipt ask — resolves once every named document rests in the vessel's store. */
export type ReceiptIssuer = (documentIds: readonly string[], heads?: Readonly<Record<string, readonly string[]>>) => Promise<void>;
/** The vessel's answer to an island's `cas:want` — verified bytes, or null. */
export type CasFetcher = (cid: string) => Promise<Uint8Array | null>;
/** The vessel's reading of one device edge on one fleet root. */
export type DyadReader = (fleetRoot: string, deviceKey: string) => EdgeStanding | Promise<EdgeStanding>;
/** The vessel's seal of bytes an island hands across under the vessel key. */
export type CustodyWriter = (carrier: CustodyWriteCarrier, bytes: Uint8Array) => Promise<void>;

export interface CapabilityRecord {
  receipt?: ReceiptIssuer | undefined;
  cas?: CasFetcher | undefined;
  dyad?: DyadReader | undefined;
  custodyWrite?: CustodyWriter | undefined;
}
