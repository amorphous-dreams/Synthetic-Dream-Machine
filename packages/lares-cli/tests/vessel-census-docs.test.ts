/**
 * `lares vessel census --docs` — every document the vessel's stores hold, and who names it, read through the vessel's door.
 *
 *   C1  prose by default: a summary per class, then the unnamed list (each orphan by id, store, bytes and why); exit 0.
 *   C2  a sealed document left unread says an orphan may be named inside it, so no orphan reads proven.
 *   C3  `--json` answers the full rows.
 *   C4  no vessel, a silent door, or a refusal exits 2 by name and never reads as an empty house.
 *   C5  the vessel door routes `census --docs` here and `census` alone to the stop census.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import type { DocCensusReading } from "@lararium/mesh";
import { cmdDocCensus } from "../src/commands/doc-census.js";
import type { ParsedArgs } from "../src/parse-args.js";

const args = (json = false): ParsedArgs => ({ command: "vessel", positional: ["census"], flags: { docs: true, json }, options: {} }) as unknown as ParsedArgs;
afterEach(() => { vi.restoreAllMocks(); });

function capture(): { out: string[]; err: string[] } {
  const out: string[] = [], err: string[] = [];
  vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { out.push(a.join(" ")); });
  vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => { err.push(a.join(" ")); });
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => { out.push(String(chunk)); return true; });
  return { out, err };
}

const base = { clearChunks: 1, sealedChunks: 0, syncStates: 0, temps: 0, read: "clear" as const };
const reading = (unreadSealed = 0): DocCensusReading => ({
  stores: [{ name: "(root)", documents: 3, bytes: 3_400 }, { name: "notes", documents: 1, bytes: 1_000 }],
  rows: [
    { ...base, id: "docCatalog", store: "(root)", bytes: 2_000, class: "current", names: [{ kind: "catalog", by: "the catalog pointer" }] },
    { ...base, id: "docMap", store: "(root)", bytes: 600, class: "orphan", names: [], why: "unnamed" },
    { ...base, id: "docChain", store: "(root)", bytes: 800, class: "orphan", names: [{ kind: "doc", by: "z", from: "docMap" }], why: "named only by documents no live name reaches" },
    { ...base, id: "docCatalog", store: "notes", bytes: 1_000, class: "duplicate", names: [], why: "the root store holds docCatalog too" },
  ],
  counts: { current: 1, duplicate: 1, orphan: 2, "last-version": 0, "sealed-unread": 0 },
  unreadSealed,
});

describe("the document census", () => {
  test("C1 — prose: a summary per class, then the unnamed list; exit 0", async () => {
    const c = capture();
    const code = await cmdDocCensus(args(), async () => ({ op: "doc-census", census: reading(), standing: "hearth" }));
    expect(code).toBe(0);
    const text = c.out.join("\n");
    expect(text).toMatch(/4 document\(s\) in 2 store\(s\)/);
    expect(text).toMatch(/current\s+1/);
    expect(text).toMatch(/duplicate\s+1/);
    expect(text).toMatch(/orphan\s+2/);
    expect(text).toMatch(/docMap\s+\(root\)\s+600 B\s+unnamed/);
    expect(text).toMatch(/docChain\s+\(root\)\s+800 B\s+named only by documents no live name reaches/);
    expect(text).not.toMatch(/docCatalog\s+\(root\)/);
  });

  test("C2 — a sealed document left unread says an orphan may be named inside it", async () => {
    const c = capture();
    await cmdDocCensus(args(), async () => ({ op: "doc-census", census: reading(2), standing: "hearth" }));
    expect(c.out.join("\n")).toMatch(/2 sealed document\(s\) stand unread/);
  });

  test("C3 — --json answers the full rows", async () => {
    const c = capture();
    const code = await cmdDocCensus(args(true), async () => ({ op: "doc-census", census: reading(), standing: "hearth" }));
    expect(code).toBe(0);
    const payload = JSON.parse(c.out.join("")) as { ok: boolean; data: { docCensus: DocCensusReading } };
    expect(payload.ok).toBe(true);
    expect(payload.data.docCensus.rows).toHaveLength(4);
  });

  test("C4 — no vessel, or a refusal, exits 2 by name", async () => {
    const c = capture();
    expect(await cmdDocCensus(args(), async () => null)).toBe(2);
    expect(c.err.join("\n")).toMatch(/no vessel answered/);
    expect(await cmdDocCensus(args(), async () => ({ op: "doc-census", status: "error", errorMessage: "no composition sits", refusal: { reason: "census-unavailable" } }))).toBe(2);
    expect(c.err.join("\n")).toMatch(/no composition sits/);
    expect(await cmdDocCensus(args(), async () => ({ op: "custody", unlocked: false }))).toBe(2);
    expect(c.err.join("\n")).toMatch(/older than this door/);
  });

  test("C5 — the vessel door routes census --docs to the document census", async () => {
    const { VESSEL_CENSUS_ROUTE } = await import("../src/commands/vessel.js");
    expect(VESSEL_CENSUS_ROUTE(args())).toBe("docs");
    expect(VESSEL_CENSUS_ROUTE({ ...args(), flags: {} } as ParsedArgs)).toBe("stop");
  });
});
