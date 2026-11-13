/**
 * stand-page -- `lares vessel stand --page` is an explicit act: it names the prepared Web root and receipt for
 * the child daemon where the desk holds both, declares same origin only where nothing declared an origin, and
 * overwrites no declared value. Without the flag, the stand's child environment stays exactly as it was.
 */
import { describe, expect, test } from "vitest";
import { standPageEnv } from "../src/stand-page.js";

const desk = { webRoot: "/repo/packages/lararium-web/dist", artifactRecord: "/repo/.pronaos-build/pronaos-artifact.json" };

describe("the child environment under --page", () => {
  test("a built desk and no declaration: names both inputs and declares same origin", () => {
    const out = standPageEnv({ HOME: "/h" }, desk, { originDeclared: false });
    expect(out.env["LAR_PRONAOS_WEB_ROOT"]).toBe(desk.webRoot);
    expect(out.env["LAR_PRONAOS_ARTIFACT_RECORD"]).toBe(desk.artifactRecord);
    expect(out.env["LAR_SAME_ORIGIN"]).toBe("true");
    expect(out.env["HOME"]).toBe("/h");
  });

  test("CONTROL: no built web leaves the environment unchanged and says why, so the node's NO PRONAOS SHORE notice stands", () => {
    const base = { HOME: "/h" };
    const out = standPageEnv(base, null, { originDeclared: false });
    expect(out.env).toEqual(base);
    expect(out.note).toMatch(/pnpm.*build/);
  });

  test("CONTROL: a declared LAR_PRONAOS_* value wins and is never overwritten", () => {
    const base = { LAR_PRONAOS_WEB_ROOT: "/mine/web", LAR_PRONAOS_ARTIFACT_RECORD: "/mine/record.json" };
    const out = standPageEnv(base, desk, { originDeclared: false });
    expect(out.env["LAR_PRONAOS_WEB_ROOT"]).toBe("/mine/web");
    expect(out.env["LAR_PRONAOS_ARTIFACT_RECORD"]).toBe("/mine/record.json");
  });

  test("CONTROL: an origin already declared (env or config) is never overwritten by the flag", () => {
    expect(standPageEnv({ LAR_SAME_ORIGIN: "false" }, desk, { originDeclared: true }).env["LAR_SAME_ORIGIN"]).toBe("false");
    expect(standPageEnv({}, desk, { originDeclared: true }).env["LAR_SAME_ORIGIN"]).toBeUndefined();
  });
});
