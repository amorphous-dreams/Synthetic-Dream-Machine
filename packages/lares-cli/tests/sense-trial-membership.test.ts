/**
 * The trial CLI accepts only Content rows named by the current semantic receipt.
 * The cap deliberately returns hostile high-ranked rows before the valid row; the
 * witness checks the boundary after the real `cmdSense` filtering path.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

const seam = vi.hoisted(() => ({
  outputs: [] as string[],
  errors: [] as string[],
  candidates: [] as Array<Record<string, unknown>>,
  searchResult: undefined as Record<string, unknown> | undefined,
  searchArgs: [] as Array<Record<string, unknown>>,
}));

const current = {
  observation_id: "obs-current",
  source_key: "source-current",
  revision_sha256: "rev-current",
  view_key: "view-current",
  model_basis_sha256: "basis-current",
  content_frontier: 1,
  semantic_frontier: 1,
  cids: ["cid-receipted"],
};
const status = {
  operation_status: "complete",
  content_root: "/tmp/trial-op/sensorium/content",
  model_home: "/tmp/model-home",
  content_frontier: 1,
  semantic_frontier: 1,
  semantic_frontiers: { "view-current": { "source-current": 1 } },
  receipts: {
    intake: { observation_id: "obs-current", revision_sha256: "rev-current" },
    typed: { observation_id: "obs-current", source_key: "source-current", source_frontier: 1, typed_blocks: 1 },
    semantic: {
      observation_id: "obs-current", source_frontier: 1,
      view_key: "view-current", model_basis_sha256: "basis-current", blocks: 1,
    },
  },
};

vi.mock("@lararium/node", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@lararium/node")>()),
  runTrialServing: vi.fn(async (op: string) => op === "status" ? status : current),
  trialContentDir: () => "/tmp/trial-op/sensorium/content",
  verifyTrialModel: vi.fn(async () => ({})),
  makeLaresQuery: () => ({
    search: vi.fn(async (_lens: string, _query: string, options: Record<string, unknown>) => {
      seam.searchArgs.push(options);
      return seam.searchResult ?? { results: seam.candidates, total: seam.candidates.length };
    }),
    close: vi.fn(async () => {}),
  }),
}));

import { cmdSense } from "../src/commands/sense.js";
import { parseArgs } from "../src/parse-args.js";

const run = (...argv: string[]) => cmdSense(parseArgs(["sense", ...argv]));
const hit = (drawer_id: string, source: string, revision: string, occurrence = drawer_id) => ({
  drawer_id,
  text: drawer_id,
  metadata: {
    lar_occurrence_id: occurrence,
    lar_source_key: source,
    lar_revision_sha256: revision,
  },
});
const readOutput = () => JSON.parse(seam.outputs.at(-1)!) as Record<string, any>;

describe("sense search trial receipt membership", () => {
  beforeEach(() => {
    seam.outputs = [];
    seam.errors = [];
    seam.searchArgs = [];
    seam.candidates = [];
    seam.searchResult = undefined;
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      seam.outputs.push(String(chunk));
      return true;
    });
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation((line: unknown) => { seam.errors.push(String(line)); });
  });

  test("only the receipted CID survives highly ranked foreign, stale, and inconsistent rows", async () => {
    seam.candidates = [
      hit("cid-foreign", "source-current", "rev-current"),
      hit("cid-stale", "source-current", "rev-old"),
      hit("cid-receipted", "source-old", "rev-current"),
      hit("cid-receipted", "source-current", "rev-current", "cid-other-occurrence"),
      hit("cid-receipted", "source-current", "rev-current"),
    ];

    expect(await run("search", "query", "--trial-root", "/tmp/trial-op", "--model-home", "/tmp/model-home", "--k", "1", "--json"), seam.errors.join("\n")).toBe(0);

    const result = readOutput().data.result;
    expect(seam.searchArgs[0]?.k).toBe(32);
    expect(result.results.map((row: Record<string, unknown>) => row.cid)).toEqual(["cid-receipted"]);
    expect(result.total_after_filter).toBe(1);
    expect(result.filter_exhaustive).toBe(false);
  });

  test("caller source and revision filters reject otherwise receipted rows", async () => {
    seam.candidates = [hit("cid-receipted", "source-current", "rev-current")];

    expect(await run("search", "query", "--trial-root", "/tmp/trial-op", "--model-home", "/tmp/model-home", "--source-key", "source-other", "--revision", "rev-other", "--json"), seam.errors.join("\n")).toBe(0);

    const result = readOutput().data.result;
    expect(result.results).toEqual([]);
    expect(result.filter_exhaustive).toBe(false);
  });

  test("a malformed cap response fails closed instead of returning unfiltered data", async () => {
    seam.searchResult = { total: 1 };

    expect(await run("search", "query", "--trial-root", "/tmp/trial-op", "--model-home", "/tmp/model-home", "--json")).toBe(4);
    expect(readOutput().ok).toBe(false);
    expect(readOutput().error.message).toMatch(/no hit array/);
  });
});
