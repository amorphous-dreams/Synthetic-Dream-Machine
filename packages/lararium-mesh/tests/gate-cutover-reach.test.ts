/**
 * Source inventory alone: exercising every live dial falls to the W built-image negative probe.
 *
 * The inventory derives from the tree, never from a list: every non-test source under each package's `src`,
 * and beside it every non-test source under each package's `probes`, that names an old-wire symbol in code,
 * its comments and string bodies stripped. A symbol's own declaration counts as no site; every call,
 * construction, import, re-export and type use does, so a gate hidden behind a type alias or a barrel line
 * still reads red, and a converted file that keeps speaking one frame of the old wire reads red by that frame.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { admitCarriageCommit, carriageEntryActCid, openAdmitCarriage } from "../src/carriage-registry.js";
import { carriageAct } from "./fixtures/carriage.js";

const red = process.env.LAR_UNBUILT_REDS === "1" ? test : test.skip;
const root = join(import.meta.dirname, "..", "..");

/**
 * The old wire, by the names its production reach carries: the handshake, its challenge, the gate and both proofs;
 * then every frame a converted file could keep speaking: the challenge's reader, the answer's builder and judge, the
 * auth and auth-ok frames, the auth-ok's bytes and check, and both signers.
 */
const OLD_WIRE = [
  "runPeerHandshake", "mkLarChallenge", "DaemonAuthGate", "verifyLeafProof", "verifyAuthProof",
  "isLarChallengeMsg", "buildAuthResponse", "evaluateAuthProof", "mkLarAuth", "mkLarAuthOk", "authOkBytes", "verifyAuthOk",
  "signLeafProof", "signPresented",
] as const;
const NAMES = new RegExp(String.raw`\b(${OLD_WIRE.join("|")})\b`, "g");
const DECLARES = new RegExp(String.raw`^\s*(?:export\s+)?(?:async\s+)?(?:function\s*\*?|class|const|let)\s+(${OLD_WIRE.join("|")})\b`);

/** Code alone: comments gone, string and template bodies blanked, every newline kept so a line reads true. */
function codeOnly(source: string): string {
  let out = "";
  for (let i = 0; i < source.length;) {
    const c = source[i]!, d = source[i + 1];
    if (c === "/" && d === "/") { while (i < source.length && source[i] !== "\n") i++; continue; }
    if (c === "/" && d === "*") {
      const end = source.indexOf("*/", i + 2) < 0 ? source.length : source.indexOf("*/", i + 2) + 2;
      out += source.slice(i, end).replace(/[^\n]/g, "");
      i = end;
      continue;
    }
    if (c === "\"" || c === "'" || c === "`") {
      let j = i + 1;
      while (j < source.length && source[j] !== c) j += source[j] === "\\" ? 2 : 1;
      out += c + source.slice(i + 1, j).replace(/[^\n]/g, " ") + c;
      i = j + 1;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** Every `file:line symbol` where a source names the old wire, its own declarations aside. */
function sitesIn(file: string, source: string): string[] {
  const sites: string[] = [];
  codeOnly(source).split("\n").forEach((line, k) => {
    const declared = DECLARES.exec(line)?.[1];
    for (const [, name] of line.matchAll(NAMES)) if (name !== declared) sites.push(`${file}:${k + 1} ${name}`);
  });
  return sites;
}

function sourcesUnder(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(root, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(root, rel)).isDirectory()) sourcesUnder(rel, out);
    else if (/\.(?:ts|tsx|mts|js|mjs)$/.test(name) && !/\.d\.ts$|\.test\.|\.spec\./.test(name)) out.push(rel);
  }
  return out;
}

/** Every non-test source under each package's `leaf` directory. */
const sourcesOf = (leaf: "src" | "probes"): string[] =>
  readdirSync(root).filter((pkg) => { try { return statSync(join(root, pkg, leaf)).isDirectory(); } catch { return false; } })
    .flatMap((pkg) => sourcesUnder(`${pkg}/${leaf}`)).sort();
const productionSources = (): string[] => sourcesOf("src");
const probeSources = (): string[] => sourcesOf("probes");

const sitesOver = (files: readonly string[]): string[] => files.flatMap((file) => sitesIn(file, readFileSync(join(root, file), "utf8")));
const oldWireSites = (): string[] => [...sitesOver(productionSources()), ...sitesOver(probeSources())];

describe("W cutover reach", () => {
  test("CONTROL: the strip keeps code and drops comments and string bodies", () => {
    const sample = "const u = \"ws://h\"; // runPeerHandshake\n/* DaemonAuthGate */ send(mkLarChallenge(n));\nlog(\"verifyLeafProof refused\");";
    expect(codeOnly(sample).split("\n")).toHaveLength(3);
    expect(codeOnly(sample)).toContain("send(mkLarChallenge(n));");
    expect(sitesIn("x.ts", sample)).toEqual(["x.ts:2 mkLarChallenge"]);
    expect(sitesIn("x.ts", "export async function runPeerHandshake(h) { return verifyAuthProof(h); }")).toEqual(["x.ts:1 verifyAuthProof"]);
    expect(sitesIn("x.ts", "import type { DaemonAuthGate } from \"./g.js\";\nexport class DaemonAuthGate {}")).toEqual(["x.ts:1 DaemonAuthGate"]);
    expect(sitesIn("x.ts", "const runPeerHandshakeLater = 1; mkLarChallengeX();")).toEqual([]);
  });

  test("CONTROL: the inventory reads the tree and names the old-wire reach the tree holds, by every symbol", () => {
    const files = productionSources();
    expect(files.length).toBeGreaterThan(300);
    expect(files.some((file) => /tests\//.test(file))).toBe(false);
    const probes = probeSources();
    expect(probes.length).toBeGreaterThan(0);
    expect(probes.every((file) => /^[^/]+\/probes\//.test(file) && !/\.test\.|\.spec\./.test(file))).toBe(true);
    const sites = oldWireSites();
    for (const name of OLD_WIRE) expect(sites.some((site) => site.endsWith(` ${name}`)), name).toBe(true);
    // The probes inventory reads on its own: a probe that speaks the old wire names its own site.
    expect(sitesOver(probes).some((site) => /^[^/]+\/probes\//.test(site))).toBe(true);
    // Each declaration in the wire's own module counts as no site: every symbol but the gate's class declares there.
    const wire = "lararium-mesh/src/auth-wire.ts";
    const declared = codeOnly(readFileSync(join(root, wire), "utf8")).split("\n")
      .flatMap((line, k) => { const name = DECLARES.exec(line)?.[1]; return name ? [`${wire}:${k + 1} ${name}`] : []; });
    expect(declared.map((site) => site.split(" ")[1]).sort()).toEqual(OLD_WIRE.filter((name) => name !== "DaemonAuthGate").sort());
    expect(sites.filter((site) => declared.includes(site))).toEqual([]);
  });

  red("NO_OLD_WIRE_PRODUCTION_CALLER: no production source or probe reaches the retired handshake, its gate, its frames or its proofs", () => {
    const sites = oldWireSites();
    expect(sites, `old wire still reached at:\n  ${sites.join("\n  ")}`).toEqual([]);
  });

  test("CONTROL: changing an existing signed admit field changes its act CID", async () => {
    const entry = await carriageAct(new Uint8Array(32).fill(31), "admit", { kahu: [new Uint8Array(32).fill(32)], epoch: "epoch-cutover" });
    expect(carriageEntryActCid({ ...entry, parents: ["different-parent"] })).not.toBe(carriageEntryActCid(entry));
  });

  // ADMIT_SIGNS_CANON_AND_PIN stands built: admit-carriage.test.ts holds its two-face, two-Nexus vectors.
  test("ADMIT_SIGNS_CANON_AND_PIN: changing the carried canon or gate pin changes the signed admit image", async () => {
    const opening = openAdmitCarriage({ gatePin: "aa".repeat(32), canon: { "bags/lares": "automerge:hearth-a" } });
    const withPin = await carriageAct(new Uint8Array(32).fill(31), "admit", { kahu: [new Uint8Array(32).fill(32)], epoch: "epoch-cutover", carriageCommit: admitCarriageCommit(opening) });
    const withOtherPin = { ...withPin, carriageCommit: admitCarriageCommit({ ...opening, carriage: { ...opening.carriage, gatePin: "bb".repeat(32) } }) };
    const withOtherCanon = { ...withPin, carriageCommit: admitCarriageCommit({ ...opening, carriage: { ...opening.carriage, canon: { "bags/lares": "automerge:hearth-b" } } }) };
    expect(carriageEntryActCid(withOtherPin)).not.toBe(carriageEntryActCid(withPin));
    expect(carriageEntryActCid(withOtherCanon)).not.toBe(carriageEntryActCid(withPin));
  });
});
