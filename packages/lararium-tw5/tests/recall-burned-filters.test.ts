/**
 * A BURNED RECALL FILTER REFUSES BY NAME.
 *
 * ── WHY ───────────────────────────────────────────────────────────────────────────────────────────────────
 * The recall verb forwards its arguments to the one coordinator, and the coordinator's holder keeps only the
 * parameters its signature declares: an argument it does not know drops without a word. The enrichment
 * filters `voice`, `band` and `drift` left that signature (the taxonomy axis `speaker` carries the stratum
 * now), so a direct verb caller that still passes one gets an UNFILTERED result back and reads it as
 * filtered. Under no back-compat, a burned argument refuses by name, in every mode, before any read runs.
 *
 * ── WHAT THIS HOLDS ───────────────────────────────────────────────────────────────────────────────────────
 * Each burned name refuses on the search, the dual and the list paths, and the client never sees the call.
 * The worldline handle filter `agent-handle` burned beside them: no recall surface reads it (the CLI's
 * filter table holds agent, surface, speaker, channel and function; the coordinator's signature holds no
 * handle; canon folds `lar_agent_handle` into the drawer's provenance envelope, and a handle's turns read
 * through the worldline door, never a recall filter). It refuses in each spelling a caller may send.
 * CONTROLS: `speaker` and the other live filters pass through to the client unchanged.
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
    listDrawers: async (args) => { calls.push({ op: "list", args }); return { drawers: [] }; },
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

describe("a burned recall filter refuses by name", () => {
  for (const burned of ["voice", "band", "drift", "agent-handle", "agent_handle", "agentHandle"]) {
    for (const [mode, extra] of [["search", { query: "q" }], ["dual", { query: "q", dual: true }], ["list", {}]] as const) {
      test(`★ ${burned} refuses on the ${mode} path, and no read runs ★`, async () => {
        const { recall, calls } = harness();
        await expect(recall({ ...extra, [burned]: "operator" })).rejects.toThrow(new RegExp(`(^|[^\\w-])${burned}([^\\w-]|$)`));
        expect(calls).toEqual([]);
      });
    }
  }

  test("CONTROL — speaker rides through to the client's search unchanged", async () => {
    const { recall, calls } = harness();
    await recall({ query: "q", speaker: "operator", channel: "speech", wing: "w" });
    expect(calls).toEqual([{ op: "search", args: { query: "q", speaker: "operator", channel: "speech", wing: "w" } }]);
  });

  test("CONTROL — a plain list call still lists", async () => {
    const { recall, calls } = harness();
    await recall({ wing: "w" });
    expect(calls.map((c) => c.op)).toEqual(["list"]);
  });
});
