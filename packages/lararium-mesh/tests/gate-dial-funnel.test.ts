/**
 * gate-dial-funnel — no test, probe or e2e source speaks a frame outside the ONE handshake.
 *
 * The socket speaks one handshake: the Noise IK flight, a sealed presentation and the gate's signed verdict. Every test
 * dials a gate through ONE helper (`gate-dial-fixture.ts`, here and in the node package), which holds the real dialer
 * and a real gate and speaks no other frame either.
 *
 * This witness reads every test, probe and e2e source in the workspace, strips comments, and refuses any file that
 * names a frame constructor, frame guard, proof byte-builder, handshake runner or gate class from the list below.
 * Two kinds of file may name them, each by name and for a stated reason: a `retirement-witness` names the symbols only
 * to assert they are absent, and a `source-weld` reads source text. Each named file must still name one, so a file that
 * stops naming leaves the list in the same commit.
 *
 * What it guards: drift. A hand that assembles a frame's name from parts, or hides a call between two strings that
 * spell a comment's fences, passes it; a review reads those.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const REPO = path.resolve(new URL(".", import.meta.url).pathname, "../../..");

/** The helper: the files every suite dials a gate through. They speak no listed frame either. */
const HELPERS = [
  "packages/lararium-mesh/tests/gate-dial-fixture.ts",
  "packages/lararium-node/tests/gate-dial-fixture.ts",
] as const;

type Named = "retirement-witness" | "source-weld";
/** The files that may name a listed symbol, and why. */
const NAMES_RETIRED: Readonly<Record<string, Named>> = {
  "packages/lararium-mesh/tests/gate-cutover-reach.test.ts": "retirement-witness",
  "packages/lararium-mesh/tests/unbuilt-laws.test.ts":       "retirement-witness",
  "packages/lararium-keyhive/tests/gate-walk-wired.test.ts": "retirement-witness",
};

/** What speaking a frame outside the one handshake looks like in code. */
const SPEAKS = new RegExp([
  String.raw`\b(?:mkLarChallenge|mkLarAuth|mkLarAuthOk|isLarChallengeMsg|isLarAuthMsg|isLarAuthOkMsg)\b`,
  String.raw`\b(?:buildAuthResponse|runPeerHandshake|mintLeafNonce)\b`,
  String.raw`\b(?:authProofBytes|authOkBytes|verifyAuthOk|verifyAuthProof|evaluateAuthProof)\b`,
  String.raw`\b(?:leafProofBytes|signLeafProof|signPresented|verifyLeafProof)\b`,
  String.raw`\bnew\s+(?:[A-Za-z_$][\w$]*\s*\.\s*)?DaemonAuthGate\s*\(`,
  String.raw`\b(?:DaemonAuthGate|AuthVerifierShore|AuthProofWire)\b`,
  String.raw`["'\x60]lar:(?:challenge|auth|auth-ok)["'\x60]`,
].join("|"));

/** Source with its comments gone: a docblock that names a frame speaks none. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'\x60\\])\/\/[^\n]*/g, "$1");
}

function sourcesUnder(dir: string, out: string[] = []): string[] {
  let names: string[];
  try { names = readdirSync(path.join(REPO, dir)); } catch { return out; }
  for (const name of names) {
    if (name === "node_modules" || name === "dist" || name.startsWith(".")) continue;
    const rel = `${dir}/${name}`;
    if (statSync(path.join(REPO, rel)).isDirectory()) sourcesUnder(rel, out);
    else if (/\.(?:ts|tsx|mts|mjs|js)$/.test(name)) out.push(rel);
  }
  return out;
}

function everyTestSource(): string[] {
  const out: string[] = [];
  for (const pkg of readdirSync(path.join(REPO, "packages"))) {
    sourcesUnder(`packages/${pkg}/tests`, out);
    sourcesUnder(`packages/${pkg}/probes`, out);
  }
  sourcesUnder("tests/e2e", out);
  sourcesUnder("tests/harness", out);
  return out.sort();
}

/** This witness names every token it hunts, so it never reads itself. */
const SELF = "packages/lararium-mesh/tests/gate-dial-funnel.test.ts";

const speaksIn = (source: string): boolean => SPEAKS.test(stripComments(source));
const speaks = (rel: string): boolean => speaksIn(readFileSync(path.join(REPO, rel), "utf8"));

describe("the one-handshake funnel", () => {
  const sources = everyTestSource();

  test("CONTROL: the witness reads the tree, and the strip leaves code standing", () => {
    expect(sources.length).toBeGreaterThan(300);
    for (const helper of HELPERS) expect(sources, helper).toContain(helper);
    expect(SPEAKS.test(stripComments("/* mkLarChallenge */ // runPeerHandshake\nconst x = 1;"))).toBe(false);
    expect(SPEAKS.test(stripComments("const url = \"ws://h\"; send(mkLarChallenge(n));"))).toBe(true);
    expect(SPEAKS.test(stripComments("sock.send(JSON.stringify({ type: \"lar:auth\" }));"))).toBe(true);
    expect(SPEAKS.test(stripComments("new   DaemonAuthGate(wss)"))).toBe(true);
    expect(SPEAKS.test(stripComments("const kind = \"lar:session\";"))).toBe(false);
    // The sealed gate's adapter is the house's one dialer: constructing it speaks no listed frame.
    expect(speaksIn("import { LarWSClientAdapter } from \"@lararium/mesh\";\nnew LarWSClientAdapter({});")).toBe(false);
    expect(speaksIn("import type { DaemonAuthGate } from \"../src/daemon-auth-gate.js\";")).toBe(true);
  });

  test("RED: no test, probe or e2e source speaks a frame outside the one handshake, apart from the files named for asserting so", () => {
    const stray = sources.filter((rel) => rel !== SELF && !(rel in NAMES_RETIRED) && speaks(rel));
    expect(stray, `these speak a frame outside the one handshake:\n  ${stray.join("\n  ")}`).toEqual([]);
  });

  test("the helpers speak no listed frame", () => {
    for (const helper of HELPERS) expect(speaks(helper), helper).toBe(false);
  });

  test("every file named as naming a listed symbol stands and names one", () => {
    for (const rel of Object.keys(NAMES_RETIRED)) {
      expect(sources, rel).toContain(rel);
      expect(speaks(rel), `${rel} names no listed symbol; it leaves NAMES_RETIRED in the same commit`).toBe(true);
    }
  });
});
