import { describe, expect, test } from "vitest";
import { spawnSync } from "node:child_process";
import { operatorHandEnv, runOwnHand, runOwnHandSync, SEAT_MARKS } from "./operator-hand.js";

/**
 * operator-hand — the e2e harness names its own hand. A CLI child the harness launches for an operator-hand act reads as a
 * person's shell whatever launched the suite (a Claude Code or Codex seat leaves its marks on the launcher's environment).
 */
describe("operator-hand — a harness CLI child carries a clean hand", () => {
  const launcher: NodeJS.ProcessEnv = { PATH: "/usr/bin", HOME: "/h", CLAUDECODE: "1", CODEX_SANDBOX: "seatbelt", CODEX_SANDBOX_NETWORK_DISABLED: "1" };
  const probe = ["-e", "process.stdout.write(process.env.CLAUDECODE ?? 'none')"];

  test("every seat mark the walls read leaves the child's environment; every other entry rides through", () => {
    const env = operatorHandEnv(launcher);
    for (const mark of SEAT_MARKS) expect(env, `${mark} stayed on the hand's environment`).not.toHaveProperty(mark);
    expect(env["PATH"]).toBe("/usr/bin");
    expect(env["HOME"]).toBe("/h");
  });

  test("the launcher's own environment stays whole (the hand is a copy, never a mutation)", () => {
    operatorHandEnv(launcher);
    expect(launcher["CLAUDECODE"]).toBe("1");
  });

  test("a child that names its seat carries the mark: the same act under a seat mark still reads as a seat", () => {
    const seat = operatorHandEnv(launcher, { CLAUDECODE: "1" });
    expect(spawnSync(process.execPath, probe, { env: seat, encoding: "utf8" }).stdout).toBe("1");
    expect(spawnSync(process.execPath, probe, { env: operatorHandEnv(launcher), encoding: "utf8" }).stdout).toBe("none");
  });

  test("an own-hand child starts orphaned in a fresh session: its parent is no process of this suite, its streams and code come back", async () => {
    const script = "process.stdout.write(JSON.stringify({ ppid: process.ppid, mark: process.env.CLAUDECODE ?? null })); process.stderr.write('e'); process.exit(3)";
    for (const r of [runOwnHandSync(process.execPath, ["-e", script], { env: launcher }), await runOwnHand(process.execPath, ["-e", script], { env: launcher })]) {
      const said = JSON.parse(r.stdout) as { ppid: number; mark: string | null };
      expect(r.code).toBe(3);
      expect(r.stderr).toBe("e");
      expect(said.mark, "the orphan carried a seat mark").toBeNull();
      expect(said.ppid, "the orphan's parent stayed this suite's own process").not.toBe(process.pid);
    }
  });

  test("an own-hand child that names its seat keeps the mark (the wall's own control)", () => {
    const r = runOwnHandSync(process.execPath, ["-e", "process.stdout.write(process.env.CLAUDECODE ?? 'none')"], { env: launcher, seat: { CLAUDECODE: "1" } });
    expect(r.stdout).toBe("1");
  });
});
