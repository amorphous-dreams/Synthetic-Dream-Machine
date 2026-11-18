// test-credential-witness — no carrier under `bags/` or `wikis/` carries a test credential literal.
//
// THE FALSE ALARM IT CLOSES. The K2 spy (`packages/lararium-web/tests/e2e/ceremony.e2e.test.ts`) hunts the published test
// passphrase in every message the page receives. Canon relays to the page as records, so a canon line that quoted the
// passphrase (stable-founding-road T36 once did) trips the spy with no key moving, and a real K2 red then reads as noise.
// The spy stays; this witness keeps canon from ever handing it that text.
//
// THE LITERALS COME FROM THEIR SOURCES, never a copy: each source file's `export const <…PASSPHRASE…> = "…"` and every
// `passphrase: "…"` literal it writes (the published routes and the fixture's own).
//
// SILENT-ZERO GUARD: a source that stands absent, a source naming no literal, or a corpus with no tracked carrier reads
// red (exit 2): a witness that found nothing to look for proves nothing.
//
// Usage: node tools/test-credential-witness.mjs [--root <repo>]
// Exit: 0 holds · 1 a carrier carries a literal · 2 the witness could not stand
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** The files that publish a test credential, read for their literals. */
export const CREDENTIAL_SOURCES = [
  "packages/lararium-node/probes/browser-test-custody.ts",
  "tools/test-custody-route.mjs",
  "tools/test-ward-route.mjs",
  "packages/lararium-node/tests/custody-seat-fixture.ts",
];

/** The carrier roots the witness reads (tracked files alone; a root that stands absent holds none). */
export const CARRIER_ROOTS = ["bags", "wikis"];

/** The credential literals one source's text names. */
export function literalsIn(text) {
  const out = new Set();
  for (const m of text.matchAll(/export\s+const\s+\w*PASSPHRASE\w*\s*=\s*(["'`])([^"'`\n]+)\1/g)) out.add(m[2]);
  for (const m of text.matchAll(/passphrase\s*:\s*(["'`])([^"'`\n$]+)\1/g)) out.add(m[2]);
  return [...out].filter((v) => v.length >= 8);
}

/** Every carrier line that carries a literal: [{ file, line, literal }]. */
export function hitsIn(files, literals, read) {
  const hits = [];
  for (const file of files) {
    const lines = read(file).split("\n");
    lines.forEach((text, i) => { for (const literal of literals) if (text.includes(literal)) hits.push({ file, line: i + 1, literal }); });
  }
  return hits;
}

export function run(root) {
  const literals = new Set();
  for (const src of CREDENTIAL_SOURCES) {
    const path = resolve(root, src);
    if (!existsSync(path)) return { code: 2, message: `test-credential-witness: the source ${src} stands absent` };
    const found = literalsIn(readFileSync(path, "utf8"));
    if (found.length === 0) return { code: 2, message: `test-credential-witness: the source ${src} names no credential literal (silent zero)` };
    for (const l of found) literals.add(l);
  }
  const roots = CARRIER_ROOTS.filter((r) => existsSync(resolve(root, r)));
  const files = roots.length === 0 ? [] : execFileSync("git", ["-C", root, "ls-files", "-z", "--", ...roots], { encoding: "utf8" })
    .split("\0").filter(Boolean).filter((f) => existsSync(resolve(root, f)));
  if (files.length === 0) return { code: 2, message: "test-credential-witness: no tracked carrier under bags/ or wikis/ (silent zero)" };
  const hits = hitsIn(files, [...literals], (f) => readFileSync(resolve(root, f), "utf8"));
  if (hits.length > 0) {
    return { code: 1, message: hits.map((h) => `  CARRIES ${h.file}:${h.line} «${h.literal}»`).join("\n") +
      `\ntest-credential-witness: ${hits.length} line(s) carry a test credential literal; reword them (the K2 spy reads relayed canon)` };
  }
  return { code: 0, message: `test-credential-witness: ${files.length} carrier(s) clean of ${literals.size} test credential literal(s)` };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf("--root");
  const root = i >= 0 ? resolve(process.argv[i + 1]) : resolve(fileURLToPath(new URL("..", import.meta.url)));
  const out = run(root);
  (out.code === 0 ? console.log : console.error)(out.message);
  process.exitCode = out.code;
}
