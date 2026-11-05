/**
 * A pasted line keeps what follows it: the first line end resolves the prompt and the rest of that chunk
 * returns to the stream for the next read. One CRLF counts as one line end, even when its two bytes arrive
 * in two chunks. Ctrl-C and backspace read as ever, and a non-TTY stdin still refuses.
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import { promptSecret, promptLine } from "../src/prompt-secret.js";

/** A TTY stream that buffers what is given back with `unshift` and delivers it once resumed, as Node does on the next tick. */
class FakeTty extends EventEmitter {
  isTTY = true;
  isRaw = false;
  readonly setRawMode = vi.fn((on: boolean) => { this.isRaw = on; });
  readonly setEncoding = vi.fn();
  private held: string[] = [];
  private flowing = false;
  resume(): this { this.flowing = true; queueMicrotask(() => this.drain()); return this; }
  pause(): this { this.flowing = false; return this; }
  unshift(chunk: string): void { this.held.unshift(chunk); }
  /** A chunk arriving from the keyboard. */
  feed(chunk: string): void { this.held.push(chunk); this.drain(); }
  private drain(): void {
    while (this.flowing && this.held.length > 0 && this.listenerCount("data") > 0) {
      this.emit("data", this.held.shift()!);
    }
  }
}

const quiet = (): void => { vi.spyOn(process.stdout, "write").mockImplementation(() => true); };
afterEach(() => { vi.restoreAllMocks(); });

describe("promptSecret keeps the rest of a pasted chunk", () => {
  test("one chunk of two lines answers two prompts", async () => {
    quiet();
    const tty = new FakeTty();
    const first = promptSecret("a: ", tty as never);
    tty.feed("alpha\rbeta\r");
    expect(await first).toBe("alpha");
    expect(await promptSecret("b: ", tty as never)).toBe("beta");
  });

  test("a CRLF in one chunk is one line end, never an empty second line", async () => {
    quiet();
    const tty = new FakeTty();
    const first = promptSecret("a: ", tty as never);
    tty.feed("alpha\r\n");
    expect(await first).toBe("alpha");
    const second = promptSecret("b: ", tty as never);
    tty.feed("beta\r");
    expect(await second).toBe("beta");
  });

  test("a CRLF split across two chunks is one line end", async () => {
    quiet();
    const tty = new FakeTty();
    const first = promptSecret("a: ", tty as never);
    tty.feed("alpha\r");
    expect(await first).toBe("alpha");
    const second = promptSecret("b: ", tty as never);
    tty.feed("\nbeta\r");
    expect(await second).toBe("beta");
  });

  test("a bare line feed ends a line like a return", async () => {
    quiet();
    const tty = new FakeTty();
    const first = promptLine("a: ", tty as never);
    tty.feed("alpha\nbeta\n");
    expect(await first).toBe("alpha");
    expect(await promptLine("b: ", tty as never)).toBe("beta");
  });

  test("control: one line per chunk reads as ever, backspace edits, raw mode restores", async () => {
    quiet();
    const tty = new FakeTty();
    const first = promptSecret("a: ", tty as never);
    tty.feed("alphx\b" + "a\r");
    expect(await first).toBe("alpha");
    expect(tty.setRawMode).toHaveBeenNthCalledWith(1, true);
    expect(tty.setRawMode).toHaveBeenLastCalledWith(false);
    const second = promptSecret("b: ", tty as never);
    tty.feed("beta\r");
    expect(await second).toBe("beta");
  });

  test("control: Ctrl-C rejects", async () => {
    quiet();
    const tty = new FakeTty();
    const p = promptSecret("a: ", tty as never);
    tty.feed("alp\u0003");
    await expect(p).rejects.toThrow("aborted");
  });

  test("control: a secret never echoes, a visible line does", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const tty = new FakeTty();
    const secret = promptSecret("s: ", tty as never);
    tty.feed("hunter2\r");
    await secret;
    expect(write.mock.calls.map((c) => String(c[0])).join("")).not.toContain("hunter2");
    write.mockClear();
    const visible = promptLine("v: ", tty as never);
    tty.feed("ok\r");
    await visible;
    expect(write.mock.calls.map((c) => String(c[0])).join("")).toContain("ok");
  });

  test("control: a non-TTY stream rejects", async () => {
    const tty = new FakeTty();
    tty.isTTY = false;
    await expect(promptSecret("a: ", tty as never)).rejects.toThrow(/not a TTY/);
  });
});

describe("the ward door reads a hand's route from a terminal alone (row 7, S2)", () => {
  test("RED: a passphrase in the environment refuses `ward-needs-tty`, and so does a piped stdin; CONTROL: a TTY stream answers", async () => {
    quiet();
    const { readWardPassphrase } = await import("../src/prompt-secret.js");
    const tty = new FakeTty();
    await expect(readWardPassphrase("lares promote commit", { stream: tty as never, env: { LARES_WARD_PASSPHRASE: "typed-by-a-script" } })).rejects.toThrow(/ward-needs-tty/);
    await expect(readWardPassphrase("lares promote commit", { stream: tty as never, env: { LARES_PASSPHRASE: "typed-by-a-script" } })).rejects.toThrow(/ward-needs-tty/);
    const piped = Object.assign(new FakeTty(), { isTTY: false });
    await expect(readWardPassphrase("lares promote commit", { stream: piped as never, env: {} })).rejects.toThrow(/ward-needs-tty/);
    const answered = readWardPassphrase("lares promote commit", { stream: tty as never, env: {} });
    tty.feed("the hand's route\r");
    expect(await answered).toBe("the hand's route");
  });
});

describe("the product ward door answers from no file (S2 cold read, P3)", () => {
  test("RED: under a root that carries the harness's marker, the terminal reader refuses `ward-needs-tty` and never answers the test route; CONTROL: a gatherer the test seats explicitly answers", async () => {
    const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { ttyWardRoute, gatherWardRoute } = await import("../src/ward-door.js");
    const { seatWardGatherer } = await import("@lararium/node");
    const root = mkdtempSync(join(tmpdir(), "ward-door-marker-"));
    writeFileSync(join(root, ".lar-test-scratch"), "");
    const prior = process.env["LAR_ROOT"];
    process.env["LAR_ROOT"] = root;
    try {
      await expect(ttyWardRoute("lares promote commit")).rejects.toThrow(/ward-needs-tty/);
      seatWardGatherer(async () => [{ kind: "passphrase", passphrase: "an explicit test route" }]);
      expect(await gatherWardRoute("lares promote commit")).toEqual([{ kind: "passphrase", passphrase: "an explicit test route" }]);
    } finally {
      if (prior === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior;
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("the product founds no face from a marker (S2 re-read, P2)", () => {
  test("RED: under a root carrying the harness's marker, the product's face-route prompt refuses with no terminal and never answers the published test route; CONTROL: the harness import seats the test route explicitly", async () => {
    const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join, resolve } = await import("node:path");
    const { pathToFileURL } = await import("node:url");
    const { gatherNewFaceRoute } = await import("../src/face-route-prompt.js");
    const root = mkdtempSync(join(tmpdir(), "face-route-marker-"));
    writeFileSync(join(root, ".lar-test-scratch"), "");
    const prior = process.env["LAR_ROOT"];
    process.env["LAR_ROOT"] = root;
    try {
      const answer = await gatherNewFaceRoute({ label: "h0" }).then((slots) => JSON.stringify(slots), (e: Error) => e.name);
      expect(answer, "the product never binds a face to the published test route").not.toContain("test-founding-passphrase");
      expect(answer).toBe("CredentialTtyRefusal");
      const node = await import("@lararium/node");
      node.seatFaceRoute(null);
      const harness = await import(pathToFileURL(resolve(import.meta.dirname, "../../../tools/test-ward-route.mjs")).href) as { seatHarnessRoutes: (n: unknown) => void };
      expect(node.faceRouteSeated(), "importing the harness module into a process that is no CLI seats nothing").toBe(false);
      harness.seatHarnessRoutes(node);
      expect(await node.gatherFaceRoute("h0")).toEqual([{ t: 1, pins: [{ kind: "passphrase", passphrase: "test-founding-passphrase" }] }]);
    } finally {
      if (prior === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior;
      rmSync(root, { recursive: true, force: true });
    }
  });
});
