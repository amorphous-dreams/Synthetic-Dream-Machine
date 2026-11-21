import { describe, expect, test } from "vitest";
import { pagePortGrant } from "../src/page-port-grant.js";

describe("the browser vessel's grant to its own page", () => {
  test("a wiki surface's page may edit the default bag and nothing wider; CONTROL: the daemon surface stays read-only", () => {
    expect(pagePortGrant({ binding: "b", islandKey: "lares", faceId: "face:T", daemonKey: "daemon" }))
      .toEqual({ faceId: "face:T", actor: "b", edits: true, bags: [], admin: false });
    expect(pagePortGrant({ binding: "b", islandKey: "daemon", faceId: "face:T", daemonKey: "daemon" }))
      .toEqual({ faceId: "face:T", actor: "b", edits: false, bags: [], admin: false });
  });
  test("with no face worn the grant names the island's own key", () => {
    expect(pagePortGrant({ binding: "b", islandKey: "lares", faceId: null, daemonKey: "daemon" }).faceId).toBe("lares");
  });
});
