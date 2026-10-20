/**
 * K15 step 0, the archive-row-selector joint (`docs/pono/k15-custody-step-zero#/open-joints`).
 *
 * Every node writer and reader of a Keyhive or Veil archive row, traced from source. Each site names the selector
 * it hands the row: `none` (a fixed row), `handle-index` (a local `h<N>` the wear pointer or anchors supply), or
 * `bytes-only` (a callback that carries bytes and no row). No site passes an authenticated PersonaGroup, so the
 * joint stays open and no bytes move. A new site, or a site that changes its count, reads red until this table
 * names it; the day a site authenticates its group, its row flips to `authenticated` in the same commit.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

type Selector = "none" | "handle-index" | "bytes-only" | "authenticated";
interface Site { readonly file: string; readonly token: RegExp; readonly count: number; readonly selector: Selector; readonly act: string }

const NODE = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const KEYHIVE = join(NODE, "..", "..", "lararium-keyhive", "src");
const CALL = (name: string): RegExp => new RegExp(`\\b${name}\\(`, "g");

/** The trace, one row per source site, in the order the scout read them. */
const SITES: readonly Site[] = [
  { file: join(NODE, "commands/init.ts"), token: CALL("loadIdentityArchive"), count: 2, selector: "none", act: "admit and place-founding read the one standing Keyhive archive" },
  { file: join(NODE, "commands/init.ts"), token: CALL("persistIdentityArchive"), count: 2, selector: "none", act: "admit and place-founding write the one standing Keyhive archive" },
  { file: join(NODE, "commands/init.ts"), token: CALL("loadVeilArchive"), count: 1, selector: "handle-index", act: "persona new reads the prior face's veil archive by h<N>" },
  { file: join(NODE, "commands/init.ts"), token: CALL("persistVeilArchive"), count: 1, selector: "handle-index", act: "persona new writes the new face's veil archive by h<N>, before its anchors commit" },
  { file: join(NODE, "open-node-vessel.ts"), token: /\bsovereign\.writeArchive\(/g, count: 1, selector: "none", act: "boot's write door for the vessel archive" },
  { file: join(NODE, "open-node-vessel.ts"), token: /\bsovereign\.writeVeilArchive\(/g, count: 1, selector: "handle-index", act: "boot's write door for the mounted face's veil archive, h<N> captured from the wear pointer" },
  { file: join(NODE, "open-node-vessel.ts"), token: /\bsovereign\.archive\(/g, count: 1, selector: "none", act: "boot reads the vessel archive whatever face is worn" },
  { file: join(NODE, "open-node-vessel.ts"), token: /\bsovereign\.veilArchive\(/g, count: 1, selector: "handle-index", act: "boot reads the mounted face's veil archive by h<N>" },
  { file: join(NODE, "node-daemon-island.ts"), token: /sealOnVessel\("(?:archive|veil)"/g, count: 2, selector: "bytes-only", act: "the worker port carries a carrier label and bytes, no row" },
  { file: join(KEYHIVE, "operator-daemon-behavior.ts"), token: /\bpersistArchiveFloor\(/g, count: 1, selector: "bytes-only", act: "boot's archive floor writes both rows through byte-only callbacks" },
  { file: join(KEYHIVE, "operator-daemon-behavior.ts"), token: /provider === veilKh \? persistVeilArchive : persistArchive/g, count: 1, selector: "bytes-only", act: "a content-key wrap rests the provider's archive: provider identity picks the row" },
];

/** The identifiers that name an archive row's writer or reader; a source file holding one must hold a SITES row. */
const WATCHED = /\b(?:persistIdentityArchive|loadIdentityArchive|persistVeilArchive|loadVeilArchive|persistArchiveFloor|writeArchive|writeVeilArchive)\b/;
const OWNED_ELSEWHERE = new Set(["identity-anchors.ts", "index.ts", "vault-carriers.ts", "archive-floor-write.ts"]);

const stripComments = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const read = (file: string): string => stripComments(readFileSync(file, "utf8"));
const count = (src: string, token: RegExp): number => (src.match(new RegExp(token.source, token.flags.includes("g") ? token.flags : `${token.flags}g`)) ?? []).length;

describe("the node archive-row selector trace (K15 step zero joint)", () => {
  it("finds every traced site in source at its recorded count", () => {
    for (const site of SITES) expect(count(read(site.file), site.token), `${site.act}`).toBe(site.count);
  });

  it("finds no archive writer or reader outside the trace", () => {
    const traced = new Set(SITES.map((s) => s.file));
    const stray: string[] = [];
    for (const dir of [NODE, join(NODE, "commands"), KEYHIVE]) {
      for (const name of readdirSync(dir).filter((n: string) => n.endsWith(".ts"))) {
        const file = join(dir, name);
        if (traced.has(file) || OWNED_ELSEWHERE.has(name)) continue;
        if (WATCHED.test(read(file))) stray.push(file);
      }
    }
    expect(stray).toEqual([]);
  });

  it("holds the joint open: no site hands its row an authenticated PersonaGroup", () => {
    expect(SITES.filter((s) => s.selector === "authenticated")).toEqual([]);
    expect(new Set(SITES.map((s) => s.selector))).toEqual(new Set(["none", "handle-index", "bytes-only"]));
  });

  // CONTROLS: the scan reads a site missing or a stray present.
  it("control: a count that drifts reads red", () => {
    const site = SITES[0]!;
    expect(count(read(site.file) + "\nloadIdentityArchive();", site.token)).toBe(site.count + 1);
  });

  it("control: the stray scan reads a known positive — the row owner's own file holds the watched names", () => {
    expect(WATCHED.test(read(join(NODE, "identity-anchors.ts")))).toBe(true);
    expect(WATCHED.test(read(join(KEYHIVE, "archive-floor-write.ts")))).toBe(true);
  });

  it("control: the watched pattern names a stray writer", () => {
    expect(WATCHED.test("await persistVeilArchive(bytes, 3);")).toBe(true);
    expect(WATCHED.test("await somethingElse(bytes);")).toBe(false);
  });
});
