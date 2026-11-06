/**
 * vessel-host-faces — A PRODUCTION SESSION WEARS THE FACE ITS HELLO NAMES (browser-vessel-lift slice 3's production reach).
 *
 *   HF1 RED the host reads the session's face from `hello` (the tab's own selection, a PersonaGroup): the session's first ask
 *       names that face, and the ceremony's unlock of THAT face's tree admits it; a hint grants nothing, so a wrong route
 *       admits nothing. CONTROL: a hello that names no face over a browser with no face asks nothing of any face.
 *   HF2 RED the host wires the vessel's provider door: the face's first admitted session lights its provider, and its last
 *       session's close drops it, per face.
 *   HF3 RED a fleet join acts only as the session's own face: an offer naming a face another session holds unlocked on this
 *       thread refuses `face-not-worn` before any ask or write. CONTROL: an offer naming a new face asks its first bind,
 *       naming that face.
 *   HF4 RED the keys a join seats belong to its session: the new face's key the join bound drops when that session closes,
 *       while a sibling session of the session's own face keeps the vessel up. CONTROL: the sibling's own face stays held.
 *
 * The vessel the host lights stands in for the real one (`VesselHostEnv.openVessel`), so the cases read the host's wiring
 * alone; faces and secrets stay synthetic, over scratch stores.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift
 */
import { describe, expect, test } from "vitest";
import { bindFirstFaceSlot, faceCustodyHeld, lockFaceCustody } from "@lararium/browser";
import { standVesselHost, type VesselScope } from "../src/workers/vessel-host.js";
import type { PageToVessel, VesselBoot, VesselToPage } from "../src/vessel-protocol.js";

const SLOW = 300_000;
const ROUTE = "this face keeps its own fire";

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
  return { heard, scope, bind: (r: (msg: PageToVessel) => void) => { receive = r; }, asks: () => heard.filter((m): m is Extract<VesselToPage, { t: "ask" }> => m.t === "ask") };
}

const boot = (idbName: string): VesselBoot => ({ idbName, hostId: "h", wikiId: "w", genesisSeed: "", genesisCasBaseUrl: "", daemonWorkerUrl: "about:blank", workerScriptUrl: "about:blank" } as unknown as VesselBoot);

function fakeVessel(log: string[]) {
  return async (o: { idbName: string; face?: string | null }) => ({
    face: o.face ?? null,
    identity: { verifyingKey: "00".repeat(32) },
    connectionState: { getSnapshot: () => ({ status: "local" }), subscribe: () => () => undefined },
    activeWikiId: "w", wikiDocUrl: "automerge:w", oracleDocUrl: "automerge:o",
    faceProviders: { lit: async (f: string) => { log.push(`lit ${f}`); }, drop: async (f: string, why: string) => { log.push(`drop ${f} ${why}`); } },
    flush: async () => undefined, close: async () => { log.push("down"); },
  });
}

const until = async (what: string, ok: () => boolean): Promise<void> => {
  for (let i = 0; i < 400 && !ok(); i++) await new Promise((r) => setTimeout(r, 25));
  if (!ok()) throw new Error(`never: ${what}`);
};

describe("the host reads each session's face from its hello", () => {
  test("HF1 RED the session's ask names the hello's face, and that face's own unlock admits — CONTROL: no face asks no face", async () => {
    const idbName = `host-faces-${crypto.randomUUID()}`;
    const face = `pg-host-${crypto.randomUUID()}`;
    await bindFirstFaceSlot(idbName, face, { kind: "passphrase", passphrase: ROUTE });
    lockFaceCustody(idbName, face);
    const log: string[] = [];
    const host = standVesselHost({ locks: navigator.locks, openVessel: fakeVessel(log) } as never);
    const t = tab(ROUTE);
    const conn = host.connect(t.scope);
    t.bind(conn.receive);
    conn.receive({ t: "hello", tabSession: "tab-1", boot: boot(idbName), face } as PageToVessel);
    await until("an ask", () => t.asks().length > 0);
    expect(t.asks()[0], "the session's first ask names the face its hello named").toMatchObject({ kind: "unlock", face });
    // barrier: the face's provider lit, the far side of the admission
    await until("the face lit", () => log.includes(`lit ${face}`));
    expect(t.heard.some((m) => m.t === "ended"), "the face's own unlock admitted the session").toBe(false);

    const wrong = tab("not this face's route");
    const other = standVesselHost({ locks: navigator.locks, openVessel: fakeVessel([]) } as never);
    const idb2 = `host-faces-wrong-${crypto.randomUUID()}`;
    const face2 = `pg-host-${crypto.randomUUID()}`;
    await bindFirstFaceSlot(idb2, face2, { kind: "passphrase", passphrase: ROUTE });
    lockFaceCustody(idb2, face2);
    const c2 = other.connect(wrong.scope);
    wrong.bind(c2.receive);
    c2.receive({ t: "hello", tabSession: "tab-2", boot: boot(idb2), face: face2 } as PageToVessel);
    // barrier: the host names the session's end
    await until("the wrong route ends", () => wrong.heard.some((m) => m.t === "ended"));
    expect(wrong.asks().every((a) => a.face === face2), "a hint grants nothing: every ask still names the face").toBe(true);
    expect(wrong.heard.find((m) => m.t === "ended"), "a wrong route admits nothing").toMatchObject({ stage: "custody" });

    const none = tab(ROUTE);
    const third = standVesselHost({ locks: navigator.locks, openVessel: fakeVessel([]) } as never);
    const c3 = third.connect(none.scope);
    none.bind(c3.receive);
    c3.receive({ t: "hello", tabSession: "tab-3", boot: boot(`host-faces-none-${crypto.randomUUID()}`) } as PageToVessel);
    // barrier: the greeting answers the hello
    await until("the greeting", () => none.heard.some((m) => m.t === "greeting"));
    await until("the vessel status", () => none.heard.some((m) => m.t === "status" && m.status.vessel !== undefined));
    expect(none.asks().filter((a) => a.face !== null), "CONTROL: a hello with no face over no face asks no face").toEqual([]);
  }, SLOW);

  test("HF2 RED the face's first admitted session lights its provider, and its last drops it", async () => {
    const idbName = `host-providers-${crypto.randomUUID()}`;
    const face = `pg-host-${crypto.randomUUID()}`;
    await bindFirstFaceSlot(idbName, face, { kind: "passphrase", passphrase: ROUTE });
    lockFaceCustody(idbName, face);
    const log: string[] = [];
    const host = standVesselHost({ locks: navigator.locks, openVessel: fakeVessel(log) } as never);
    const a = tab(ROUTE), b = tab(ROUTE);
    const ca = host.connect(a.scope), cb = host.connect(b.scope);
    a.bind(ca.receive); b.bind(cb.receive);
    ca.receive({ t: "hello", tabSession: "tab-a", boot: boot(idbName), face } as PageToVessel);
    await until("A lit", () => log.includes(`lit ${face}`));
    cb.receive({ t: "hello", tabSession: "tab-b", boot: boot(idbName), face } as PageToVessel);
    await until("B admitted", () => b.heard.some((m) => m.t === "status" && m.status.vessel !== undefined));
    expect(log.filter((l) => l.startsWith("lit")), "one provider per face: the second session lights none").toEqual([`lit ${face}`]);
    ca.receive({ t: "page:life", life: "pagehide" });
    // barrier: B still reads its vessel's status after A's close
    await until("A closed", () => log.length > 1 || a.heard.length > 0);
    expect(log.some((l) => l.startsWith("drop")), "a sibling session keeps the face lit").toBe(false);
    cb.receive({ t: "page:life", life: "pagehide" });
    await until("the face dropped", () => log.some((l) => l.startsWith(`drop ${face}`)));
    expect(log.indexOf(`drop ${face} pagehide`), "the face's last session drops its provider").toBeGreaterThan(log.indexOf(`lit ${face}`));
  }, SLOW);
});

describe("a fleet join acts as the session's own face", () => {
  const offerNaming = (group: string): string => JSON.stringify({ personaGroup: group, not: "a whole offer" });
  const replyOf = (t: ReturnType<typeof tab>, callId: string) => t.heard.find((m): m is Extract<VesselToPage, { t: "reply" }> => m.t === "reply" && m.callId === callId);

  test("HF3 RED an offer naming another session's face refuses face-not-worn — CONTROL: a new face asks its first bind", async () => {
    const idbName = `host-join-${crypto.randomUUID()}`;
    const a = `pg-host-a-${crypto.randomUUID()}`, b = `pg-host-b-${crypto.randomUUID()}`;
    await bindFirstFaceSlot(idbName, a, { kind: "passphrase", passphrase: ROUTE });
    lockFaceCustody(idbName, a);
    // B stands bound and unlocked on this thread, as another session of B would hold it.
    await bindFirstFaceSlot(idbName, b, { kind: "passphrase", passphrase: "B's own fire" });
    const host = standVesselHost({ locks: navigator.locks, openVessel: fakeVessel([]) } as never);
    const t = tab(ROUTE);
    const c = host.connect(t.scope);
    t.bind(c.receive);
    c.receive({ t: "hello", tabSession: "tab-a", boot: boot(idbName), face: a } as PageToVessel);
    await until("A admitted", () => t.heard.some((m) => m.t === "status" && m.status.vessel !== undefined));
    const asksBefore = t.asks().length;
    c.receive({ t: "join:offer", callId: "join-b", text: offerNaming(b), abandonPending: true });
    // barrier: the host's reply to the join
    await until("the join's reply", () => replyOf(t, "join-b") !== undefined);
    expect(replyOf(t, "join-b"), "A's session joins no face it does not wear").toMatchObject({ ok: false, error: { refusal: "face-not-worn" } });
    expect(t.asks().length, "and asks nothing for it").toBe(asksBefore);

    const n = `pg-host-new-${crypto.randomUUID()}`;
    c.receive({ t: "join:offer", callId: "join-n", text: offerNaming(n), abandonPending: false });
    await until("the new face's reply", () => replyOf(t, "join-n") !== undefined);
    expect(t.asks().slice(asksBefore), "CONTROL: a new face asks its first bind, naming that face").toMatchObject([{ kind: "bind-first", face: n }]);
  }, SLOW);

  test("HF4 RED the new face's key a join bound drops with its session — CONTROL: the sibling's own face stays held", async () => {
    const idbName = `host-join-keys-${crypto.randomUUID()}`;
    const a = `pg-host-a-${crypto.randomUUID()}`;
    await bindFirstFaceSlot(idbName, a, { kind: "passphrase", passphrase: ROUTE });
    lockFaceCustody(idbName, a);
    const host = standVesselHost({ locks: navigator.locks, openVessel: fakeVessel([]) } as never);
    const t1 = tab(ROUTE), t2 = tab(ROUTE);
    const c1 = host.connect(t1.scope), c2 = host.connect(t2.scope);
    t1.bind(c1.receive); t2.bind(c2.receive);
    c1.receive({ t: "hello", tabSession: "tab-1", boot: boot(idbName), face: a } as PageToVessel);
    await until("1 admitted", () => t1.heard.some((m) => m.t === "status" && m.status.vessel !== undefined));
    c2.receive({ t: "hello", tabSession: "tab-2", boot: boot(idbName), face: a } as PageToVessel);
    await until("2 admitted", () => t2.heard.some((m) => m.t === "status" && m.status.vessel !== undefined));
    const n = `pg-host-new-${crypto.randomUUID()}`;
    c1.receive({ t: "join:offer", callId: "join-n", text: offerNaming(n), abandonPending: false });
    await until("the join's reply", () => replyOf(t1, "join-n") !== undefined);
    expect(faceCustodyHeld(idbName, n), "the join bound the new face's tree in this session").toBe(true);
    c1.receive({ t: "page:life", life: "pagehide" });
    // barrier: the new face's key reads dropped, the far side of the session's close
    let dropped = true;
    try { await until("the join's key dropped", () => !faceCustodyHeld(idbName, n)); } catch { dropped = false; }
    expect(dropped, "the key a join seated drops with its session").toBe(true);
    expect(faceCustodyHeld(idbName, a), "CONTROL: the sibling's own face stays held").toBe(true);
  }, SLOW);
});
