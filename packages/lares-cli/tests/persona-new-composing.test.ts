/**
 * persona new beside a vessel that still recomposes after an unlock (L7). The stub holds the key and never finishes its
 * unlock: its custody door answers `composing: true` at once and every verb line parks. `persona new` refuses by name,
 * with no passphrase asked and no verb sent. The custody probe also hangs up its socket when its wait expires.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createServer, type Server, type Socket } from "node:net";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { cmdPersona } from "../src/commands/persona.js";
import { vesselStanding } from "../src/custody-door.js";
import { udsSocketPath } from "../src/local-connector.js";

vi.setConfig({ testTimeout: 30_000 });

describe("a vessel that recomposes", () => {
  let root: string;
  let prior: string | undefined;
  let server: Server;
  let verbLines = 0;
  const sockets: Socket[] = [];
  let closedByCaller = 0;

  const listen = async (answer: (sock: Socket, line: string) => void): Promise<void> => {
    mkdirSync(dirname(udsSocketPath()), { recursive: true });
    server = createServer((sock) => {
      sockets.push(sock);
      let buf = "";
      sock.setEncoding("utf8");
      sock.on("close", () => { closedByCaller += 1; });
      sock.on("error", () => {});
      sock.on("data", (d: string) => { buf += d; let i: number; while ((i = buf.indexOf("\n")) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); answer(sock, l); } });
    });
    await new Promise<void>((r) => server.listen(udsSocketPath(), r));
  };

  beforeEach(() => {
    prior = process.env["LAR_ROOT"];
    root = mkdtempSync(join(tmpdir(), "lares-composing-"));
    process.env["LAR_ROOT"] = root;
    verbLines = 0; closedByCaller = 0;
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    for (const s of sockets.splice(0)) s.destroy();
    await new Promise<void>((r) => server?.close(() => r()));
    if (prior === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior;
    rmSync(root, { recursive: true, force: true });
  });

  test("RED: persona new refuses vessel-composing at once while the unlock never finishes, and no verb line reaches the socket", async () => {
    await listen((sock, line) => {
      const frame = JSON.parse(line) as { op?: string };
      if (frame.op === "custody") sock.write(JSON.stringify({ op: "custody", unlocked: true, composing: true, slot: "s", attemptsLeft: 3, standing: "herm" }) + "\n", () => sock.end());
      else verbLines += 1;                                   // the parked line: never answers
    });
    const out = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const t0 = Date.now();
    const code = await cmdPersona({ command: "persona", positional: ["new", "1"], options: { name: "x" }, flags: { json: true } });
    const said = out.mock.calls.map((c) => String(c[0])).join("");
    expect(code).toBe(1);
    expect(Date.now() - t0).toBeLessThan(3_000);
    expect(said).toContain("vessel-composing");
    expect(verbLines).toBe(0);
  });

  test("RED: a reading that flips to composing DURING the route prompt refuses vessel-composing at the row, sending no verb", async () => {
    let ready = true;
    await listen((sock, line) => {
      const frame = JSON.parse(line) as { op?: string };
      if (frame.op === "custody") sock.write(JSON.stringify({ op: "custody", unlocked: true, composing: !ready, slot: "s", attemptsLeft: 3, standing: "herm" }) + "\n", () => sock.end());
      else if (frame.op === "face-route") { ready = false; sock.write(JSON.stringify({ op: "face-route", ref: "a".repeat(64) }) + "\n", () => sock.end()); }
      else verbLines += 1;
    });
    const route = await import("../src/face-route-prompt.js");
    const handed = vi.spyOn(route, "handFaceRouteToVessel").mockImplementation(async () => { ready = false; return "ref"; });
    const out = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const code = await cmdPersona({ command: "persona", positional: ["new", "0"], options: { name: "x" }, flags: { json: true } });
    expect(handed).toHaveBeenCalledWith("h0", "persona-new", { handleIndex: 0 });                       // the early reading read ready, so the prompt ran
    expect(code).toBe(1);
    expect(out.mock.calls.map((c) => String(c[0])).join("")).toContain("vessel-composing");
    expect(verbLines).toBe(0);
  });

  test("the probe hangs up its socket when its wait expires, and reads silent", async () => {
    await listen(() => { /* accepts and answers nothing */ });
    expect(await vesselStanding(undefined, 150)).toEqual({ reading: "silent" });
    await vi.waitFor(() => expect(closedByCaller).toBeGreaterThan(0));
  });
});
