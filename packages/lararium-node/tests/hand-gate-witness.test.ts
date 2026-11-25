/**
 * hand-gate-witness — every door that reads a hand reads it through the one gate, and the refusal reads in one voice.
 *
 * The gate (`src/hand-act-gate.ts`) reads the hand: `readHand` off a socket's peer, `readOwnHand` off a command's own branch;
 * the verb socket books its asker off the same `peerKindOf` reading, a cached reading of the gate. The sentence a refused hand
 * act answers with stands once, in `@lararium/mesh/hand-refusal`. This witness reads every package's `src/` and holds:
 *
 *   · no command reads `ownPeerKind` bare (only the gate itself, and the host bridge, which hands the reading into the vessel
 *     as a mark and decides nothing);
 *   · no module declares its own `readHand`, so the gate's name carries one relation;
 *   · the refusal's witness clauses stand in the builder alone;
 *   · the shore's settling acts answer the siblings' code (`hand-act-only`), never a code of their own.
 *
 * Research: lar:///ha.ka.ba/kahua/memory/research/affordance-map (collisions 1 and 2)
 */
import { describe, expect, test } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const PACKAGES = join(import.meta.dirname, "..", "..");

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sources(p));
    else if (/\.(ts|mts|js|mjs)$/.test(name) && !name.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

const FILES = readdirSync(PACKAGES)
  .map((pkg) => join(PACKAGES, pkg, "src"))
  .filter((src) => { try { return statSync(src).isDirectory(); } catch { return false; } })
  .flatMap(sources)
  .map((p) => ({ rel: relative(PACKAGES, p), text: readFileSync(p, "utf8") }));

const hits = (re: RegExp, allowed: readonly string[] = []): string[] =>
  FILES.filter((f) => !allowed.includes(f.rel) && re.test(f.text)).map((f) => f.rel);

describe("one gate reads the hand", () => {
  test("the witness reads the tree it guards", () => {
    expect(FILES.some((f) => f.rel === "lararium-node/src/hand-act-gate.ts")).toBe(true);
  });

  test("RED: no command reads ownPeerKind bare; the gate reads it, and the host bridge hands it on", () => {
    expect(hits(/\bownPeerKind\s*\(/, ["lararium-node/src/hand-act-gate.ts", "lares-cli/src/host-bridge.ts"])).toEqual([]);
  });

  test("RED: no module declares a readHand of its own beside the gate's", () => {
    expect(hits(/function\s+readHand\s*\(/, ["lararium-node/src/hand-act-gate.ts"])).toEqual([]);
  });

  test("RED: the refusal's witness clauses stand in the builder alone", () => {
    const BUILDER = ["lararium-mesh/src/hand-refusal.ts"];
    expect(hits(/reads nothing to attest/, BUILDER)).toEqual([]);
    expect(hits(/stands on this command's branch\./, BUILDER)).toEqual([]);
    expect(hits(/on a terminal whose processes the host can read/, BUILDER)).toEqual([]);
  });

  test("RED: the shore's settling acts answer hand-act-only, never shore-needs-hand", () => {
    expect(hits(/shore-needs-hand/)).toEqual([]);
  });
});
