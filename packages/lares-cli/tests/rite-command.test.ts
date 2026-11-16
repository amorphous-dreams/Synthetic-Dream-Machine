/**
 * rite-command — `lares rite kukulu | begin | land | receipts` (road L45d).
 *
 * `kukulu` (kūkulu: a vessel raised again around its hearth) runs on the host: it begins the rite in the vessel (the lei's
 * return and the guest half of the tessera), and only then calls the host shim to rebuild the image and raise the vessel; the
 * vessel that stands after lands the host half. Every port here answers from a FAKE: no shim runs, no container, no git.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { describe, expect, it } from "vitest";
import { parseArgs } from "../src/parse-args.js";
import { RiteUsage, ritePlan } from "../src/commands/rite.js";
import { riteKukulu, type RitePorts, type RiteRowAnswer } from "../src/rite-kukulu.js";
import { decideRoute } from "../src/host-bridge.js";
import { COMMAND_NAMES } from "../src/bin/lares.js";

const HEAD = "a".repeat(40), TESSERA = "c".repeat(64);
const plan = (...line: string[]) => ritePlan(parseArgs(["rite", ...line]));

/** Ports that record every call in order and answer from a script. */
function fakes(over: { begin?: RiteRowAnswer; land?: RiteRowAnswer; shim?: Partial<Record<"build" | "down" | "up", number>> } = {}) {
  const calls: string[] = [], said: string[] = [];
  const ports: RitePorts = {
    checkout: async () => { calls.push("checkout"); return { head: HEAD, branch: "main" }; },
    row: async (verb, args) => {
      calls.push(`${verb} ${JSON.stringify(args)}`);
      if (verb === "rite-begin") return over.begin ?? { ok: true, output: { tessera: TESSERA, rite: "kukulu", lei: "d".repeat(64), n: 1, begun: "e".repeat(64) } };
      return over.land ?? { ok: true, output: { tessera: TESSERA, rite: "kukulu", begun: "e".repeat(64), landed: "f".repeat(64), par: true } };
    },
    shim: async (verb) => { calls.push(`shim ${verb}`); return over.shim?.[verb] ?? 0; },
    say: (line) => { said.push(line); },
  };
  return { ports, calls, said };
}

describe("rite-begun-before-down", () => {
  it("RED: the rite begins in the vessel before any shim verb runs, and the vessel goes down only after the build; CONTROL: the landing follows the raise and reads par", async () => {
    const f = fakes();
    const out = await riteKukulu(f.ports, {});
    expect(f.calls).toEqual([
      "checkout",
      `rite-begin ${JSON.stringify({ rite: "kukulu", branch: "main", head: HEAD })}`,
      "shim build", "shim down", "shim up",
      `rite-land ${JSON.stringify({ tessera: TESSERA, head: HEAD })}`,
    ]);
    expect(out).toEqual({ code: 0, data: { rite: "kukulu", branch: "main", head: HEAD, tessera: TESSERA, begun: true, landed: true, par: true } });
  });

  it("RED: a build that fails leaves the vessel standing: no down, no up, no landing, and the answer names the begun half that now waits", async () => {
    const f = fakes({ shim: { build: 3 } });
    const out = await riteKukulu(f.ports, {});
    expect(f.calls.filter((c) => c.startsWith("shim"))).toEqual(["shim build"]);
    expect(f.calls.some((c) => c.startsWith("rite-land"))).toBe(false);
    expect(out).toMatchObject({ code: 1, data: { tessera: TESSERA, begun: true, landed: false, stopped: "build" } });
    expect(f.said.join("\n")).toMatch(/the lei's return stays spent/);
  });

  it("RED: a raise that fails ends the rite with the vessel down and names it; CONTROL: a `--branch` names the line where the checkout's own differs", async () => {
    const f = fakes({ shim: { up: 9 } });
    const out = await riteKukulu(f.ports, { branch: "feature/x" });
    expect(f.calls[1]).toBe(`rite-begin ${JSON.stringify({ rite: "kukulu", branch: "feature/x", head: HEAD })}`);
    expect(f.calls.filter((c) => c.startsWith("shim"))).toEqual(["shim build", "shim down", "shim up"]);
    expect(out).toMatchObject({ code: 1, data: { landed: false, stopped: "up" } });
  });
});

describe("rite-refuses-without-lei", () => {
  it("RED: a begin the vessel refuses runs no shim verb at all, and the refusal rides the answer under its own code; CONTROL: the same ports with a lei standing reach the shim", async () => {
    const f = fakes({ begin: { ok: false, code: "swarm-lei-absent", message: "swarm-lei-absent: the kukulu lei for \"main\" does not stand (absent)" } });
    const out = await riteKukulu(f.ports, {});
    expect(f.calls).toEqual(["checkout", `rite-begin ${JSON.stringify({ rite: "kukulu", branch: "main", head: HEAD })}`]);
    expect(out).toEqual({ code: 1, data: { rite: "kukulu", branch: "main", head: HEAD, begun: false, refusal: "swarm-lei-absent" } });
    expect((await riteKukulu(fakes().ports, {})).code).toBe(0);
  });
});

describe("the vessel that stands locked lands later", () => {
  it("RED: a landing the locked vessel refuses ends the rite clean, names the unlock and the landing still owed, and reads no par", async () => {
    const f = fakes({ land: { ok: false, code: "vessel-locked", message: "this vessel's key rests unopened" } });
    const out = await riteKukulu(f.ports, {});
    expect(out).toEqual({ code: 0, data: { rite: "kukulu", branch: "main", head: HEAD, tessera: TESSERA, begun: true, landed: false, awaits: "unlock" } });
    expect(f.said.join("\n")).toMatch(new RegExp(`lares vault unlock[\\s\\S]*lares rite land --tessera ${TESSERA} --head ${HEAD}`));
  });

  it("RED: any other landing refusal ends the rite red under its own code", async () => {
    const out = await riteKukulu(fakes({ land: { ok: false, code: "rite-begun-absent", message: "rite-begun-absent: none" } }).ports, {});
    expect(out).toMatchObject({ code: 1, data: { landed: false, refusal: "rite-begun-absent" } });
  });
});

describe("lares rite plans one store row per vessel sub-verb", () => {
  it("begin names its rite, branch and head and no tree; land names its tessera and head; receipts names nothing", () => {
    expect(plan("begin", "--rite", "kukulu", "--branch", "main", "--head", HEAD)).toEqual({ verb: "rite-begin", args: { rite: "kukulu", branch: "main", head: HEAD } });
    expect(plan("land", "--tessera", TESSERA, "--head", HEAD, "--face", "1")).toEqual({ verb: "rite-land", args: { tessera: TESSERA, head: HEAD, face: 1 } });
    expect(plan("receipts")).toEqual({ verb: "rite-receipts", args: {} });
    // receipt-door-signs-the-tree: the host battery hands the vessel its verdict over a tree.
    expect(plan("receipt", "--tree", "b".repeat(40), "--checks", "typecheck, mesh,cli", "--verdict", "pass", "--definitions", "d".repeat(64)))
      .toEqual({ verb: "rite-receipt", args: { tree: "b".repeat(40), checks: ["typecheck", "mesh", "cli"], verdict: "pass", definitions: "d".repeat(64) } });
  });

  it("RED: an unknown sub-verb and a line that lacks a name refuse by usage; `kukulu` plans no single row", () => {
    for (const line of [[], ["restart"], ["begin", "--rite", "kukulu", "--branch", "main"], ["begin", "--branch", "main", "--head", HEAD], ["land", "--head", HEAD], ["land", "--tessera", TESSERA], ["kukulu"],
      ["receipt", "--tree", "t", "--checks", "a", "--verdict", "pass"], ["receipt", "--tree", "t", "--checks", " , ", "--verdict", "pass", "--definitions", "d"], ["receipt", "--checks", "a", "--verdict", "pass", "--definitions", "d"]]) {
      expect(() => plan(...line), line.join(" ")).toThrow(RiteUsage);
    }
  });
});

describe("the rite runs on the host, and its rows in the vessel", () => {
  const route = (argv: string[]) => decideRoute({
    argv, env: { HOME: "/home/op" }, commands: COMMAND_NAMES, shim: "/clone/tools/lares-container.sh", tty: false,
    fsProbe: { exists: () => true },
  });

  it("RED: `rite kukulu` (and its spelling `kūkulu`) stays on this machine, where the shim stands; CONTROL: begin, land and receipts forward into the vessel", () => {
    expect(route(["rite", "kukulu"])).toBe("local");
    expect(route(["rite", "kūkulu", "--branch", "main"])).toBe("local");
    for (const sub of ["begin", "land", "receipts", "receipt", "offer"]) expect(route(["rite", sub, "--json"]), sub).toBe("forward");
  });
});

describe("kukulu-offer-reaches-the-new-vessel (the host's step)", () => {
  const IMAGE = "sha256:" + "ab".repeat(32);

  it("RED: where the host names the image it built, the standing vessel writes the offer AFTER the build and BEFORE the lowering; CONTROL: with no image port the order stands as before", async () => {
    const f = fakes();
    f.ports.image = async () => { f.calls.push("image"); return IMAGE; };
    const out = await riteKukulu(f.ports, {});
    expect(f.calls).toEqual([
      "checkout",
      `rite-begin ${JSON.stringify({ rite: "kukulu", branch: "main", head: HEAD })}`,
      "shim build", "image",
      `rite-offer ${JSON.stringify({ branch: "main", head: HEAD, image: IMAGE })}`,
      "shim down", "shim up",
      `rite-land ${JSON.stringify({ tessera: TESSERA, head: HEAD })}`,
    ]);
    expect(out.code).toBe(0);
    expect(f.said.join("\n")).toMatch(/the offer rests for the next vessel/);
    const bare = fakes();
    await riteKukulu(bare.ports, {});
    expect(bare.calls.some((c) => c.startsWith("rite-offer") || c === "image")).toBe(false);
  });

  it("RED: a standing vessel that writes no offer stays standing: no lowering, no raise, and the answer names the offer; a host that names no digest goes on and says so", async () => {
    const f = fakes();
    f.ports.image = async () => IMAGE;
    const row = f.ports.row;
    f.ports.row = async (verb, args) => verb === "rite-offer" ? { ok: false, code: "swarm-lei-absent", message: "no kukulu lei rests" } : row(verb, args);
    const out = await riteKukulu(f.ports, {});
    expect(f.calls.filter((c) => c.startsWith("shim"))).toEqual(["shim build"]);
    expect(out).toMatchObject({ code: 1, data: { begun: true, landed: false, stopped: "offer", refusal: "swarm-lei-absent" } });
    const none = fakes();
    none.ports.image = async () => null;
    const went = await riteKukulu(none.ports, {});
    expect(went.code).toBe(0);
    expect(none.calls.filter((c) => c.startsWith("shim"))).toEqual(["shim build", "shim down", "shim up"]);
    expect(none.said.join("\n")).toMatch(/no offer rests for a pūlama/);
  });

  it("the offer sub-verb plans its store row", () => {
    expect(plan("offer", "--branch", "main", "--head", HEAD, "--image", IMAGE)).toEqual({ verb: "rite-offer", args: { branch: "main", head: HEAD, image: IMAGE } });
    expect(() => plan("offer", "--branch", "main", "--head", HEAD)).toThrow(RiteUsage);
  });
});
