/**
 * surface-return-leg — A CONTROL EVENT RETURNS TO THE SURFACE THAT PAINTED ITS TARGET.
 *
 * Every island counts render-ids on its own, so one id can stand in two frames. The page keeps a surface's
 * frame on screen until the next surface's first frame lands, while a switch flips the active pointer at once.
 * The leg therefore routes on the surface each event CARRIES, and the active pointer plays no part. A resend
 * routes the same way: the arriving surface's island mints a fresh epoch and paints whole.
 *
 * The fake islands below each hold their own id space and their own mount epoch, and answer the way a real
 * island does: a live id under the current epoch applies, a retired id or another epoch answers `stale-target`.
 */
import { describe, expect, test } from "vitest";
import { LAR_CAMERA_STORY, mkLarControlEvent, type LarMsg_ControlEvent } from "@lararium/mesh";
import { makeSurfaceReturnLeg } from "../src/surface-return-leg.js";

const DAEMON = "daemon";

function island(name: string, live: readonly string[]) {
  const liveIds = new Set(live);
  let epoch = 1;
  const log: string[] = [];
  return {
    log,
    epoch: () => epoch,
    /** A re-render retires every earlier id and mints fresh ones, as a surface does when it returns. */
    rerender(ids: readonly string[]) { liveIds.clear(); for (const id of ids) liveIds.add(id); },
    take(ev: LarMsg_ControlEvent) {
      const id = ev.renderId ?? ev.controlId ?? "";
      log.push(ev.mountEpoch === epoch && liveIds.has(id) ? `${name}:${ev.action}:${id}` : `${name}:stale-target:${id}`);
    },
    resend(cameraId: string) { epoch += 1; log.push(`${name}:resend:${cameraId}:epoch-${epoch}`); },
  };
}

const ev = (renderId: string, action = "lar:click", mountEpoch = 1): LarMsg_ControlEvent =>
  mkLarControlEvent({ eventId: `e-${renderId}-${action}-${mountEpoch}`, cameraId: LAR_CAMERA_STORY, mountEpoch, kind: action === "lar:sense" ? "lar:sense" : "lar:act", action, seenFrameRev: 1, renderId,
    // a sense carries the page revision it senses at; without it the contract reads it malformed
    ...(action === "lar:sense" ? { localRev: 1, wholeValue: "" } : {}) });

function vessel() {
  const daemon = island("daemon", ["7", "8"]);
  const wiki = island("lares", ["7", "9"]);        // id 7 stands on BOTH surfaces
  const refusals: string[] = [];
  const sessions: Array<string | undefined> = [];
  let active = "lares";
  const leg = makeSurfaceReturnLeg({
    daemonSurfaceId: DAEMON,
    daemon: () => ({ sendControlEvent: (e) => daemon.take(e), resend: (cameraId) => daemon.resend(cameraId) }),
    pool: () => ({
      has: (id) => id === "lares",
      placeControlEvent: (_id, e, session) => { sessions.push(session); wiki.take(e); },
      resendProjection: (_id, cameraId, session) => { sessions.push(session); wiki.resend(cameraId); },
    }),
    onRefusal: (line) => refusals.push(line),
  });
  /** What a leg that read the active pointer would do: the measured fault, kept as the control. */
  const byActivePointer = (e: LarMsg_ControlEvent): void => (active === DAEMON ? daemon.take(e) : wiki.take(e));
  return { daemon, wiki, refusals, sessions, leg, byActivePointer, setActive: (s: string) => { active = s; } };
}

describe("the return leg routes on the surface an event carries", () => {
  test("an event raised on the wiki's frame reaches the wiki after the daemon took the active pointer", () => {
    const v = vessel();
    v.setActive(DAEMON);   // the switch flipped; the pane still shows the wiki frame the person clicked
    expect(v.leg.sendControlEvent("lares", ev("7"))).toBe("routed");
    expect(v.wiki.log).toEqual(["lares:lar:click:7"]);
    expect(v.daemon.log).toEqual([]);
    // CONTROL: routed by the active pointer, the same click fires the DAEMON's node 7.
    v.byActivePointer(ev("7"));
    expect(v.daemon.log).toEqual(["daemon:lar:click:7"]);
  });

  test("a miss after switching to the daemon surface and back answers stale-target on the source surface", () => {
    const v = vessel();
    v.setActive(DAEMON);
    expect(v.leg.sendControlEvent(DAEMON, ev("8"))).toBe("routed");
    v.setActive("lares");
    v.wiki.rerender(["21", "22"]);   // the wiki re-rendered on its return: ids 7 and 9 retired
    // A late event from the earlier wiki frame names id 7, which the DAEMON still holds live.
    expect(v.leg.sendControlEvent("lares", ev("7"))).toBe("routed");
    expect(v.wiki.log).toEqual(["lares:stale-target:7"]);
    expect(v.daemon.log).toEqual(["daemon:lar:click:8"]);   // the daemon's live node 7 never fired
    // A sense routes the same way.
    expect(v.leg.sendControlEvent("lares", ev("9", "lar:sense"))).toBe("routed");
    expect(v.wiki.log.at(-1)).toBe("lares:stale-target:9");
    expect(v.leg.sendControlEvent("lares", ev("21", "lar:sense"))).toBe("routed");
    expect(v.wiki.log.at(-1)).toBe("lares:lar:sense:21");
  });

  test("a resend reaches the arriving surface's island, which mints a fresh epoch; an act under the old one answers stale-target", () => {
    const v = vessel();
    expect(v.leg.resend("lares")).toBe("routed");
    expect(v.leg.resend(DAEMON)).toBe("routed");
    expect(v.wiki.log).toEqual([`lares:resend:${LAR_CAMERA_STORY}:epoch-2`]);
    expect(v.daemon.log).toEqual([`daemon:resend:${LAR_CAMERA_STORY}:epoch-2`]);
    expect(v.leg.sendControlEvent("lares", ev("7", "lar:click", 1))).toBe("routed");
    expect(v.wiki.log.at(-1)).toBe("lares:stale-target:7");
    // CONTROL: the same act under the fresh epoch applies.
    expect(v.leg.sendControlEvent("lares", ev("7", "lar:click", 2))).toBe("routed");
    expect(v.wiki.log.at(-1)).toBe("lares:lar:click:7");
    expect(v.sessions).toEqual([undefined, undefined, undefined]);   // no session names itself on this leg yet
  });

  test("a surface this vessel does not hold refuses by name and posts nothing", () => {
    const v = vessel();
    expect(v.leg.sendControlEvent("elsewhere", ev("7"))).toBe("surface-unknown");
    expect(v.leg.sendControlEvent("", ev("7", "lar:sense"))).toBe("surface-unknown");
    expect(v.leg.resend("elsewhere")).toBe("surface-unknown");
    expect(v.refusals).toHaveLength(3);
    expect(v.refusals[0]).toMatch(/surface-unknown: lar:click for render-id 7 names surface "elsewhere"/);
    expect(v.refusals[2]).toMatch(/surface-unknown: lar:resend names surface "elsewhere"/);
    expect(v.wiki.log).toEqual([]);
    expect(v.daemon.log).toEqual([]);
  });

  test("NONSENSE CONTROL: an event the contract's reader refuses posts nowhere, whatever surface it names", () => {
    const v = vessel();
    const twoTargets = { ...ev("7"), controlId: "also" } as LarMsg_ControlEvent;
    expect(v.leg.sendControlEvent("lares", twoTargets)).toBe("event-malformed");
    expect(v.leg.sendControlEvent(DAEMON, { ...ev("7"), mountEpoch: -1 } as LarMsg_ControlEvent)).toBe("event-malformed");
    expect(v.wiki.log).toEqual([]);
    expect(v.daemon.log).toEqual([]);
    expect(v.refusals[0]).toMatch(/event-malformed/);
  });

  test("the old DOM doors left the leg whole", () => {
    const v = vessel();
    expect(Object.keys(v.leg).sort()).toEqual(["resend", "sendControlEvent"]);
  });
});
