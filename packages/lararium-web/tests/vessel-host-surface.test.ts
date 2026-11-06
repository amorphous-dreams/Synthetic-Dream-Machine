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
  onPortMessage?: (binding: string, islandKey: string, msg: unknown) => void;
};

/** A stand-in vessel whose surface callbacks the case fires, and whose port doors log every place and close. */
function fakeVessel() {
  const hooks: SurfaceHooks = {};
  const placed: Array<{ surface: string; binding: string }> = [];
  const closed: string[] = [];
  const open = async (o: { idbName: string; face?: string | null } & SurfaceHooks) => {
    hooks.onFrame = o.onFrame;
    hooks.onPortMessage = o.onPortMessage;
    return {
      face: o.face ?? null,
      identity: { verifyingKey: "00".repeat(32) },
      connectionState: { getSnapshot: () => ({ status: "local" }), subscribe: () => () => undefined },
      activeWikiId: "w", wikiDocUrl: "automerge:w", oracleDocUrl: "automerge:o",
      faceProviders: { lit: async () => undefined, drop: async () => undefined },
      ports: {
        place: (surface: string, binding: string) => { placed.push({ surface, binding }); return { ok: true as const }; },
        close: (binding: string) => { closed.push(binding); },
      },
      flush: async () => undefined, close: async () => undefined,
    };
  };
  return { open, hooks, placed, closed };
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
const enter = (host: ReturnType<typeof standVesselHost>, t: ReturnType<typeof tab>, tabSession: string, idbName: string, face: string) => {
  const c = host.connect(t.scope);
  t.bind(c.receive);
  c.receive({ t: "hello", tabSession, boot: boot(idbName), face } as PageToVessel);
  return c;
};

const openOn = (binding: string): PageToVessel => ({ t: "port:place", surface: "lares", binding, msg: { type: "port:open", portId: binding } });

describe("surface traffic reaches each session over its own port", () => {
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
});
