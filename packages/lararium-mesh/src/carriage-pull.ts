/**
 * carriage-pull — the GATE-NATIVE pull a carriage is handed (`carriageCap` `pullOracle`): one dial per (peer, Nexus) on the
 * floor tier, at the floor pin the reader's own pair index holds for that peer at that Nexus, presenting what this vessel
 * stands as there, and verified against the publisher key the carried dial names.
 *
 * WHERE THE PIN COMES FROM. Never the wire and never the dial entry: the pair index, keyed (peer's key, Nexus hex,
 * "/oracle", "floor"), filled only through an authenticated relation or a carried signed pin set (`place-floor-pin`). A peer
 * this vessel holds no pin for at any Nexus it stands in is not dialed at all (`pin-absent`): a stranger's crossroads, and
 * a crossroads of another Nexus, are never knocked on.
 *
 * WHAT IT PRESENTS. The caller's `presentationFor`: a face with its admit at that Nexus, or a place with its carriage
 * contract there. A Nexus at which this vessel can present nothing is skipped by name, never dialed bare.
 *
 * Feed-or-fade: the first verified pull wins; every Nexus is tried at most once per pull; nothing throws.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/carriage-pull
 */
import type { DialPinKey } from "./admit-gate-pin.js";
import { hex, utf8Bytes } from "./crypto.js";
import type { DialSocket } from "./face-dial.js";
import type { GateBundlePin } from "./gate-bundle.js";
import type { FacePresentation } from "./lar-ws-client-adapter.js";
import {
  ORACLE_SOCKET_ROUTE, pullAndVerifyFlow,
  type FlowPullResult, type PlaceOraclePresentation,
} from "./flow-read-client.js";

export interface GateNativeCarriagePullDeps {
  /** The vessel's pair index. */
  readonly pins:            { get(key: DialPinKey): GateBundlePin | null };
  /** The Nexuses (AID text) this vessel stands in, read fresh at each pull. */
  readonly nexuses:         () => readonly string[] | Promise<readonly string[]>;
  /** What this vessel presents at `nexus`'s floor gate under `pin`, or null where it can present nothing there. */
  readonly presentationFor: (nexus: string, pin: GateBundlePin) => Promise<FacePresentation | PlaceOraclePresentation | null>;
  readonly audience:        string;
  readonly deadlines:       { draw(lapse: () => void): { cancel(): void } };
  /** Runs once before each pull: where the vessel files the pins its boards carried since the last one. */
  readonly refresh?:        () => Promise<void>;
  readonly dialSocket?:     (url: string) => DialSocket;
  readonly onLog?:          (line: string) => void;
}

/** The reason a pull names when this vessel holds no floor pin for the peer at any Nexus it stands in. */
export const CARRIAGE_PIN_ABSENT = "pin-absent: this vessel holds no floor pin for the peer at any Nexus it stands in, so it knocks nowhere";

/** Stand the pull. */
export function gateNativeCarriagePull<T = unknown>(deps: GateNativeCarriagePullDeps): (peer: string, publisherKey: string) => Promise<FlowPullResult<T>> {
  return async (peer, publisherKey) => {
    try { await deps.refresh?.(); } catch { /* a refresh that fails files nothing new; the held pins still answer */ }
    const hearth = publisherKey.toLowerCase();
    let last: FlowPullResult<T> | null = null;
    let nexuses: readonly string[];
    try { nexuses = await deps.nexuses(); } catch { nexuses = []; }
    for (const nexus of new Set(nexuses)) {
      const nexusHex = hex(utf8Bytes(nexus));
      let pin: GateBundlePin | null;
      try { pin = deps.pins.get({ hearth, nexus: nexusHex, route: ORACLE_SOCKET_ROUTE, tier: "floor" }); } catch { pin = null; }
      if (pin === null) continue;
      let presentation: FacePresentation | PlaceOraclePresentation | null;
      try { presentation = await deps.presentationFor(nexus, pin); } catch { presentation = null; }
      if (presentation === null) {
        deps.onLog?.(`carriage: no presentation at ${nexus.slice(0, 18)}… for ${hearth.slice(0, 12)}… — this vessel dials nothing there`);
        last = { ok: false, reason: "presentation-absent: this vessel presents nothing at that Nexus" };
        continue;
      }
      const read = await pullAndVerifyFlow<T>(peer, {
        pins: deps.pins, hearth, nexus: nexusHex, presentation, audience: deps.audience, deadlines: deps.deadlines,
        verifyingKey: hearth, ...(deps.dialSocket ? { dialSocket: deps.dialSocket } : {}),
      });
      if (read.ok) return read;
      last = read;
    }
    return last ?? { ok: false, reason: CARRIAGE_PIN_ABSENT };
  };
}
