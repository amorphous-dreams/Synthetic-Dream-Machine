/**
 * vessel-host-console — THE VESSEL WORKER'S SIDE OF THE CONSOLE DOOR (browser-vessel-lift#/the-console-door).
 *
 * The page's `lares(...)` door crosses the page's one port as a `verb` call and reads its answer off the port's own `reply`.
 * The host answers from its own table, and it answers a session that has not unlocked: a person reads what the vessel waits
 * on while it waits.
 *
 *   H1 RED   a `verb` call for `help` answers over the port while the session's unlock ask still stands unanswered, and
 *            names the vessel's own rows.
 *   H2 RED   `vessel read` while the unlock waits names the pending ask and its kind, the floor standing, the session still
 *            asking, the face's custody bound (how it rests; H5 pins what stays withheld), and the floor pin's own refusal. CONTROL: once the ask reads
 *            answered the same verb names no ask, the lit standing, the worn face and the vessel's public key; no reading
 *            carries a route.
 *   H4 RED   `vault status` answers the node's two halves: custody at rest (the place clear) and
 *            the door (this tab's session not yet unlocked). CONTROL: answered, the face reads unlocked and the door
 *            unlocked by `unlock`; no slot id and no route reads anywhere.
 *   H5 RED   A SESSION THAT HAS NOT UNLOCKED READS CUSTODY AT REST AND NOTHING THE VESSEL HOLDS OPEN NOW. Its `vessel read`
 *            and `vault status` carry exactly the fields named here: how the place and its own face rest (`reading`), the
 *            roster, the standing its hello already told it, its own asks. Neither carries an `unlocked` flag for the place
 *            or any face, the census of held sessions and keys, or the face the lit vessel wears; each names what it
 *            withholds. CONTROL: admitted, the same session reads all of them and withholds nothing.
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
import { VESSEL_PROTOCOL } from "../src/vessel-protocol.js";
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
  conn.receive({ t: "hello", protocol: VESSEL_PROTOCOL, tabSession: "tab-console", boot: boot(idbName), face } as PageToVessel);
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

  test("H2 RED vessel read names the pending ask and its kind while the unlock waits; CONTROL: answered, it names the lit standing and the worn face", async () => {
    const tab = await standLockedTab();
    const waiting = await tab.verb("vessel", "read");
    expect(waiting.ok).toBe(true);
    const at = (waiting as { value: Record<string, never> }).value as never as {
      standing: string; session: { admission: string; face: string } | null; asks: readonly { askId: string; kind: string; ceremony: string; face: string | null }[];
      custody: { face: { reading: string; unlocked?: boolean } | null }; floorPin: { ok: boolean; refusal?: string }; faces: { worn: string | null }; vessel: unknown; place: { aid: string | null; kel: string };
    };
    expect(at.asks, "the ask the vessel waits on reads by name").toEqual([{ askId: tab.ask.askId, kind: "unlock", act: "boot", face: tab.face, ceremony: "unopened" }]);
    expect(at.standing).toBe("floor");
    expect(at.session).toMatchObject({ admission: "asking", face: tab.face });
    expect(at.custody.face, "an unadmitted session reads how its face rests, never whether it stands unlocked").toEqual({ reading: "bound" });
    expect(at.floorPin).toMatchObject({ ok: false, refusal: "floor-state-unread" });
    expect(at.place).toEqual({ aid: null, kel: "unfounded" });
    expect(at.faces, "the face a lit vessel wears reaches an admitted session alone").not.toHaveProperty("worn");
    expect(at.vessel).toBeNull();

    // CONTROL: the ask answered, the same verb reads the lit vessel.
    tab.answer();
    await tab.until("the session admitted", () => tab.heard.some((m) => m.t === "status" && m.status.vessel !== undefined));
    const lit = (await tab.verb("vessel", "read") as { value: typeof at }).value;
    expect(lit.asks).toEqual([]);
    expect(lit.standing).toBe("lit");
    expect(lit.session).toMatchObject({ admission: "admitted", face: tab.face });
    expect(lit.faces.worn).toBe(tab.face);
    expect(lit.custody.face).toEqual({ reading: "bound", unlocked: true });
    expect(lit.vessel).toMatchObject({ verifyingKey: "00".repeat(32) });
    expect(lit.floorPin).toMatchObject({ ok: false, refusal: "floor-no-nexus" });
    expect(JSON.stringify(lit), "no reading carries the route").not.toContain("keeps its own fire");
  });

  test("H4 RED vault status reads custody at rest and the door, before and after the unlock, and carries no route", async () => {
    const tab = await standLockedTab();
    const locked = await tab.verb("vault", "status");
    expect(locked.ok).toBe(true);
    expect((locked as { value: unknown }).value).toMatchObject({
      custody: { place: { reading: "clear" }, faces: [] },
      door: { standing: "floor", unlocked: false, face: tab.face, admittedBy: null },
    });
    tab.answer();
    await tab.until("the session admitted", () => tab.heard.some((m) => m.t === "status" && m.status.vessel !== undefined));
    const open = (await tab.verb("vault", "status") as { value: { door: unknown } }).value;
    expect(open.door).toMatchObject({ standing: "lit", unlocked: true, admittedBy: "unlock", face: tab.face });
    expect(JSON.stringify(open)).not.toContain("keeps its own fire");
    // help names both rows the vessel holds.
    const help = (await tab.verb("help") as { value: { entries: readonly { verb: string }[] } }).value;
    expect(help.entries.map((e) => e.verb)).toEqual(["vault status", "vessel read"]);
  });

  test("H5 RED a session that has not unlocked reads custody at rest and nothing the vessel holds open now; CONTROL: admitted, it reads all of it", async () => {
    const tab = await standLockedTab();
    /** Every key path of a reading, so a field that arrives under any branch reads here. */
    const paths = (value: unknown, at = ""): string[] => value !== null && typeof value === "object" && !Array.isArray(value)
      ? Object.entries(value).flatMap(([k, v]) => [`${at}${k}`, ...paths(v, `${at}${k}.`)])
      : Array.isArray(value) ? value.flatMap((v) => paths(v, `${at}[].`)) : [];
    const LIVE = /(^|\.)(unlocked|held|worn)$/;

    const read = (await tab.verb("vessel", "read") as { value: Record<string, unknown> }).value;
    expect(Object.keys(read).sort(), "the fields an unadmitted session's vessel read carries").toEqual(["asks", "custody", "faces", "floorPin", "place", "relay", "session", "standing", "vessel", "withheld"]);
    expect(Object.keys(read["custody"] as object).sort()).toEqual(["face", "place", "seedRest"]);
    expect(read["custody"]).toMatchObject({ place: { reading: "clear" }, face: { reading: "bound" } });
    expect(Object.keys(read["faces"] as object).sort()).toEqual(["joined", "named"]);
    expect(read["relay"]).toEqual({ dials: null, connection: null });
    expect(read["vessel"]).toBeNull();
    expect(paths(read).filter((p) => LIVE.test(p)), "no reading of what stands unlocked, held or worn now").toEqual([]);
    expect(read["withheld"]).toEqual(["faces.worn", "custody.place.unlocked", "custody.face.unlocked", "custody.held"]);

    const vault = (await tab.verb("vault", "status") as { value: Record<string, unknown> }).value;
    expect(Object.keys(vault).sort()).toEqual(["custody", "door", "withheld"]);
    expect(Object.keys(vault["custody"] as object).sort()).toEqual(["faces", "place", "seed"]);
    // The door's own `unlocked` names this session alone, and reads false until it unlocks.
    expect(vault["door"]).toEqual({ standing: "floor", unlocked: false, admittedBy: null, face: tab.face });
    expect(paths(vault["custody"]).filter((p) => LIVE.test(p)), "custody at rest names no unlock").toEqual([]);
    expect(vault["withheld"]).toEqual(["custody.place.unlocked", "custody.faces[].unlocked", "door.held"]);

    // CONTROL: the ask answered, the same session reads what the vessel holds open, and withholds nothing.
    tab.answer();
    await tab.until("the session admitted", () => tab.heard.some((m) => m.t === "status" && m.status.vessel !== undefined));
    const lit = (await tab.verb("vessel", "read") as { value: Record<string, unknown> }).value;
    expect(lit["withheld"]).toEqual([]);
    expect(lit["faces"]).toMatchObject({ worn: tab.face });
    expect(lit["custody"]).toMatchObject({ face: { reading: "bound", unlocked: true }, held: { floor: "lit", admitted: 1 } });
    const open = (await tab.verb("vault", "status") as { value: Record<string, unknown> }).value;
    expect(open["withheld"]).toEqual([]);
    expect(open["door"]).toMatchObject({ unlocked: true, held: { floor: "lit", admitted: 1 } });
  });
});
