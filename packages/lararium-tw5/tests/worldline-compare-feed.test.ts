/**
 * The worldline-compare verb ships every spirit edge the transcript feed carries: each spawn, each
 * round-closing handback and each delivered message ride as opens, and no retirement rides, since a
 * transcript records none. A spirit that handed back stays live for the compare.
 *
 * Meme: lar:///ha.ka.ba/lararium/api/agent-worldline#/time
 */
import { describe, expect, test } from "vitest";
import { delegationEdge, communicationEdge, handbackEdge } from "@lararium/mesh/worldline-edge";
import { worldlineVerbCap, VERB_PROVIDER, type DaemonVerbProvider, type SpiritEdges } from "../src/verb-caps.js";
import type { VerbTable } from "../src/verb-dispatcher.js";

type Handler = (args: Record<string, unknown>) => Promise<unknown>;

describe("worldline-compare carries the spirit feed whole", () => {
  test("spawns, round closes and messages ride as opens, with no closes, seeded at the run the spawns name", async () => {
    const spirit: SpiritEdges = {
      spawn: delegationEdge("run", "run.a", { turnKey: "s0" }),
      handbacks: [handbackEdge("run.a", "run", { turnKey: "n1", parentKey: "s0" })],
      messages: [communicationEdge("run", "run.a", { turnKey: "m1", parentKey: "n1" })],
      ends: [],
    };
    const seen: Record<string, unknown>[] = [];
    const daemon = {
      subagentEdges: async () => ({ spirits: [spirit], unplaced: [], run: "run" }),
      worldlineCompare: async (input: Record<string, unknown>) => { seen.push(input); return { order: "before", uncertain: [] }; },
    } as unknown as DaemonVerbProvider;
    const providers: Record<string, unknown> = {
      [VERB_PROVIDER.daemonVm]: daemon, [VERB_PROVIDER.mempalace]: {}, [VERB_PROVIDER.formPalace]: {},
    };
    const handlers = new Map<string, Handler>();
    const registry = { register: (name: string, h: Handler) => { handlers.set(name, h); } } as unknown as VerbTable;
    (worldlineVerbCap().build(<T,>(id: string) => providers[id] as T) as (r: VerbTable) => void)(registry);

    await handlers.get("worldline-compare")!({ a: "run", b: "run.a", transcript: "/s.jsonl" });
    expect(seen).toEqual([{ a: "run", b: "run.a", opens: [spirit.spawn, ...spirit.handbacks, ...spirit.messages], root: "run" }]);
  });
});

describe("worldline-compare names an unplaced spirit", () => {
  test("a handle whose spirit holds no launch row refuses by that cause", async () => {
    const daemon = {
      subagentEdges: async () => ({ spirits: [], unplaced: ["ccc"], run: "sess" }),
      worldlineCompare: async () => { throw new Error("unknown handle"); },
    } as unknown as DaemonVerbProvider;
    const providers: Record<string, unknown> = {
      [VERB_PROVIDER.daemonVm]: daemon, [VERB_PROVIDER.mempalace]: {}, [VERB_PROVIDER.formPalace]: {},
    };
    const handlers = new Map<string, Handler>();
    const registry = { register: (name: string, h: Handler) => { handlers.set(name, h); } } as unknown as VerbTable;
    (worldlineVerbCap().build(<T,>(id: string) => providers[id] as T) as (r: VerbTable) => void)(registry);
    await expect(handlers.get("worldline-compare")!({ a: "sess", b: "sess.ccc", transcript: "/sess.jsonl" }))
      .rejects.toThrow(/sess\.ccc.*unplaced.*launch row/);
  });
});
