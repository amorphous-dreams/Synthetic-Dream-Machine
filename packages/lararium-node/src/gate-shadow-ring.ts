/**
 * gate-shadow-ring — THE SHADOW RING a face gate consults (`@lararium/mesh` `face-gate` `GateShadowRing`), over this
 * vessel's one edge reading (`edge-shadow-ring`).
 *
 * ── D4, A DEVICE SET ASIDE ──────────────────────────────────────────────────────────────────────
 * Each vessel face-key certificate binds its face key to its certified device edge. The wire carries the face-scoped
 * key alone, so the gate reads the binding off this vessel's own records (`deviceOf`) and asks the fleet edge's
 * shadow about that device edge. A presenter reads FLEET-ASIDE, and so never sorts same-operator, while:
 *   · the edge ring has no fold (before the first one lands, after one fails, or while a board moved);
 *   · the mapping reads unreadable, throws, or names no device;
 *   · a standing shadow sets the mapped device aside from a fleet this vessel serves.
 * A device set aside thereby cuts every face it wore: each of its face keys maps to the one device edge.
 *
 * FAIL CLOSED UNTIL THE FIRST FOLD LANDS. Before a fold every presenter and every place reads aside: the gate
 * then answers nobody, as a vessel that armed its gates before reading its boards must.
 *
 * Canon: lar:///ha.ka.ba/lares/docs/stable-founding-road#/rulings ("A device set aside");
 *        lar:///ha.ka.ba/lares/api/pono/kapae#/reach
 */
import type { FaceScope, GateShadowRing, VesselFaceKey } from "@lararium/mesh";
import type { EdgeShadowRing } from "./edge-shadow-ring.js";

/** The device edge a presenting vessel face key stands certified under, or why the binding reads nothing. */
export type FaceDeviceReading = { readonly device: string } | { readonly unreadable: string };

export interface GateShadowRingDeps {
  /** This vessel's one edge reading: its last fold, and the fleet shadow over a device. */
  readonly ring:     Pick<EdgeShadowRing, "fold" | "deviceAside">;
  /** The face-key to device-edge binding this vessel holds for a presenter. */
  readonly deviceOf: (presenter: { readonly scope: FaceScope; readonly vesselFaceKey: VesselFaceKey }) => FaceDeviceReading;
}

/**
 * The binding with no carrier: every presenter reads unreadable, and none sorts same-operator. A vessel binds its
 * own records instead (`face-device-book`); this stands for a composition that holds none.
 */
export function faceDevicesUnbound(): GateShadowRingDeps["deviceOf"] {
  return () => ({ unreadable: "face-device-unbound" });
}

/** The ring a face gate consults. */
export function gateShadowRing(deps: GateShadowRingDeps): GateShadowRing {
  const deviceAside = (presenter: { readonly scope: FaceScope; readonly vesselFaceKey: VesselFaceKey }): boolean => {
    let reading: FaceDeviceReading;
    try { reading = deps.deviceOf(presenter); } catch { return true; }
    if (reading === null || typeof reading !== "object" || !("device" in reading)) return true;
    if (typeof reading.device !== "string" || reading.device.trim().length === 0) return true;
    return deps.ring.deviceAside(reading.device);
  };
  const ring: GateShadowRing = {
    consult(presenter) {
      if (deps.ring.fold() === null) return { aside: true, fleetAside: true };
      return { aside: false, fleetAside: deviceAside(presenter) };
    },
    consultPlace() {
      return { aside: deps.ring.fold() === null };
    },
  };
  return Object.freeze(ring);
}
