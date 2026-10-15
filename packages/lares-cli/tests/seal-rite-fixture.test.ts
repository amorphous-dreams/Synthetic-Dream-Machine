/**
 * seal-rite-fixture.test — the door CLI tests seat and roll a charter through.
 *
 * Proven, over a door that records what it gets and seats nothing:
 *   · a rite enters the `nexus` command at `seal seat` or `seal rotate`, asks for JSON, and hands back the
 *     door's exit code with the one JSON payload it printed;
 *   · the helper adds nothing to arm a head: the rite arms itself behind the custody door, so the options a
 *     test names reach the verb exactly, and no others;
 *   · a rite keeps every chunk its verb writes, in order, and reads the first JSON payload as the answer;
 *   · a stdout spy the calling test seated still collects each chunk and still stands after the rite; a bare
 *     stdout stands restored;
 *   · an arming option passed by hand refuses by name, and the door never runs.
 */
import { describe, test, expect, vi } from "vitest";
import type { ParsedArgs } from "../src/parse-args.js";
import { ARMING_OPTIONS, sealRite } from "./seal-rite-fixture.js";

/** A door that records every call, prints one JSON payload and answers `code`. */
function recordingDoor(code = 0) {
  const calls: ParsedArgs[] = [];
  const run = async (args: ParsedArgs): Promise<number> => {
    calls.push(args);
    process.stdout.write(`${JSON.stringify({ ok: code === 0, data: { verb: args.positional.join(" ") } })}\n`);
    return code;
  };
  return { calls, run };
}

describe("the seal rite's door", () => {
  test("★ a rite enters the nexus command at its verb, asks for JSON, and hands back the code and the payload ★", async () => {
    const door = recordingDoor();
    const rite = sealRite(door.run);
    const seated = await rite.seat();
    const rolled = await rite.rotate();
    expect(door.calls.map((c) => [c.command, ...c.positional])).toEqual([["nexus", "seal", "seat"], ["nexus", "seal", "rotate"]]);
    expect(door.calls.every((c) => c.flags["json"] === true)).toBe(true);
    expect(seated).toMatchObject({ code: 0, out: { ok: true, data: { verb: "seal seat" } } });
    expect(rolled).toMatchObject({ code: 0, out: { ok: true, data: { verb: "seal rotate" } } });
    expect(seated.printed).toHaveLength(1);
    // A door that refuses hands its code back, payload and all.
    const refused = await sealRite(recordingDoor(1).run).rotate();
    expect(refused).toMatchObject({ code: 1, out: { ok: false, data: { verb: "seal rotate" } } });
  });

  test("★ the helper adds nothing to arm a head: the options a test names reach the verb exactly ★", async () => {
    const door = recordingDoor();
    const rite = sealRite(door.run);
    await rite.seat({ threshold: "2" });
    await rite.rotate();
    expect(door.calls.map((c) => c.options)).toEqual([{ threshold: "2" }, {}]);
  });

  test("an arming option passed by hand refuses by name, and the door never runs", async () => {
    const door = recordingDoor();
    const rite = sealRite(door.run);
    for (const name of ARMING_OPTIONS) {
      await expect(rite.seat({ [name]: "ab".repeat(32) })).rejects.toMatchObject({ code: "arming-option-by-hand" });
      await expect(rite.rotate({ [name]: "ab".repeat(32) })).rejects.toMatchObject({ code: "arming-option-by-hand" });
    }
    expect(door.calls).toHaveLength(0);
    expect((await rite.seat({ threshold: "3" })).code).toBe(0);   // CONTROL: another option passes
    expect(door.calls[0]!.options).toEqual({ threshold: "3" });
  });

  test("a rite keeps every chunk in order, reads the first JSON payload as the answer, and leaves stdout as it found it", async () => {
    const bare = process.stdout.write;
    const chatty = async (): Promise<number> => {
      process.stdout.write("a plain line\n");
      process.stdout.write(`${JSON.stringify({ first: true })}\n`);
      process.stdout.write(`${JSON.stringify({ second: true })}\n`);
      return 0;
    };
    const said = await sealRite(chatty).seat();
    expect(said.out).toEqual({ first: true });
    expect(said.printed.map((line) => line.trim())).toEqual(["a plain line", "{\"first\":true}", "{\"second\":true}"]);
    expect(process.stdout.write).toBe(bare);
    // A door that throws still hands stdout back.
    await expect(sealRite(async () => { throw new Error("a synthetic fault"); }).seat()).rejects.toThrow("a synthetic fault");
    expect(process.stdout.write).toBe(bare);
    expect((await sealRite(async () => 0).rotate()).out).toEqual({});   // CONTROL: nothing printed, nothing read
  });

  test("a stdout spy the calling test seated still collects each chunk, and still stands after the rite", async () => {
    const collected: string[] = [];
    const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => { collected.push(String(chunk)); return true; });
    try {
      const said = await sealRite(recordingDoor().run).seat();
      expect(collected).toEqual(said.printed);
      expect(collected).toHaveLength(1);
      expect(process.stdout.write).toBe(spy);
      process.stdout.write("after the rite\n");
      expect(collected).toHaveLength(2);
    } finally { spy.mockRestore(); }
  });
});
