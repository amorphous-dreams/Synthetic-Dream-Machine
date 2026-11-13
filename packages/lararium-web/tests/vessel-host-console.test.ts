/**
 * vessel-host-console — THE VESSEL WORKER'S SIDE OF THE CONSOLE DOOR (browser-vessel-lift#/the-console-door).
 *
 * The page's `lares(...)` door crosses the page's one port as a `verb` call and reads its answer off the port's own `reply`.
 * The host answers from its own table, and it answers a session that has not unlocked: a person reads what the vessel waits
 * on while it waits.
 *
 *   H1 RED   a `verb` call for `help` answers over the port while the session's unlock ask still stands unanswered, and
 *            names the vessel's own rows.
 *   H3 RED   a verb the table lacks refuses `verb-not-held` by name on the reply, and words past a held path refuse `usage`.
 *            CONTROL: the same port's `read:floor`, sent before a verb, still waits on admission after that verb answered:
 *            the door opens no other request early.
 *
 * The vessel the host lights stands in, as in vessel-host-follower.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift
 */
import { describe, expect, test } from "vitest";
import { bindFirstFaceSlot, lockFaceCustody } from "@lararium/browser";
import { standVesselHost, type VesselScope } from "../src/workers/vessel-host.js";
import type { PageToVessel, VesselBoot, VesselToPage } from "../src/vessel-protocol.js";

const ROUTE = "this face keeps its own fire";
type Reply = Extract<VesselToPage, { t: "reply" }>;

const boot = (idbName: string): VesselBoot => ({ idbName, hostId: "h", wikiId: "w", genesisSeed: "", genesisCasBaseUrl: "", daemonWorkerUrl: "about:blank", workerScriptUrl: "about:blank" } as unknown as VesselBoot);

function fakeVessel() {
  return async (o: { idbName: string; face?: string | null }) => ({
    face: o.face ?? null,
    identity: { verifyingKey: "00".repeat(32) },
    connectionState: { getSnapshot: () => ({ status: "local" }), subscribe: () => () => undefined },
    activeWikiId: "w", wikiDocUrl: "automerge:w", oracleDocUrl: "automerge:o",
    faceProviders: { lit: async () => undefined, drop: async () => undefined },
    floorStatus: async () => ({ ok: false, refusal: "floor-no-nexus", detail: "no Nexus AID is known for this hearth" }),
    flush: async () => undefined, close: async () => undefined,
  });
}

const until = async (what: string, ok: () => boolean): Promise<void> => {
  for (let i = 0; i < 400 && !ok(); i++) await new Promise((r) => setTimeout(r, 25));
  if (!ok()) throw new Error(`never: ${what}`);
};

/** One tab over one host: a face whose custody rests sealed and locked, so its hello raises an unlock ask the tab holds unanswered. */
export async function standLockedTab() {
  const idbName = `host-console-${crypto.randomUUID()}`;
  const face = `pg-console-${crypto.randomUUID()}`;
  await bindFirstFaceSlot(idbName, face, { kind: "passphrase", passphrase: ROUTE });
  lockFaceCustody(idbName, face);
  const host = standVesselHost({ locks: navigator.locks, openVessel: fakeVessel() } as never);
  const heard: VesselToPage[] = [];
  const scope: VesselScope = { postMessage(msg) { heard.push(msg); } };
  const conn = host.connect(scope);
  conn.receive({ t: "hello", tabSession: "tab-console", boot: boot(idbName), face } as PageToVessel);
  await until("the unlock ask", () => heard.some((m) => m.t === "ask"));
  const ask = heard.find((m): m is Extract<VesselToPage, { t: "ask" }> => m.t === "ask")!;
  let calls = 0;
  const verb = async (...argv: string[]): Promise<Reply> => {
    const callId = `call-${String(++calls)}`;
    conn.receive({ t: "verb", callId, argv, readFace: "http://127.0.0.1:1" } as PageToVessel);
    await until(`the reply to ${argv.join(" ")}`, () => heard.some((m) => m.t === "reply" && m.callId === callId));
    return heard.find((m): m is Reply => m.t === "reply" && m.callId === callId)!;
  };
  /** Answer the standing ask down a fresh ceremony channel, as the ceremony document would. */
  const answer = (route = ROUTE): void => {
    const rite = new MessageChannel();
    rite.port2.onmessage = (e: MessageEvent) => {
      const sent = e.data as { t: string; askId: string };
      if (sent.t !== "ask") return;
      const bytes = new TextEncoder().encode(route).buffer as ArrayBuffer;
      rite.port2.postMessage({ t: "answer", askId: sent.askId, answer: { kind: "passphrase", bytes } }, [bytes]);
    };
    conn.receive({ t: "ceremony:port", askId: ask.askId, port: rite.port1 });
  };
  return { idbName, face, heard, conn, ask, verb, answer, until };
}

describe("the vessel worker answers the console door over the page's own port", () => {
  test("H1 RED help answers while the session's unlock ask still stands, and names the vessel's own rows", async () => {
    const tab = await standLockedTab();
    const reply = await tab.verb("help");
    expect(reply.ok, "the vessel answers the door before any unlock").toBe(true);
    const help = (reply as { value: { entries: readonly { verb: string; summary: string }[] } }).value;
    expect(help.entries.length, "the vessel's table holds rows").toBeGreaterThan(0);
    for (const entry of help.entries) expect(entry.summary.length, `${entry.verb} carries its help row`).toBeGreaterThan(0);
    expect(tab.heard.some((m) => m.t === "ask:settled"), "the ask still stands").toBe(false);
  });

  test("H3 RED a verb the table lacks refuses verb-not-held, words past a path refuse usage; CONTROL: read:floor keeps its wait on admission", async () => {
    const tab = await standLockedTab();
    const lacks = await tab.verb("frobnicate");
    expect(lacks).toMatchObject({ ok: false, error: { name: "ConsoleRefused", refusal: "verb-not-held" } });
    const help = (await tab.verb("help") as { value: { entries: readonly { verb: string }[] } }).value;
    const held = help.entries[0]!.verb.split(" ");
    expect(await tab.verb(...held, "a word too many")).toMatchObject({ ok: false, error: { refusal: "usage" } });
    // CONTROL: the door opens no other request early. A floor read sent before a verb still waits on the session's admission
    // after that verb answered.
    tab.conn.receive({ t: "read:floor", callId: "floor-1", baseUrl: "http://127.0.0.1:1" });
    expect((await tab.verb("help")).ok).toBe(true);
    expect(tab.heard.some((m) => m.t === "reply" && m.callId === "floor-1"), "the floor read keeps its wait on admission").toBe(false);
  });
});
