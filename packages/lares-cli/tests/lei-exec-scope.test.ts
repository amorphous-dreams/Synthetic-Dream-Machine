/**
 * lei-exec-scope — `lares lei kui|restring --rite exec --scope '<json>'`: the executable-record lei on the CLI (backlog-awakens
 * "The executable-record lei"). The scope names the wiki, the writer, and a title set or one class; the branch derives from the
 * wiki (`execLeiBranch`), so the hand names no branch. A scope on another rite, or an exec lei with none, refuses as usage. The
 * node's swarm row carries the scope to the door, and the pūlama's hand door reads it too. Every red pairs with a CONTROL.
 */
import { describe, expect, it } from "vitest";
import { execLeiBranch } from "@lararium/mesh/exec-lei";
import { parseArgs } from "../src/parse-args.js";
import { LeiUsage, leiPlan } from "../src/commands/lei.js";
import { COMMANDS } from "../src/bin/lares.js";
import { COMMAND_HELP as HELP } from "../src/command-help.js";

const plan = (...line: string[]) => leiPlan(parseArgs(["lei", ...line]));
const SCOPE = { wiki: "notes", writer: "seat", class: "startup-action" };

describe("lares lei carries an exec lei's scope", () => {
  it("RED: kui --rite exec --scope strings at the wiki's line with the scope; restring carries it too; CONTROL: a push lei plans as before", () => {
    expect(plan("kui", "--rite", "exec", "--scope", JSON.stringify(SCOPE), "--returns", "2"))
      .toEqual({ verb: "swarm-lei-kui", args: { rite: "exec", branch: execLeiBranch("notes"), scope: SCOPE, returns: 2, after: null } });
    expect(plan("restring", "--rite", "exec", "--scope", JSON.stringify({ wiki: "notes", writer: "seat", titles: ["A b"] }), "--returns", "1"))
      .toEqual({ verb: "swarm-lei-restring", args: { rite: "exec", branch: execLeiBranch("notes"), scope: { wiki: "notes", writer: "seat", titles: ["A b"] }, returns: 1 } });
    expect(plan("kui", "--rite", "push", "--branch", "feature/x", "--returns", "3")).toEqual({ verb: "swarm-lei-kui", args: { rite: "push", branch: "feature/x", returns: 3, after: null } });
  });

  it("RED: a scope that reads no JSON, a scope on another rite, and an exec lei with none refuse as usage", () => {
    expect(() => plan("kui", "--rite", "exec", "--scope", "{", "--returns", "1")).toThrow(LeiUsage);
    expect(() => plan("kui", "--rite", "push", "--branch", "x", "--scope", JSON.stringify(SCOPE), "--returns", "1")).toThrow(LeiUsage);
    expect(() => plan("kui", "--rite", "exec", "--returns", "1")).toThrow(LeiUsage);
  });

  it("RED: the lei command accepts --scope and its usage names the exec rite; CONTROL: --rite still stands", () => {
    const lei = COMMANDS.find((c) => c.name === "lei")!;
    expect(lei.accepts).toContain("scope");
    expect(lei.accepts).toContain("rite");
    expect(HELP["lei"]!.usage).toMatch(/push\|kukulu\|keep\|exec/);
    expect(HELP["lei"]!.usage).toMatch(/--scope/);
  });
});
