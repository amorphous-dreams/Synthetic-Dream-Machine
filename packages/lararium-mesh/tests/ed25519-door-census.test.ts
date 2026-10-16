/**
 * ed25519-door-census.test — no source file verifies an Ed25519 signature but through the one door.
 *
 * The census DERIVES its ground: every source file under `packages/<package>/src` and `packages/<package>/scripts`,
 * `tools/` and the sensorium's Python scripts. A file reads red when it
 *   · calls `verify` or `verifyAsync` on a binding it imported from a curve library (`@noble/ed25519`,
 *     `@noble/curves`), or imports either name from one;
 *   · loads a curve library dynamically and calls any `.verify(` / `.verifyAsync(`;
 *   · verifies through WebCrypto (`subtle.verify`), Node (`crypto.verify`, `createVerify`), NaCl or a Python
 *     signature library.
 * The door itself stands as the one file that may. A named exemption carries its reason, and an exemption
 * that no longer matches anything reads red too, so the list cannot rot into a blanket.
 *
 * CONTROL: the same scanner reads a planted fault of each kind and names it.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, test, expect } from "vitest";

const REPO = join(import.meta.dirname, "..", "..", "..");
const DOOR = "packages/lararium-mesh/src/ed25519-door.ts";

/** A file that may hold a verify call the scanner would flag, with the reason it stands outside the law. */
const EXEMPT: Readonly<Record<string, string>> = {
  "tools/capability-probe/app.js":
    "a browser capability probe: it asks whether WebCrypto offers Ed25519 at all, over a key it just minted, and decides no authority",
};

const CURVE_LIBRARY = /^@noble\/(?:ed25519|curves)(?:\/|$)|^tweetnacl$|^libsodium/;

export function findDirectVerifies(path: string, source: string): string[] {
  const found: string[] = [];
  const flag = (what: string): void => { found.push(`${path}: ${what}`); };
  // Comments name the call they retired; only code counts.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");

  if (path.endsWith(".py")) {
    if (/\b(?:VerifyKey|Ed25519PublicKey|verify_strict)\b|\.verify\s*\(/.test(source.replace(/#.*$/gm, ""))
        && /\b(?:nacl|cryptography|ed25519)\b/.test(source)) flag("a Python signature library verifies");
    return found;
  }

  const bindings = new Set<string>();
  for (const m of code.matchAll(/import\s+([^;]*?)\s+from\s+["']([^"']+)["']/g)) {
    if (!CURVE_LIBRARY.test(m[2]!)) continue;
    const clause = m[1]!;
    const star = /\*\s+as\s+(\w+)/.exec(clause);
    if (star) bindings.add(star[1]!);
    const named = /\{([^}]*)\}/.exec(clause);
    for (const part of named ? named[1]!.split(",") : []) {
      const [imported, local] = part.trim().split(/\s+as\s+/);
      if (!imported) continue;
      if (/^verify(?:Async)?$/.test(imported)) flag(`imports ${imported} from ${m[2]}`);
      bindings.add((local ?? imported).trim());
    }
    const bare = /^(\w+)\s*(?:,|$)/.exec(clause);
    if (bare) bindings.add(bare[1]!);
  }
  for (const name of bindings) {
    if (new RegExp(`\\b${name}\\s*\\.\\s*verify(?:Async)?\\s*\\(`).test(code)) flag(`calls ${name}.verify on a curve library`);
    // A destructured or aliased verify: `const { verify } = ed`, `const v = ed.verifyAsync`.
    if (new RegExp(`\\b${name}\\s*\\.\\s*verify(?:Async)?\\b(?!\\s*\\()`).test(code)) flag(`takes ${name}.verify off a curve library`);
    if (new RegExp(`\\{[^}]*\\bverify(?:Async)?\\b[^}]*\\}\\s*=\\s*${name}\\b`).test(code)) flag(`destructures verify off ${name}`);
  }
  if (/import\s*\(\s*["']@noble\/(?:ed25519|curves)[^"']*["']\s*\)/.test(code) && /\.\s*verify(?:Async)?\s*\(/.test(code)) {
    flag("loads a curve library dynamically and calls a verify");
  }
  if (/\bsubtle\s*\.\s*verify\s*\(|\b\w+\.verify\s*\(\s*(?:["']Ed25519["']|\{\s*name:\s*["']Ed25519["'])/.test(code)) flag("verifies through WebCrypto");
  if (/\bcrypto\s*\.\s*verify\s*\(|\bcreateVerify\s*\(|import\s*\{[^}]*\bverify\b[^}]*\}\s*from\s*["']node:crypto["']/.test(code)) flag("verifies through Node crypto");
  if (/\bnacl\s*\.\s*sign\b/.test(code)) flag("verifies through NaCl");
  return found;
}

function walk(dir: string, keep: (file: string) => boolean, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name.startsWith(".")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, keep, out);
    else if (keep(name)) out.push(path);
  }
  return out;
}

function censusGround(): string[] {
  const code = (name: string): boolean => /\.(?:ts|tsx|mts|js|mjs|cjs|sh)$/.test(name) && !/\.test\.[cm]?[jt]sx?$/.test(name) && !name.endsWith(".d.ts");
  const files: string[] = [];
  for (const pkg of readdirSync(join(REPO, "packages"))) {
    for (const part of ["src", "scripts"]) {
      const dir = join(REPO, "packages", pkg, part);
      try { if (statSync(dir).isDirectory()) walk(dir, code, files); } catch { /* a package with no such directory holds no source there */ }
    }
  }
  walk(join(REPO, "tools"), code, files);
  walk(join(REPO, "packages", "lararium-sensorium", "scripts"), (name) => name.endsWith(".py"), files);
  return files.map((f) => relative(REPO, f)).sort();
}

describe("the census of Ed25519 verifiers", () => {
  const ground = censusGround();

  test("the ground reads wide: every package's source, the tools and the Python scripts", () => {
    expect(ground).toContain(DOOR);
    expect(ground.filter((f) => f.startsWith("packages/lararium-mesh/src/")).length).toBeGreaterThan(200);
    for (const pkg of ["lararium-node", "lares-cli", "lararium-browser", "lararium-keyhive", "lararium-tw5"]) {
      expect(ground.some((f) => f.startsWith(`packages/${pkg}/src/`)), pkg).toBe(true);
    }
    expect(ground.some((f) => f.startsWith("tools/"))).toBe(true);
    expect(ground.some((f) => f.endsWith(".py"))).toBe(true);
  });

  test("★ no source file but the door calls a curve library's verify ★", () => {
    const found = ground
      .filter((f) => f !== DOOR && !(f in EXEMPT))
      .flatMap((f) => findDirectVerifies(f, readFileSync(join(REPO, f), "utf8")));
    expect(found).toEqual([]);
  });

  test("the door itself holds the one call, and every exemption still names a live call", () => {
    expect(findDirectVerifies(DOOR, readFileSync(join(REPO, DOOR), "utf8"))).not.toEqual([]);
    for (const [file, reason] of Object.entries(EXEMPT)) {
      expect(reason.length, file).toBeGreaterThan(20);
      expect(findDirectVerifies(file, readFileSync(join(REPO, file), "utf8")), file).not.toEqual([]);
    }
  });

  test("the door's callers reach it: every package that verifies imports the door by name", () => {
    const callers = ground.filter((f) => f !== DOOR && /\bverifyEd25519\s*\(/.test(readFileSync(join(REPO, f), "utf8")));
    expect(callers.length).toBeGreaterThan(20);
    for (const f of callers) {
      expect(readFileSync(join(REPO, f), "utf8"), f).toMatch(/import\s*\{[^}]*\bverifyEd25519\b[^}]*\}\s*from\s*["'](?:\.\/ed25519-door\.js|@lararium\/mesh)["']/);
    }
  });
});

/**
 * A VERIFIER HANDED IN verifies as leniently as its caller chose. No function takes a signature verifier as a
 * parameter where it can call the door itself. The files below still take one, each fed today by a caller
 * that hands in the door; the list may only SHRINK: a new file reads red, and so does a name that no longer
 * takes one.
 */
const STILL_TAKES_A_VERIFIER: readonly string[] = [
  "packages/lararium-keyhive/src/keyhive-identity-slot.ts",   // a token SEAL (sign and verify under one held key): no public key rides the call
  "packages/lararium-mesh/src/cabal-invite.ts",
  "packages/lararium-mesh/src/raise-challenge.ts",
  "packages/lararium-mesh/src/vouch-board.ts",
  "packages/lararium-node/src/realm-admission.ts",
  "packages/lararium-node/src/vessel-raise.ts",
];
/** A parameter or option named `verify` whose type takes signature-shaped arguments (bytes and hex strings). */
const TAKES_A_VERIFIER = /\bverify\??:\s*\(\s*\w+:\s*(?:Uint8Array|string)\b[^)]*\)\s*=>\s*(?:boolean|Promise<boolean>)/;

describe("no verifier rides in as a parameter", () => {
  test("★ the files that still take a signature verifier stand exactly as listed, and the list only shrinks ★", () => {
    const takers = censusGround().filter((f) => TAKES_A_VERIFIER.test(readFileSync(join(REPO, f), "utf8")));
    expect(takers).toEqual([...STILL_TAKES_A_VERIFIER].sort());
  });
  test("CONTROL: a planted verifier parameter reads, and a door call does not", () => {
    expect(TAKES_A_VERIFIER.test("export function f(edge: Edge, verify: (bytes: Uint8Array, sigHex: string, did: string) => Promise<boolean>) {}")).toBe(true);
    expect(TAKES_A_VERIFIER.test("readonly verify: (nym: string, bytes: Uint8Array, sig: string) => boolean | Promise<boolean>;")).toBe(true);
    expect(TAKES_A_VERIFIER.test("export function f(edge: Edge) { return verifyEd25519(edge.sig, bytes, edge.signer); }")).toBe(false);
  });
});

describe("CONTROL: a planted fault of each kind reads red", () => {
  const PLANTED: ReadonlyArray<readonly [string, string, RegExp]> = [
    ["a namespace call", `import * as ed25519 from "@noble/ed25519";\nexport const ok = (s: Uint8Array, m: Uint8Array, k: Uint8Array) => ed25519.verifyAsync(s, m, k);`, /calls ed25519\.verify/],
    ["a named binding", `import { ed25519 as edSync } from "@noble/curves/ed25519.js";\nexport const ok = edSync.verify(s, m, k);`, /calls edSync\.verify/],
    ["the library's own strict flag", `import { ed25519 } from "@noble/curves/ed25519.js";\nconst ok = ed25519.verify(s, m, k, { zip215: false });`, /calls ed25519\.verify/],
    ["an imported verify", `import { verifyAsync } from "@noble/ed25519";\nawait verifyAsync(s, m, k);`, /imports verifyAsync/],
    ["an aliased verify", `import * as ed from "@noble/ed25519";\nconst check = ed.verifyAsync;\nawait check(s, m, k);`, /takes ed\.verify/],
    ["a destructured verify", `import * as ed from "@noble/ed25519";\nconst { verifyAsync } = ed;`, /destructures verify off ed/],
    ["a dynamic import", `const lib = await import("@noble/ed25519");\nawait lib.verifyAsync(s, m, k);`, /dynamically/],
    ["WebCrypto", `const ok = await crypto.subtle.verify({ name: "Ed25519" }, key, sig, data);`, /WebCrypto/],
    ["Node crypto", `import crypto from "node:crypto";\nconst ok = crypto.verify(null, data, key, sig);`, /Node crypto/],
    ["Node crypto, named", `import { verify } from "node:crypto";\nverify(null, data, key, sig);`, /Node crypto/],
    ["NaCl", `import nacl from "tweetnacl";\nnacl.sign.detached.verify(m, s, k);`, /NaCl/],
  ];
  test.each(PLANTED)("%s", (_name, source, names) => {
    const found = findDirectVerifies("packages/planted/src/fault.ts", source);
    expect(found.join("\n")).toMatch(names);
  });
  test("a Python verifier", () => {
    expect(findDirectVerifies("scripts/fault.py", "from nacl.signing import VerifyKey\nVerifyKey(k).verify(m, s)\n")).not.toEqual([]);
  });
  test("a comment that names a call stays quiet, and so does a signer", () => {
    const quiet = `import * as ed25519 from "@noble/ed25519";\n// was: ed25519.verifyAsync(sig, bytes, key)\n/* ed25519.verify( */\nexport const sign = (b: Uint8Array, s: Uint8Array) => ed25519.signAsync(b, s);`;
    expect(findDirectVerifies("packages/planted/src/quiet.ts", quiet)).toEqual([]);
  });
});
