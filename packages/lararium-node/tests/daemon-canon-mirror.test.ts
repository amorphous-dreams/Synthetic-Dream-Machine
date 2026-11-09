import { describe, test, expect } from "vitest";
import { DAEMON_BAG_ID } from "@lararium/mesh";
import { daemonDiskMirrors } from "../src/bag-paths.js";

describe("the daemon document has no disk residency", () => {
  test("neither the legacy canon mirror nor the observe renderer appears in the granted mirror list", () => {
    const list = daemonDiskMirrors({ projectionRoot: "/p", canonBags: "/absent", faceRelation: "123e4567-e89b-42d3-a456-426614174000" });
    expect(list.some((mirror) => mirror.bagId === DAEMON_BAG_ID)).toBe(false);
    expect(list.map((mirror) => mirror.scope)).toEqual(expect.arrayContaining(["kahua", "crossroads"]));
    expect(list.some((mirror) => mirror.scope === "daemon")).toBe(false);
    expect(list.some((mirror) => mirror.scope === "daemon-observe" || mirror.scope === "daemon-canon")).toBe(false);
  });
});
