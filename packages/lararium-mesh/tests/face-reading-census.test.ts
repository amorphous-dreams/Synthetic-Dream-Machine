/**
 * face-reading-census — THE CENSUS WITNESS. Every authority decision about a face (who may sign, which acts stand, which lease
 * counts, which frontier qualifies) reads through `readFace` (mesh/src/face-reading.ts) or one of the named verifier files below.
 * This test greps the source tree for the raw-record primitives and goes red on any file outside that set that touches one.
 *
 * The census (decision sites and their door):
 *   boot (node, browser)        proveFaceFromLog -> readFace; lease pin -> readFace(...).observedLease; sibling epoch -> readFace(...).leaseEpoch
 *   gates (daemon)              lease read + dyad reader lineage -> readFace(...).currentSigner / .lineage
 *   admit (issuer, joinee)      runDeviceAdmit + runApplyAdmitPayload -> readFace(chain, anchor).leaseEpoch / .project / .currentSigner
 *   registration (node, browser) proveFaceFromLog for every plane family
 *   writers                     persona-lease -> fleetFaceForVessel(...).currentSigner; lease-observation -> readFace(...).observedLease
 *   fleet frontier readers      readFleetFrontier over readFace(...).lineage (fleet-lineage.ts is the node's one source)
 *
 * Allowed outside the door, by name and reason:
 *   persona-act-store.ts   record transport (reads held documents into `faceRecordsOf` inputs; judges nothing)
 *   lease-frontier.ts, lease-rekey.ts   lease readers/writers that TAKE the door's `currentSigner` as their authorize argument
 *   boot-daemon-keyhive.ts the Binding Gate's anchor floor on the epoch a door handed it
 *
 * A KNOWN POSITIVE proves the scanner can see: a synthetic raw read must be flagged, and the real door must be found holding
 * the primitives, so a zero elsewhere means something.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "vitest";

const PACKAGES = join(import.meta.dirname, "..", "..");
const PRIMITIVES = [
  "personaLineageFromKel", "projectPersonaLog", "signedLeaseEpoch", "readLeaseAdvance", "currentSignerOf", "leaseEpochUnderAnchor",
  "rosterAt", "currentRoster", "readWideningFrontier", "edgeFrontierRecords", "frontierSnapshots", "personaActRecordsOfGroup",
] as const;
/** package-relative paths ("<pkg>/src/<file>") that may name a primitive */
const ALLOWED = new Set([
  "lararium-mesh/src/face-reading.ts", "lararium-mesh/src/persona-act-board.ts", "lararium-mesh/src/persona-act.ts",
  "lararium-mesh/src/lease-advance.ts", "lararium-mesh/src/hand-lineage.ts", "lararium-mesh/src/edge-frontier.ts",
  "lararium-mesh/src/edge-frontier-board.ts", "lararium-mesh/src/fleet-frontier.ts", "lararium-mesh/src/face-anchor.ts",
  "lararium-node/src/persona-act-store.ts", "lararium-keyhive/src/lease-frontier.ts", "lararium-node/src/lease-rekey.ts",
  "lararium-keyhive/src/boot-daemon-keyhive.ts",
]);

const stripComments = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
export function rawPrimitivesIn(src: string): string[] {
  const code = stripComments(src);
  return PRIMITIVES.filter((name) => new RegExp(`\\b${name}\\s*\\(`).test(code));
}
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (name === "node_modules" || name === "dist") continue;
    const st = statSync(full);
    if (st.isDirectory()) out.push(...sourceFiles(full));
    else if (name.endsWith(".ts") && !name.endsWith(".d.ts")) out.push(full);
  }
  return out;
}
const srcTree = (): Array<{ rel: string; src: string }> =>
  readdirSync(PACKAGES).filter((p) => { try { return statSync(join(PACKAGES, p, "src")).isDirectory(); } catch { return false; } })
    .flatMap((p) => sourceFiles(join(PACKAGES, p, "src")).map((f) => ({ rel: relative(PACKAGES, f), src: readFileSync(f, "utf8") })));

describe("the face-reading census", () => {
  test("KNOWN POSITIVE: the scanner flags a raw read, ignores a comment, and finds the door holding the primitives", () => {
    expect(rawPrimitivesIn("const l = personaLineageFromKel(chain);")).toEqual(["personaLineageFromKel"]);
    expect(rawPrimitivesIn("// personaLineageFromKel( is said here\n/* signedLeaseEpoch( too */ const x = 1;")).toEqual([]);
    const door = srcTree().find((f) => f.rel === "lararium-mesh/src/face-reading.ts")!;
    expect(door, "the door stands in the tree").toBeDefined();
    expect(rawPrimitivesIn(door.src).sort()).toEqual(["currentSignerOf", "leaseEpochUnderAnchor", "personaActRecordsOfGroup", "personaLineageFromKel", "projectPersonaLog", "signedLeaseEpoch"].sort());
    expect(srcTree().length, "a census over nothing proves nothing").toBeGreaterThan(300);
  });

  test("RED: no file outside the door and its named verifiers reads those records raw", () => {
    const offenders = srcTree().filter((f) => !ALLOWED.has(f.rel)).map((f) => ({ file: f.rel, names: rawPrimitivesIn(f.src) })).filter((o) => o.names.length > 0);
    expect(offenders, "a raw read of a KEL, lease, act or frontier record outside the door").toEqual([]);
  });

  test("CONTROL: every decision site the census names reads the door", () => {
    const sites: Record<string, string[]> = {
      "lararium-node/src/open-node-vessel.ts": ["readFace(", "proveFaceFromLog("],
      "lararium-browser/src/open-browser-vessel.ts": ["readFace(", "proveFaceFromLog(", "faceRecordsOf("],
      "lararium-node/src/commands/device-admit.ts": ["readFace("],
      "lararium-keyhive/src/ceremony-core.ts": ["readFace("],
      "lararium-keyhive/src/operator-daemon-behavior.ts": ["readFace("],
      "lararium-node/src/lease-observation.ts": ["readFace("],
      "lararium-node/src/commands/persona-lease.ts": ["fleetFaceForVessel("],
      "lararium-node/src/fleet-lineage.ts": ["readFace("],
    };
    const tree = new Map(srcTree().map((f) => [f.rel, f.src] as const));
    for (const [rel, needs] of Object.entries(sites)) for (const need of needs) expect(tree.get(rel), `${rel} reads ${need}`).toContain(need);
  });
});
