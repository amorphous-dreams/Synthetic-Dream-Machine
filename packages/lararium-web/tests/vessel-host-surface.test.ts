/**
 * vessel-host-surface — SURFACE TRAFFIC REACHES EACH SESSION OVER ITS OWN PORT (browser-vessel-lift slice 4, every tab its
 * own session, the 2026-11-06 ruling).
 *
 * The host once sent surface traffic (frames, phases, rest, coherence, port messages) to ONE surface session, so a second
 * tab's mirror never painted. Now the vessel's surface reaches every admitted session that wears the face the lit vessel
 * boots (THE FACE CHECK: `session.face === litVessel.face`); a session wearing another face, or one not yet admitted, hears
 * none of it. Port traffic (the mirror's road) rides its binding: a binding belongs to the session whose `port:place`
 * opened it, its replies reach that session alone, and another session's place on it refuses `binding-not-owned`.
 *
 *   SV1 RED  two admitted sessions of the lit face each hear the vessel's frame over their own port; each hears its OWN
 *            binding's port traffic and never the other's; a place on the other's binding refuses `binding-not-owned` and
 *            reaches no vessel port. CONTROL: an admitted session of ANOTHER face hears no frame and no port traffic of the
 *            lit face (the face check), and a session greeted but not yet admitted hears no frame.
 *   SV2 RED  a session that closes (pagehide) hears no frame after its close, and its bindings close at the vessel; its loss
 *            frees nothing of the other's: the survivor still hears frames and its own binding's traffic, and its binding
 *            stays open at the vessel. CONTROL: before the close both sessions hear the frame.
 *   SV6 RED  a session admitted for ANOTHER face acts on nothing of the lit face: its control event, its surface switch, its
 *            place and its mirror read never reach the vessel, and the place and the read refuse `face-not-worn` by name.
 *            CONTROL: the same four acts from the lit face's session reach the vessel.
 *   SV7 RED  a control event naming an eventId another session's event still holds pending refuses and never reaches the
 *            vessel; the pending result returns to its own sender alone. CONTROL: the second session's own eventId reaches
 *            the vessel and its result returns to it.
 *   SV4 RED  a session admitted AFTER the vessel lit missed every frame already sent (its mirror never stands: glass-tabs
 *            e2e, the second tab): its admission hears the shown surface whole (every key at its newest, folded from the
 *            frames already sent) over its own port ALONE, under the epoch the other sessions act under; the vessel
 *            repaints nothing and moves no epoch, so no other tab's view moves. CONTROL: the lighting session hears its
 *            frames live, and a late session of ANOTHER face hears no catch-up.
 *   SV5 RED  the catch-up names the surface that shows, never the wiki behind it.
 *   SV8 RED  a session admitted while another session's act waits leaves that act answered `applied`, never
 *            `stale-target` (the golden road's W4: a second tab's arrival once re-minted the epoch under the first tab's
 *            close). CONTROL: the late session paints the current surface.
 *   SV9 RED  the fold lives no longer than the lit vessel: the face's LAST session closes (the house locks with no session
 *            left to hear a floor), the worker relights for ANOTHER face on the same surface slug, and that face's late
 *            session hears nothing of the first face's frames, nor any frame the closed vessel sends after its close.
 *            CONTROL: within the second face's own lighting a late session still catches up on its frames.
 *   SV10 RED a face admitted while another face's lock brings its vessel down keeps its light: that lock's end retires
 *            nothing of the new light, so face B's frames fan out and its late session catches up. CONTROL: the lock still
 *            takes face A's fold (B's late session hears nothing of face A).
 *   SV11 RED a light's connection events reach the sessions wearing its face alone, and its listener ends with it: a closed
 *            light's late event reaches no session of the relit vessel. CONTROL: each lit face hears its own vessel's.
 *   SV12 RED a relight's holder spawn (the page builds a dedicated worker's SharedWorker) asks the tab that lights it, never
 *            the first light's closed tab. CONTROL: the first light asks its own lighting tab.
 *
 * The vessel the host lights stands in (as in vessel-host-faces), with its surface callbacks held so a case can fire them.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift
 */
import { describe, expect, test } from "vitest";
import { bindFirstFaceSlot, lockFaceCustody } from "@lararium/browser";
import { standVesselHost, type VesselScope } from "../src/workers/vessel-host.js";
import type { PageToVessel, VesselBoot, VesselToPage } from "../src/vessel-protocol.js";

const SLOW = 300_000;
const ROUTE = "this face keeps its own fire";
const OTHER_ROUTE = "the other face keeps another";

/** One tab: it hears every message, and its ceremony answers each ask with `route` down a fresh channel. */
function tab(route: string) {
  const heard: VesselToPage[] = [];
  let receive: ((msg: PageToVessel) => void) | null = null;
  const scope: VesselScope = {
    postMessage(msg) {
      heard.push(msg);
      if (msg.t !== "ask") return;
      const channel = new MessageChannel();
      channel.port2.onmessage = (e: MessageEvent) => {
        const ask = e.data as { t: string; askId: string };
        if (ask.t !== "ask") return;
        const bytes = new TextEncoder().encode(route).buffer as ArrayBuffer;
        channel.port2.postMessage({ t: "answer", askId: ask.askId, answer: { kind: "passphrase", bytes } }, [bytes]);
      };
      queueMicrotask(() => receive?.({ t: "ceremony:port", askId: msg.askId, port: channel.port1 }));
    },
  };
  return {
    heard, scope, bind: (r: (msg: PageToVessel) => void) => { receive = r; },
    frames: () => heard.filter((m) => m.t === "frame"),
    portMsgs: () => heard.filter((m): m is Extract<VesselToPage, { t: "port-msg" }> => m.t === "port-msg"),
    admitted: () => heard.some((m) => m.t === "status" && m.status.vessel !== undefined),
  };
}

const boot = (idbName: string): VesselBoot => ({ idbName, hostId: "h", wikiId: "w", genesisSeed: "", genesisCasBaseUrl: "", daemonWorkerUrl: "about:blank", workerScriptUrl: "about:blank" } as unknown as VesselBoot);

type SurfaceHooks = {
  onFrame?: (frame: unknown) => void;
  onControlResult?: (surface: string, result: Extract<VesselToPage, { t: "control-result" }>["result"]) => void;
  onPortMessage?: (binding: string, islandKey: string, msg: unknown) => void;
};

/** A stand-in vessel whose surface callbacks the case fires, and whose port doors log every place and close. */
function fakeVessel() {
  const hooks: SurfaceHooks = {};
  const placed: Array<{ surface: string; binding: string }> = [];
  const closed: string[] = [];
  const controlEvents: string[] = [];
  const resent: string[] = [];
  const surfaces: string[] = [];
  const mirrorReads: string[] = [];
  let closes = 0;
  /** A close the case holds open: the lock stands in flight until the case lets it go. */
  let closeGate: Promise<void> | null = null;
  /** Each light's connection listeners, in light order: a case fires a closed light's own. */
  const connections: Array<Set<(state: unknown) => void>> = [];
  let shown = "w";
  /** The camera's mount epoch, as the island's camera keeps it: a resend re-mints it, and an act under another answers stale-target. */
  let epoch = 1;
  let rev = 0;
  const acts = new Map<string, { surface: string; mountEpoch: number }>();
  const open = async (o: { idbName: string; face?: string | null } & SurfaceHooks) => {
    hooks.onFrame = o.onFrame;
    hooks.onControlResult = o.onControlResult;
    hooks.onPortMessage = o.onPortMessage;
    const listeners = new Set<(state: unknown) => void>();
    connections.push(listeners);
    return {
      face: o.face ?? null,
      identity: { verifyingKey: "00".repeat(32) },
      connectionState: { getSnapshot: () => ({ status: "local" }), subscribe: (l: (state: unknown) => void) => { listeners.add(l); return () => { listeners.delete(l); }; } },
      activeWikiId: "w", wikiDocUrl: "automerge:w", oracleDocUrl: "automerge:o",
      faceProviders: { lit: async () => undefined, drop: async () => undefined },
      ports: {
        place: (surface: string, binding: string) => { placed.push({ surface, binding }); return { ok: true as const }; },
        close: (binding: string) => { closed.push(binding); },
      },
      flush: async () => undefined, close: async () => { closes++; await closeGate; },
      sendControlEvent: (surface: string, ev: { eventId: string; mountEpoch?: number }) => {
        controlEvents.push(ev.eventId);
        acts.set(ev.eventId, { surface, mountEpoch: ev.mountEpoch ?? epoch });
      },
      resend: (surface: string) => { resent.push(surface); epoch++; return { ok: true as const }; },
      activeSurface: () => shown,
      setActiveSurface: (surface: string) => { surfaces.push(surface); shown = surface; },
      mirrorInputs: (surface: string) => { mirrorReads.push(surface); return {}; },
    };
  };
  /** The camera paints the shown surface: the keys named, each under a fresh revision, under the epoch it stands in. */
  const paint = (keys: Record<string, string>): void => hooks.onFrame!({
    type: "lar:frame", surface: shown, wikiUri: "lar:///w", cameraId: "lar:story", mountEpoch: epoch, sensedRevision: {},
    keys: Object.entries(keys).map(([key, v]) => (key === "lar:style" ? { key, rev: ++rev, css: v } : { key, rev: ++rev, html: v })),
  });
  /** The camera answers one act: applied under the epoch it was made in, stale-target under any other. */
  const answer = (eventId: string): void => {
    const act = acts.get(eventId)!;
    hooks.onControlResult!(act.surface, { type: "lar:control-result", eventId, cameraId: "lar:story", mountEpoch: epoch, status: act.mountEpoch === epoch ? "applied" : "stale-target" } as never);
  };
  return { open, hooks, placed, closed, controlEvents, resent, surfaces, mirrorReads, show: (s: string) => { shown = s; }, paint, answer, epoch: () => epoch, closes: () => closes,
    holdClose: (): (() => void) => { let open = (): void => undefined; closeGate = new Promise<void>((r) => { open = r; }); return () => { closeGate = null; open(); }; },
    connections };
}

const until = async (what: string, ok: () => boolean): Promise<void> => {
  for (let i = 0; i < 400 && !ok(); i++) await new Promise((r) => setTimeout(r, 25));
  if (!ok()) throw new Error(`never: ${what}`);
};
const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 200));

/** A face bound and locked over the store, as a fresh boot finds it. */
const standFace = async (idbName: string, route: string): Promise<string> => {
  const face = `pg-surface-${crypto.randomUUID()}`;
  await bindFirstFaceSlot(idbName, face, { kind: "passphrase", passphrase: route });
  lockFaceCustody(idbName, face);
  return face;
};

/** Connect one tab and say its hello. */
const enter = (host: ReturnType<typeof standVesselHost>, t: ReturnType<typeof tab>, tabSession: string, idbName: string, face: string, extra: Partial<VesselBoot> = {}) => {
  const c = host.connect(t.scope);
  t.bind(c.receive);
  c.receive({ t: "hello", tabSession, boot: { ...boot(idbName), ...extra }, face } as PageToVessel);
  return c;
};

const openOn = (binding: string): PageToVessel => ({ t: "port:place", surface: "lares", binding, msg: { type: "port:open", portId: binding } });

describe("surface traffic reaches each session over its own port", () => {
  test("SV3 — a control result answers its sender alone", async () => {
    const idbName = `host-surface-control-${crypto.randomUUID()}`;
    const face = await standFace(idbName, ROUTE);
    const v = fakeVessel();
    const host = standVesselHost({ locks: navigator.locks, openVessel: v.open } as never);
    const a = tab(ROUTE), b = tab(ROUTE);
    const ca = enter(host, a, "tab-a", idbName, face);
    await until("A admitted", a.admitted);
    enter(host, b, "tab-b", idbName, face);
    await until("B admitted", b.admitted);

    ca.receive({ t: "control-event", surface: "lares", ev: { eventId: "evA" } } as PageToVessel);
    await until("A's control event reaches the vessel", () => v.controlEvents.includes("evA"));
    const result = (eventId: string) => ({ eventId } as Extract<VesselToPage, { t: "control-result" }>["result"]);
    const results = (t: ReturnType<typeof tab>) => t.heard.filter((m): m is Extract<VesselToPage, { t: "control-result" }> => m.t === "control-result");
    v.hooks.onControlResult!("lares", result("evA"));
    expect(results(a).map((m) => m.result.eventId)).toEqual(["evA"]);
    expect(results(b)).toEqual([]);

    v.hooks.onFrame!({ n: 1 });
    expect(a.frames()).toHaveLength(1);
    expect(b.frames()).toHaveLength(1);
    v.hooks.onControlResult!("lares", result("unknown"));
    expect(results(a).map((m) => m.result.eventId)).toEqual(["evA", "unknown"]);
    expect(results(b).map((m) => m.result.eventId)).toEqual(["unknown"]);
  }, SLOW);

  test("SV1 RED both sessions of the lit face hear the frame; each hears its own binding alone — CONTROL: another face hears nothing", async () => {
    const idbName = `host-surface-${crypto.randomUUID()}`;
    const face = await standFace(idbName, ROUTE);
    const other = await standFace(idbName, OTHER_ROUTE);
    const v = fakeVessel();
    const host = standVesselHost({ locks: navigator.locks, openVessel: v.open } as never);

    const a = tab(ROUTE), b = tab(ROUTE), g = tab(OTHER_ROUTE);
    const ca = enter(host, a, "tab-a", idbName, face);
    await until("A admitted", a.admitted);
    const cb = enter(host, b, "tab-b", idbName, face);
    await until("B admitted", b.admitted);
    enter(host, g, "tab-g", idbName, other);
    await until("G admitted (its own face, its own unlock)", g.admitted);
    expect(g.heard.some((m) => m.t === "ended"), "the other face's own unlock admitted its session").toBe(false);

    v.hooks.onFrame!({ n: 1 });
    // barrier: A hears the frame (the surface it lit)
    await until("A hears the frame", () => a.frames().length > 0);
    await until("B hears the frame over its own port", () => b.frames().length > 0);

    ca.receive(openOn("bind-a"));
    cb.receive(openOn("bind-b"));
    await until("both bindings placed", () => v.placed.length === 2);
    v.hooks.onPortMessage!("bind-a", "isle", { to: "a" });
    v.hooks.onPortMessage!("bind-b", "isle", { to: "b" });
    await until("A hears its own binding", () => a.portMsgs().some((m) => m.binding === "bind-a"));
    await until("B hears its own binding", () => b.portMsgs().some((m) => m.binding === "bind-b"));
    await settle();
    expect(a.portMsgs().map((m) => m.binding), "A never hears B's binding").toEqual(["bind-a"]);
    expect(b.portMsgs().map((m) => m.binding), "B never hears A's binding").toEqual(["bind-b"]);

    // A binding belongs to the session that opened it: B's place on A's binding reaches no vessel port.
    cb.receive(openOn("bind-a"));
    await until("B's refusal", () => b.heard.some((m) => m.t === "port:refused" && m.binding === "bind-a"));
    expect(b.heard.find((m) => m.t === "port:refused" && m.binding === "bind-a"), "a binding another session owns refuses by name").toMatchObject({ reason: "binding-not-owned" });
    expect(v.placed.filter((p) => p.binding === "bind-a"), "the refused place never reached the vessel").toHaveLength(1);

    expect(g.frames(), "CONTROL (the face check): a session of another face hears no frame of the lit face").toEqual([]);
    expect(g.portMsgs(), "CONTROL: nor any of its port traffic").toEqual([]);

    // CONTROL: a session greeted but not yet admitted hears no frame (its ceremony never answers).
    const pending = tab(ROUTE);
    const cp = host.connect({ postMessage: (msg) => { if (msg.t !== "ask") pending.heard.push(msg); } });
    cp.receive({ t: "hello", tabSession: "tab-pending", boot: boot(idbName), face } as PageToVessel);
    await until("the pending greeting", () => pending.heard.some((m) => m.t === "greeting"));
    v.hooks.onFrame!({ n: 2 });
    await until("A hears the second frame", () => a.frames().length > 1);
    await settle();
    expect(pending.frames(), "CONTROL: an unadmitted session hears no frame").toEqual([]);
    expect(g.frames(), "CONTROL: the other face still hears none").toEqual([]);
  }, SLOW);

  test("SV2 RED a closed session hears no more frames and its bindings close; the survivor loses nothing — CONTROL: both heard before", async () => {
    const idbName = `host-surface-close-${crypto.randomUUID()}`;
    const face = await standFace(idbName, ROUTE);
    const v = fakeVessel();
    const host = standVesselHost({ locks: navigator.locks, openVessel: v.open } as never);
    const a = tab(ROUTE), b = tab(ROUTE);
    const ca = enter(host, a, "tab-a", idbName, face);
    await until("A admitted", a.admitted);
    const cb = enter(host, b, "tab-b", idbName, face);
    await until("B admitted", b.admitted);
    ca.receive(openOn("bind-a"));
    cb.receive(openOn("bind-b"));
    await until("both bindings placed", () => v.placed.length === 2);

    v.hooks.onFrame!({ n: 1 });
    await until("CONTROL: A hears the frame", () => a.frames().length === 1);
    await until("CONTROL: B hears the frame", () => b.frames().length === 1);

    ca.receive({ t: "page:life", life: "pagehide" });
    await until("A's binding closes at the vessel with its session", () => v.closed.includes("bind-a"));
    v.hooks.onFrame!({ n: 2 });
    v.hooks.onPortMessage!("bind-b", "isle", { to: "b" });
    v.hooks.onPortMessage!("bind-a", "isle", { to: "a, gone" });
    await until("B hears the frame after A's close", () => b.frames().length === 2);
    await until("B hears its own binding after A's close", () => b.portMsgs().some((m) => m.binding === "bind-b"));
    await settle();
    expect(a.frames(), "a closed session hears no frame after its close").toHaveLength(1);
    expect(a.portMsgs(), "nor its gone binding's traffic").toEqual([]);
    expect(v.closed, "A's loss closes nothing of B's").not.toContain("bind-b");
  }, SLOW);

  test("SV4 RED a late session hears the shown surface whole, alone, under the held epoch — CONTROL: the lighting session and another face hear none", async () => {
    const idbName = `host-surface-late-${crypto.randomUUID()}`;
    const face = await standFace(idbName, ROUTE);
    const other = await standFace(idbName, OTHER_ROUTE);
    const v = fakeVessel();
    const host = standVesselHost({ locks: navigator.locks, openVessel: v.open } as never);
    const a = tab(ROUTE), b = tab(ROUTE), g = tab(OTHER_ROUTE);
    enter(host, a, "tab-a", idbName, face);
    await until("A admitted", a.admitted);
    v.paint({ "lar:surface": "<p>one</p>", "lar:style": "p{}" });
    v.paint({ "lar:surface": "<p>two</p>" });
    expect(a.frames(), "CONTROL: the session that lit the vessel hears its frames live").toHaveLength(2);

    enter(host, b, "tab-b", idbName, face);
    await until("B admitted", b.admitted);
    await until("B hears the shown surface over its own port", () => b.frames().length > 0);
    expect(v.resent, "a late session moves no epoch: the vessel repaints nothing").toEqual([]);
    const caught = b.frames()[0] as Extract<VesselToPage, { t: "frame" }>;
    expect(caught.frame.surface).toBe("w");
    expect(caught.frame.mountEpoch, "the catch-up rides the epoch the others act under").toBe(v.epoch());
    expect(Object.fromEntries(caught.frame.keys.map((k) => [k.key, k.html ?? k.css])), "every key whole, each at its newest").toEqual({ "lar:surface": "<p>two</p>", "lar:style": "p{}" });
    expect(a.frames(), "one tab's arrival never moves what the others show").toHaveLength(2);

    enter(host, g, "tab-g", idbName, other);
    await until("G admitted (its own face)", g.admitted);
    await settle();
    expect(g.frames(), "CONTROL: a session of another face hears no catch-up of the lit face's surface").toEqual([]);
    expect(v.resent).toEqual([]);
  }, SLOW);

  test("SV5 RED a tab joining while surface X shows catches up on X, never the wiki — CONTROL: the joining tab paints X", async () => {
    const idbName = `host-surface-shown-${crypto.randomUUID()}`;
    const face = await standFace(idbName, ROUTE);
    const v = fakeVessel();
    const host = standVesselHost({ locks: navigator.locks, openVessel: v.open } as never);
    const a = tab(ROUTE), b = tab(ROUTE);
    enter(host, a, "tab-a", idbName, face);
    await until("A admitted", a.admitted);
    v.paint({ "lar:surface": "<p>wiki</p>" });
    v.show("daemon");
    v.paint({ "lar:surface": "<p>daemon</p>" });
    enter(host, b, "tab-b", idbName, face);
    await until("B admitted", b.admitted);
    await until("CONTROL: the joining tab paints the shown surface over its own port", () => b.frames().length > 0);
    await settle();
    const surfaces = b.frames().map((m) => (m as Extract<VesselToPage, { t: "frame" }>).frame.surface);
    expect(surfaces, "the catch-up names the surface that shows, so no tab flips").toEqual(["daemon"]);
    expect(v.resent).toEqual([]);
  }, SLOW);

  test("SV8 RED a late session leaves another's waiting act applied, never stale-target — CONTROL: the late session paints", async () => {
    const idbName = `host-surface-race-${crypto.randomUUID()}`;
    const face = await standFace(idbName, ROUTE);
    const v = fakeVessel();
    const host = standVesselHost({ locks: navigator.locks, openVessel: v.open } as never);
    const a = tab(ROUTE), b = tab(ROUTE);
    const ca = enter(host, a, "tab-a", idbName, face);
    await until("A admitted", a.admitted);
    v.paint({ "lar:surface": "<p>sentinel</p>" });
    ca.receive({ t: "control-event", surface: "w", ev: { eventId: "evClose", mountEpoch: v.epoch() } } as PageToVessel);
    await until("A's close reaches the vessel", () => v.controlEvents.includes("evClose"));

    enter(host, b, "tab-b", idbName, face);
    await until("B admitted", b.admitted);
    v.answer("evClose");
    const results = a.heard.filter((m): m is Extract<VesselToPage, { t: "control-result" }> => m.t === "control-result");
    expect(results.map((m) => [m.result.eventId, m.result.status]), "A's act answers under the epoch it was made in").toEqual([["evClose", "applied"]]);
    await until("CONTROL: B paints the current surface", () => b.frames().length > 0);
  }, SLOW);

  test("SV9 RED the last close takes the fold with the vessel; a relit face hears nothing of the old — CONTROL: its own late session catches up", async () => {
    const idbName = `host-surface-relight-${crypto.randomUUID()}`;
    const faceA = await standFace(idbName, ROUTE);
    const faceB = await standFace(idbName, OTHER_ROUTE);
    const v = fakeVessel();
    const host = standVesselHost({ locks: navigator.locks, openVessel: v.open } as never);
    const a = tab(ROUTE);
    const ca = enter(host, a, "tab-a", idbName, faceA);
    await until("A admitted", a.admitted);
    v.paint({ "lar:surface": "<p>face A's own words</p>" });
    expect(a.frames(), "A hears its frame live").toHaveLength(1);
    const closedVesselFrame = v.hooks.onFrame!;

    ca.receive({ t: "page:life", life: "pagehide" });
    await until("A's last close brings the vessel down", () => v.closes() === 1);
    await settle();

    const b1 = tab(OTHER_ROUTE), b2 = tab(OTHER_ROUTE), b3 = tab(OTHER_ROUTE);
    enter(host, b1, "tab-b1", idbName, faceB);
    await until("B1 admitted (face B lights the vessel anew)", b1.admitted);
    closedVesselFrame({
      type: "lar:frame", surface: "w", wikiUri: "lar:///w", cameraId: "lar:aside", mountEpoch: 1, sensedRevision: {},
      keys: [{ key: "lar:surface", rev: 99, html: "<p>face A's late words</p>" }],
    });
    enter(host, b2, "tab-b2", idbName, faceB);
    await until("B2 admitted", b2.admitted);
    await settle();
    const said = (t: ReturnType<typeof tab>) => JSON.stringify(t.frames());
    expect(said(b2), "a late session of face B hears nothing of face A's frames").not.toContain("face A");
    expect(said(b1), "the closed vessel's late frame reaches no session of the relit vessel").not.toContain("face A");
    expect(b2.frames()).toEqual([]);

    v.paint({ "lar:surface": "<p>face B's own words</p>" });
    enter(host, b3, "tab-b3", idbName, faceB);
    await until("B3 admitted", b3.admitted);
    await until("CONTROL: a late session within face B's lighting catches up", () => b3.frames().length > 0);
    expect(said(b3)).toContain("face B's own words");
    expect(said(b3)).not.toContain("face A");
  }, SLOW);

  test("SV10 RED a face admitted while another face's lock brings its vessel down keeps its light: its frames fan out and its late session catches up — CONTROL: the lock takes the first face's fold", async () => {
    const idbName = `host-surface-lock-race-${crypto.randomUUID()}`;
    const faceA = await standFace(idbName, ROUTE);
    const faceB = await standFace(idbName, OTHER_ROUTE);
    const v = fakeVessel();
    const host = standVesselHost({ locks: navigator.locks, openVessel: v.open } as never);
    const a = tab(ROUTE);
    const ca = enter(host, a, "tab-a", idbName, faceA);
    await until("A admitted", a.admitted);
    v.paint({ "lar:surface": "<p>face A's own words</p>" });

    // A's last close runs the lock; its vessel's close stands open while face B's first tab asks.
    const letGo = v.holdClose();
    ca.receive({ t: "page:life", life: "pagehide" });
    await until("A's lock reaches its vessel's close", () => v.closes() === 1);
    const b1 = tab(OTHER_ROUTE), b2 = tab(OTHER_ROUTE);
    enter(host, b1, "tab-b1", idbName, faceB);
    // B's own unlock runs its KDF: give its admission the room to reach its light while the lock still stands (the old race).
    for (let i = 0; i < 200 && v.connections.length < 2; i++) await new Promise((r) => setTimeout(r, 25));
    letGo();
    await until("B1 admitted", b1.admitted);
    await settle();

    const said = (t: ReturnType<typeof tab>) => JSON.stringify(t.frames());
    v.paint({ "lar:surface": "<p>face B's own words</p>" });
    expect(said(b1), "the lock that closed face A's vessel leaves face B's light standing: B's frame fans out").toContain("face B's own words");
    enter(host, b2, "tab-b2", idbName, faceB);
    await until("B2 admitted", b2.admitted);
    await until("B2 catches up on face B's frames", () => b2.frames().length > 0);
    expect(said(b2)).toContain("face B's own words");
    expect(said(b2), "CONTROL: face A's fold left with its lock").not.toContain("face A");
  }, SLOW);

  test("SV11 RED a light's connection events reach its own face's sessions alone and end with it — CONTROL: the lit face hears its own", async () => {
    const idbName = `host-surface-connection-${crypto.randomUUID()}`;
    const faceA = await standFace(idbName, ROUTE);
    const faceB = await standFace(idbName, OTHER_ROUTE);
    const v = fakeVessel();
    const host = standVesselHost({ locks: navigator.locks, openVessel: v.open } as never);
    const connectionsHeard = (t: ReturnType<typeof tab>) => t.heard.filter((m) => m.t === "status" && m.status.vessel === undefined && m.status.connection !== undefined).map((m) => JSON.stringify(m.t === "status" ? m.status.connection : null));
    const a = tab(ROUTE), g = tab(OTHER_ROUTE);
    const ca = enter(host, a, "tab-a", idbName, faceA);
    await until("A admitted", a.admitted);
    const cg = enter(host, g, "tab-g", idbName, faceB);
    await until("G admitted (its own face, its own unlock)", g.admitted);
    for (const l of v.connections[0]!) l({ status: "a-live" });
    expect(connectionsHeard(a), "CONTROL: the lit face hears its own vessel's connection").toEqual([JSON.stringify({ status: "a-live" })]);
    expect(connectionsHeard(g), "a session wearing another face hears none of the lit face's connection").toEqual([]);

    const firstLight = [...v.connections[0]!];
    ca.receive({ t: "page:life", life: "pagehide" });
    cg.receive({ t: "page:life", life: "pagehide" });
    await until("the last close brings face A's vessel down", () => v.closes() === 1);
    await settle();
    expect(v.connections[0]!.size, "the lock ends the closed light's connection listener").toBe(0);
    const b1 = tab(OTHER_ROUTE);
    enter(host, b1, "tab-b1", idbName, faceB);
    await until("B1 admitted (face B lights anew)", b1.admitted);
    for (const l of firstLight) l({ status: "a-late" });
    expect(connectionsHeard(b1), "the closed light's late connection event reaches no session of the relit vessel").toEqual([]);
    for (const l of v.connections[1]!) l({ status: "b-live" });
    expect(connectionsHeard(b1), "CONTROL: face B hears its own vessel's connection").toEqual([JSON.stringify({ status: "b-live" })]);
  }, SLOW);

  test("SV12 RED a relight's holder spawn asks its own lighting tab, never the first light's — CONTROL: the first light asks its own", async () => {
    const idbName = `host-surface-holder-${crypto.randomUUID()}`;
    const faceA = await standFace(idbName, ROUTE);
    const faceB = await standFace(idbName, OTHER_ROUTE);
    const v = fakeVessel();
    // The vessel's holder door builds its SharedWorker as a dedicated worker would: with none native, the host's page-built one.
    const open = async (o: Parameters<typeof v.open>[0] & { sharedHolderUrl?: URL }) => {
      const r = await v.open(o);
      if (o.sharedHolderUrl) new (globalThis as unknown as { SharedWorker: new (u: URL, x: { name: string }) => unknown }).SharedWorker(o.sharedHolderUrl, { name: "holder" });
      return r;
    };
    const native = (globalThis as { SharedWorker?: unknown }).SharedWorker;
    (globalThis as { SharedWorker?: unknown }).SharedWorker = undefined;
    try {
      const host = standVesselHost({ locks: navigator.locks, openVessel: open } as never);
      const holder = { sharedHolderUrl: "https://holder.synthetic/holder.js" } as Partial<VesselBoot>;
      const spawnsTo = (t: ReturnType<typeof tab>) => t.heard.filter((m) => m.t === "spawn").length;
      const a = tab(ROUTE);
      const ca = enter(host, a, "tab-a", idbName, faceA, holder);
      await until("A admitted", a.admitted);
      expect(spawnsTo(a), "CONTROL: the first light's holder spawn asks its own lighting tab").toBe(1);
      ca.receive({ t: "page:life", life: "pagehide" });
      await until("A's last close brings the vessel down", () => v.closes() === 1);
      await settle();
      const b1 = tab(OTHER_ROUTE);
      enter(host, b1, "tab-b1", idbName, faceB, holder);
      await until("B1 admitted (face B lights anew)", b1.admitted);
      expect(spawnsTo(b1), "the relight's holder spawn asks the tab that lights it").toBe(1);
      expect(spawnsTo(a), "the closed tab hears no second spawn").toBe(1);
    } finally {
      (globalThis as { SharedWorker?: unknown }).SharedWorker = native;
    }
  }, SLOW);

  test("SV6 RED a session of another face acts on nothing of the lit face — CONTROL: the lit face's session acts", async () => {
    const idbName = `host-surface-gate-${crypto.randomUUID()}`;
    const face = await standFace(idbName, ROUTE);
    const other = await standFace(idbName, OTHER_ROUTE);
    const v = fakeVessel();
    const host = standVesselHost({ locks: navigator.locks, openVessel: v.open } as never);
    const a = tab(ROUTE), g = tab(OTHER_ROUTE);
    const ca = enter(host, a, "tab-a", idbName, face);
    await until("A admitted", a.admitted);
    const cg = enter(host, g, "tab-g", idbName, other);
    await until("G admitted (its own face, its own unlock)", g.admitted);
    const replyOf = (t: ReturnType<typeof tab>, callId: string) => t.heard.find((m) => m.t === "reply" && m.callId === callId);
    const refusalOf = (t: ReturnType<typeof tab>, binding: string) => t.heard.find((m) => m.t === "port:refused" && m.binding === binding);

    cg.receive({ t: "control-event", surface: "lares", ev: { eventId: "evG" } } as PageToVessel);
    cg.receive({ t: "set-surface", surface: "g-surface" } as PageToVessel);
    cg.receive(openOn("bind-g"));
    cg.receive({ t: "read:mirror-inputs", callId: "read-g", surface: "g-read" } as PageToVessel);
    await until("G's place answers", () => refusalOf(g, "bind-g") !== undefined || v.placed.some((p) => p.binding === "bind-g"));
    await until("G's mirror read answers", () => replyOf(g, "read-g") !== undefined);

    // CONTROL, and the barrier: the lit face's own four acts, sent after G's, reach the vessel.
    ca.receive({ t: "control-event", surface: "lares", ev: { eventId: "evA" } } as PageToVessel);
    ca.receive({ t: "set-surface", surface: "a-surface" } as PageToVessel);
    ca.receive(openOn("bind-a"));
    ca.receive({ t: "read:mirror-inputs", callId: "read-a", surface: "a-read" } as PageToVessel);
    await until("CONTROL: A's control event reaches the vessel", () => v.controlEvents.includes("evA"));
    await until("CONTROL: A's surface switch reaches the vessel", () => v.surfaces.includes("a-surface"));
    await until("CONTROL: A's place reaches the vessel", () => v.placed.some((p) => p.binding === "bind-a"));
    await until("CONTROL: A's mirror read answers", () => replyOf(a, "read-a") !== undefined);
    expect(replyOf(a, "read-a"), "CONTROL: A's read answers ok").toMatchObject({ ok: true });
    await settle();

    expect(v.controlEvents, "G's control event never reaches the lit face's vessel").toEqual(["evA"]);
    expect(v.surfaces, "G's surface switch never moves the lit face's surface").toEqual(["a-surface"]);
    expect(v.placed.map((p) => p.binding), "G's place never reaches a vessel port").toEqual(["bind-a"]);
    expect(v.mirrorReads, "G reads no mirror input of the lit face").toEqual(["a-read"]);
    expect(refusalOf(g, "bind-g"), "G's place refuses by name").toMatchObject({ reason: "face-not-worn" });
    expect(replyOf(g, "read-g"), "G's mirror read refuses by name").toMatchObject({ ok: false, error: { refusal: "face-not-worn" } });
  }, SLOW);

  test("SV7 RED a control event naming another session's pending eventId refuses — CONTROL: its own eventId acts", async () => {
    const idbName = `host-surface-pending-${crypto.randomUUID()}`;
    const face = await standFace(idbName, ROUTE);
    const v = fakeVessel();
    const host = standVesselHost({ locks: navigator.locks, openVessel: v.open } as never);
    const a = tab(ROUTE), b = tab(ROUTE);
    const ca = enter(host, a, "tab-a", idbName, face);
    await until("A admitted", a.admitted);
    const cb = enter(host, b, "tab-b", idbName, face);
    await until("B admitted", b.admitted);
    const results = (t: ReturnType<typeof tab>) => t.heard.filter((m): m is Extract<VesselToPage, { t: "control-result" }> => m.t === "control-result").map((m) => m.result.eventId);
    const result = (eventId: string) => ({ eventId } as Extract<VesselToPage, { t: "control-result" }>["result"]);

    ca.receive({ t: "control-event", surface: "lares", ev: { eventId: "evX" } } as PageToVessel);
    await until("A's event reaches the vessel", () => v.controlEvents.includes("evX"));
    cb.receive({ t: "control-event", surface: "lares", ev: { eventId: "evX" } } as PageToVessel);
    cb.receive({ t: "control-event", surface: "lares", ev: { eventId: "evB" } } as PageToVessel);
    await until("CONTROL: B's own event reaches the vessel", () => v.controlEvents.includes("evB"));
    expect(v.controlEvents, "B's event under A's pending eventId never reaches the vessel").toEqual(["evX", "evB"]);

    v.hooks.onControlResult!("lares", result("evX"));
    v.hooks.onControlResult!("lares", result("evB"));
    expect(results(a), "A's pending result returns to A").toEqual(["evX"]);
    expect(results(b), "CONTROL: B hears its own result alone").toEqual(["evB"]);
  }, SLOW);
});
