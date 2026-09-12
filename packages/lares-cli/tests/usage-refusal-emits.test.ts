/**
 * A USAGE REFUSAL IS AN EMISSION, NOT PROSE ON stderr.
 *
 * `render.ts` states the invariant: "ONE CHOKE POINT, ONE NARROW CORRECTION. Every error surfaces through
 * `emit`." Every hand-rolled `usage()` bypassed it — printing prose to stderr and returning a bare code —
 * so under `--json`, the mode that exists "for agents/pipes", an agent invoking a bad sub-verb received
 * ZERO parseable bytes and an exit code. Measured on the built binary before this test existed:
 * `lares library bogus-verb --json` wrote nothing at all to stdout.
 *
 * The exit code was never the gap: `EXIT_FOR.usage` is 2 and the refusals returned it. The PAYLOAD was.
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import { dispatch } from "../src/bin/lares.js";

afterEach(() => vi.restoreAllMocks());

/** Capture what an AGENT reads: stdout alone. Prose on stderr is the human's channel and never parsed. */
function captureJson(): { lines: string[] } {
  const lines: string[] = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
    lines.push(String(chunk)); return true;
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  return { lines };
}

/** The doors whose sub-dispatch refuses an unknown verb through a hand-rolled usage(). */
const DOORS = ["library", "circle", "persona", "vault"] as const;

describe("★ a usage refusal reaches the agent surface ★", () => {
  for (const door of DOORS) {
    test(`${door}: an unknown sub-verb emits a parseable refusal under --json`, async () => {
      const cap = captureJson();
      const code = await dispatch([door, "zzz-not-a-sub-verb", "--json"]);
      expect(code, "the exit vocabulary was never the gap").toBe(2);

      const payload = cap.lines.join("");
      expect(payload, `${door} wrote nothing an agent could parse`).not.toBe("");
      const parsed = JSON.parse(payload) as { ok: boolean; error?: { code?: string; message?: string } };
      expect(parsed.ok).toBe(false);
      expect(parsed.error?.code).toBe("usage");
      expect(parsed.error?.message, "the refusal names the door it came from").toContain(door);
    });
  }

  test("CONTROL — at a TTY the refusal prints prose and emits NO machine payload", async () => {
    // `emit` renders JSON under `--json` OR off-TTY (a pipe IS an agent), so a prose control must actually
    // stand at a terminal. Without this the control passes for the wrong reason — vitest is never a TTY.
    const wasTty = process.stdout.isTTY;
    Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
    try {
      const cap = captureJson();
      const code = await dispatch(["library", "zzz-not-a-sub-verb"]);   // no --json, and a terminal
      expect(code).toBe(2);
      expect(cap.lines.join(""), "a human's channel carries no machine payload").toBe("");
    } finally {
      Object.defineProperty(process.stdout, "isTTY", { value: wasTty, configurable: true });
    }
  });

  test("★ the human is told WHAT THEY TYPED, not only what is valid ★", async () => {
    // The hand-rolled refusals printed the reason AND the menu; routing them through the choke point
    // moved the reason onto the JSON channel alone, so a person at a terminal saw what IS valid and never
    // what they typed. Both readers get both halves.
    const wasTty = process.stdout.isTTY;
    Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
    try {
      const errs: string[] = [];
      vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => { errs.push(a.join(" ")); });
      vi.spyOn(process.stdout, "write").mockImplementation(() => true);
      expect(await dispatch(["library", "zzz-not-a-sub-verb"])).toBe(2);
      const prose = errs.join("\n");
      expect(prose, "the reason the refusal happened").toContain("zzz-not-a-sub-verb");
      expect(prose, "and the menu of what IS valid").toMatch(/usage: lares library/);
    } finally {
      Object.defineProperty(process.stdout, "isTTY", { value: wasTty, configurable: true });
    }
  });

});
