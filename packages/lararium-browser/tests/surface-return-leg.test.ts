/**
 * surface-return-leg — A DOM EVENT RETURNS TO THE SURFACE THAT PAINTED ITS TARGET.
 *
 * Every island counts render-ids on its own, so one id can stand in two frames. The page keeps a surface's
 * frame on screen until the next surface's first frame lands, while a switch flips the active pointer at once.
 * The leg therefore routes on the surface each event CARRIES, and the active pointer plays no part.
 *
 * The fake islands below each hold their own id space and answer the way a real island does: a live id
 * dispatches, a retired id answers `stale-target`.
 */
import { describe, expect, test } from "vitest";
import { makeSurfaceReturnLeg } from "../src/surface-return-leg.js";

const DAEMON = "daemon";

function island(name: string, live: readonly string[]) {
  const liveIds = new Set(live);
  const log: string[] = [];
  const take = (kind: string, renderId: string, eventType: string): void => {
    log.push(liveIds.has(renderId) ? `${name}:${kind}:${eventType}:${renderId}` : `${name}:stale-target:${renderId}`);
  };
  return {
    log,
    /** A re-render retires every earlier id and mints fresh ones, as a surface does when it returns. */
    rerender(ids: readonly string[]) { liveIds.clear(); for (const id of ids) liveIds.add(id); },
    event: (renderId: string, eventType: string) => take("event", renderId, eventType),
    input: (renderId: string, eventType: string) => take("input", renderId, eventType),
  };
}

function vessel() {
  const daemon = island("daemon", ["7", "8"]);
  const wiki = island("lares", ["7", "9"]);        // id 7 stands on BOTH surfaces
  const refusals: string[] = [];
  let active = "lares";
  const leg = makeSurfaceReturnLeg({
    daemonSurfaceId: DAEMON,
    daemon: () => ({
      sendDomEvent: (rid, type) => daemon.event(rid, type),
      sendDomInput: (rid, type) => daemon.input(rid, type),
    }),
    pool: () => ({
      has: (id) => id === "lares",
      placeWikiEvent: (_id, ev) => wiki.event(ev.renderId, ev.eventType),
      placeWikiInput: (_id, ev) => wiki.input(ev.renderId, ev.eventType),
    }),
    onRefusal: (line) => refusals.push(line),
  });
  /** What a leg that read the active pointer would do: the measured fault, kept as the control. */
  const byActivePointer = (renderId: string, eventType: string): void =>
    active === DAEMON ? daemon.event(renderId, eventType) : wiki.event(renderId, eventType);
  return { daemon, wiki, refusals, leg, byActivePointer, setActive: (s: string) => { active = s; } };
}

describe("the return leg routes on the surface an event carries", () => {
  test("an event raised on the wiki's frame reaches the wiki after the daemon took the active pointer", () => {
    const v = vessel();
    v.setActive(DAEMON);   // the switch flipped; the pane still shows the wiki frame the person clicked
    expect(v.leg.sendDomEvent("lares", "7", "click", { button: 0 })).toBe("routed");
    expect(v.wiki.log).toEqual(["lares:event:click:7"]);
    expect(v.daemon.log).toEqual([]);
    // CONTROL: routed by the active pointer, the same click fires the DAEMON's node 7.
    v.byActivePointer("7", "click");
    expect(v.daemon.log).toEqual(["daemon:event:click:7"]);
  });

  test("a miss after switching to the daemon surface and back answers stale-target on the source surface", () => {
    const v = vessel();
    v.setActive(DAEMON);
    expect(v.leg.sendDomEvent(DAEMON, "8", "click", { button: 0 })).toBe("routed");
    v.setActive("lares");
    v.wiki.rerender(["21", "22"]);   // the wiki re-rendered on its return: ids 7 and 9 retired
    // A late event from the earlier wiki frame names id 7, which the DAEMON still holds live.
    expect(v.leg.sendDomEvent("lares", "7", "click", { button: 0 })).toBe("routed");
    expect(v.wiki.log).toEqual(["lares:stale-target:7"]);
    expect(v.daemon.log).toEqual(["daemon:event:click:8"]);   // the daemon's live node 7 never fired
    // The text half routes the same way.
    expect(v.leg.sendDomInput("lares", "9", "input", "typed")).toBe("routed");
    expect(v.wiki.log).toEqual(["lares:stale-target:7", "lares:stale-target:9"]);
    expect(v.leg.sendDomInput("lares", "21", "input", "typed")).toBe("routed");
    expect(v.wiki.log.at(-1)).toBe("lares:input:input:21");
  });

  test("a surface this vessel does not hold refuses by name and posts nothing", () => {
    const v = vessel();
    expect(v.leg.sendDomEvent("elsewhere", "7", "click", {})).toBe("surface-unknown");
    expect(v.leg.sendDomInput("", "7", "input", "x")).toBe("surface-unknown");
    expect(v.refusals).toHaveLength(2);
    expect(v.refusals[0]).toMatch(/surface-unknown: click for render-id 7 names surface "elsewhere"/);
    expect(v.wiki.log).toEqual([]);
    expect(v.daemon.log).toEqual([]);
  });
});
