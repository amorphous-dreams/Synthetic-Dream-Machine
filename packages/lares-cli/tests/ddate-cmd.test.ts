/**
 * `lares ddate` — the host verb that reads the Discordian calendar through the house's own core: it answers the
 * argument shape of the host's `ddate(1)`, needs no vessel, names its entropy source under `--json`, and stands in the
 * host's command scope.
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import { dispatch, COMMANDS } from "../src/bin/lares.js";
import { commandScope } from "../src/host-bridge.js";

async function run(argv: string[]): Promise<{ code: number; out: string; err: string }> {
  const out: string[] = []; const err: string[] = [];
  const lo = vi.spyOn(console, "log").mockImplementation((...a) => { out.push(a.map(String).join(" ")); });
  const le = vi.spyOn(console, "error").mockImplementation((...a) => { err.push(a.map(String).join(" ")); });
  const so = vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => { out.push(String(chunk).replace(/\n$/, "")); return true; });
  try { const code = await dispatch(argv); return { code, out: out.join("\n"), err: err.join("\n") }; }
  finally { lo.mockRestore(); le.mockRestore(); so.mockRestore(); }
}
afterEach(() => vi.restoreAllMocks());

describe("lares ddate", () => {
  test("the verb stands in the table, runs on the host, and takes no flag of its own beside the global --json", () => {
    const row = COMMANDS.find((c) => c.name === "ddate");
    expect(row).toBeDefined();
    expect(row?.accepts).toEqual([]);
    expect(commandScope("ddate")).toBe("host");
  });

  test("the default answers the bare line through a pipe, and --json answers the envelope", async () => {
    const plain = await run(["ddate", "5", "1", "2024"]);
    expect(plain.out).toBe("Setting Orange, Chaos 5, 3190 YOLD");
    const env = JSON.parse((await run(["ddate", "--json", "5", "1", "2024"])).out) as { ok: boolean; data: { text: string } };
    expect(env.ok).toBe(true);
    expect(env.data.text).toBe("Setting Orange, Chaos 5, 3190 YOLD");
  });

  test("a refusal under --json still exits 2", async () => {
    expect((await run(["ddate", "--json", "32", "1", "2024"])).code).toBe(2);
  });

  test("a named day answers as the host's ddate does", async () => {
    const r = await run(["ddate", "5", "1", "2024"]);
    expect(r.code).toBe(0);
    expect(r.out).toBe("Setting Orange, Chaos 5, 3190 YOLD");
  });

  test("a +FORMAT rides the same line, the easter egg and St. Tib's span included", async () => {
    expect((await run(["ddate", "+%e|%E", "11", "1", "2025"])).out).toBe("11th|11st");
    expect((await run(["ddate", "+%{%A, %B %d%}, %Y YOLD", "29", "2", "2024"])).out).toBe("St. Tib's Day, 3190 YOLD");
    expect((await run(["ddate", "+%H", "5", "1", "2025"])).out).toBe("Mungday");
  });

  test("a bare line reads today's local day through the default format", async () => {
    const r = await run(["ddate"]);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/^Today is [A-Za-z' .-]+, the \d+(st|nd|rd|th) day of (Chaos|Discord|Confusion|Bureaucracy|The Aftermath) in the YOLD \d+/);
  });

  test("--json carries the reading and names the entropy door a %. drew from", async () => {
    const drawn = JSON.parse((await run(["ddate", "--json", "+%.", "1", "1", "2025"])).out) as { ok: boolean; data: { text: string; entropy: string | null; yold: number; season: string } };
    expect(drawn.ok).toBe(true);
    expect(drawn.data.entropy).toBe("platform:crypto.getRandomValues");
    expect(drawn.data.text.length).toBeGreaterThan(0);
    expect(drawn.data).toMatchObject({ yold: 3191, season: "Chaos" });
    const plain = JSON.parse((await run(["ddate", "--json", "+%A", "1", "1", "2025"])).out) as { data: { entropy: string | null } };
    expect(plain.data.entropy).toBe(null);
  });

  test("a date out of range and a wrong count refuse by name, exit 2", async () => {
    const bad = await run(["ddate", "32", "1", "2024"]);
    expect(bad.code).toBe(2);
    expect(bad.err).toContain("Invalid date -- out of range");
    const few = await run(["ddate", "1", "1"]);
    expect(few.code).toBe(2);
    expect(few.err).toContain("usage: lares ddate [+FORMAT] [<day> <month> <year>]");   // the spine the carrier's seats derive
  });

  test("a BCE year rides as a bare negative number", async () => {
    expect((await run(["ddate", "1", "1", "-5"])).out).toBe("Sweetmorn, Chaos 1, 1162 YOLD");
  });
});
