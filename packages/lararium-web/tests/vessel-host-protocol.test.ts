/**
 * vessel-host-protocol — THE VESSEL READS THE HELLO'S PROTOCOL BEFORE IT STANDS ANYTHING (the Pono Browser, wave W2; story T-X3).
 *
 * A follower tab's port reaches the owner tab's vessel worker, and a deploy can leave the two on different builds. The host
 * reads the hello's `protocol` against its own (`vessel-protocol.ts`) ahead of every other act.
 *
 *   VP1 RED      a hello naming another protocol hears `ended{stage: open, refusal: protocol-skew}` whose words carry the cure,
 *                and no greeting; the opener never ran, so no house stood over the store.
 *   VP2 RED      a hello naming no protocol refuses the same way.
 *   VP3 CONTROL  two tabs of one build on one store both hear a greeting that names this build's protocol, and neither
 *                hears a refusal.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift
 */
import { describe, expect, test } from "vitest";
import { standVesselHost, type VesselScope } from "../src/workers/vessel-host.js";
import { PROTOCOL_SKEW, VESSEL_PROTOCOL } from "../src/vessel-protocol.js";
import type { PageToVessel, VesselBoot, VesselToPage } from "../src/vessel-protocol.js";

const SLOW = 300_000;
type Ended = Extract<VesselToPage, { t: "ended" }>;
type Greeting = Extract<VesselToPage, { t: "greeting" }>;

const boot = (idbName: string): VesselBoot => ({ idbName, hostId: "h", wikiId: "w", genesisSeed: "", genesisCasBaseUrl: "", daemonWorkerUrl: "about:blank", workerScriptUrl: "about:blank" } as unknown as VesselBoot);

const until = async (what: string, ok: () => boolean): Promise<void> => {
  for (let i = 0; i < 400 && !ok(); i++) await new Promise((r) => setTimeout(r, 25));
  if (!ok()) throw new Error(`never: ${what}`);
};

/** A host whose opener counts its calls; a store with no face, so a hello that passes greets at the floor with no ask. */
function standHost() {
  let opens = 0;
  const openVessel = async (o: { idbName: string; face?: string | null }) => {
    opens += 1;
    return {
      face: o.face ?? null,
      identity: { verifyingKey: "00".repeat(32) },
      connectionState: { getSnapshot: () => ({ status: "local" }), subscribe: () => () => undefined },
      activeWikiId: "w", wikiDocUrl: "automerge:w", oracleDocUrl: "automerge:o",
      faceProviders: { lit: async () => undefined, drop: async () => undefined },
      floorStatus: async () => ({ ok: false, refusal: "floor-no-nexus", detail: "no Nexus AID is known for this hearth" }),
      flush: async () => undefined, close: async () => undefined,
    };
  };
  const host = standVesselHost({ locks: navigator.locks, openVessel } as never);
  const tab = () => {
    const heard: VesselToPage[] = [];
    const scope: VesselScope = { postMessage(msg) { heard.push(msg); } };
    return { heard, conn: host.connect(scope) };
  };
  return { tab, opens: () => opens };
}

describe("the vessel refuses a hello from another build by name, before any house stands", () => {
  test("VP1 RED a hello naming another protocol hears protocol-skew with its cure, no greeting, and the opener never ran", async () => {
    const host = standHost();
    const { heard, conn } = host.tab();
    const other = `sha256-${"0".repeat(64)}`;
    conn.receive({ t: "hello", protocol: other, tabSession: "tab-skew", boot: boot(`host-protocol-${crypto.randomUUID()}`) } as PageToVessel);
    await until("the refusal", () => heard.some((m) => m.t === "ended"));
    const ended = heard.find((m): m is Ended => m.t === "ended")!;
    expect(ended).toMatchObject({ stage: "open", refusal: PROTOCOL_SKEW });
    expect(ended.why).toContain(VESSEL_PROTOCOL.slice(0, 15));
    expect(ended.why).toContain(other.slice(0, 15));
    expect(ended.why, "the refusal names its cure").toMatch(/Reload or close the other tabs of this site, then reload this one/);
    expect(heard.some((m) => m.t === "greeting"), "a refused hello opens no session").toBe(false);
    expect(host.opens(), "no vessel opened for a refused hello").toBe(0);
  }, SLOW);

  test("VP2 RED a hello naming no protocol refuses the same way", async () => {
    const host = standHost();
    const { heard, conn } = host.tab();
    conn.receive({ t: "hello", tabSession: "tab-bare", boot: boot(`host-protocol-${crypto.randomUUID()}`) } as unknown as PageToVessel);
    await until("the refusal", () => heard.some((m) => m.t === "ended"));
    const ended = heard.find((m): m is Ended => m.t === "ended")!;
    expect(ended).toMatchObject({ stage: "open", refusal: PROTOCOL_SKEW });
    expect(ended.why).toContain("names no protocol");
    expect(heard.some((m) => m.t === "greeting")).toBe(false);
  }, SLOW);

  test("VP3 CONTROL two tabs of one build on one store both hear a greeting naming this build's protocol, and neither refuses", async () => {
    const host = standHost();
    const idbName = `host-protocol-${crypto.randomUUID()}`;
    const a = host.tab();
    const b = host.tab();
    a.conn.receive({ t: "hello", protocol: VESSEL_PROTOCOL, tabSession: "tab-a", boot: boot(idbName) } as PageToVessel);
    b.conn.receive({ t: "hello", protocol: VESSEL_PROTOCOL, tabSession: "tab-b", boot: boot(idbName) } as PageToVessel);
    await until("both greetings", () => a.heard.some((m) => m.t === "greeting") && b.heard.some((m) => m.t === "greeting"));
    for (const tab of [a, b]) {
      const greeting = tab.heard.find((m): m is Greeting => m.t === "greeting")!;
      expect(greeting.protocol).toBe(VESSEL_PROTOCOL);
      expect(tab.heard.some((m) => m.t === "ended" && m.refusal === PROTOCOL_SKEW), "one build never refuses itself").toBe(false);
    }
  }, SLOW);
});
