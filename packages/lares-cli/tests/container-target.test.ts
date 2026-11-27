import { describe, expect, test } from "vitest";
import { containerArgs, engineContainerArgs } from "../src/container-target.js";
import type { ParsedArgs } from "../src/parse-args.js";

const args = (options: Record<string, string> = {}): ParsedArgs => ({
  command: "meme", positional: [], options, flags: {},
}) as unknown as ParsedArgs;

/** The refusal a container read throws, caught whole. */
function refusal(run: () => unknown): Error & { code?: string } {
  try { run(); } catch (err) { return err as Error & { code?: string }; }
  throw new Error("expected a container refusal");
}

describe("containerArgs", () => {
  test("★ naming no container reads the worn face's daemon wiki: the recipe default reaches every call, a read or a write ★", () => {
    expect(containerArgs(args(), "meme project")).toEqual({ recipe: "default" });
    expect(containerArgs(args(), "meme project", "write")).toEqual({ recipe: "default" });
    expect(containerArgs(args({ recipe: "  ", bag: " " }), "meme project")).toEqual({ recipe: "default" });
  });

  test("returns exactly the named container", () => {
    expect(containerArgs(args({ recipe: " lares " }), "meme project")).toEqual({ recipe: "lares" });
    expect(containerArgs(args({ bag: " sd m " }), "meme project", "write")).toEqual({ bag: "sd m" });
  });

  test("a realm rides beside a bag and names that bag's realm; control: with none named the bag stands alone", () => {
    const realm = "C1AB".repeat(16);
    expect(containerArgs(args({ bag: "lares", realm: ` ${realm} ` }), "meme project")).toEqual({ bag: "lares", realm: realm.toLowerCase() });
    expect(containerArgs(args({ bag: "lares" }), "meme project")).toEqual({ bag: "lares" });
    expect(containerArgs(args({ bag: "lares", realm: "  " }), "meme project")).toEqual({ bag: "lares" });
  });

  test("a realm beside a recipe, or a realm alone, refuses by name: a wiki lives in no realm", () => {
    for (const options of [{ recipe: "lares", realm: "a".repeat(64) }, { realm: "a".repeat(64) }]) {
      const err = refusal(() => containerArgs(args(options), "meme project"));
      expect(err).toMatchObject({ code: "no-container" });
      expect(err.message).toContain("--realm names a BAG's realm");
    }
  });

  test("the same named refusal rejects two containers", () => {
    const err = refusal(() => containerArgs(args({ recipe: "lares", bag: "sdm" }), "meme project"));
    expect(err).toMatchObject({ code: "no-container" });
    expect(err.message).toBe("lares meme project: no-container — name one of --recipe <slug> or --bag <slug>, never both.");
  });
});

describe("engineContainerArgs", () => {
  test("★ naming no wiki runs in the worn face's daemon wiki (recipe default); a named recipe rides as named ★", () => {
    expect(engineContainerArgs(args(), "wiki render")).toEqual({ recipe: "default" });
    expect(engineContainerArgs(args({ recipe: "lares" }), "wiki render")).toEqual({ recipe: "lares" });
  });

  test("a bag refuses wiki-not-anchored and names the calls that read and write one bag", () => {
    const read = refusal(() => engineContainerArgs(args({ bag: "lares" }), "wiki render"));
    expect(read).toMatchObject({ code: "wiki-not-anchored" });
    expect(read.message).toContain("`lares get title=<title> bag=<slug>`");
    expect(read.message).toContain("`lares get meme=true bag=<slug>`");
    const write = refusal(() => engineContainerArgs(args({ bag: "lares" }), "wiki render", "write"));
    expect(write.message).toContain("`lares put title=<title> bag=<slug>` · `lares delete title=<title> bag=<slug>`");
  });

  test("a realm beside a recipe refuses by name", () => {
    expect(refusal(() => engineContainerArgs(args({ recipe: "lares", realm: "x" }), "wiki render"))).toMatchObject({ code: "no-container" });
  });
});
