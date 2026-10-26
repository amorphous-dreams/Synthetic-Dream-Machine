/**
 * seat-duties-ask — WHO MAY ASK the daemon island's `seat-duties` verb (kapae#/what-the-code-holds).
 *
 * The verb recounts signed acts and mints key epochs for a face. It answers ONE asker: its own vessel's main
 * thread, on two roads (the settle a fold sets off, and `lares edge settle` through the store door's row). A wiki
 * island's surface, a session island and a peer's summons each reach a daemon island's verb table and each name
 * whatever requester they like; none holds the vessel key. So every ask carries the vessel key's signature over
 * its own request id and the facts it hands in, and the verb reads that before it reads anything else.
 *
 *   Q1  the main thread's asker places the verb with its proof: the island's check reads it as licensed, and the
 *       requester names the vessel.
 *   Q2  RED: an ask with no proof refuses (the parent commit's verb ran it); a proof under another key refuses (an
 *       island or a peer holds no vessel key); a true proof replayed under another request id refuses; a true
 *       proof beside other facts refuses; a malformed proof refuses.          control: the true ask reads licensed
 *   Q3  RED: THE VERB CHECKS FIRST, AND ONE ROAD PLACES IT. In the island's source the check stands ahead of every
 *       other read inside the one `seat-duties` registration; across every package's source, the verb's name
 *       gets placed by the main thread's asker alone.
 *   Q4  THE OPERATOR'S ROAD: the store door's `edge-seat-duties` row names ONE fleet, reads that fleet's facts off
 *       this vessel's own ledger and board, and hands those to the vessel's asker; it takes no facts from its
 *       caller (RED: a caller's own facts refuse), so the vessel signs only what the vessel read. With no
 *       sovereign vessel standing it refuses by name.
 *   Q5  an ask abandoned while its proof signs places nothing.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Repo } from "@automerge/automerge-repo";
import * as ed from "@noble/ed25519";
import { describe, expect, test } from "vitest";
import { concludeVerb, ed25519SignerFromSeed, emptyLarDoc, hex, seatDutiesAskRefusal, signSeatDutiesAsk, type LarDoc } from "@lararium/mesh";
import { IslandAskAbandoned, askSeatDuties } from "../src/island-verb-ask.js";
import { storeDoorReactors } from "../src/store-door-verbs.js";
import { runEdgeSeatFacts } from "../src/commands/edge-seats.js";
import { generateOrLoadPersonaGroupRoot, generateOrLoadVesselIdentity } from "../src/node-vessel-identity.js";
import { seatScratchCustody } from "./custody-seat-fixture.js";
import { seedFaceAtom } from "./atom-fixture.js";

const VESSEL_SEED = new Uint8Array(32).fill(41);
const OTHER_SEED = new Uint8Array(32).fill(42);
const FACTS = { fleetRoot: "ab".repeat(32), acts: [{ kind: "a-synthetic-act", n: 1 }], rolled: ["cd".repeat(32)] };
const pub = async (seed: Uint8Array): Promise<string> => hex(await ed.getPublicKeyAsync(seed));

/** A daemon document and a main-thread channel that records what got placed. */
function island() {
  const repo = new Repo({});
  const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
  const placed: Array<{ verb: string; args: Record<string, unknown>; requestedBy: string; requestId: string }> = [];
  let onPlace: () => void = () => {};
  const placedOnce = new Promise<void>((r) => { onPlace = r; });
  const conclude = (requestId: string, output: Record<string, unknown>): void => {
    const outcome = concludeVerb({ requestId, verb: "seat-duties", status: "done", requestedBy: "vessel", cause: "test-island", batchMode: "best-effort", results: { summary: { ok: true, output } } });
    daemonHandle.change((doc) => { doc.tiddlers[outcome.tiddler.title] = outcome as unknown as LarDoc["tiddlers"][string]; });
  };
  return { daemonHandle, placed, placedOnce, conclude, place: (o: (typeof placed)[number]) => { placed.push(o); onPlace(); } };
}

describe("who may ask the island's seat-duties verb", () => {
  test("Q1/Q2 — the vessel's own ask reads licensed; every other ask refuses", async () => {
    const vesselKey = await pub(VESSEL_SEED);
    const s = island();
    const ask = askSeatDuties({ daemonHandle: s.daemonHandle, placeVerb: s.place, facts: FACTS, vesselKey, sign: ed25519SignerFromSeed(VESSEL_SEED) });
    await s.placedOnce;
    expect(s.placed).toHaveLength(1);
    const sent = s.placed[0]!;
    expect(sent).toMatchObject({ verb: "seat-duties", requestedBy: `0x${vesselKey}` });
    expect(Object.keys(sent.args).sort()).toEqual(["ask", "facts"]);
    expect(sent.args["facts"]).toEqual(FACTS);
    const check = (over: Partial<{ requestId: string; facts: unknown; ask: unknown; vesselVerifyingKey: string }>): string | null =>
      seatDutiesAskRefusal({ requestId: sent.requestId, facts: sent.args["facts"], ask: sent.args["ask"], vesselVerifyingKey: vesselKey, ...over });
    // Q1 / CONTROL: the island reads the main thread's ask as licensed, under either spelling of the vessel's key.
    expect(check({})).toBeNull();
    expect(check({ vesselVerifyingKey: `0x${vesselKey.toUpperCase()}` })).toBeNull();
    s.conclude(sent.requestId, { ran: true, rolls: [] });
    expect(await ask.answer).toEqual({ ran: true, rolls: [] });

    // Q2 RED: no proof at all (what a wiki island's surface, a session island or a peer's summons would place).
    expect(check({ ask: undefined })).toMatch(/answers this vessel's own main thread alone.*carries no proof/);
    for (const malformed of [null, "sig", [], {}, { sig: 7 }]) expect(check({ ask: malformed }), JSON.stringify(malformed)).toMatch(/carries no proof/);
    // A proof another key made, over this very request and these very facts.
    const foreign = await signSeatDutiesAsk({ requestId: sent.requestId, facts: FACTS, sign: ed25519SignerFromSeed(OTHER_SEED) });
    expect(check({ ask: foreign })).toMatch(/proof does not hold under the vessel's key/);
    // The true proof, replayed under another request id.
    expect(check({ requestId: "another-request" })).toMatch(/proof does not hold/);
    expect(check({ requestId: "" })).toMatch(/names no request/);
    // The true proof beside other facts: one more act, one fewer rolled raise, another fleet.
    expect(check({ facts: { ...FACTS, acts: [...FACTS.acts, { kind: "a-planted-act" }] } })).toMatch(/proof does not hold/);
    expect(check({ facts: { ...FACTS, rolled: [] } })).toMatch(/proof does not hold/);
    expect(check({ facts: { ...FACTS, fleetRoot: "ef".repeat(32) } })).toMatch(/proof does not hold/);
    expect(check({ ask: { sig: "zz" } })).toMatch(/proof does not hold/);
  });

  test("Q3 — the island's verb checks before any other read, and one road places the verb", () => {
    const packages = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
    const behavior = readFileSync(join(packages, "lararium-keyhive", "src", "operator-daemon-behavior.ts"), "utf8");
    const registrations = behavior.split('registry.register("seat-duties"').length - 1;
    expect(registrations).toBe(1);
    const body = behavior.slice(behavior.indexOf('registry.register("seat-duties"'), behavior.indexOf('registry.register("face-join"'));
    const at = (needle: string): number => { const i = body.indexOf(needle); expect(i, needle).toBeGreaterThan(-1); return i; };
    const check = at("seatDutiesAskRefusal(");
    expect(at("if (unlicensed) throw")).toBeGreaterThan(check);
    for (const later of ["veilKh", "daemonAuth.deviceEdge", "as FleetSeatFacts", "answerFleetSeatDuties("]) expect(at(later), later).toBeGreaterThan(at("if (unlicensed) throw"));
    expect(body).toContain("context.invocation.requestId");                         // the proof binds the island's own reading of the request
    // ONE ROAD: across every package's source, the verb's name gets placed (named beside its arguments, or handed
    // to a verb call) by the main thread's asker alone. The island's own answers echo the name and place nothing.
    const sources = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? sources(path) : /\.ts$/.test(name) ? [path] : [];
    });
    const placers = readdirSync(packages).map((pkg) => join(packages, pkg, "src")).filter((dir) => { try { return statSync(dir).isDirectory(); } catch { return false; } })
      .flatMap(sources).filter((path) => /(verb:\s*"seat-duties",\s*args\b|runVerb\(\s*"seat-duties"|storeVerb\(\s*"seat-duties"|placeVerb\([^)]*"seat-duties")/.test(readFileSync(path, "utf8")))
      .map((path) => path.slice(packages.length + 1));
    expect(placers).toEqual(["lararium-node/src/island-verb-ask.ts"]);
  });

  test("Q4 — the store door's row names a fleet and reads its facts itself; it takes no facts from its caller", async () => {
    const c = await seatScratchCustody("seat-duties-q4");
    try {
      await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
      const root = (await generateOrLoadPersonaGroupRoot(0)).verifyingKey;
      await seedFaceAtom(0);
      const asked: unknown[] = [];
      const repo = new Repo({});
      const withVessel = storeDoorReactors({ storageDir: "/a-synthetic/storage", sealHome: "/a-synthetic/seal", repo, seatDuties: async (facts) => { asked.push(facts); return { ran: true, outcomes: [], rolls: [] }; } });
      // The vessel's own reading of this fleet, as the facts row answers it.
      const own = (await runEdgeSeatFacts({ repo, fleetRoot: root })).fleets[0]!;
      expect(await withVessel["edge-seat-duties"]({ fleetRoot: root }, {} as never)).toEqual({ verb: "edge-seat-duties", ran: true, outcomes: [], rolls: [] });
      expect(asked).toEqual([{ fleetRoot: own.fleetRoot, acts: own.acts, rolled: own.rolled }]);
      // RED: a caller that hands in facts of its own choosing gets nothing signed: the row refuses the argument.
      for (const args of [{ fleetRoot: root, facts: FACTS }, { facts: FACTS }, {}, { fleetRoot: 7 }]) {
        expect((await withVessel["edge-seat-duties"](args, {} as never))["refused"], JSON.stringify(args).slice(0, 40)).toMatch(/names one fleet and nothing else/);
      }
      expect(asked).toHaveLength(1);
      const noVessel = storeDoorReactors({ storageDir: "/a-synthetic/storage", sealHome: "/a-synthetic/seal", repo });
      expect((await noVessel["edge-seat-duties"]({ fleetRoot: root }, {} as never))["refused"]).toMatch(/no unlocked vessel stands here/);
    } finally { await c.drop(); }
  });

  test("Q5 — an ask abandoned while its proof signs places nothing", async () => {
    const s = island();
    let signed!: (sig: string) => void;
    const ask = askSeatDuties({ daemonHandle: s.daemonHandle, placeVerb: s.place, facts: FACTS, vesselKey: await pub(VESSEL_SEED), sign: () => new Promise((resolve) => { signed = resolve; }) });
    ask.abandon();
    signed("00".repeat(64));
    await expect(ask.answer).rejects.toBeInstanceOf(IslandAskAbandoned);
    expect(s.placed).toEqual([]);
  });
});
