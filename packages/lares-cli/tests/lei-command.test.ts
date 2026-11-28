/**
 * lei-command — `lares lei show | kui | unstring | restring`: the lei door on the CLI.
 *
 * Each sub-verb plans one store row and the args it carries (`leiPlan`); the plan runs through the store door. The plan alone
 * runs here: no vessel stands. Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { describe, expect, it } from "vitest";
import { parseArgs } from "../src/parse-args.js";
import { LeiUsage, leiPlan } from "../src/commands/lei.js";
import { COMMANDS } from "../src/bin/lares.js";

const CID = "c".repeat(64), HEAD = "a".repeat(40);
const plan = (...line: string[]) => leiPlan(parseArgs(["lei", ...line]));

describe("lares lei plans one store row per sub-verb", () => {
  it("show: a rite, a branch and a head ask after one rite's lei; with none it reads the board alone", () => {
    expect(plan("show", "rite=push", "branch=feature/x", `head=${HEAD}`)).toEqual({ verb: "swarm-show", args: { rite: "push", branch: "feature/x", head: HEAD } });
    expect(plan("show")).toEqual({ verb: "swarm-show", args: {} });
    // A wide lei names no head, so its line reads by rite and branch alone.
    expect(plan("show", "rite=kukulu", "branch=main")).toEqual({ verb: "swarm-show", args: { rite: "kukulu", branch: "main" } });
    expect(plan("show", "rite=kukulu", "branch=main", `head=${HEAD}`, "face=1")).toEqual({ verb: "swarm-show", args: { rite: "kukulu", branch: "main", head: HEAD, face: 1 } });
  });

  it("kui: wide by default with its returns, and `after` null for the first on the line; the head reach pins the head it names", () => {
    expect(plan("kui", "rite=push", "branch=feature/x", "returns=3")).toEqual({ verb: "swarm-lei-kui", args: { rite: "push", branch: "feature/x", returns: 3, after: null } });
    expect(plan("kui", "rite=push", "branch=feature/x", "returns=40", "yes=true")).toEqual({ verb: "swarm-lei-kui", args: { rite: "push", branch: "feature/x", returns: 40, after: null, confirm: true } });
    expect(plan("kui", "rite=push", "branch=feature/x", "reach=head", `head=${HEAD}`, `after=${CID}`))
      .toEqual({ verb: "swarm-lei-kui", args: { rite: "push", branch: "feature/x", reach: "head", head: HEAD, after: CID } });
  });

  it("unstring names its lei by cid; restring names the newer lei's terms and no `after`", () => {
    expect(plan("unstring", "rite=push", "branch=feature/x", `lei=${CID}`)).toEqual({ verb: "swarm-lei-unstring", args: { rite: "push", branch: "feature/x", lei: CID } });
    expect(plan("restring", "rite=kukulu", "branch=main", "returns=1")).toEqual({ verb: "swarm-lei-restring", args: { rite: "kukulu", branch: "main", returns: 1 } });
  });

  it("RED: an unknown sub-verb, a missing rite or branch, a count that reads as no count, and a restring that names `after` each refuse by usage", () => {
    for (const line of [[], ["issue"], ["kui", "branch=b", "returns=2"], ["kui", "rite=push", "returns=2"], ["kui", "rite=push", "branch=b", "returns=two"],
      ["kui", "rite=push", "branch=b", "returns=0"], ["unstring", "rite=push", "branch=b"], ["restring", "rite=push", "branch=b", `after=${CID}`],
      ["show", "rite=push"], ["show", "face=x"]]) {
      expect(() => plan(...line), line.join(" ")).toThrow(LeiUsage);
    }
  });

  it("the command table names the door, and marks the three acts that hold a key", () => {
    const row = COMMANDS.find((c) => c.name === "lei");
    expect(row).toMatchObject({ signs: true, signsOnly: ["kui", "unstring", "restring"] });
  });
});
