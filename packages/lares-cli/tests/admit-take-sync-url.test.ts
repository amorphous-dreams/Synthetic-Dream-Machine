/**
 * admit-take-sync-url — `nexus admit-take` warns when the bundle names no sync url.
 *   RED:     a bundle with no `syncUrl` draws the warning, which names `nexus contract <leaf> --sync-url`.
 *   CONTROL: a bundle that names one, and text that does not parse (the take names that), draw none.
 */
import { describe, expect, it } from "vitest";
import { admitTakeSyncUrlWarning } from "../src/commands/nexus.js";

describe("admit-take warns when the bundle names no sync url", () => {
  it("RED: no syncUrl → a warning naming `nexus contract <leaf> --sync-url`", () => {
    const w = admitTakeSyncUrlWarning(JSON.stringify({ aid: "nexus-x", gatePubKey: "ab", admit: {}, lineage: [] }));
    expect(w).not.toBeNull();
    expect(w).toContain("nexus contract <leaf> --sync-url");
  });
  it("CONTROL: a bundle naming a sync url, or text that does not parse, draws none", () => {
    expect(admitTakeSyncUrlWarning(JSON.stringify({ aid: "nexus-x", syncUrl: "ws://hearth:7700" }))).toBeNull();
    expect(admitTakeSyncUrlWarning("not json")).toBeNull();
  });
});
