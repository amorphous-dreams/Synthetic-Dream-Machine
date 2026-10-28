/**
 * herm-carriage — where a herm stands its floor gates, how they answer, and the GATE-NATIVE carriage pull a vessel hands its
 * carriage (the shut-routes house ruling, stable-founding-road #/rulings: "an explicit Nexus opens the herm relay", and carriage peering flips "on a
 * proven gate-native caller").
 *
 *   · WHERE. A herm stands a floor gate at the explicit Nexus it was joined to and only there: a Nexus whose carriage board,
 *     on its own replica, counts a `carry` for its own vessel key (`placeCarriedNexuses`, `via: "carrier-seal"`). A charter
 *     it merely holds stands no gate. A lararium stands one at its own Nexus and at each it carries.
 *   · HOW IT ANSWERS (operator ruling "A herm answers the knock"): any PROVEN peer that knocked, read by the vessel's one
 *     posture reader (`ownPlacePosture`, OPEN by class). The knock is the silence: only a peer handed the gate key computes
 *     the path. The carrying Nexus's charter posture governs that Nexus's own hearths, never the waystone.
 *   · THE PIN A READER DIALS (lar:///ha.ka.ba/lararium/mesh/place-floor-pin). The herm signs its FLOOR PIN CLAIM at each carrying
 *     Nexus: the pin, at the head of its own place KEL, under the signer the KEL seats there (the key the quorum's act names). It
 *     lays the claim and its KEL rows on its own replica of that Nexus's carriage board; a reader files the claim only where
 *     its own replica counts the signer at the head as a carrier, and KEL descent orders the claims it files
 *     (`place-floor-pin`, `admit-gate-pin`). A herm that rotated its place is carried again under its new signer.
 *   · WHAT A READER PRESENTS (lar:///ha.ka.ba/lararium/mesh/carriage-pull#/what-it-presents). A place carried at that Nexus presents the quorum's
 *     counted head-epoch `carry` over its own key (the place arm, class `contracted`); a lararium otherwise presents its mounted face with
 *     the admit it took for that Nexus. Nothing composed, nothing dialed.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/herm-carriage
 */
import {
  carriageAncestryFromBoard, foldCarriageDetails, foldCarrierSet, filePlaceFloorPins, gateNativeCarriagePull, placeArmFor, placeFloorPinKey, placeFloorPinsFromBoard,
  placeKelRowsFromBoard, placeKelKey, verifyPlaceKel, writePlaceKelEvent,
  signPlaceFloorPin, tiddlerText, writePlaceFloorPin, carriageDocUrl, FLOW_SOCKET_ROUTE,
  deriveGateBundle, floorGateRoot, floorRoute,
  type DialSocket, type FloorKeyDoor, type FacePresentation, type GateBundlePin, type HearthPinIndex, type LarDoc,
  type FlowPullResult, type PlaceFloorPinStatement, type PlaceKelEvent,
} from "@lararium/mesh";
import type { AutomergeUrl } from "@automerge/automerge-repo";
import type { CarriedNexusReading } from "./nexus-carriage.js";
import type { PlaceClass } from "./socket-sorter.js";

/** The carried Nexuses a vessel's gates stand in: every one for a lararium; for a herm, those that carry its own key. */
export function gateReadingsFor(placeClass: PlaceClass, readings: readonly CarriedNexusReading[]): readonly CarriedNexusReading[] {
  return placeClass === "herm" ? readings.filter((r) => r.via === "carrier-seal") : readings;
}

export interface VesselCarriagePullDeps {
  readonly placeClass:  PlaceClass;
  /** This vessel's own vessel key: the place key a herm's carry act names, and the key its flow pointer signs under. */
  readonly ownPlaceKey: string;
  /** The vessel key's signing door: 64 signature bytes over exactly the image handed in. */
  readonly sign:        (image: Uint8Array) => Promise<Uint8Array>;
  /** Every Nexus this vessel carries, as its own replica reads them now. */
  readonly readings:    () => Promise<readonly CarriedNexusReading[]>;
  /** A lararium's own Nexus AID, or null. A herm stands at no Nexus of its own. */
  readonly ownNexus:    () => string | null;
  /** Read a carriage board on this vessel's own replica. */
  readonly openBoard:   (url: AutomergeUrl) => Promise<LarDoc | undefined>;
  /** A herm only: the floor pin its own gate stands at `nexus` on the flow route. */
  readonly ownFloorPin?: (nexus: string) => Promise<GateBundlePin | null>;
  /** A herm only: its own place KEL, inception first (the chain whose head signs the claim and whose rows readers fold). */
  readonly ownPlaceChain?: () => Promise<readonly PlaceKelEvent[]>;
  /** A herm only: lay its signed claim and its KEL rows on its own replica of the board at `url` (written once; again when moved). */
  readonly layStatement?: (url: AutomergeUrl, statement: PlaceFloorPinStatement, kel: readonly PlaceKelEvent[]) => Promise<void>;
  /** A lararium only: the mounted face's presentation at the Nexus `pin` names, or null. */
  readonly facePresentation?: (pin: GateBundlePin) => Promise<FacePresentation | null>;
  readonly pins:        HearthPinIndex;
  readonly audience:    string;
  readonly deadlines:   { draw(lapse: () => void): { cancel(): void } };
  readonly dialSocket?: (url: string) => DialSocket;
  readonly onLog?:      (line: string) => void;
}

/** The floor pin a vessel's flow gate stands at `nexus`, derived from its floor key door; the derived secret drops at once. */
export function flowFloorPinAt(nexus: string, door: FloorKeyDoor): GateBundlePin {
  const bundle = deriveGateBundle(floorGateRoot(door), new TextEncoder().encode(nexus), floorRoute(FLOW_SOCKET_ROUTE));
  try { return bundle.pin; } finally { bundle.drop(); }
}

/**
 * Lay a herm's claim and the KEL rows that fold to its head onto a board handle's doc, once: a claim and a row already on the
 * board (keyed by the head and the event digest) write nothing, and a claim at a new head lays beside the older ones, since KEL
 * descent orders them.
 */
export function layStatementOn(handle: { doc(): LarDoc | undefined; change(fn: (d: LarDoc) => void): void }, statement: PlaceFloorPinStatement, kel: readonly PlaceKelEvent[]): boolean {
  const tiddlers = handle.doc()?.tiddlers ?? {};
  const claimKey = placeFloorPinKey(statement);
  const claimStands = tiddlerText(tiddlers[claimKey]) === JSON.stringify(statement);
  const rows = kel.filter((event) => tiddlerText(tiddlers[placeKelKey(statement.aid, event)]) === null);
  if (claimStands && rows.length === 0) return false;
  handle.change((d) => {
    if (!claimStands) writePlaceFloorPin(d, statement);
    for (const event of rows) writePlaceKelEvent(d, statement.aid, event);
  });
  return true;
}

/** Stand the gate-native carriage pull a vessel hands its carriage. */
export function vesselCarriagePull<T = unknown>(deps: VesselCarriagePullDeps): (peer: string, publisherKey: string) => Promise<FlowPullResult<T>> {
  const placeKey = deps.ownPlaceKey.toLowerCase();
  const standing = async (): Promise<readonly CarriedNexusReading[]> => gateReadingsFor(deps.placeClass, await deps.readings());
  const refresh = async (): Promise<void> => {
    for (const r of await deps.readings()) {
      const url = carriageDocUrl(r.island) as AutomergeUrl;
      const board = await deps.openBoard(url);
      const ancestry = carriageAncestryFromBoard(r.sealLineage, board);
      const carriers = await foldCarrierSet(r.denyBoard, r.roster, ancestry);
      if (deps.placeClass === "herm" && r.via === "carrier-seal" && carriers.has(placeKey) && deps.ownFloorPin && deps.layStatement && deps.ownPlaceChain) {
        const pin = await deps.ownFloorPin(r.aid);
        const chain = await deps.ownPlaceChain();
        const at = verifyPlaceKel(chain);
        // The claim names the head this herm's KEL stands at now; the signer there is the key its carry names, or none is laid.
        if (pin !== null && at.ok && at.signerKey === placeKey) await deps.layStatement(url, await signPlaceFloorPin({ at, pin, sign: deps.sign }), chain);
      }
      const nexusHex = Buffer.from(r.aid, "utf8").toString("hex");
      const statements = placeFloorPinsFromBoard(board);
      const kelRows = placeKelRowsFromBoard(board);
      // WHICH READING READ WHICH BOARD: the reading's way in, its board, the carriers its own replica counts and the
      // places whose statements that board holds, so a refused pin names the relation it missed.
      const named = (keys: Iterable<string>): string => [...keys].map((k) => k.slice(0, 8)).sort().join(",") || "none";
      const stated = statements.map((s) => (typeof s === "object" && s !== null && typeof (s as { aid?: unknown }).aid === "string" ? (s as { aid: string }).aid : "?"));
      const acts = [...r.denyBoard].filter((e) => e.action === "carry" || e.action === "uncarry")
        .map((e) => `${e.action}:${e.nym.slice(0, 8)}@${e.sealEpochCid.slice(-8)}`).sort().join(",") || "none";
      const { filed, refused, held } = filePlaceFloorPins(deps.pins, statements, { nexusHex, route: FLOW_SOCKET_ROUTE, kelRows, standing: { via: "carrier", carriers } });
      if (refused.length > 0 && deps.onLog) {
        const folded = await foldCarriageDetails(r.denyBoard, r.roster, ancestry);
        const reasons = folded.entries.filter((e) => e.action === "carry" || e.action === "uncarry")
          .map((e) => `${e.action}:${e.nym.slice(0, 8)}=${e.reason}`).join(",") || "no matching carry act";
        deps.onLog(`${r.aid}: refresh ${deps.placeClass} via=${r.via} board=${url} head=${r.roster.sealEpochCid.slice(-8)} lineage=${String(r.sealLineage.length)} acts=[${acts}] carriers=[${named(carriers)}] statements=[${named(stated)}] fold=[${reasons}]`);
      }
      if (refused.length > 0) deps.onLog?.(`${r.aid.slice(0, 18)}…: ${refused.length} place floor pin(s) refused (${[...new Set(refused)].join(", ")})`);
      if (held.length > 0) deps.onLog?.(`${r.aid.slice(0, 18)}…: ${held.length} place floor pin claim(s) held back (${[...new Set(held)].join(", ")})`);
      if (filed.length > 0) deps.onLog?.(`${r.aid.slice(0, 18)}…: ${filed.length} place floor pin(s) read`);
    }
  };
  return gateNativeCarriagePull<T>({
    pins: deps.pins,
    nexuses: async () => {
      const own = deps.placeClass === "herm" ? null : deps.ownNexus();
      return [...new Set([...(own ? [own] : []), ...(await standing()).map((r) => r.aid)])];
    },
    refresh,
    presentationFor: async (nexus, pin) => {
      const aid = nexus.trim().toLowerCase();
      const reading = (await standing()).find((r) => r.aid.toLowerCase() === aid);
      const arm = reading ? await placeArmFor(reading.denyBoard, reading.roster, placeKey,
        carriageAncestryFromBoard(reading.sealLineage, await deps.openBoard(carriageDocUrl(reading.island) as AutomergeUrl))) : null;
      if (reading && arm !== null) {
        return { kind: "place", placeKey, sign: deps.sign, arm };
      }
      // A place presents its contract or nothing: it wears no face.
      if (deps.placeClass === "herm" || !deps.facePresentation) return null;
      return deps.facePresentation(pin);
    },
    audience: deps.audience,
    deadlines: deps.deadlines,
    ...(deps.dialSocket ? { dialSocket: deps.dialSocket } : {}),
    ...(deps.onLog ? { onLog: deps.onLog } : {}),
  });
}
