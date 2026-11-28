/**
 * `lares home undo` puts back the bytes a tend replaced in the operator's homes, a settings file that lacks the doors' deny list among them, so it
 * takes the consent `tend` takes and one more: an AI seat refuses by name before any home or ledger is read, a terminal
 * asks, and no terminal needs `--yes`. Every case here refuses before the door resolves a home, so no real home is read.
 *
 * Meme: lar:///ha.ka.ba/lares/cli/reality-tunnel
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cmdTunnelDoor } from "../src/commands/tunnel-door.js";
import { EXIT } from "../src/reality-tunnel/engine.js";
import { parseArgs } from "../src/parse-args.js";

const AI = () => ({ refusal: "hand-act-only" }) as const;
const UNREAD = () => ({ refusal: "hand-unattested" }) as const;
const HAND = () => ({ admit: "hand" }) as const;

let said: string[];
beforeEach(() => {
  said = [];
  vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => { said.push(a.join(" ")); });
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); });

describe("lares home undo — the operator's hand, at a terminal or by --yes", () => {
  it.each([
    [["home", "undo"]],
    [["home", "undo", "3"]],
    [["home", "force=true", "undo"]],
    [["home", "--json", "undo"]],
    [["home", "undo", "--yes"]],
  ])("RED: an AI seat's %j refuses hand-act-only by name and names the cure", async (argv) => {
    expect(await cmdTunnelDoor("home", parseArgs(argv), AI)).toBe(EXIT.usage);
    const text = said.join("\n");
    expect(text).toMatch(/lares home undo: refused hand-act-only/);
    expect(text).toMatch(/run `lares home undo/);
    expect(text).toMatch(/own terminal/);
  });

  it("RED: a branch the gate reads nothing on refuses hand-unattested by name and names a readable terminal", async () => {
    expect(await cmdTunnelDoor("home", parseArgs(["home", "undo", "--yes"]), UNREAD)).toBe(EXIT.usage);
    const text = said.join("\n");
    expect(text).toMatch(/lares home undo: refused hand-unattested/);
    expect(text).not.toMatch(/hand-act-only/);
    expect(text).toMatch(/Run `lares home undo/);
    expect(text).toMatch(/whose processes the host can read/);
  });

  it("RED: a hand with no terminal and no --yes refuses and names --yes", async () => {
    if (process.stdin.isTTY) return;
    expect(await cmdTunnelDoor("home", parseArgs(["home", "undo"]), HAND)).toBe(EXIT.usage);
    expect(said.join("\n")).toMatch(/pass --yes/);
  });

  it("CONTROL: the repo door's undo reads no seat (the checkout stays the spirit's working ground)", async () => {
    const seat = vi.fn(AI);
    // A generation that reads no whole number refuses before anything moves, past the seat gate the home door alone keeps.
    expect(await cmdTunnelDoor("repo", parseArgs(["repo", "undo", "x"]), seat)).toBe(EXIT.usage);
    expect(seat).not.toHaveBeenCalled();
    expect(said.join("\n")).toMatch(/a generation is a whole number/);
  });
});
