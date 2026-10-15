/**
 * surface-return-leg — a DOM event returns to the surface that PAINTED the node it names.
 *
 * Every island keeps its own render-id space, so the same id can stand in the daemon's frame and in a wiki's.
 * The page paints one surface at a time and a switch flips the active pointer at once, while the pane keeps
 * the old surface's frame until the new surface's first frame lands. An event routed by the active pointer in
 * that window reaches the wrong island and can fire a node its person never saw. So each event carries the
 * surface whose frame painted its target, and the leg routes on that alone:
 *
 *   - the daemon surface        → the daemon island;
 *   - a surface the pool holds  → that wiki island (which answers `stale-target` for an id it retired);
 *   - any other surface         → refused by name, and nothing is posted anywhere.
 *
 * Meme: lar:///ha.ka.ba/lararium/browser/surface-return-leg
 */

export type DomEventFields = Record<string, number | boolean>;

/** The daemon island's half of the return leg. */
export interface DaemonReturnDoor {
  sendDomEvent(renderId: string, eventType: string, fields: DomEventFields): void;
  sendDomInput(renderId: string, eventType: string, value: string): void;
}

/** The wiki pool's half: `has` answers whether the pool holds an island under that id. */
export interface PoolReturnDoor {
  has(wikiId: string): boolean;
  placeWikiEvent(wikiId: string, ev: { renderId: string; eventType: string; fields: DomEventFields }): void;
  placeWikiInput(wikiId: string, ev: { renderId: string; eventType: string; value: string }): void;
}

export type ReturnLegVerdict = "routed" | "surface-unknown";

export interface SurfaceReturnLeg {
  sendDomEvent(surface: string, renderId: string, eventType: string, fields: DomEventFields): ReturnLegVerdict;
  sendDomInput(surface: string, renderId: string, eventType: string, value: string): ReturnLegVerdict;
}

export function makeSurfaceReturnLeg(doors: {
  readonly daemonSurfaceId: string;
  readonly daemon: () => DaemonReturnDoor;
  readonly pool:   () => PoolReturnDoor;
  readonly onRefusal?: (line: string) => void;
}): SurfaceReturnLeg {
  const refuse = (surface: string, renderId: string, eventType: string): ReturnLegVerdict => {
    (doors.onRefusal ?? ((line) => console.warn(line)))(
      `[vessel] surface-unknown: ${eventType} for render-id ${renderId} names surface "${surface}", and this vessel holds no such surface`,
    );
    return "surface-unknown";
  };
  return {
    sendDomEvent(surface, renderId, eventType, fields) {
      if (surface === doors.daemonSurfaceId) { doors.daemon().sendDomEvent(renderId, eventType, fields); return "routed"; }
      const pool = doors.pool();
      if (!surface || !pool.has(surface)) return refuse(surface, renderId, eventType);
      pool.placeWikiEvent(surface, { renderId, eventType, fields });
      return "routed";
    },
    sendDomInput(surface, renderId, eventType, value) {
      if (surface === doors.daemonSurfaceId) { doors.daemon().sendDomInput(renderId, eventType, value); return "routed"; }
      const pool = doors.pool();
      if (!surface || !pool.has(surface)) return refuse(surface, renderId, eventType);
      pool.placeWikiInput(surface, { renderId, eventType, value });
      return "routed";
    },
  };
}
