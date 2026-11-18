/**
 * surface-return-leg — a control event returns to the surface that PAINTED the node it names.
 *
 * Every island keeps its own render-id space, so the same id can stand in the daemon's frame and in a wiki's.
 * The page paints one surface at a time and a switch flips the active pointer at once, while the pane keeps
 * the outgoing surface's frame until the new surface's first frame lands. An event routed by the active pointer in
 * that window reaches the wrong island and can fire a node its person never saw. So each `lar:control-event`
 * carries the surface whose frame painted its target, and the leg routes on that alone:
 *
 *   - the daemon surface        → the daemon island's `sendControlEvent`;
 *   - a surface the pool holds  → that wiki island through `placeControlEvent` (which answers `stale-target`
 *                                 for an id it retired or an epoch it superseded);
 *   - any other surface         → no island takes it; the page hears `refused: surface-unknown`.
 *
 * A `lar:resend` routes the same way: the arriving surface's island mints a fresh mount epoch and paints whole; a resend
 * naming no held surface refuses by name on the console (it carries no event a page waits on).
 * An event the contract's reader refuses reaches no island (`readLarControlEvent`, fail closed); the page hears
 * `refused: event-malformed`.
 *
 * EVERY ACT THE LEG REFUSES ANSWERS THE PAGE. The page holds each reliable act it relayed until its
 * `lar:control-result` lands, so a refusal on a console line alone reads to it as silence. The leg answers each refusal
 * on the result rail (`answer`) under the surface the act named, carrying its reason; the console line stays as
 * testimony beside it. Only an act with no readable event id answers nothing: no page waits under a name it never had.
 *
 * Meme: lar:///ha.ka.ba/lararium/browser/surface-return-leg
 */
import { LAR_CAMERA_STORY, mkLarControlResult, readLarControlEvent, type LarMsg_ControlEvent, type LarMsg_ControlResult, type LarRefusal } from "@lararium/mesh";

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
  /** The page's result rail: a refused act's `lar:control-result`, under the surface the act named. */
  readonly answer?: (surface: string, result: LarMsg_ControlResult) => void;
}): SurfaceReturnLeg {
  const say = (line: string): void => (doors.onRefusal ?? ((l) => console.warn(l)))(line);
  const unknown = (surface: string, what: string): ReturnLegVerdict => {
    say(`[vessel] surface-unknown: ${what} names surface "${surface}", and this vessel holds no such surface`);
    return "surface-unknown";
  };
  /** Answer one refused act. Its own identity rides where it reads; a malformed epoch or camera answers under the
   *  story camera's floor so the result still reads whole, and the page correlates by event id alone. */
  const refuse = (surface: string, ev: unknown, reason: LarRefusal): void => {
    const raw = (ev !== null && typeof ev === "object" ? ev : {}) as Record<string, unknown>;
    const name = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 1024;   // the contract's name bound
    if (!name(raw["eventId"])) return;
    const epoch = raw["mountEpoch"];
    doors.answer?.(surface, mkLarControlResult({
      eventId: raw["eventId"],
      cameraId: name(raw["cameraId"]) ? raw["cameraId"] : LAR_CAMERA_STORY,
      mountEpoch: typeof epoch === "number" && Number.isSafeInteger(epoch) && epoch >= 0 ? epoch : 0,
      ...(name(raw["controlId"]) ? { controlId: raw["controlId"] } : {}),
      ...(name(raw["renderId"]) ? { renderId: raw["renderId"] } : {}),
      status: "refused", reason,
    }));
  };
  return {
    sendControlEvent(surface, ev) {
      if (readLarControlEvent(ev) === null) {
        say(`[vessel] event-malformed: a control event for surface "${surface}" fails the contract's reader, and no island takes it`);
        refuse(surface, ev, "event-malformed");
        return "event-malformed";
      }
      if (surface === doors.daemonSurfaceId) { doors.daemon().sendControlEvent(ev); return "routed"; }
      const pool = doors.pool();
      if (!surface || !pool.has(surface)) {
        refuse(surface, ev, "surface-unknown");
        return unknown(surface, `${ev.action} for ${ev.renderId !== undefined ? `render-id ${ev.renderId}` : `control ${ev.controlId ?? ev.affordanceId}`}`);
      }
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
