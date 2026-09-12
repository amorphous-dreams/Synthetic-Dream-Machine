/**
 * A READING NEVER TRIGGERS A BUILD — and the reason runs deeper than tidiness.
 *
 * The fresh-build gate exists because founding or booting from a stale dist runs superseded logic against
 * real identity. A caller holding the observe cap alone founds nothing and boots nothing, so that danger
 * cannot arise — and the rebuild is far from free to attempt anyway: `pnpm -r build` CLEANS dist first,
 * so a probe that triggered one deletes the modules out from under any daemon already running.
 *
 * Measured, when a rehearsal's liveness check reached for `wake`: the gate fired, the build cleaned dist,
 * and the running node lost `node-host.js` mid-flight. The probe killed what it was measuring, then
 * reported it dead. A reading that disturbs what it reads measures its own footprint.
 */
import { describe, test, expect } from "vitest";
import { freshBuildGate, needsFreshBuild } from "../src/build-freshness.js";
import type { ParsedArgs } from "../src/parse-args.js";

const args = (flags: Record<string, boolean>, positional: string[] = []): ParsedArgs =>
  ({ command: "vessel", positional, flags, options: {} } as unknown as ParsedArgs);

describe("★ the observe cap never triggers a rebuild ★", () => {
  test("an observing wake passes the gate untouched, however stale the tree", async () => {
    // null = "run the handler in-process": no build, no re-exec, nothing on disk disturbed.
    expect(await freshBuildGate(["vessel", "stand", "--json"], args({ observe: true }, ["stand"]))).toBeNull();
  });

  test("the re-exec sentinel still ends the recursion", async () => {
    expect(await freshBuildGate(["vessel", "stand"], args({ "skip-build": true }, ["stand"]))).toBeNull();
  });

  test("standing REMAINS gated — the cap withholds the build, never the gate", () => {
    // The gate stays armed for the standing half. Exempting it would let a real founding run from stale
    // dist, which is the failure the gate was built for.
    expect(needsFreshBuild(args({}, ["stand"]))).toBe(true);
    expect(needsFreshBuild(args({}, ["found"]))).toBe(true);
  });

  test("★ membership is DERIVED from the SUBS table, so a name that runs no vessel logic never builds ★", () => {
    // `cmdVessel` dispatches EXCLUSIVELY through the SUBS table; a name absent from it returns an
    // "unknown sub-door" error and loads no vessel logic. It therefore cannot run STALE logic — so
    // building for it would run a full 16-package rebuild ahead of an error message. A read-shaped
    // word (`status` — the read verb is `read`) or a plain typo paid that founding tax for nothing.
    // Membership stays DERIVED and drift-free: the gate reads the SUBS table (VESSEL_SUBS) itself, so a
    // real sub-door added tomorrow appears there and builds automatically — no separate roster to keep.
    expect(needsFreshBuild(args({}, ["status"]))).toBe(false);                 // not a sub-door; the read verb is `read`
    expect(needsFreshBuild(args({}, ["a-name-not-in-the-table"]))).toBe(false); // dispatches to an error, no logic
    expect(needsFreshBuild(args({}, ["read"]))).toBe(false);                   // a real read — inspects, starts nothing
    expect(needsFreshBuild(args({}, ["stop"]))).toBe(false);                   // real, port-control, loads no vessel logic
    // CONTROL: the real founding/booting subs STILL build — the gate withholds nothing it was built for.
    expect(needsFreshBuild(args({}, ["stand"]))).toBe(true);
    expect(needsFreshBuild(args({}, ["found"]))).toBe(true);
    expect(needsFreshBuild(args({}, ["rite"]))).toBe(true);                    // founding/rebuild/rebirth run real logic
  });

  test("a verb outside the vessel door never reaches the gate at all", () => {
    const other = { command: "bag", positional: ["stats"], flags: {}, options: {} } as unknown as ParsedArgs;
    expect(needsFreshBuild(other)).toBe(false);
  });
});
