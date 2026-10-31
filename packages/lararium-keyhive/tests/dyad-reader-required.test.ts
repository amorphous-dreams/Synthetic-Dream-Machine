/**
 * dyad-reader-required.test — the daemon island's two dyad consults take a reader or refuse by name.
 *
 * R1 NO READER, NO BIND AND NO SEAT. `requireDyadReader` hands back the reader it received and throws
 *    `DyadReaderAbsent`, naming its gate, when it received none. Control: a standing reader comes back whole and
 *    answers its word.
 * R2 BOTH CONSULTS PASS THROUGH IT (a source weld, comments stripped, strip pinned). The behavior calls
 *    `requireDyadReader(` once per gate; no consult defaults a missing reader to `clear`; and no
 *    site asks the raw `dyadReading` option without the guard. The resolved reader takes the node's injected
 *    reader or the browser island's board reader. The content-key seat's two readings (a seat's
 *    standing, the vessel's own shadow) pass through it too.
 */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { requireDyadReader } from "../src/operator-daemon-behavior.js";

describe("the island's dyad consults take a reader or refuse", () => {
  test("R1 no reader refuses by name; a reader comes back whole", async () => {
    const reader = (): "owing" => "owing";
    expect(requireDyadReader(reader, "the join gate")).toBe(reader);            // control
    expect(await requireDyadReader(reader, "the Binding Gate")("0x" + "ab".repeat(32), "cd".repeat(32))).toBe("owing");
    expect(() => requireDyadReader(undefined, "the join gate")).toThrow(/DyadReaderAbsent/);
    expect(() => requireDyadReader(undefined, "the join gate")).toThrow(/the join gate/);
    expect(() => requireDyadReader(undefined, "the Binding Gate")).toThrow(/the Binding Gate/);
    expect(() => requireDyadReader(undefined, "the content-key seat")).toThrow(/the content-key seat/);
    expect(() => requireDyadReader(undefined, "the seat summons")).toThrow(/the seat summons/);
  });

  test("R2 both consults pass through the guard and none defaults to clear", () => {
    const src = readFileSync(join(__dirname, "..", "src", "operator-daemon-behavior.ts"), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    expect(code, "the comment strip ate the file").toMatch(/runFaceJoinOperation\(/);
    expect(code).toMatch(/const dyadReader = \(ctx: IslandContext, face = daemonAuth\): DyadReader \| undefined => readDyadFromBoard\s*\?[\s\S]*?boardDyadReader\(\s*ctx\.repo,[\s\S]*?:\s*dyadReading;/);
    expect((code.match(/requireDyadReader\(dyadReader\(ctx\), "the join gate"\)\(/g) ?? []).length).toBe(1);
    // The mounted face's boot and each joined face's boot each pass the guard.
    expect((code.match(/requireDyadReader\(dyadReader\(ctx(?:, \{ \.\.\.daemonAuth, \.\.\.face \})?\), "the Binding Gate"\)\(/g) ?? []).length).toBe(2);
    // The intent door reads a device's standing through the same guard, under the face's live lineage: an island with no reader stalls it as unknown, never as clear.
    expect((code.match(/requireDyadReader\(dyadReader\(ctx, liveFace\(\)\), "the intent door"\)\(/g) ?? []).length).toBe(1);
    // The seat summons (the joinee's half of the intent door) reads its OWN edge's standing through the same guard: never a summons from an edge set aside.
    expect((code.match(/requireDyadReader\(dyadReader\(ctx\), "the seat summons"\)\(/g) ?? []).length).toBe(1);
    // The content-key seat reads a seat's standing and its own shadow through the same guard.
    expect((code.match(/requireDyadReader\(dyadReader\(ctx\), "the content-key seat"\)\(/g) ?? []).length).toBe(2);
    expect(code).not.toMatch(/dyadReading\s*\?(?!:)/);     // no ternary over the reader: no optional consult, no default
    expect(code).toMatch(/dyadReading\?: DyadReader;/);     // control for the line above: the option's own declaration stands
    expect(code).not.toMatch(/await dyadReading\(/);       // no raw ask around the guard
    expect(code).not.toMatch(/:\s*"clear"\s*;/);
  });
});
