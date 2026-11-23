import { describe, expect, test } from "vitest";
import { reachFaceBootNotice } from "../src/reach-face-watch.js";
import { pronaosShoreBootNotice } from "../src/pronaos-composition.js";

const local = "http://localhost:4321";
describe("startup notices for scratch and desk vessels", () => {
  test("scratch stays quiet about absent optional reach and shore", () => {
    expect(reachFaceBootNotice(undefined, local, true)).toBeNull();
    expect(pronaosShoreBootNotice("lararium", null, true)).toBeNull();
    expect(reachFaceBootNotice(local, local, true)).toBeNull();
    expect(reachFaceBootNotice(local, local)).toContain("NAMES LOOPBACK");
    expect(pronaosShoreBootNotice("lararium", null, false)).toContain("NO PRONAOS SHORE");
  });
  test("reach claims and malformed declarations retain actionable notices", () => {
    expect(reachFaceBootNotice(undefined, local, false)).toContain("NO LAR_PUBLIC_URL");
    expect(reachFaceBootNotice("not a url", local, true)).toContain("NAMES NO BARE HTTP ORIGIN");
    expect(pronaosShoreBootNotice("lararium", null, false)).toContain("NO PRONAOS SHORE");
  });
});
