/**
 * vessel-host-follower — A FOLLOWER TAB OPENS ITS OWN SESSION OVER A BROKERED PORT (browser-vessel-lift slice 4, the floor).
 *
 * On the floor one tab's dedicated vessel worker owns the store. A second tab claims a port through the broker; the owner's
 * page hears the want and asks its own vessel worker to mint one (`port:want{wantId, tabSession}`); the host mints a
 * MessageChannel, connects one end as a fresh connection (a session of its own, opened only by that tab's `hello`), and hands
 * the other end to the owner's page (`port:minted{wantId, port}`), which offers it to the broker unread. Every tab carries a
 * live session (the 2026-11-06 ruling): the follower's session keeps its own unlock through its own ceremony door, and its
 * ceremony's answer bytes travel on the ceremony's own port, never through the broker.
 *
 *   FB4 RED   the follower's hello over the minted port opens a session of its own (a greeting naming a sessionId the
 *             owner's session does not hold); its ask names its face and reaches the follower alone; its own ceremony
 *             (its port handed through the broker's ceremony routes) admits it; and nothing the broker saw carries an
 *             `answer` or an ArrayBuffer.
 *   FB4b RED  the follower's own unlock decides it: a wrong route ends the follower's session (`ended`, stage custody) while
 *             the owner's session stands. CONTROL: a want on a connection with no hello mints nothing
 *             (`port:minted{refused: "session-unadmitted"}`).
 *
 * The broker stands as its real served bytes (fixtures/broker-scope.ts); the vessel the host lights stands in, as in
 * vessel-host-faces.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift
 */
import { describe, expect, test } from "vitest";
import { bindFirstFaceSlot, lockFaceCustody } from "@lararium/browser";
import { standVesselHost, type VesselScope } from "../src/workers/vessel-host.js";
import type { PageToVessel, VesselBoot, VesselToPage } from "../src/vessel-protocol.js";
import { client, standBroker } from "./fixtures/broker-scope.js";

const SLOW = 300_000;
const ROUTE = "this face keeps its own fire";

type Ask = Extract<VesselToPage, { t: "ask" }>;
type Minted = { t: "port:minted"; wantId: string; port?: MessagePort; refused?: string };

/** The owner's tab: its ceremony answers each ask directly down a fresh channel (its own door, unbrokered here). */
function ownerTab(route: string) {
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
  return { heard, scope, bind: (r: (msg: PageToVessel) => void) => { receive = r; } };
}

const boot = (idbName: string): VesselBoot => ({ idbName, hostId: "h", wikiId: "w", genesisSeed: "", genesisCasBaseUrl: "", daemonWorkerUrl: "about:blank", workerScriptUrl: "about:blank" } as unknown as VesselBoot);

function fakeVessel() {
  return async (o: { idbName: string; face?: string | null }) => ({
    face: o.face ?? null,
    identity: { verifyingKey: "00".repeat(32) },
    connectionState: { getSnapshot: () => ({ status: "local" }), subscribe: () => () => undefined },
    activeWikiId: "w", wikiDocUrl: "automerge:w", oracleDocUrl: "automerge:o",
    faceProviders: { lit: async () => undefined, drop: async () => undefined },
    flush: async () => undefined, close: async () => undefined,
  });
}

const until = async (what: string, ok: () => boolean): Promise<void> => {
  for (let i = 0; i < 400 && !ok(); i++) await new Promise((r) => setTimeout(r, 25));
  if (!ok()) throw new Error(`never: ${what}`);
};

/** True when `v` carries an `answer` key or binary bytes anywhere in its structure. */
const carriesAnswer = (v: unknown, depth = 0): boolean => {
  if (depth > 8 || v === null || typeof v !== "object") return false;
  if (v instanceof ArrayBuffer || ArrayBuffer.isView(v)) return true;
  if (v instanceof MessagePort) return false;
  return Object.entries(v).some(([k, x]) => k === "answer" || carriesAnswer(x, depth + 1));
};

/**
 * Stand the floor: an owner admitted on its own connection; a follower whose page claims through the real broker, whose
 * owner page asks its vessel worker for a port and offers it, and whose ceremony port rides the broker's ceremony routes.
 */
async function standFloor(followerRoute: string) {
  const idbName = `host-follower-${crypto.randomUUID()}`;
  const face = `pg-follow-${crypto.randomUUID()}`;
  await bindFirstFaceSlot(idbName, face, { kind: "passphrase", passphrase: ROUTE });
  lockFaceCustody(idbName, face);
  const host = standVesselHost({ locks: navigator.locks, openVessel: fakeVessel() } as never);

  const owner = ownerTab(ROUTE);
  const oc = host.connect(owner.scope);
  owner.bind(oc.receive);
  oc.receive({ t: "hello", tabSession: "tab-owner", boot: boot(idbName), face } as PageToVessel);
  await until("the owner admitted", () => owner.heard.some((m) => m.t === "status" && m.status.vessel !== undefined));

  const ownerWin = client("lead", "/"), followerWin = client("follow", "/"), ceremonyWin = client("rite", "/ceremony.html");
  const broker = standBroker([ownerWin, followerWin, ceremonyWin]);

  // The follower claims; the owner's page hears the want and asks its own vessel worker to mint the follower's port.
  await broker.send(followerWin, { t: "vessel:claim", tabSession: "tab-follower" });
  const want = ownerWin.posted.map((p) => p.msg as { t?: string; claimId?: string }).find((m) => m.t === "vessel:want");
  expect(want?.claimId, "the owner's window hears the follower's want").toBeTypeOf("string");
  oc.receive({ t: "port:want", wantId: want!.claimId!, tabSession: "tab-follower" } as unknown as PageToVessel);
  await until("port:minted", () => owner.heard.some((m) => (m as { t: string }).t === "port:minted"));
  const minted = owner.heard.find((m) => (m as { t: string }).t === "port:minted") as unknown as Minted;
  expect(minted.port, "the host hands the owner's page the follower's end").toBeInstanceOf(MessagePort);
  await broker.send(ownerWin, { t: "vessel:offer", claimId: want!.claimId }, [minted.port!]);
  const handed = followerWin.posted.find((p) => (p.msg as { t?: string }).t === "vessel:port");
  expect(handed?.ports.length, "the broker hands the follower its port").toBe(1);

  // The follower's page speaks to the vessel over its brokered port; its own ceremony answers each ask.
  const port = handed!.ports[0]!;
  const heard: VesselToPage[] = [];
  port.onmessage = (e: MessageEvent) => {
    const msg = e.data as VesselToPage;
    heard.push(msg);
    if (msg.t !== "ask") return;
    const rite = new MessageChannel();
    port.postMessage({ t: "ceremony:port", askId: msg.askId, port: rite.port1 }, [rite.port1]);
    void (async () => {
      await broker.send(followerWin, { t: "ceremony:offer", askId: msg.askId }, [rite.port2]);
      await broker.send(ceremonyWin, { t: "ceremony:claim", askId: msg.askId });
      const got = ceremonyWin.posted.find((p) => (p.msg as { t?: string; askId?: string }).t === "ceremony:port" && (p.msg as { askId?: string }).askId === msg.askId);
      const door = got!.ports[0]!;
      door.onmessage = (ev: MessageEvent) => {
        const ask = ev.data as { t: string; askId: string };
        if (ask.t !== "ask") return;
        const bytes = new TextEncoder().encode(followerRoute).buffer as ArrayBuffer;
        door.postMessage({ t: "answer", askId: ask.askId, answer: { kind: "passphrase", bytes } }, [bytes]);
      };
    })();
  };
  port.postMessage({ t: "hello", tabSession: "tab-follower", boot: boot(idbName), face });
  return { face, owner, follower: { heard, asks: () => heard.filter((m): m is Ask => m.t === "ask") }, broker };
}

describe("a follower tab opens its own session over a brokered port", () => {
  test("FB4 RED the follower's own session, its own ask, its own ceremony; the broker sees no answer bytes", async () => {
    const { face, owner, follower, broker } = await standFloor(ROUTE);
    await until("the follower's greeting", () => follower.heard.some((m) => m.t === "greeting"));
    const ownerGreeting = owner.heard.find((m): m is Extract<VesselToPage, { t: "greeting" }> => m.t === "greeting")!;
    const followerGreeting = follower.heard.find((m): m is Extract<VesselToPage, { t: "greeting" }> => m.t === "greeting")!;
    expect(followerGreeting.sessionId, "the follower's session stands its own").not.toBe(ownerGreeting.sessionId);
    const ownerAsks = owner.heard.filter((m) => m.t === "ask").length;
    await until("the follower's ask", () => follower.asks().length > 0);
    expect(follower.asks()[0], "the follower's ask names its face").toMatchObject({ kind: "unlock", face });
    // barrier: the follower's admitted status, the far side of its own ceremony's answer
    await until("the follower admitted", () => follower.heard.some((m) => m.t === "status" && m.status.vessel !== undefined));
    expect(follower.heard.some((m) => m.t === "ended"), "its own unlock admitted it").toBe(false);
    expect(owner.heard.filter((m) => m.t === "ask").length, "the owner's tab hears none of the follower's asks").toBe(ownerAsks);
    const kinds = broker.seen.map((m) => (m as { t?: string }).t);
    expect(kinds, "the broker brokered both the vessel port and the ceremony port").toEqual(expect.arrayContaining(["vessel:claim", "vessel:offer", "ceremony:offer", "ceremony:claim"]));
    expect(broker.seen.filter((m) => carriesAnswer(m)), "nothing the broker saw carries the ceremony's answer").toEqual([]);
  }, SLOW);

  test("FB4b RED a wrong route ends the follower alone — CONTROL: a want before hello mints nothing", async () => {
    const { owner, follower } = await standFloor("not this face's route");
    // barrier: the host names the follower's end
    await until("the follower ends", () => follower.heard.some((m) => m.t === "ended"));
    expect(follower.heard.find((m) => m.t === "ended"), "the follower's own unlock refuses it").toMatchObject({ stage: "custody" });
    expect(owner.heard.some((m) => m.t === "ended"), "the owner's session stands").toBe(false);

    const host = standVesselHost({ locks: navigator.locks, openVessel: fakeVessel() } as never);
    const bare = ownerTab(ROUTE);
    const c = host.connect(bare.scope);
    bare.bind(c.receive);
    c.receive({ t: "port:want", wantId: "w1", tabSession: "tab-x" } as unknown as PageToVessel);
    await until("the refusal", () => bare.heard.some((m) => (m as { t: string }).t === "port:minted"));
    const refused = bare.heard.find((m) => (m as { t: string }).t === "port:minted") as unknown as Minted;
    expect(refused, "CONTROL: a want with no admitted session mints nothing").toMatchObject({ wantId: "w1", refused: "session-unadmitted" });
    expect(refused.port).toBeUndefined();
  }, SLOW);
});
