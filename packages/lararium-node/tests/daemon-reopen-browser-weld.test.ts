/**
 * daemon-reopen-browser-weld — the browser vessel stands its daemon island through the holder, once, and offers the re-open (a source weld).
 *
 * Presence first. `daemon` binds once, to the holder's facade; the island's worker script, plugin CIDs and recipe resolve inside the
 * re-open step, so a restart spawns a fresh worker; the result offers `restartDaemonIsland`; the held `down` disposes through the facade.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const SRC = readFileSync(join(__dirname, "..", "..", "lararium-browser", "src", "open-browser-vessel.ts"), "utf8");

describe("the browser vessel's daemon seam", () => {
  test("daemon binds once, to the holder's facade, and the island opens inside the holder's open step", () => {
    expect((SRC.match(/^\s*daemon = /gm) ?? []).length).toBe(1);
    expect(SRC).toMatch(/daemon = daemonHolder\.vm;/);
    expect((SRC.match(/holdDaemonVm\(/g) ?? []).length).toBe(1);
    expect((SRC.match(/openBrowserDaemonVm\(\{/g) ?? []).length).toBe(1);
  });

  test("the result offers restartDaemonIsland through the holder alone", () => {
    expect(SRC).toMatch(/restartDaemonIsland: \(reason: string\) => daemonHolder\.restart\(reason\),/);
    expect(SRC).toMatch(/restartDaemonIsland: \(reason: string\) => Promise<\{ restarts: number \}>;/);
  });

  test("the page door stands behind the loopback check in the web main", () => {
    const main = readFileSync(join(__dirname, "..", "..", "lararium-web", "src", "main.ts"), "utf8");
    expect(main).toMatch(/if \(isLoopbackOrigin\(location\)\) \(window as [^;]*?\)\.__larRestartDaemonIsland = /);
  });

  test("CONTROL: the instrument reads an absent seam as red", () => {
    expect("daemon = await openBrowserDaemonVm({".match(/daemon = daemonHolder\.vm;/)).toBeNull();
  });
});
