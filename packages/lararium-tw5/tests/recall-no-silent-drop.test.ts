/**
 * RECALL DROPS NO ARGUMENT WITHOUT A WORD.
 *
 * Three doors let a caller's argument vanish while the answer reads as if it applied:
 *   · the burned-filter table matched exact keys, so `Voice` and `agenthandle` slipped past `voice` and
 *     `agent-handle`;
 *   · the fusion-only knobs (register, grammarLayer, formWeight, aperture*) only the dual fuse honours rode
 *     the search, list and imago paths and fell away at the coordinator;
 *   · `room` and `lens` narrow only the coordinator's search, and the list, imago and dual paths dropped them.
 * Each refuses by name before any read runs. CONTROLS: the dual fuse still carries its knobs, the search path
 * still carries `room` and `lens`, and a live filter (`speaker`) passes untouched.
 */
import { describe, test, expect } from "vitest";
import { recallVerbCap, VERB_PROVIDER, type MempalaceProvider, type FormPalaceProvider, type RecallClient } from "../src/verb-caps.js";
import type { VerbTable } from "../src/verb-dispatcher.js";

type Handler = (args: Record<string, unknown>) => Promise<unknown>;

function harness() {
  const calls: { op: string; args: Record<string, unknown> }[] = [];
  const client: RecallClient = {
    getImago: async (id) => { calls.push({ op: "imago", args: { id } }); return {}; },
    search: async (args) => { calls.push({ op: "search", args }); return { results: [] }; },
    listDrawers: async (args) => { calls.push({ op: "list", args }); return { imagines: [] }; },
  };
  const mp: MempalaceProvider = { withClient: (fn) => fn(client), turnsForHandleStubs: async () => [] };
  const form: FormPalaceProvider = {
    getForm: async () => null,
    multiRecall: async (legs, args) => { calls.push({ op: "multi", args }); return legs.contentSearch(args); },
  };
  const providers: Record<string, unknown> = { [VERB_PROVIDER.mempalace]: mp, [VERB_PROVIDER.formPalace]: form };
  let handler: Handler | undefined;
  const registry = { register: (_name: string, h: Handler) => { handler = h; } } as unknown as VerbTable;
  (recallVerbCap().build(<T,>(id: string) => providers[id] as T) as (r: VerbTable) => void)(registry);
  return { recall: handler!, calls };
}

describe("a burned filter refuses in any spelling", () => {
  for (const name of ["Voice", "VOICE", "Band", "agenthandle", "AgentHandle", "AGENT_HANDLE", "Agent-Handle", "dRiFt"]) {
    test(`★ ${name} refuses and no read runs ★`, async () => {
      const { recall, calls } = harness();
      await expect(recall({ query: "q", [name]: "x" })).rejects.toThrow(/burned/);
      expect(calls).toEqual([]);
    });
  }
  test("CONTROL — speaker rides the search path unchanged", async () => {
    const { recall, calls } = harness();
    await recall({ query: "q", speaker: "operator" });
    expect(calls).toEqual([{ op: "search", args: { query: "q", speaker: "operator" } }]);
  });
});

describe("a fusion-only knob refuses off the dual fuse", () => {
  const knobs: ReadonlyArray<readonly [string, unknown]> = [
    ["register", "r"], ["grammarLayer", "wikitext"], ["grammar_layer", "wikitext"], ["formWeight", 2],
    ["apertureGrain", 10], ["aperture_grain", 10], ["aperture", "paragraph"], ["apertureWidth", 5], ["aperture_width", 5],
  ];
  const paths: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
    ["search", { query: "q" }], ["list", {}], ["imago", { imago: "cid-1" }],
  ];
  for (const [name, value] of knobs) {
    for (const [path, extra] of paths) {
      test(`★ ${name} refuses on the ${path} path, naming dual ★`, async () => {
        const { recall, calls } = harness();
        await expect(recall({ ...extra, [name]: value })).rejects.toThrow(new RegExp(`${name}[\\s\\S]*dual`));
        expect(calls).toEqual([]);
      });
    }
  }
  test("CONTROL — the dual fuse carries its knobs to the form provider", async () => {
    const { recall, calls } = harness();
    await recall({ query: "q", dual: true, register: "r", formWeight: 2, aperture: "paragraph" });
    expect(calls[0]).toMatchObject({ op: "multi", args: { query: "q", register: "r", formWeight: 2, apertureGrain: "paragraph" } });
  });
});

describe("room and lens narrow only the search path", () => {
  for (const name of ["room", "lens"]) {
    for (const [path, extra] of [["list", {}], ["imago", { imago: "c" }], ["dual", { query: "q", dual: true }]] as const) {
      test(`★ ${name} refuses on the ${path} path ★`, async () => {
        const { recall, calls } = harness();
        await expect(recall({ ...extra, [name]: "x" })).rejects.toThrow(new RegExp(`${name}[\\s\\S]*query`));
        expect(calls).toEqual([]);
      });
    }
  }
  test("CONTROL — room and lens ride the search path unchanged", async () => {
    const { recall, calls } = harness();
    await recall({ query: "q", room: "r", lens: "form" });
    expect(calls).toEqual([{ op: "search", args: { query: "q", room: "r", lens: "form" } }]);
  });
});
