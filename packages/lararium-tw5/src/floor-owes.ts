/**
 * floor-owes — WHICH SUITES A LANE'S DIFF OWES THE FLOOR, folded inside the wiki that holds the seam table
 * (research/corpus-seams, the placement law: what CAN live in the wiki VM MUST). The pure core the `floor-owes` filter
 * operator reads through (`filters/floor-owes.ts`); it touches no engine and imports nothing.
 *
 * The records it folds ride in the line grammars below (the seam table, then the facts), joined into one text and folded
 * ONCE. A ticket that names files guards the files a spirit remembered; a ticket that names seams guards what the diff moves.
 *
 * ── THE SEAM TABLE (one data record, shipped with the house skin, overridable in the working layer) ─────────────────────
 *   PKG <letter> <dir>                       a package letter for MOVES rows (`n packages/lararium-node`)
 *   SEAM <name> [trunk] [root] [whole=<dir>] a seam; `trunk` owes the whole node e2e set, `root` the whole root e2e set,
 *                                            `whole=<dir>` that package's whole suite
 *   MOVES <seam> <letter> <stem-glob>…       source under `<dir>/src/`, by basename stem (a glob holding `/` reads the path
 *                                            under `src/`, extension aside)
 *   MOVES <seam> path <glob>…                any tracked path, by repo glob
 *   GUARDS <seam> e2e <name>…                `tests/e2e/<name>.test.ts`
 *   GUARDS <seam> node-e2e <name>…           `packages/lararium-node/tests/e2e/<name>.test.ts`
 *   GUARDS <seam> tool <name>…               `tools/<name>.test.mjs`
 *   GUARDS <seam> path <path-or-glob>…       a test file by path; a glob rides out as a GLOB row the host expands
 *   GUARDS <seam> witness <name>…            `tools/<name>.sh`, as the set `witness:<name>`
 *   BOTH <seam> <seam> <set>                 both seams hit owes the set
 *   VESSEL <path>…                           tool tests that stand real vessels (the vessel tier, beside every `e2e/` file)
 *   DARK <glob>…                             test files no lamp runs: owed ones read tier `dark`, receipted and unrun
 *   CONFIG <glob>…                           barrels, manifests and test configs: the package's whole suite and the node e2e set
 *   FREE <glob>…                             paths that owe nothing (prose, scratch)
 *   HUB <n> · WIDE <n> · SWIFT <n>           direct test fan-in that makes a hub · seams hit that owe every touched package's
 *                                            heavy tier · seconds under which a measured file reads swift
 * ── THE FACTS (the host reads a checkout; it holds no seam, no threshold and no second fold) ────────────────────────────
 *   TOUCH <path>                             a path the diff names
 *   GONE <path>                              a touched path absent from the head
 *   EDGE <test> <path> [secs=<n>]            a test file importing (or reading) a touched path at depth one
 *   SECS <test> <n>                          a test file's measured seconds
 *   UNREAD <what…>                           a fact the host could not read
 * A path rides percent-encoded wherever it holds whitespace or `%`. A `#` line and a blank line fold to nothing; any other
 * line the grammar does not read THROWS, since a dropped GUARDS row would owe less in silence.
 *
 * ── THE RULE ─────────────────────────────────────────────────────────────────────────────────────────────────────────
 *   R1 direct edge   every EDGE test rides; a touched test file owes itself
 *   R2 seam          each touched path maps to its seams; each seam hit owes that seam's guards
 *   R3 whole sets    a trunk seam owes `e2e-node`; `whole=<dir>` owes `pkg:<dir>`; a hub (fan-in at or past HUB) and a
 *                    CONFIG path owe `pkg:<their package>` and `e2e-node` (outside every package: `all`); WIDE seams hit owe
 *                    `pkg:<dir>` for every touched package
 *   R4 refusal       a touched path in no seam, no CONFIG row and no FREE row, and no test file, REFUSES the ticket by name
 *   unread           an UNREAD fact other than `weights` owes `all` and `e2e-node`: an unreadable fact owes more, never less
 * No clock enters the fold; rows answer sorted, so one diff answers one owed set.
 *
 * Views: `runs` (the default: the header `OWES facts=<n> table=<sha256> …`, then REFUSE, SET, GLOB and FILE rows) · `refuse` ·
 * `files` · `sets` · `seams` · `census` (the facts name every tracked path: UNMAPPED, UNDECLARED and DEAD rows under a
 * `CENSUS` header). A view the grammar does not name THROWS: an empty answer for a typo would read as nothing owed.
 *
 * THE TABLE NAMES ITSELF BY ITS BYTES: the header's `table=` carries the SHA-256 of the table rows this fold read (every
 * non-blank line outside the facts grammar, trimmed, newline-joined). The host holds a door's answer to the digest of
 * develop's own table, so a wiki standing on another table never answers a narrow ticket.
 *
 * TWO CALLERS, ONE FOLD. A wiki page and the host's ask through the filter door run the operator. Where the doors stand
 * dark `tools/floor-owes.mjs` loads THIS file's source out of develop's git objects and calls `floorOwesRows` in a child
 * node: it relies on that export name and on this file importing nothing, so the stripped source loads on its own.
 */

/** The seam table's shipped record. */
export const FLOOR_SEAMS = "lar:///ha.ka.ba/lararium/tw5/floor/seams";
export type OwedTier = "vessel" | "heavy" | "swift" | "tool" | "dark";
export const FLOOR_OWES_VIEWS = ["runs", "refuse", "files", "sets", "seams", "census"] as const;

interface Mover { readonly dir: string | null; readonly deep: boolean; readonly glob: RegExp }
interface Seam {
  readonly name: string;
  trunk: boolean;
  root: boolean;
  whole: string[];
  moves: Mover[];
  /** Guard test files by exact path. */
  guards: string[];
  /** Guard globs the host expands. */
  globs: string[];
  /** Sets the seam owes outright (`witness:<name>`). */
  sets: string[];
}
export interface SeamTable {
  pkgs: Map<string, string>;
  seams: Map<string, Seam>;
  both: Array<{ a: string; b: string; set: string }>;
  vessel: Set<string>;
  dark: RegExp[];
  config: RegExp[];
  free: RegExp[];
  hub: number;
  wide: number;
  swift: number;
}
export interface OwesFacts {
  touched: string[];
  gone: Set<string>;
  /** test path → the touched paths it reaches at depth one */
  edges: Map<string, Set<string>>;
  secs: Map<string, number>;
  unread: string[];
  /** Unique fact lines read: the host holds the header's `facts=` to the count it sent. */
  count: number;
  /** SHA-256 of the table rows read, as `tableDigestOf` canonicalises them. */
  table: string;
}
export interface OwedFile { path: string; tier: OwedTier; why: string[] }
export interface OwedNamed { name: string; why: string[] }
export interface Owed { refuse: string[]; files: OwedFile[]; globs: OwedNamed[]; sets: OwedNamed[]; seams: string[] }

const TEST_FILE = /\.test\.[cm]?[jt]sx?$|(?:^|\/)test_[^/]*\.py$/;
const E2E_DIR = /(?:^|\/)e2e\//;
const NODE_E2E = "packages/lararium-node/tests/e2e/";
const ROOT_E2E = "tests/e2e/";

/** True where a path names a test file (it owes itself and needs no seam). */
export const isTestPath = (path: string): boolean => TEST_FILE.test(path);

/** One glob as an anchored RegExp: `**` crosses `/` (a leading `**` and its slash match nothing too), `*` stops at `/`, `?` holds one non-`/` char. */
export function owesGlob(glob: string): RegExp {
  let out = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob.charAt(i);
    if (c === "*" && glob[i + 1] === "*") {
      if (glob[i + 2] === "/") { out += "(?:[\\s\\S]*/)?"; i += 2; } else { out += "[\\s\\S]*"; i += 1; }
    } else if (c === "*") out += "[^/]*";
    else if (c === "?") out += "[^/]";
    else out += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${out}$`);
}

const hasWild = (s: string): boolean => /[*?]/.test(s);
/** A path as a line carries it: whitespace and `%` percent-encoded. */
export const encodeOwesPath = (path: string): string => path.replace(/[%\s]/g, (c) => encodeURIComponent(c));
const decodePath = (word: string): string => { try { return decodeURIComponent(word); } catch { return word; } };

/** The package a path stands in (`packages/<name>`, or `tests` for the harness package); empty outside every package. */
export function packageOfPath(path: string): string {
  const m = /^packages\/([^/]+)\//.exec(path);
  if (m) return `packages/${m[1]}`;
  return path.startsWith("tests/") ? "tests" : "";
}

function count(word: string | undefined, verb: string, line: number): number {
  const n = Number(word);
  if (word === undefined || !Number.isFinite(n) || n < 0) throw new Error(`floor-owes: line ${line} ${verb} wants one non-negative number`);
  return n;
}

const SHA_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

/** SHA-256 of a string's UTF-8 bytes, lowercase hex. Pure: the fold reaches no engine and no host crypto. */
export function sha256Hex(text: string): string {
  const bytes: number[] = [];
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0;
    if (c < 0x80) bytes.push(c);
    else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  const bits = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const high = Math.floor(bits / 0x100000000), low = bits >>> 0;
  for (let i = 3; i >= 0; i--) bytes.push((high >>> (i * 8)) & 255);
  for (let i = 3; i >= 0; i--) bytes.push((low >>> (i * 8)) & 255);
  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const w = new Array<number>(64).fill(0);
  const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));
  for (let at = 0; at < bytes.length; at += 64) {
    for (let i = 0; i < 16; i++) w[i] = (((bytes[at + i * 4] ?? 0) << 24) | ((bytes[at + i * 4 + 1] ?? 0) << 16) | ((bytes[at + i * 4 + 2] ?? 0) << 8) | (bytes[at + i * 4 + 3] ?? 0)) >>> 0;
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15] ?? 0, b = w[i - 2] ?? 0;
      const s0 = rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3), s1 = rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10);
      w[i] = ((w[i - 16] ?? 0) + s0 + (w[i - 7] ?? 0) + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h as [number, number, number, number, number, number, number, number];
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + (SHA_K[i] ?? 0) + (w[i] ?? 0)) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    [a, b, c, d, e, f, g, hh].forEach((v, i) => { h[i] = ((h[i] ?? 0) + v) >>> 0; });
  }
  return h.map((v) => v.toString(16).padStart(8, "0")).join("");
}

const FACT_VERBS = new Set(["TOUCH", "GONE", "EDGE", "SECS", "UNREAD"]);

/** The digest a table names itself by: SHA-256 over every non-blank line outside the facts grammar, trimmed, newline-joined. */
export function tableDigestOf(text: string): string {
  const rows = String(text).split("\n").map((l) => l.trim()).filter((l) => l !== "" && !FACT_VERBS.has(l.split(/\s+/)[0] ?? ""));
  return sha256Hex(rows.join("\n"));
}

/** Read the joined records: the seam table and the facts. Throws on any line neither grammar reads. */
export function readOwes(text: string): { table: SeamTable; facts: OwesFacts } {
  const table: SeamTable = { pkgs: new Map(), seams: new Map(), both: [], vessel: new Set(), dark: [], config: [], free: [], hub: 40, wide: 8, swift: 5 };
  const facts: OwesFacts = { touched: [], gone: new Set(), edges: new Map(), secs: new Map(), unread: [], count: 0, table: tableDigestOf(text) };
  const touched = new Set<string>();
  const seenFacts = new Set<string>();
  const seam = (name: string | undefined, verb: string, line: number): Seam => {
    const held = name === undefined ? undefined : table.seams.get(name);
    if (!held) throw new Error(`floor-owes: line ${line} ${verb} names the seam "${name ?? ""}", which no SEAM row above it declares`);
    return held;
  };
  String(text).split("\n").forEach((raw, index) => {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) return;
    const at = index + 1;
    const words = line.split(/\s+/);
    const verb = words[0] ?? "";
    const rest = words.slice(1);
    const need = (n: number): void => { if (rest.length < n) throw new Error(`floor-owes: line ${at} ${verb} carries ${rest.length} word(s) where the grammar wants ${n} or more`); };
    const fact = (): boolean => { if (seenFacts.has(line)) return false; seenFacts.add(line); facts.count++; return true; };
    switch (verb) {
      case "PKG": need(2); table.pkgs.set(rest[0]!, rest[1]!.replace(/\/+$/, "")); return;
      case "SEAM": {
        need(1);
        const name = rest[0]!;
        if (table.seams.has(name)) throw new Error(`floor-owes: line ${at} declares the seam ${name} a second time`);
        const s: Seam = { name, trunk: false, root: false, whole: [], moves: [], guards: [], globs: [], sets: [] };
        for (const flag of rest.slice(1)) {
          if (flag === "trunk") s.trunk = true;
          else if (flag === "root") s.root = true;
          else if (flag.startsWith("whole=") && flag.length > 6) s.whole.push(flag.slice(6).replace(/\/+$/, ""));
          else throw new Error(`floor-owes: line ${at} SEAM ${name} carries the flag "${flag}"; flags: trunk · root · whole=<dir>`);
        }
        table.seams.set(name, s);
        return;
      }
      case "MOVES": {
        need(3);
        const s = seam(rest[0], verb, at);
        const kind = rest[1]!;
        const dir = kind === "path" ? null : table.pkgs.get(kind);
        if (dir === undefined) throw new Error(`floor-owes: line ${at} MOVES ${s.name} names "${kind}", neither \`path\` nor a PKG letter declared above it`);
        for (const g of rest.slice(2)) s.moves.push({ dir, deep: g.includes("/"), glob: owesGlob(decodePath(g)) });
        return;
      }
      case "GUARDS": {
        need(3);
        const s = seam(rest[0], verb, at);
        const kind = rest[1]!;
        for (const word of rest.slice(2)) {
          const w = decodePath(word);
          if (kind === "e2e") s.guards.push(`${ROOT_E2E}${w}.test.ts`);
          else if (kind === "node-e2e") s.guards.push(`${NODE_E2E}${w}.test.ts`);
          else if (kind === "tool") s.guards.push(`tools/${w}.test.mjs`);
          else if (kind === "witness") s.sets.push(`witness:${w}`);
          else if (kind === "path") (hasWild(w) ? s.globs : s.guards).push(w);
          else throw new Error(`floor-owes: line ${at} GUARDS ${s.name} names the kind "${kind}"; kinds: e2e · node-e2e · tool · path · witness`);
        }
        return;
      }
      case "BOTH": need(3); seam(rest[0], verb, at); seam(rest[1], verb, at); table.both.push({ a: rest[0]!, b: rest[1]!, set: rest[2]! }); return;
      case "VESSEL": need(1); for (const w of rest) table.vessel.add(decodePath(w)); return;
      case "DARK": need(1); for (const w of rest) table.dark.push(owesGlob(decodePath(w))); return;
      case "CONFIG": need(1); for (const w of rest) table.config.push(owesGlob(decodePath(w))); return;
      case "FREE": need(1); for (const w of rest) table.free.push(owesGlob(decodePath(w))); return;
      case "HUB": table.hub = count(rest[0], verb, at); return;
      case "WIDE": table.wide = count(rest[0], verb, at); return;
      case "SWIFT": table.swift = count(rest[0], verb, at); return;
      case "TOUCH": {
        need(1);
        if (!fact()) return;
        const p = decodePath(rest[0]!);
        if (!touched.has(p)) { touched.add(p); facts.touched.push(p); }
        return;
      }
      case "GONE": need(1); if (fact()) facts.gone.add(decodePath(rest[0]!)); return;
      case "EDGE": {
        need(2);
        if (!fact()) return;
        const test = decodePath(rest[0]!);
        const reached = facts.edges.get(test) ?? new Set<string>();
        reached.add(decodePath(rest[1]!));
        facts.edges.set(test, reached);
        const secs = rest.slice(2).map((w) => (w.startsWith("secs=") ? Number(w.slice(5)) : NaN)).find((n) => Number.isFinite(n));
        if (secs !== undefined) facts.secs.set(test, secs);
        return;
      }
      case "SECS": need(2); if (fact()) facts.secs.set(decodePath(rest[0]!), count(rest[1], verb, at)); return;
      case "UNREAD": need(1); if (fact()) facts.unread.push(rest.join(" ")); return;
      default: throw new Error(`floor-owes: line ${at} carries no row the grammar reads: "${line.slice(0, 80)}"`);
    }
  });
  facts.touched.sort();
  return { table, facts };
}

/** The seams whose MOVES rows name a path, in table order. */
export function seamsOfPath(table: SeamTable, path: string): string[] {
  const hit: string[] = [];
  for (const s of table.seams.values()) {
    const moved = s.moves.some((m) => {
      if (m.dir === null) return m.glob.test(path);
      const lead = `${m.dir}/src/`;
      if (!path.startsWith(lead)) return false;
      const rel = path.slice(lead.length);
      const slash = rel.lastIndexOf("/");
      const dot = rel.lastIndexOf(".");
      const stem = dot > slash + 1 ? rel.slice(0, dot) : rel;
      return m.glob.test(m.deep ? stem : stem.slice(slash + 1));
    });
    if (moved) hit.push(s.name);
  }
  return hit;
}

const any = (globs: readonly RegExp[], path: string): boolean => globs.some((g) => g.test(path));

/** The tier a test file rides: dark, vessel (an `e2e/` file or a VESSEL tool test), tool, then swift or heavy by its seconds (unmeasured reads heavy). */
export function tierOfTest(table: SeamTable, facts: OwesFacts, path: string): OwedTier {
  if (any(table.dark, path)) return "dark";
  if (E2E_DIR.test(path) || table.vessel.has(path)) return "vessel";
  if (path.startsWith("tools/")) return "tool";
  const secs = facts.secs.get(path);
  return secs !== undefined && secs < table.swift ? "swift" : "heavy";
}

/** A path the table places: a seam, a CONFIG row, a FREE row, or a test file. */
function placed(table: SeamTable, path: string, seams: readonly string[]): boolean {
  return seams.length > 0 || isTestPath(path) || any(table.config, path) || any(table.free, path);
}

/** THE RULE: the owed set for the facts, every list sorted. */
export function owedOf(table: SeamTable, facts: OwesFacts): Owed {
  const files = new Map<string, Set<string>>();
  const globs = new Map<string, Set<string>>();
  const sets = new Map<string, Set<string>>();
  const hit = new Map<string, string[]>();
  const refuse: string[] = [];
  const put = (into: Map<string, Set<string>>, key: string, why: string): void => { (into.get(key) ?? into.set(key, new Set()).get(key)!).add(why); };

  for (const what of facts.unread) {
    if (what === "weights") continue;
    put(sets, "all", `unread:${what}`);
    put(sets, "e2e-node", `unread:${what}`);
  }

  const fan = new Map<string, number>();
  for (const [test, reached] of facts.edges) for (const p of reached) { fan.set(p, (fan.get(p) ?? 0) + 1); put(files, test, `edge:${p}`); }

  const packages = new Set<string>();
  for (const p of facts.touched) {
    const pkg = packageOfPath(p);
    if (pkg) packages.add(pkg);
    const seams = seamsOfPath(table, p);
    for (const name of seams) (hit.get(name) ?? hit.set(name, []).get(name)!).push(p);
    if (isTestPath(p)) { if (!facts.gone.has(p)) put(files, p, "itself"); }
    if (!placed(table, p, seams)) { refuse.push(p); continue; }
    const escalate = (why: string): void => { put(sets, pkg ? `pkg:${pkg}` : "all", why); put(sets, "e2e-node", why); };
    if (any(table.config, p)) escalate(`config:${p}`);
    const drawn = fan.get(p) ?? 0;
    if (!isTestPath(p) && drawn >= table.hub) escalate(`hub:${p}(${drawn})`);
  }

  for (const [name] of hit) {
    const s = table.seams.get(name)!;
    for (const g of s.guards) put(files, g, `seam:${name}`);
    for (const g of s.globs) put(globs, g, `seam:${name}`);
    for (const set of s.sets) put(sets, set, `seam:${name}`);
    if (s.trunk) put(sets, "e2e-node", `trunk:${name}`);
    if (s.root) put(sets, "e2e-root", `root:${name}`);
    for (const dir of s.whole) put(sets, `pkg:${dir}`, `whole:${name}`);
  }
  for (const b of table.both) if (hit.has(b.a) && hit.has(b.b)) put(sets, b.set, `both:${b.a}+${b.b}`);
  if (hit.size >= table.wide) for (const pkg of packages) put(sets, `pkg:${pkg}`, `wide:${hit.size}-seams`);

  const named = (m: Map<string, Set<string>>): OwedNamed[] => [...m.keys()].sort().map((name) => ({ name, why: [...m.get(name)!].sort() }));
  return {
    refuse: refuse.sort(),
    files: [...files.keys()].sort().map((path) => ({ path, tier: tierOfTest(table, facts, path), why: [...files.get(path)!].sort() })),
    globs: named(globs),
    sets: named(sets),
    seams: [...hit.keys()].sort(),
  };
}

/** The refusal a path in no seam draws (R4). */
export const refusalOf = (path: string): string => `floor-owes: ${path} stands in no seam; add a MOVES row to the seam table, then ask again`;

/** The reasons a row carries: every seam, set and self reason, then the first three edges and a count of the rest. */
function whyWord(why: readonly string[]): string {
  const edges = why.filter((w) => w.startsWith("edge:"));
  const lead = why.filter((w) => !w.startsWith("edge:"));
  return [...lead, ...edges.slice(0, 3), ...(edges.length > 3 ? [`+${edges.length - 3} edges`] : [])].join(", ");
}

/** THE CENSUS over a whole tree (the facts TOUCH every tracked path): paths no row places, vessel-tier files no seam declares, guards naming nothing. */
export function censusOf(table: SeamTable, facts: OwesFacts): { unmapped: string[]; undeclared: string[]; dead: string[] } {
  const tree = new Set(facts.touched);
  const unmapped = facts.touched.filter((p) => !placed(table, p, seamsOfPath(table, p)));
  const guarded = new Set<string>();
  const globbed: RegExp[] = [];
  const dead: string[] = [];
  for (const s of table.seams.values()) {
    for (const g of s.guards) { guarded.add(g); if (!tree.has(g)) dead.push(`${s.name} ${g}`); }
    for (const g of s.globs) { const re = owesGlob(g); globbed.push(re); if (!facts.touched.some((p) => re.test(p))) dead.push(`${s.name} ${g}`); }
    for (const set of s.sets) if (set.startsWith("witness:") && !tree.has(`tools/${set.slice(8)}.sh`)) dead.push(`${s.name} ${set}`);
  }
  for (const v of table.vessel) if (!tree.has(v)) dead.push(`VESSEL ${v}`);
  const undeclared = facts.touched.filter((p) => isTestPath(p) && (E2E_DIR.test(p) || table.vessel.has(p)) && !any(table.dark, p) && !guarded.has(p) && !any(globbed, p));
  return { unmapped, undeclared, dead: dead.sort() };
}

/** One view of the fold over the joined records, as the filter operator answers it. */
export function floorOwesRows(text: string, view = "runs"): string[] {
  const { table, facts } = readOwes(text);
  const v = view.trim() || "runs";
  if (v === "census") {
    const c = censusOf(table, facts);
    return [
      `CENSUS files=${facts.touched.length} unmapped=${c.unmapped.length} undeclared=${c.undeclared.length} dead=${c.dead.length}`,
      ...c.unmapped.map((p) => `UNMAPPED ${encodeOwesPath(p)}`),
      ...c.undeclared.map((p) => `UNDECLARED ${encodeOwesPath(p)}`),
      ...c.dead.map((d) => `DEAD ${d}`),
    ];
  }
  const owed = owedOf(table, facts);
  switch (v) {
    case "runs": return [
      `OWES facts=${facts.count} table=${facts.table} touched=${facts.touched.length} seams=${owed.seams.length} refuse=${owed.refuse.length} sets=${owed.sets.length} globs=${owed.globs.length} files=${owed.files.length}`,
      ...owed.refuse.map((p) => `REFUSE ${encodeOwesPath(p)} · ${refusalOf(p)}`),
      ...owed.sets.map((s) => `SET ${s.name} · ${whyWord(s.why)}`),
      ...owed.globs.map((g) => `GLOB ${encodeOwesPath(g.name)} · ${whyWord(g.why)}`),
      ...owed.files.map((f) => `FILE ${f.tier} ${encodeOwesPath(f.path)} · ${whyWord(f.why)}`),
    ];
    case "refuse": return owed.refuse;
    case "files": return owed.files.map((f) => f.path);
    case "sets": return owed.sets.map((s) => s.name);
    case "seams": return owed.seams;
    default: throw new Error(`floor-owes: "${view}" names no view; views: ${FLOOR_OWES_VIEWS.join(" · ")}`);
  }
}
