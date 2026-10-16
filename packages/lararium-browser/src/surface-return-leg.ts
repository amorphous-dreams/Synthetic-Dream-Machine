/**
 * surface-return-leg — a control event returns to the surface that PAINTED the node it names.
 *
 * Every island keeps its own render-id space, so the same id can stand in the daemon's frame and in a wiki's.
 * The page paints one surface at a time and a switch flips the active pointer at once, while the pane keeps
 * the old surface's frame until the new surface's first frame lands. An event routed by the active pointer in
 * that window reaches the wrong island and can fire a node its person never saw. So each `lar:control-event`
 * carries the surface whose frame painted its target, and the leg routes on that alone:
 *
 *   - the daemon surface        → the daemon island's `sendControlEvent`;
 *   - a surface the pool holds  → that wiki island through `placeControlEvent` (which answers `stale-target`
 *                                 for an id it retired or an epoch it superseded);
 *   - any other surface         → refused by name, and nothing is posted anywhere.
 *
 * A `lar:resend` routes the same way: the arriving surface's island mints a fresh mount epoch and paints whole.
 * An event the contract's reader refuses posts nowhere (`readLarControlEvent`, fail closed).
 *
 * Meme: lar:///ha.ka.ba/lararium/browser/surface-return-leg
 */
import { LAR_CAMERA_STORY, readLarControlEvent, type LarMsg_ControlEvent } from "@lararium/mesh";

/** The daemon island's half of the return leg. */
export interface DaemonReturnDoor {
  sendControlEvent(ev: LarMsg_ControlEvent): void;
  resend(cameraId: string): void;
}

/** The wiki pool's half: `has` answers whether the pool holds an island under that id. */
export interface PoolReturnDoor {
  has(wikiId: string): boolean;
  placeControlEvent(wikiId: string, ev: LarMsg_ControlEvent): void;
  resendProjection(wikiId: string, cameraId: string): void;
}

export type ReturnLegVerdict = "routed" | "surface-unknown" | "event-malformed";

export interface SurfaceReturnLeg {
  sendControlEvent(surface: string, ev: LarMsg_ControlEvent): ReturnLegVerdict;
  resend(surface: string, cameraId?: string): ReturnLegVerdict;
}

export function makeSurfaceReturnLeg(doors: {
  readonly daemonSurfaceId: string;
  readonly daemon: () => DaemonReturnDoor;
  readonly pool:   () => PoolReturnDoor;
  readonly onRefusal?: (line: string) => void;
}): SurfaceReturnLeg {
  const say = (line: string): void => (doors.onRefusal ?? ((l) => console.warn(l)))(line);
  const unknown = (surface: string, what: string): ReturnLegVerdict => {
    say(`[vessel] surface-unknown: ${what} names surface "${surface}", and this vessel holds no such surface`);
    return "surface-unknown";
  };
  return {
    sendControlEvent(surface, ev) {
      if (readLarControlEvent(ev) === null) {
        say(`[vessel] event-malformed: a control event for surface "${surface}" fails the contract's reader, and nothing is posted`);
        return "event-malformed";
      }
      if (surface === doors.daemonSurfaceId) { doors.daemon().sendControlEvent(ev); return "routed"; }
      const pool = doors.pool();
      if (!surface || !pool.has(surface)) return unknown(surface, `${ev.action} for ${ev.renderId !== undefined ? `render-id ${ev.renderId}` : `control ${ev.controlId ?? ev.affordanceId}`}`);
      pool.placeControlEvent(surface, ev);
      return "routed";
    },
    resend(surface, cameraId = LAR_CAMERA_STORY) {
      if (surface === doors.daemonSurfaceId) { doors.daemon().resend(cameraId); return "routed"; }
      const pool = doors.pool();
      if (!surface || !pool.has(surface)) return unknown(surface, "lar:resend");
      pool.resendProjection(surface, cameraId);
      return "routed";
    },
  };
}
