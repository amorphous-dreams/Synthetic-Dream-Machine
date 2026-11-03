/**
 * daemon-reopen-weld — the node vessel stands its daemon island through the holder, once, and offers the re-open (a source weld).
 *
 * Presence first (an ordering over an absent call passes vacuously). The `daemonVm` binding gets ONE assignment, to the holder's
 * facade, so every capture reaches the live island; the auth is built by a function that reads the standing anchor live, so a
 * re-open snapshots the anchor the vessel holds NOW; both result shapes offer `restartDaemonIsland`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const SRC = readFileSync(join(__dirname, "..", "src", "open-node-vessel.ts"), "utf8");

describe("the node vessel's daemon seam", () => {
  test("daemonVm binds once, to the holder's facade; the island opens only inside the seam's open step", () => {
    expect((SRC.match(/^\s*daemonVm = /gm) ?? []).length).toBe(1);
    expect(SRC).toMatch(/daemonVm = daemonHolder\.vm;/);
    expect((SRC.match(/await standDaemonIsland\(\{/g) ?? []).length).toBe(1);
    expect((SRC.match(/openDaemonVm\(\{/g) ?? []).length).toBe(1);
    expect(SRC.indexOf("openDaemonVm({")).toBeGreaterThan(SRC.indexOf("await standDaemonIsland({"));
  });

  test("the auth is a function that reads the standing anchor at call time, and the seam reuses it for every open", () => {
    expect(SRC).toMatch(/const daemonAuthNow = \(joinedFaces: readonly JoinedFaceAuth\[\]\) => \(\{/);
    expect(SRC).toContain("...(faceLit && standingAnchor ? { faceAnchor: standingAnchor } : {}),");
    expect(SRC).not.toMatch(/const daemonAuth = \{/);
    expect((SRC.match(/daemonAuth: daemonAuthNow\(joinedFaces\)/g) ?? []).length).toBe(1);
  });

  test("both result shapes offer restartDaemonIsland, through the holder alone", () => {
    expect((SRC.match(/restartDaemonIsland:\s+\(reason: string\) => Promise<\{ restarts: number \}>;/g) ?? []).length).toBe(3);   // the platform, the vessel result, the herm result
    expect((SRC.match(/restartDaemonIsland:\s+p\.restartDaemonIsland,/g) ?? []).length).toBe(2);
    expect(SRC).toMatch(/restartDaemonIsland: \(reason\) => daemonHolder\.restart\(reason\),/);
  });

  test("CONTROL: the instrument reads a missing seam as red", () => {
    expect("daemonVm = await openDaemonVm({".match(/daemonVm = daemonHolder\.vm;/)).toBeNull();
  });
});
