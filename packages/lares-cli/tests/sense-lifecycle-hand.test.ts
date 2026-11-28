/**
 * sense-lifecycle-hand — `lares sense harden|retire|un-retire|purge` and `lares sense teardown confirm=true` run on a person's
 * hand at a real terminal alone (hitl-reads-a-hand). The command runs direct over manifest.json with no socket between it and
 * the vessel, so it reads its own branch through the house hand gate (`readOwnHand`): a harness on the branch refuses
 * `hand-act-only`, whatever `--approve` or `--confirm` says, and nothing moves. CONTROL: the hand path lands every verb, and the
 * reads and the teardown's preview stay open.
 *
 * The suite runs inside a harness as often as in CI, so each case names the reading it stands on; the reader itself carries
 * its own witness (`lararium-node/tests/own-hand-gate.test.ts`).
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { existsSync } from "node:fs";
import { buildEphemeralSensorium, inspectSensorium, memorySensoriumDir, readOwnHand, sensoriumDir } from "@lararium/node";
import {
  cmdSensePromote, cmdSenseRetire, cmdSenseUnRetire, cmdSensePurge, cmdSenseRoster, type HandRead,
} from "../src/commands/sense-lifecycle.js";
import { cmdPalaceTeardown } from "../src/commands/palace-teardown.js";
import { parseArgs } from "../src/parse-args.js";

const AI: HandRead = () => readOwnHand({ proveRoute: false }, "ai");
const UNREAD: HandRead = () => readOwnHand({ proveRoute: false }, "unknown");
const HAND: HandRead = () => readOwnHand({ proveRoute: false }, "hand");

/** Run one sense sub-verb under `json=true`, answering its exit code and the envelope it wrote. */
function run(fn: (a: ReturnType<typeof parseArgs>, h?: HandRead) => number, hand: HandRead, ...argv: string[]): { code: number; out: Record<string, unknown> } {
  const lines: string[] = [];
  const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => { lines.push(String(chunk)); return true; });
  try {
    const code = fn(parseArgs([...argv, "json=true"]), hand);
    return { code, out: JSON.parse(lines.join("").trim().split("\n").at(-1) ?? "{}") as Record<string, unknown> };
  } finally { spy.mockRestore(); }
}

const lifecycle = (name: string): string | undefined => (inspectSensorium(name) as { lifecycle?: string } | null)?.lifecycle;

afterEach(() => vi.restoreAllMocks());

describe("a sense hand verb reads the hand behind the command", () => {
  test("RED: an AI shell's --approve refuses hand-act-only on harden, retire and purge, and nothing moves", () => {
    buildEphemeralSensorium("seat-forges");
    for (const [fn, argv] of [
      [cmdSensePromote, ["harden", "seat-forges", "approve=true"]],
      [cmdSenseRetire, ["retire", "seat-forges", "grounds=superseded", "approve=true"]],
      [cmdSensePurge, ["purge", "seat-forges", "approve=true"]],
    ] as const) {
      const { code, out } = run(fn, AI, ...argv);
      expect(code, argv[0]).not.toBe(0);
      expect(out, argv[0]).toMatchObject({ ok: false, error: { code: "hand-act-only" } });
      expect(String((out["error"] as { message: string }).message), argv[0]).toMatch(new RegExp(`lares sense ${argv[0]}`));
    }
    expect(lifecycle("seat-forges")).toBe("pioneer");
    expect(existsSync(sensoriumDir("seat-forges"))).toBe(true);
  });

  test("RED: an AI shell's un-retire refuses hand-act-only and the tombstone stays", () => {
    buildEphemeralSensorium("seat-restores");
    expect(run(cmdSenseRetire, HAND, "retire", "seat-restores", "grounds=superseded", "approve=true").code).toBe(0);
    const { code, out } = run(cmdSenseUnRetire, AI, "un-retire", "seat-restores");
    expect(code).not.toBe(0);
    expect(out).toMatchObject({ ok: false, error: { code: "hand-act-only" } });
    expect(lifecycle("seat-restores")).toBe("tombstone");
  });

  test("RED: a command whose branch reads unknown refuses hand-unattested", () => {
    buildEphemeralSensorium("unread-branch");
    expect(run(cmdSensePromote, UNREAD, "harden", "unread-branch", "approve=true").out).toMatchObject({ ok: false, error: { code: "hand-unattested" } });
    expect(lifecycle("unread-branch")).toBe("pioneer");
  });

  test("CONTROL: the hand path lands harden, retire, un-retire and purge; --approve still names the intent", () => {
    buildEphemeralSensorium("hand-lands");
    expect(run(cmdSensePromote, HAND, "harden", "hand-lands").out, "the hand without --approve").toMatchObject({ ok: false });
    expect(run(cmdSensePromote, HAND, "harden", "hand-lands", "approve=true").code).toBe(0);
    expect(lifecycle("hand-lands")).not.toBe("pioneer");
    expect(run(cmdSenseRetire, HAND, "retire", "hand-lands", "grounds=superseded", "approve=true").code).toBe(0);
    expect(run(cmdSenseUnRetire, HAND, "un-retire", "hand-lands").code).toBe(0);
    expect(lifecycle("hand-lands")).not.toBe("tombstone");
    expect(run(cmdSenseRetire, HAND, "retire", "hand-lands", "grounds=superseded", "approve=true").code).toBe(0);
    expect(run(cmdSensePurge, HAND, "purge", "hand-lands", "approve=true").code).toBe(0);
    expect(existsSync(sensoriumDir("hand-lands"))).toBe(false);
  });

  test("CONTROL: the roster read stays open to an AI shell", () => {
    expect(run((a) => cmdSenseRoster(a), AI, "roster").code).toBe(0);
  });
});

describe("the teardown's --confirm reads the hand behind the command", () => {
  async function teardown(hand: HandRead, ...argv: string[]): Promise<{ code: number; out: Record<string, unknown> }> {
    const lines: string[] = [];
    const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => { lines.push(String(chunk)); return true; });
    try {
      const code = await cmdPalaceTeardown(parseArgs([...argv, "json=true"]), hand);
      return { code, out: JSON.parse(lines.join("").trim().split("\n").at(-1) ?? "{}") as Record<string, unknown> };
    } finally { spy.mockRestore(); }
  }

  test("RED: an AI shell's --confirm refuses hand-act-only and the scratch sensorium stays", async () => {
    buildEphemeralSensorium("memory");
    const { code, out } = await teardown(AI, "teardown", "memory", "confirm=true", "force=true");
    expect(code).not.toBe(0);
    expect(out).toMatchObject({ ok: false, error: { code: "hand-act-only" } });
    expect(String((out["error"] as { message: string }).message)).toMatch(/lares sense teardown/);
    expect(existsSync(memorySensoriumDir())).toBe(true);
  });

  test("CONTROL: the preview stays open to an AI shell and removes nothing", async () => {
    if (!existsSync(memorySensoriumDir())) buildEphemeralSensorium("memory");
    const { code, out } = await teardown(AI, "teardown", "memory");
    expect(code).toBe(0);
    expect(out).toMatchObject({ ok: true, data: { mode: "preview" } });
    expect(existsSync(memorySensoriumDir())).toBe(true);
  });
});
