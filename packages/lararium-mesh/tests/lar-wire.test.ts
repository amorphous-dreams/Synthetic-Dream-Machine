/**
 * lar-wire — the camera's kinds ride the island wire, and the pool carries them both ways.
 *
 * Proven here:
 *   · `lar:control-event` and `lar:resend` pass the vessel → island door; a control event reads through the
 *     contract's own reader, so two targets, an unknown crossing or an unbounded whole value refuse there;
 *   · `lar:frame`, `lar:control-result` and `lar:service` pass the island → vessel door, each read whole, and a
 *     malformed one refuses;
 *   · `placeControlEvent` posts the event whole to the slot's worker and drops on a cooled slot;
 *     `resendProjection` posts `lar:resend` for the camera it names;
 *   · the island's answers reach the vessel's handler through the pool's own gate;
 *   · the session contract's surface kinds read the `lar:` names and the contract's own fields.
 */
import { describe, test, expect, expectTypeOf } from "vitest";
import {
  LAR_CONTROL_EVENT, LAR_CONTROL_RESULT, LAR_FRAME, LAR_RESEND, LAR_SERVICE, LAR_WHOLE_VALUE_MAX_CHARS,
  mkLarControlEvent, mkLarControlResult, mkLarFrame, mkLarResend, mkLarService,
  type LarMsg_ControlEvent, type LarMsg_ControlResult, type LarMsg_Frame,
} from "../src/lar-camera.js";
import { isIslandToVesselMsg, isVesselToIslandMsg, mkEa, mkTeardownAck } from "../src/island-protocol.js";
import { VesselIslandPoolCore } from "../src/vessel-island-pool-core.js";
import type { VesselIslandHost, VesselWorkerHandle } from "../src/vessel-host.js";
import type { WikiMountSpec } from "../src/wiki-recipe.js";
import type { SessionMessage } from "../src/session-contract.js";

const act = (): LarMsg_ControlEvent => mkLarControlEvent({
  eventId: "e1", cameraId: "lar:story", mountEpoch: 2, kind: "lar:act", renderId: "7", action: "lar:click", seenFrameRev: 3,
});
const frame = (): LarMsg_Frame => mkLarFrame({
  wikiUri: "lar:///ha.ka.ba/wikis/table", cameraId: "lar:story", mountEpoch: 2,
  keys: [{ key: "lar:surface", rev: 41, html: "<p>whole</p>" }, { key: "lar:membership", rev: 3, members: ["lar:surface"] }],
  sensedRevision: { "character.level": 8 },
});
const result = (): LarMsg_ControlResult => mkLarControlResult({ eventId: "e1", cameraId: "lar:story", mountEpoch: 2, status: "applied" });

describe("the vessel → island door", () => {
  test("a control event passes; CONTROL: two targets, an unknown crossing, an unbounded value, a nonsense kind refuse", () => {
    expect(isVesselToIslandMsg(act())).toBe(true);
    expect(isVesselToIslandMsg({ ...act(), controlId: "c" })).toBe(false);
    expect(isVesselToIslandMsg({ ...act(), kind: "lar:keystroke" })).toBe(false);
    expect(isVesselToIslandMsg({ ...act(), wholeValue: "x".repeat(LAR_WHOLE_VALUE_MAX_CHARS + 1) })).toBe(false);
    expect(isVesselToIslandMsg({ ...act(), wholeValue: "x".repeat(LAR_WHOLE_VALUE_MAX_CHARS) })).toBe(true);
    expect(isVesselToIslandMsg({ ...act(), type: "lar:control-evnet" })).toBe(false);
  });

  test("a resend passes; CONTROL: a resend that names no camera refuses", () => {
    expect(isVesselToIslandMsg(mkLarResend())).toBe(true);
    expect(isVesselToIslandMsg({ type: LAR_RESEND, cameraId: "" })).toBe(false);
    expect(isVesselToIslandMsg({ type: LAR_RESEND })).toBe(false);
  });

  test("CONTROL: the DOM relay kinds pass no door", () => {
    expect(isVesselToIslandMsg({ type: "wiki:dom-event", renderId: "1", eventType: "click", fields: {} })).toBe(false);
    expect(isVesselToIslandMsg({ type: "wiki:dom-input", renderId: "1", eventType: "input", value: "hi" })).toBe(false);
  });
});

describe("the island → vessel door", () => {
  test("a frame, a control result and a service ask pass; CONTROL: each malformed refuses", () => {
    expect(isIslandToVesselMsg(frame())).toBe(true);
    expect(isIslandToVesselMsg(result())).toBe(true);
    const service = mkLarService({ wikiUri: "lar:///ha.ka.ba/wikis/table", requestId: "q1", kind: "clipboard", args: { text: "x" } });
    expect(isIslandToVesselMsg(service)).toBe(true);
    // A key with two payloads paints from two things at once; a refusal names no reason; a door the house never named.
    expect(isIslandToVesselMsg({ ...frame(), keys: [{ key: "lar:surface", rev: 1, html: "a", css: "b" }] })).toBe(false);
    expect(isIslandToVesselMsg({ ...result(), status: "refused" })).toBe(false);
    expect(isIslandToVesselMsg({ ...service, kind: "lar:http-request" })).toBe(false);
    expect(isIslandToVesselMsg({ ...service, userActivation: false })).toBe(false);
    expect(isIslandToVesselMsg({ type: "lar:frmae" })).toBe(false);
  });
});

// ── The pool ────────────────────────────────────────────────────────────────────────────────────

const NO_OFFERINGS = async () => ({ ok: true as const, pluginCids: [] });
const WIKI_ID = "lar:///ha.ka.ba/bags/test/wiki";
const spec = (): WikiMountSpec => ({ coreHash: null, recipe: { wikiSlug: "test" }, grants: { islandUrl: "automerge:fixture", wikiUrl: null } });

/** A scripted island: it breathes on its manifest, acks its teardown, and records every other post. */
function scriptedHost() {
  const listeners = new Set<(raw: unknown) => void>();
  const posted: unknown[] = [];
  const host: VesselIslandHost = {
    spawnWorker(): VesselWorkerHandle {
      return {
        post: (msg: unknown) => {
          const type = (msg as { type?: string } | null)?.type;
          if (type === "manifest") { queueMicrotask(() => { for (const l of [...listeners]) l(mkEa(WIKI_ID)); }); return; }
          if (type === "teardown") { queueMicrotask(() => { for (const l of [...listeners]) l(mkTeardownAck()); }); return; }
          posted.push(msg);
        },
        listen: (h) => { listeners.add(h); return () => { listeners.delete(h); }; },
        onError: () => () => {},
        terminate: () => {},
      };
    },
    newSyncChannel: () => { const { port1, port2 } = new MessageChannel(); return { mainPort: port1, syncPort: port2 }; },
    storage: () => undefined,
  };
  return { host, posted, reply: (msg: unknown) => { for (const l of [...listeners]) l(msg); } };
}

describe("the pool carries the camera's kinds", () => {
  test("placeControlEvent posts the event whole to the slot's worker; a cooled slot drops it", async () => {
    const island = scriptedHost();
    const pool = new VesselIslandPoolCore({ host: island.host, resolvePluginCids: NO_OFFERINGS });
    await pool.mountWiki(WIKI_ID, spec());
    pool.placeControlEvent(WIKI_ID, act());
    expect(island.posted).toEqual([act()]);
    // CONTROL: a wiki no slot holds takes nothing, and a cooled slot takes nothing.
    pool.placeControlEvent("lar:///ha.ka.ba/bags/test/absent", act());
    await pool.unmountWiki(WIKI_ID);
    expect(pool.tier(WIKI_ID)).toBe("anu");
    pool.placeControlEvent(WIKI_ID, act());
    expect(island.posted).toEqual([act()]);
    await pool.disposeAll();
  });

  test("resendProjection posts lar:resend for the camera it names; a cooled slot drops it", async () => {
    const island = scriptedHost();
    const pool = new VesselIslandPoolCore({ host: island.host, resolvePluginCids: NO_OFFERINGS });
    await pool.mountWiki(WIKI_ID, spec());
    pool.resendProjection(WIKI_ID, "lar:story");
    expect(island.posted).toEqual([{ type: LAR_RESEND, cameraId: "lar:story" }]);
    await pool.unmountWiki(WIKI_ID);
    pool.resendProjection(WIKI_ID, "lar:story");
    expect(island.posted).toHaveLength(1);
    await pool.disposeAll();
  });

  test("the island's frame, result and service ask reach the vessel's handler; CONTROL: a malformed frame never does", async () => {
    const island = scriptedHost();
    const seen: Array<[string, unknown]> = [];
    const pool = new VesselIslandPoolCore({
      host: island.host, resolvePluginCids: NO_OFFERINGS,
      onWorkerEvent: (wikiId, msg) => { seen.push([wikiId, msg]); },
    });
    await pool.mountWiki(WIKI_ID, spec());
    const service = mkLarService({ wikiUri: WIKI_ID, requestId: "q1", kind: "route", args: { to: "lar:///x" } });
    island.reply(frame());
    island.reply(result());
    island.reply(service);
    island.reply({ ...frame(), keys: [{ key: "lar:surface", rev: 1 }] });
    expect(seen.map(([, msg]) => (msg as { type: string }).type)).toEqual([LAR_FRAME, LAR_CONTROL_RESULT, LAR_SERVICE]);
    expect(seen[0]).toEqual([WIKI_ID, frame()]);
    await pool.disposeAll();
  });
});

// ── The session contract ────────────────────────────────────────────────────────────────────────

describe("the session contract's surface kinds read the lar: names", () => {
  test("lar:frame, lar:control-event and lar:control-result stand in the holder's union with the contract's fields", () => {
    type Frame = Extract<SessionMessage, { kind: typeof LAR_FRAME }>;
    type Event = Extract<SessionMessage, { kind: typeof LAR_CONTROL_EVENT }>;
    type Result = Extract<SessionMessage, { kind: typeof LAR_CONTROL_RESULT }>;
    expectTypeOf<Frame>().not.toBeNever();
    expectTypeOf<Event>().not.toBeNever();
    expectTypeOf<Result>().not.toBeNever();
    expectTypeOf<Frame["keys"]>().toEqualTypeOf<LarMsg_Frame["keys"]>();
    expectTypeOf<Frame["sensedRevision"]>().toEqualTypeOf<LarMsg_Frame["sensedRevision"]>();
    expectTypeOf<Frame["cameraId"]>().toEqualTypeOf<string>();
    expectTypeOf<Frame["mountEpoch"]>().toEqualTypeOf<number>();
    expectTypeOf<Event["event"]>().toEqualTypeOf<LarMsg_ControlEvent>();
    expectTypeOf<Result["status"]>().toEqualTypeOf<LarMsg_ControlResult["status"]>();
    expectTypeOf<Result["reason"]>().toEqualTypeOf<LarMsg_ControlResult["reason"]>();
    // CONTROL: the projection: and wiki: spellings name no member of the union.
    expectTypeOf<Extract<SessionMessage, { kind: "projection:frame" }>>().toBeNever();
    expectTypeOf<Extract<SessionMessage, { kind: "wiki:control-event" }>>().toBeNever();
    expectTypeOf<Extract<SessionMessage, { kind: "projection:control-result" }>>().toBeNever();
    // A message a holder relays carries the control event whole, beside the envelope.
    const relayed: SessionMessage = {
      kind: LAR_CONTROL_EVENT, ownerEpoch: "epoch-a", sessionId: "s", generation: 0, surfaceId: "surface-a", event: act(),
    };
    expect(relayed.kind).toBe("lar:control-event");
  });
});
