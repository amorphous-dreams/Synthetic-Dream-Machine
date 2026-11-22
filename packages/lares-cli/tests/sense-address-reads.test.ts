/**
 * `lares sense <sensorium> <read-verb>` READS THE SENSORIUM IT NAMES.
 *
 * The door strips a leading sensorium name off the line; the four plane reads must then read THAT sensorium's
 * planes (`<name>/<plane>` in the lens map), never fall back to the memory default the bare plane name keys.
 * A named sensorium that holds no such plane refuses, naming the address it could not open. Control: bare
 * `lares sense search` keeps reading memory's `content`.
 */
import { describe, expect, test, vi } from "vitest";

const searched: string[] = [];

vi.mock("@lararium/node", async (importOriginal) => {
  const real = await importOriginal<typeof import("@lararium/node")>();
  const fake = {
    search: async (lens: string) => { searched.push(lens); return { results: [] }; },
    relate: async (lens: string) => { searched.push(lens); return {}; },
    structure: async (lens: string) => { searched.push(lens); return {}; },
    status: async (lens: string) => { searched.push(lens); return {}; },
    lenses: () => [],
    close: async () => {},
  };
  return {
    ...real,
    sensoriumNames: () => ["memory", "other"],
    sensoriumDir: (name: string) => `/scratch/sensoriums/${name}`,
    memorySensoriumDir: () => "/scratch/sensoriums/memory",
    sensoriumLenses: () => ({
      content: "/scratch/sensoriums/memory/content",
      "other/content": "/scratch/sensoriums/other/content",
      "other/who/content": "/scratch/sensoriums/other/who/content",
    }),
    openMemorySensorium: () => fake,
    makeLaresQuery: () => fake,
  };
});

const { cmdSense } = await import("../src/commands/sense.js");

async function run(positional: string[], options: Record<string, string> = {}): Promise<{ code: number; out: Record<string, unknown> }> {
  const lines: string[] = [];
  const write = vi.spyOn(process.stdout, "write").mockImplementation((c: string | Uint8Array) => { lines.push(String(c)); return true; });
  try {
    const code = await cmdSense({ command: "sense", positional, options, flags: { json: true } });
    return { code, out: JSON.parse(lines.join("").trim().split("\n").at(-1)!) as Record<string, unknown> };
  } finally {
    write.mockRestore();
  }
}

describe("a named sensorium's reads reach its own planes", () => {
  test("`sense other search` reads other/content, and the answer names that lens", async () => {
    searched.length = 0;
    const r = await run(["other", "search", "anything"]);
    expect(r.code).toBe(0);
    expect(searched).toEqual(["other/content"]);
    expect((r.out["data"] as Record<string, unknown>)["lens"]).toBe("other/content");
  });

  test("a plane the named sensorium lacks refuses, naming the address", async () => {
    searched.length = 0;
    const r = await run(["other", "status"], { lens: "form" });
    expect(r.code).not.toBe(0);
    expect(String((r.out["error"] as Record<string, unknown>)["message"])).toContain("other/form");
    expect(searched).toEqual([]);
  });

  test("CONTROL: bare `sense search` keeps memory's content", async () => {
    searched.length = 0;
    const r = await run(["search", "anything"]);
    expect(r.code).toBe(0);
    expect(searched).toEqual(["content"]);
  });

  test("crossplane keeps working for a named sensorium: it widens that sensorium's own planes", async () => {
    searched.length = 0;
    const r = await run(["other", "search", "anything"], { lens: "crossplane" });
    expect(r.code).toBe(0);
    expect(searched).toEqual(["other/crossplane"]);
  });

  test("a child plane reads under the named sensorium; a lens already addressed to it rides as written", async () => {
    searched.length = 0;
    expect((await run(["other", "search", "anything"], { lens: "who/content" })).code).toBe(0);
    expect((await run(["other", "search", "anything"], { lens: "other/content" })).code).toBe(0);
    expect(searched).toEqual(["other/who/content", "other/content"]);
  });

  test("--trial-root keeps its own path under a name (CONTROL: the trial refusal, never a plane refusal)", async () => {
    const r = await run(["other", "relate", "x"], { "trial-root": "/scratch/trial" });
    expect(r.code).not.toBe(0);
    expect(String((r.out["error"] as Record<string, unknown>)["message"])).toContain("trial relate is unsupported");
  });
});
