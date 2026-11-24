/**
 * THE VESSEL'S OWN ASKS MEET THE SAME GATE AS THE SOCKET.
 *
 * The face pool's watch, the workbench watches and the mirror leg ask the daemon island straight through `askIslandVerb`
 * (`placeVerb`), never through the verb socket. So the socket's two gates stand here too: a fallen engine refuses
 * `engine-terminated` and an INGEST wave past one document's budget refuses `ingest-wave-over-budget`, each before any
 * placement. Every fault comes injected.
 */
import { describe, expect, test } from "vitest";
import { askIslandVerb, IslandVerbRefused } from "../src/island-verb-ask.js";
import { createEngineWatch } from "../src/engine-watch.js";

/** A control store that never holds an outcome: a placement would wait forever, so a refusal must come first. */
const control = { get: async () => null, subscribe: () => () => {} } as unknown as Parameters<typeof askIslandVerb>[0]["control"];

const carrier = (i: number) => ({ uri: `lar:///t/c${i}`, file: `/b/c${i}.mem`, size: 18_000, diskHash: "sha256:a", syncedHash: null, ext: ".mem",
  text: "<<~ ahu slot=`#/s`>>\n".repeat(6) + "x".repeat(18_000) });

describe("askIslandVerb — the fall gate and the wave budget", () => {
  test("a fallen engine refuses engine-terminated and places nothing", async () => {
    const engine = createEngineWatch();
    engine.note(new Error("Module terminated"), "ledger");
    const placed: unknown[] = [];
    const ask = askIslandVerb({ control, placeVerb: (o) => { placed.push(o); }, verb: "shore", args: { op: "sense" }, requestedBy: "0xabc", requestId: "r1", engine });
    const err = await ask.answer.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(IslandVerbRefused);
    expect((err as IslandVerbRefused).reason).toBe("engine-terminated");
    expect(placed).toHaveLength(0);
  });

  test("an overweight INGEST refuses ingest-wave-over-budget and places nothing", async () => {
    const placed: unknown[] = [];
    const ask = askIslandVerb({ control, placeVerb: (o) => { placed.push(o); }, verb: "INGEST",
      args: { "to-bag": "lar:///ha.ka.ba/bags/lares", carriers: Array.from({ length: 194 }, (_, i) => carrier(i)) }, requestedBy: "0xabc", requestId: "r2", engine: createEngineWatch() });
    const err = await ask.answer.catch((e: unknown) => e);
    expect((err as IslandVerbRefused).reason).toBe("ingest-wave-over-budget");
    expect(placed).toHaveLength(0);
  });

  test("CONTROL: a standing engine and a light ask place once", async () => {
    const placed: unknown[] = [];
    const ask = askIslandVerb({ control, placeVerb: (o) => { placed.push(o); }, verb: "shore", args: { op: "sense" }, requestedBy: "0xabc", requestId: "r3", engine: createEngineWatch() });
    await new Promise((r) => setTimeout(r, 20));
    expect(placed).toHaveLength(1);
    ask.abandon();
    await ask.answer.catch(() => {});
  });
});
