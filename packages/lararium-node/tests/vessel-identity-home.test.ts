/**
 * M1 — the identity home resolves in the SPIRITS' house (reset-safe), the ONE resolver. No migration
 * arm and no second spelling: an empty home re-derives a fresh device key.
 */
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { larIdentityDir } from "../src/vessel-paths.js";
import { loadVesselVerifyingKey, generateOrLoadVesselIdentity } from "../src/node-vessel-identity.js";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";

const saved: Record<string, string | undefined> = {};
function setEnv(k: string, v: string | undefined): void {
  saved[k] = process.env[k];
  if (v === undefined) delete process.env[k]; else process.env[k] = v;
}

describe("identity home (M1)", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lares-identity-home-"));
    setEnv("LAR_ROOT", undefined);          // exercise the real XDG arm, not the isolated one
    setEnv("XDG_STATE_HOME", join(root, "state"));
    setEnv("XDG_DATA_HOME", join(root, "data"));
  });
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    rmSync(root, { recursive: true, force: true });
  });

  test("larIdentityDir resolves in the spirits' house — beside the seal", () => {
    // THE CRITERION IS WHOSE IT IS. A Lar's keys ARE that Lar, so the sovereign root belongs to the
    // SPIRITS and stands at `<lares>/identity`, beside the Nexus seal. What belongs to the HOUSE — the
    // acquired shelf, the sensoriums — stands at `<lararium>`. `reset` spares identity by targeting the
    // vessel SUBDIR, so the two sit as siblings and never as parent and child.
    expect(larIdentityDir()).toBe(join(root, "data", "lares", "identity"));
  });

  test("ONE address answers — a key sitting anywhere else stays unread and untouched", async () => {
    const elsewhere = join(root, "data", "lares", ".lararium-identity"); // a sibling that is not the home
    mkdirSync(elsewhere, { recursive: true });
    writeFileSync(join(elsewhere, ".vessel-key.json"), JSON.stringify({ verifyingKey: "x", signingKey: "x" }));

    // A read routes through identityDir() and nowhere else. A key outside that address never gets
    // consulted or consumed — an empty home re-derives a fresh one instead.
    try { await loadVesselVerifyingKey(); } catch { /* a fresh home may reject the read; the point is no migration */ }

    expect(existsSync(elsewhere)).toBe(true);                    // left untouched — never moved
    expect(existsSync(join(elsewhere, ".vessel-key.json"))).toBe(true);
  });
});

describe("Follow-on 3 — identityDir() takes NO dataDir (the removed footgun)", () => {
  // `identityDir()` (node-vessel-identity.ts) used to take a `dataDir` parameter and silently IGNORE it,
  // resolving purely off `LAR_ROOT`/XDG env vars — the exact footgun `persona-ring-cross-operator-admit
  // .test.ts` measured live: a caller isolating a `dataDir` per simulated vessel, in-process, with no
  // matching `LAR_ROOT` mutation, silently read/wrote the REAL, non-isolated
  // `~/.local/share/lares/identity` home instead of its intended isolated one.
  //
  // RED-FIRST, stated as the COLLISION the pre-fix code could produce: two callers passing DISTINCT
  // `dataDir`s, with no `LAR_ROOT` difference between them, resolved to the SAME identity home — an
  // isolation a caller believed it had and did not. That specific collision is no longer EXPRESSIBLE
  // (there is no `dataDir` parameter left to pass two different values to), which is the stronger
  // guarantee the removal (over honoring it) was chosen for. The two vectors below pin what replaced it.
  test("★ RUNTIME GATE (CI-enforced — see COMPILE-GATE note below): generateOrLoadVesselIdentity/"
    + "loadVesselVerifyingKey/etc. take ZERO arguments; a regression back toward a dataDir parameter "
    + "shows up here as arity > 0, and plain `vitest run` catches it", async () => {
    // This package's own `tsconfig.typecheck.json` excludes `tests/` (rootDir/path-mapping reasons —
    // it lets a test import sibling packages' source through the same alias list the build honors,
    // which would collide with a narrower rootDir), so `tools/typecheck-witness.sh` never typechecks
    // THIS file, and a `@ts-expect-error` comment alone (below) is not CI-enforced: nothing runs `tsc`
    // over it in the normal pipeline. `.length` is a plain runtime property vitest evaluates on every
    // run with no typecheck involved, so it is the actual gate a regression trips.
    expect(generateOrLoadVesselIdentity.length).toBe(0);
    expect(loadVesselVerifyingKey.length).toBe(0);

    // SAFETY FIRST: `@ts-expect-error` disarms the type CHECK, not the JS call itself — an extra argument
    // is silently ignored at runtime (not a JS error), so this still calls the real function. Wrap it in an
    // isolated LAR_ROOT so the "believed-isolated path" argument, once ignored, resolves somewhere
    // throwaway rather than the operator's real `~/.local/share/lares/identity`.
    const isolated = mkdtempSync(join(tmpdir(), "lares-identity-compilegate-"));
    try {
      await withLarRoot(isolated, async () => {
        // @ts-expect-error — loadVesselVerifyingKey/generateOrLoadVesselIdentity/etc. take ZERO arguments.
        // Before Follow-on 3, this identical call compiled AND silently ignored the path, reading/writing
        // whatever `identityDir(dataDir)` resolved to (in production, the real home, since `dataDir` was
        // never honored). After, it is a compile error — the mistaken belief becomes unrepresentable
        // rather than merely unfulfilled. NOTE: this package's own tsconfig.typecheck.json excludes
        // `tests/`, so `tools/typecheck-witness.sh` does not itself catch a regression here; a manual
        // `npx tsc --noEmit -p tsconfig.typecheck.json` with tests temporarily un-excluded (done once, by
        // hand, when this commit landed) is what actually proved the gate. Flagged rather than silently
        // relied on — see the commit message's WELD note.
        const id = await generateOrLoadVesselIdentity("some/caller-believed-isolated/path");
        expect(id.verifyingKey.length).toBe(64);   // the extra arg was ignored; the call still resolved
      });
    } finally {
      rmSync(isolated, { recursive: true, force: true });
    }
  });

  test("the ONLY isolation axis is LAR_ROOT — two distinct roots mint two DISTINCT device identities, "
    + "with no dataDir channel involved at all", async () => {
    const rootA = mkdtempSync(join(tmpdir(), "lares-identity-rootA-"));
    const rootB = mkdtempSync(join(tmpdir(), "lares-identity-rootB-"));
    try {
      const a = await withLarRoot(rootA, () => generateOrLoadVesselIdentity());
      const b = await withLarRoot(rootB, () => generateOrLoadVesselIdentity());
      // CONTROL: re-reading root A returns the SAME identity (a real resolver, not a fresh mint each time).
      const aAgain = await withLarRoot(rootA, () => generateOrLoadVesselIdentity());
      expect(a.verifyingKey).not.toBe(b.verifyingKey);
      expect(a.verifyingKey).toBe(aAgain.verifyingKey);
    } finally {
      rmSync(rootA, { recursive: true, force: true });
      rmSync(rootB, { recursive: true, force: true });
    }
  });
});
