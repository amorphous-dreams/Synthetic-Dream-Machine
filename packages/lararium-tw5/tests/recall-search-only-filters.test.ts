/**
 * A RECALL FILTER NARROWS ONLY THE COORDINATOR'S SEARCH, AND REFUSES BY NAME ELSEWHERE.
 *
 * ── WHY ───────────────────────────────────────────────────────────────────────────────────────────────────
 * The recall filters (agent, surface, speaker, channel, function) and the exchange view (pair) have one home:
 * the coordinator's recall signature, reached on the search path. The list path pages drawers by wing and
 * limit, the imago path fetches one entry by id, and the dual fuse assembles its own content-leg args; none
 * of them carries a filter. Before the stamp post-filter burned, the list path applied agent and surface in
 * TypeScript and the dual path refused a filter; since the burn each drops them without a word, so a caller
 * reads an UNFILTERED answer as a filtered one. The coordinator holds no query-less filtered search, so no
 * path can honour the filter without a query: the verb refuses it by name, pointing at the search path.
 *
 * ── WHAT THIS HOLDS ───────────────────────────────────────────────────────────────────────────────────────
 * Each filter refuses on the list, imago and dual paths, and the client never sees the call.
 * CONTROLS: a filter with a query rides the search path unchanged; a plain list still lists.
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
  const contribution = recallVerbCap().build(<T,>(id: string) => providers[id] as T) as (r: VerbTable) => void;
  contribution(registry);
  return { recall: handler!, calls };
}

describe("a recall filter narrows only the search path", () => {
  const filters: ReadonlyArray<readonly [string, unknown]> = [
    ["agent", "a1"], ["surface", "claude"], ["speaker", "operator"], ["channel", "speech"], ["function", "steering"], ["pair", true],
  ];
  const paths: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
    ["list", {}], ["list (named)", { list: true, wing: "w" }], ["imago", { imago: "cid-1" }], ["dual", { query: "q", dual: true }],
  ];
  for (const [name, value] of filters) {
    for (const [path, extra] of paths) {
      test(`★ ${name} refuses on the ${path} path, and no read runs ★`, async () => {
        const { recall, calls } = harness();
        await expect(recall({ ...extra, [name]: value })).rejects.toThrow(new RegExp(`(^|[^\\w-])${name}([^\\w-]|$)[\\s\\S]*query`));
        expect(calls).toEqual([]);
      });
    }
  }

  test("CONTROL — speaker with a query rides the search path unchanged", async () => {
    const { recall, calls } = harness();
    await recall({ query: "q", speaker: "operator", pair: true });
    expect(calls).toEqual([{ op: "search", args: { query: "q", speaker: "operator", pair: true } }]);
  });

  test("CONTROL — a plain list with no filter still lists", async () => {
    const { recall, calls } = harness();
    await recall({ wing: "w", limit: 3 });
    expect(calls).toEqual([{ op: "list", args: { wing: "w", limit: 3 } }]);
  });
});
