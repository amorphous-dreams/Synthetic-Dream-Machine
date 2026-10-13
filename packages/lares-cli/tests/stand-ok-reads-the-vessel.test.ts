/**
 * stand-ok-reads-the-vessel — `vessel stand` answers `ok` for the vessel, and an absent memory library never
 * reads as a failed stand.
 *
 * The memory library keeps its own door and never rides a founding. An image that carries no python and no
 * mempalace source holds an optional organ nobody installed: the vessel stands whole. A half-installed
 * library (some part stands, another lacks) reads as a fault to cure, and a node that fails to answer fails
 * the stand whatever the library says.
 */
import { describe, test, expect } from "vitest";
import { mempalaceStanding, standOk, type IntegrationCheck } from "../src/integration-check.js";

const check = (name: string, ok: boolean): IntegrationCheck => ({ name, ok, detail: ok ? "present" : "absent" });
/** The four checks a stand runs, with the two that name the library itself set by hand. */
const checks = (submodule: boolean, holder: boolean, repo = true): IntegrationCheck[] => [
  check("submodule", submodule), check("integration-package", repo), check("holder-deps", holder), check("recall-plugin", repo && submodule),
];

describe("how the memory library stands", () => {
  test("no source and no python that holds its deps: ABSENT (the image's shape)", () => {
    expect(mempalaceStanding(checks(false, false))).toBe("absent");
    // The repository files it rides say nothing of an install, present or not.
    expect(mempalaceStanding(checks(false, false, false))).toBe("absent");
  });

  test("every check holds: INTEGRATED", () => {
    expect(mempalaceStanding(checks(true, true))).toBe("integrated");
  });

  test("one half of the library stands and the other lacks: INCOMPLETE", () => {
    expect(mempalaceStanding(checks(true, false))).toBe("incomplete");
    expect(mempalaceStanding(checks(false, true))).toBe("incomplete");
    // The library stands and a repository file lacks: still a fault, never an absence.
    expect(mempalaceStanding([check("submodule", true), check("integration-package", false), check("holder-deps", true), check("recall-plugin", true)])).toBe("incomplete");
  });

  test("a source directory that holds files and lacks its entry reads INCOMPLETE, though both library checks fail", () => {
    const partial: IntegrationCheck[] = [{ ...check("submodule", false), partial: true }, check("integration-package", true), check("holder-deps", false), check("recall-plugin", false)];
    expect(mempalaceStanding(partial)).toBe("incomplete");
    expect(standOk(true, mempalaceStanding(partial))).toBe(false);
  });

  test("CONTROL: a report that names neither library check reads incomplete, never absent", () => {
    expect(mempalaceStanding([check("recall-plugin", false)])).toBe("incomplete");
  });
});

describe("what `ok` means on a stand", () => {
  test("a standing vessel with an absent memory library reads ok", () => {
    expect(standOk(true, "absent")).toBe(true);
  });

  test("a standing vessel with an integrated memory library reads ok", () => {
    expect(standOk(true, "integrated")).toBe(true);
  });

  test("a half-installed memory library fails the reading: a fault a hand can cure", () => {
    expect(standOk(true, "incomplete")).toBe(false);
  });

  test("CONTROL: a node that fails to answer fails the stand, whatever the library says", () => {
    for (const standing of ["absent", "integrated", "incomplete"] as const) expect(standOk(false, standing)).toBe(false);
  });
});
