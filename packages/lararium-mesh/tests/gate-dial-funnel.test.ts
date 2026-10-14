/**
 * gate-dial-funnel — every test that speaks the gate's handshake goes through ONE helper.
 *
 * The socket's handshake changes once, in one cutover. This witness keeps that cutover's edit to the helper
 * (`gate-dial-fixture.ts`, here and in the node package): it reads every test, probe and e2e source in the
 * workspace, strips comments, and refuses any file that names a frame constructor, a frame guard, a proof's
 * signed bytes, the dialer's transport or the gate's class outside the helper.
 *
 * Three kinds of file stand outside the funnel, each by name and each for a stated reason:
 *   · `old-wire-vector`: it pins the law of the wire that stands today, frame by frame. It retires with that
 *     wire, in the cutover's own commit;
 *   · `other-owner`: another lane holds the file; the cutover's lander moves it;
 *   · `source-weld`: it reads a source file's text and speaks no frame.
 * Every named file must still speak, so a file that moved into the funnel leaves this list in the same commit.
 *
 * What it guards: drift. A hand that assembles a frame's name from parts, or hides a call between two
 * strings that spell a comment's fences, passes it; a review reads those.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const REPO = path.resolve(new URL(".", import.meta.url).pathname, "../../..");

/** The helper: the only files that may name the handshake. */
const HELPERS = [
  "packages/lararium-mesh/tests/gate-dial-fixture.ts",
  "packages/lararium-node/tests/gate-dial-fixture.ts",
] as const;

type Outside = "old-wire-vector" | "other-owner" | "source-weld";
const OUTSIDE: Readonly<Record<string, Outside>> = {
  // The wire that stands today, pinned frame by frame. Each retires in the cutover's commit.
  "packages/lararium-mesh/tests/auth-proof.test.ts":                 "old-wire-vector",
  "packages/lararium-mesh/tests/auth-proof-domain.test.ts":          "old-wire-vector",
  "packages/lararium-mesh/tests/auth-wire-no-clock.test.ts":         "old-wire-vector",
  "packages/lararium-mesh/tests/presented-leaf-proof.test.ts":       "old-wire-vector",
  "packages/lararium-mesh/tests/ed25519-door-families.test.ts":      "old-wire-vector",
  "packages/lararium-mesh/tests/socket-sort.test.ts":                "old-wire-vector",
  "packages/lararium-node/tests/daemon-auth-gate.test.ts":           "old-wire-vector",
  "packages/lararium-node/tests/v3-proof-crux.test.ts":              "old-wire-vector",
  "packages/lararium-node/tests/p1-authority-audit.test.ts":         "old-wire-vector",
  // Held by another lane.
  "packages/lararium-browser/tests/browser-relay-pin.test.ts":       "other-owner",
  "packages/lararium-keyhive/probes/device-delegation-admission.ts": "other-owner",
  "packages/lararium-node/probes/crossing-client.ts":                "other-owner",
  "packages/lararium-node/probes/crossing-daemon.ts":                "other-owner",
  "packages/lararium-node/probes/swarm-present.ts":                  "other-owner",
  "tests/e2e/hosted-walk.test.ts":                                   "other-owner",
  // Reads source text; speaks no frame.
  "packages/lararium-keyhive/tests/lease-epoch-doors-wired.test.ts": "source-weld",
  "packages/lararium-mesh/tests/gate-cutover-reach.test.ts":        "source-weld",
};

/** What speaking the handshake looks like in code. */
const SPEAKS = new RegExp([
  String.raw`\b(?:mkLarChallenge|mkLarAuth|mkLarAuthOk|isLarChallengeMsg|isLarAuthMsg|isLarAuthOkMsg)\b`,
  String.raw`\b(?:buildAuthResponse|runPeerHandshake|mintLeafNonce)\b`,
  String.raw`\b(?:authProofBytes|authOkBytes|verifyAuthOk|verifyAuthProof|evaluateAuthProof)\b`,
  String.raw`\b(?:leafProofBytes|signLeafProof|signPresented|verifyLeafProof)\b`,
  String.raw`\bnew\s+(?:[A-Za-z_$][\w$]*\s*\.\s*)?(?:LarWSClientAdapter|DaemonAuthGate)\s*\(`,
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

/** The two classes a suite may name as a TYPE and never as a value: the dialer's transport and the gate. */
const CLASSES = /(?:^|,)\s*(?:LarWSClientAdapter|DaemonAuthGate)\b/;

/** Does an import bring a class in as a value? An alias then constructs it under a name the pattern above never reads. */
function importsClassAsValue(code: string): boolean {
  for (const [, typeOnly, names] of code.matchAll(/\bimport\s+(type\s+)?\{([^}]*)\}\s*from/g)) {
    if (!typeOnly && CLASSES.test(names!.replace(/\s+/g, " "))) return true;
  }
  return false;
}

function speaksIn(source: string): boolean {
  const code = stripComments(source);
  return SPEAKS.test(code) || importsClassAsValue(code);
}

const speaks = (rel: string): boolean => speaksIn(readFileSync(path.join(REPO, rel), "utf8"));

describe("the handshake funnel", () => {
  const sources = everyTestSource();

  test("CONTROL: the witness reads the tree, and the strip leaves code standing", () => {
    expect(sources.length).toBeGreaterThan(300);
    for (const helper of HELPERS) expect(sources, helper).toContain(helper);
    // The helper itself speaks: a witness that finds no frame there reads nothing.
    for (const helper of HELPERS.slice(0, 1)) expect(speaks(helper), helper).toBe(true);
    expect(SPEAKS.test(stripComments("/* mkLarChallenge */ // runPeerHandshake\nconst x = 1;"))).toBe(false);
    expect(SPEAKS.test(stripComments("const url = \"ws://h\"; send(mkLarChallenge(n));"))).toBe(true);
    expect(SPEAKS.test(stripComments("sock.send(JSON.stringify({ type: \"lar:auth\" }));"))).toBe(true);
    expect(SPEAKS.test(stripComments("new   DaemonAuthGate(wss)"))).toBe(true);
    expect(SPEAKS.test(stripComments("const kind = \"lar:session\";"))).toBe(false);
    // An aliased class constructs under another name: the import itself speaks. A type import speaks nothing.
    expect(speaksIn("import { LarWSClientAdapter as Adapter } from \"@lararium/mesh\";\nnew Adapter({});")).toBe(true);
    expect(speaksIn("import { hex,\n  DaemonAuthGate } from \"x\";")).toBe(true);
    expect(speaksIn("new mesh.LarWSClientAdapter({})")).toBe(true);
    expect(speaksIn("import { hex, type LarWSClientAdapter } from \"@lararium/mesh\";\nlet a: LarWSClientAdapter | null = null;")).toBe(false);
    expect(speaksIn("import type { DaemonAuthGate } from \"../src/daemon-auth-gate.js\";")).toBe(false);
  });

  test("RED: no test, probe or e2e source speaks the handshake outside the helper and the files named outside it", () => {
    const stray = sources.filter((rel) => rel !== SELF && !(HELPERS as readonly string[]).includes(rel) && !(rel in OUTSIDE) && speaks(rel));
    expect(stray, `these speak the handshake by hand:\n  ${stray.join("\n  ")}`).toEqual([]);
  });

  test("every file named outside the funnel still stands and still speaks", () => {
    for (const rel of Object.keys(OUTSIDE)) {
      expect(sources, `${rel} left the tree: drop its row`).toContain(rel);
      expect(speaks(rel), `${rel} speaks no frame now: drop its row`).toBe(true);
    }
  });
});
