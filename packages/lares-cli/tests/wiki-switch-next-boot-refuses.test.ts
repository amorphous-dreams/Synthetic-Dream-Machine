/**
 * wiki-switch-next-boot-refuses — the boot pointer burned (pin migration step 1, research/pin-mu#S2).
 *
 * RED FIRST, written unrun. `lares wiki switch <slug> --next-boot` and `lares wiki open <slug>` ran the `open-wiki` verb, which
 * wrote `bags/daemon/active-wiki`. No vessel-scope boot pointer stands now: each answers a NAMED refusal whose cure runs as
 * typed (the live switch, or the face's own home-preference write), and neither sends a verb down the wire.
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import { dispatch } from "../src/bin/lares.js";

async function run(argv: string[]): Promise<{ code: number; err: string }> {
  const err: string[] = [];
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation((...a) => { err.push(a.map(String).join(" ")); });
  return { code: await dispatch([...argv, "--no-json"]), err: err.join("\n") };
}
afterEach(() => vi.restoreAllMocks());

describe("the burned boot pointer answers by name", () => {
  test("`wiki switch <slug> --next-boot` refuses next-boot-burned and names both cures", async () => {
    const r = await run(["wiki", "switch", "works", "--next-boot"]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("next-boot-burned");
    expect(r.err).toContain("lares wiki switch works");
    expect(r.err).toContain('lares tiddler put $:/config/lares/home/wiki --recipe default --text "[[works]]"');
  });

  test("`wiki open <slug>` answers its moved pointer to the same two cures, never an unknown flag", async () => {
    const r = await run(["wiki", "open", "works"]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("moved to");
    expect(r.err).toContain("lares wiki switch <slug>");
    expect(r.err).toContain("$:/config/lares/home/wiki");
    expect(r.err).not.toContain("unknown flag");
  });
});
