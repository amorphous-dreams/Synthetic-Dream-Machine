/**
 * daemon-reopen-browser-weld — the browser vessel stands its daemon island through the holder, once, and offers the re-open (a source weld).
 *
 * Presence first. `daemon` binds once, to the holder's facade; the island's worker script, plugin CIDs and recipe resolve inside the
 * re-open step, so a restart spawns a fresh worker; the result offers `restartDaemonIsland`; the held `down` disposes through the facade.
 */
import { readFileSync, readdirSync } from "node:fs";
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

  test("the shipped page carries NO restart door: the symbol hides behind a build-time constant the default build sets false", () => {
    const main = readFileSync(join(__dirname, "..", "..", "lararium-web", "src", "main.ts"), "utf8");
    const vite = readFileSync(join(__dirname, "..", "..", "lararium-web", "vite.config.ts"), "utf8");
    expect(main).toMatch(/if \(__LAR_WALK_DOOR__\) \(window as [^;]*?\)\.__larRestartDaemonIsland = /);
    expect(main).not.toMatch(/isLoopbackOrigin|location\.hostname/);       // no runtime origin check stands in for the build gate
    expect(vite).toMatch(/__LAR_WALK_DOOR__:\s*JSON\.stringify\(process\.env\["LAR_WALK_DOOR"\] === "1"\)/);
  });

  test("the default build's dist names the door nowhere; CONTROL: the same grep finds a symbol the page does ship", () => {
    const assets = join(__dirname, "..", "..", "lararium-web", "dist", "assets");
    const js = readdirSync(assets).filter((f) => f.endsWith(".js")).map((f) => readFileSync(join(assets, f), "utf8"));
    expect(js.length, "the built dist stands (run pnpm build first)").toBeGreaterThan(0);
    expect(js.some((t) => t.includes("__larVesselMetrics")), "CONTROL: the grep reads a shipped symbol").toBe(true);
    expect(js.some((t) => t.includes("__larRestartDaemonIsland"))).toBe(false);
    expect(js.some((t) => t.includes("__LAR_WALK_DOOR__"))).toBe(false);
  });

  test("CONTROL: the instrument reads an absent seam as red", () => {
    expect("daemon = await openBrowserDaemonVm({".match(/daemon = daemonHolder\.vm;/)).toBeNull();
  });
});
