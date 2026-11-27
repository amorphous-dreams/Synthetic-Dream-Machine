/**
 * build-affordance-pack — bake every canon affordance carrier through the skin templates into ONE content-addressed pack.
 *
 * THE READ LANTERN NEVER RAN, SETTLED IN SOURCE: the engine renders a carrier through a text template at bake time with no
 * vessel. A `TW5Engine` boots in-process off the vendored core and the two packed skins (`tests/test-wiki.ts`, the boot
 * `scripts/smoke-plugin-boot.ts` already runs at build), `ingestCarrier` splits a `.mem` through TW5's own registered
 * deserializer into its root and `#/slot` records, and `wiki.renderTiddler("text/plain", template, { variables })` renders a
 * template against them, the call `meme project` already rides (`meme-project.ts#renderRoot`). No vessel, no store, no dial.
 *
 * WHAT IT READS. Every `.mem` under the canon source (`bags/`, or `--bags <dir>`) whose text names the affordance type tag
 * (`lar:///ha.ka.ba/lares/api/pono/affordance`), so the law meme that owns the shared `#/takes/*` slots rides in beside the
 * carriers and a `kahea` call resolves. A carrier: a root record tagged with the type tag whose title carries an address, the
 * bare root or the stable seat canon gives it (`lar:///ha.ka.ba/lares/afford/<address>`, tagging the bare address). The pack
 * keys every carrier by its ADDRESS and keeps its title beside it.
 * `--carrier <file>` (repeatable) adds a file outside the canon source (a test's fixture).
 *
 * WHAT IT WRITES (`affordance-pack.json`, beside this package's `package.json`):
 *   carriers    per address: its frame check (`bcc`), `role`, and every render, surface × depth (line · whole · each slot),
 *               the mcp surface also per parameter
 *   routes      per surface: the skin's spelling → address (cli `oracle cast`, mcp `oracle_cast`, tw5 `action-oracle-cast`,
 *               console the bare address), each derived from the carrier's `#/skins`, no hand table
 *   doors       per CLI door (the spelling's first word): its addresses, the brief the top-level index prints, the lines
 *               `lares <door> --help` and its usage refusal print
 *   index       the `lares --help` lines of every carrier, through the index template
 *   hash        sha256 over the pack's canonical bytes with the hash field absent
 *
 * `--check` regenerates in memory and compares bytes with the tracked pack (witness W3); a stale or hand-edited pack exits 1
 * and names the cure. Run after `build:plugin`, since the renderer rides the packed house skin.
 *
 * Usage: tsx scripts/build-affordance-pack.ts [--check] [--bags <dir>] [--carrier <file>]... [--out <file>]
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/affordance
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bccOf, headUriOf } from "@lararium/memetic-frame";
import { bootTestWiki } from "../tests/test-wiki.js";
import { TW5_CORE_SCRIPT_FILENAME } from "../src/generated-tw5-version.js";
import { AFFORDANCE_TAG, AFFORD_SLOTS, AFFORD_SURFACES, addressOfTitle, bareAddressOf, type AffordSurface } from "../src/affordance-rows.js";
import { rowsOf, skinRows, type TextOf } from "../src/affordance-read.js";
import type { TW5Engine } from "../src/tw5-vm.js";

const PACKAGE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO = path.resolve(PACKAGE, "../..");
export const PACK_PATH = path.join(PACKAGE, "affordance-pack.json");
export const PACK_TITLE = "lar:///ha.ka.ba/lares/api/pono/affordance-pack";
const SKIN = (surface: string): string => `lar:///ha.ka.ba/lararium/tw5/afford/skin/${surface}`;
const INDEX = "lar:///ha.ka.ba/lararium/tw5/afford/index";

/** Every `.mem` under a directory, sorted, so one tree bakes one byte string on any filesystem. */
function memFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith(".mem")) out.push(full);
    }
  };
  if (existsSync(dir)) walk(dir);
  return out;
}

/** The text of one record the engine holds, `undefined` where it holds none. */
const textOfEngine = (engine: TW5Engine): TextOf => (title) => {
  const fields = (engine.wiki.getTiddler(title) as { fields?: Record<string, unknown> } | undefined)?.fields;
  return fields === undefined ? undefined : String(fields["text"] ?? "");
};

const lines = (text: string): string[] => {
  const out = text.replace(/\r\n/g, "\n").split("\n");
  while (out.length > 0 && out[out.length - 1] === "") out.pop();
  return out;
};

export interface AffordancePackCarrier {
  /** The carrier's own title: the stable seat canon gives it (`lar:///ha.ka.ba/lares/afford/oracle.cast.throws`). */
  readonly title: string;
  readonly bcc: string | null;
  readonly role: string;
  readonly renders: Record<string, Record<string, readonly string[]>>;
  /** The mcp skin's parameter descriptions, keyed by the mcp spelling. */
  readonly params: Record<string, string>;
  /** Per surface the carrier skins: the argument spellings its door takes (witness W2 reads them against the handler). */
  readonly takes: Record<string, readonly string[]>;
  /** Per surface the carrier skins: every example and every cure as a runnable line (witness W4 parses each at its door). */
  readonly calls: Record<string, readonly string[]>;
}

export interface AffordancePack {
  readonly title: string;
  readonly hash: string;
  readonly carriers: Record<string, AffordancePackCarrier>;
  readonly routes: Record<string, Record<string, string>>;
  readonly doors: Record<string, { readonly addresses: readonly string[]; readonly brief: string; readonly help: readonly string[] }>;
  readonly index: Record<string, readonly string[]>;
}

/** Bake the pack from carrier texts: the one function `--check`, the write and a test's fixture bake all call. */
export async function bakeAffordancePack(texts: readonly string[]): Promise<AffordancePack> {
  const engine = await bootTestWiki();
  const bccs = new Map<string, string | null>();
  for (const text of texts) {
    const uri = headUriOf(text);
    if (!uri) continue;
    engine.ingestCarrier(uri, text);
    bccs.set(uri, bccOf(text));
  }
  const textOf = textOfEngine(engine);
  const tagged = engine.wiki.filterTiddlers(`[all[tiddlers]tag[${AFFORDANCE_TAG}]sort[]]`).filter((t) => addressOfTitle(t) !== null);
  const render = (surface: string, title: string, variables: Record<string, string>): string[] =>
    lines(engine.wiki.renderTiddler("text/plain", SKIN(surface), { variables: { currentTiddler: title, ...variables } }));

  const carriers: Record<string, AffordancePackCarrier> = {};
  const routes: Record<string, Record<string, string>> = Object.fromEntries(AFFORD_SURFACES.map((s) => [s, {}]));
  /** Each address's own cli spelling (its skin row's `spells/`), apart from the `also/` spellings routed beside it. */
  const ownCli = new Map<string, string>();
  for (const title of tagged) {
    const address = addressOfTitle(title)!;
    // ONE CLOSED SLOT SET: a carrier slot the set never names would bake silently unrendered, so it refuses the bake by name.
    for (const child of engine.wiki.filterTiddlers(`[prefix[${title}#/]]`)) {
      const slot = `#/${child.slice(title.length + 2).split("/")[0]}`;
      if (!(AFFORD_SLOTS as readonly string[]).includes(slot)) {
        throw new Error(`affordance-slot-unknown: ${title} holds ${slot}, outside the closed slot set (${AFFORD_SLOTS.join(" · ")}); rename the slot or name it in lar:///ha.ka.ba/lares/api/pono/affordance and AFFORD_SLOTS together`);
      }
    }
    const role = String((engine.wiki.getTiddler(title) as { fields?: Record<string, unknown> } | undefined)?.fields?.["role"] ?? "");
    const renders: Record<string, Record<string, readonly string[]>> = {};
    for (const surface of AFFORD_SURFACES) {
      const bySurface: Record<string, readonly string[]> = {
        line: render(surface, title, { depth: "line" }),
        whole: render(surface, title, { depth: "whole" }),
      };
      if (surface !== "mcp") for (const slot of AFFORD_SLOTS) bySurface[slot] = render(surface, title, { depth: "slot", slot });
      renders[surface] = bySurface;
    }
    const params: Record<string, string> = {};
    for (const row of rowsOf(textOf, title, "#/takes", "mcp")) {
      if (row["entity"] !== "arg") continue;
      params[String(row["spell"])] = render("mcp", title, { depth: "param", arg: String(row["name"]) }).join(" ");
    }
    const takes: Record<string, string[]> = {};
    const calls: Record<string, string[]> = {};
    const bare = bareAddressOf(address)!;
    for (const row of skinRows(textOf, title)) {
      const spells = (row.params["spells"] ?? row.name).trim();
      const surface = row.name as AffordSurface;
      if (!(surface in routes)) continue;
      const spelling = surface === "cli" ? spells.replace(/^lares\s+/, "") : spells;
      const claimed = routes[surface]![spelling];
      // ONE DOOR, ONE ADDRESS: two carriers claiming one spelling refuse the bake by name (witness W1's red, at the source).
      if (claimed !== undefined && claimed !== address) {
        throw new Error(`affordance-door-claimed-twice: ${surface} \`${spelling}\` skins both ${claimed} and ${address}; one door names one address`);
      }
      routes[surface]![spelling] = address;
      if (surface === "cli") ownCli.set(address, spelling);
      // A skin row may name further spellings the one door answers (`also/[[lares shore keep-records]]`, comma-joined): two
      // words for one act ride one address, each routed to it. Another carrier claiming one refuses the bake the same way.
      for (const alias of (row.params["also"] ?? "").split(",").map((a) => a.trim().replace(/^lares\s+/, "")).filter(Boolean)) {
        const held = routes[surface]![alias];
        if (held !== undefined && held !== address) {
          throw new Error(`affordance-door-claimed-twice: ${surface} \`${alias}\` skins both ${held} and ${address}; one door names one address`);
        }
        routes[surface]![alias] = address;
      }
      // A positional arg (`seat/N`) rides no flag: the door row's `accepts` names flags alone, so W2 reads these apart.
      takes[surface] = rowsOf(textOf, title, "#/takes", surface).filter((r) => r["entity"] === "arg" && r["positional"] !== true).map((r) => String(r["spell"]));
      calls[surface] = [
        ...rowsOf(textOf, title, "#/shows", surface).flatMap((r) => (typeof r["call"] === "string" && r["foreign"] !== true ? [r["call"]] : [])),
        ...rowsOf(textOf, title, "#/refuses", surface).flatMap((r) => (typeof r["cure"] === "string" && r["foreign"] !== true ? [r["cure"]] : [])),
      ];
    }
    carriers[address] = { title, bcc: bccs.get(title) ?? null, role, renders, params, takes, calls };
    routes["console"]![bare] = address;
  }

  // A CLI door gathers every address whose cli skin spells beneath it: one address renders its whole, several an index.
  const doors: Record<string, { addresses: string[]; brief: string; help: string[] }> = {};
  for (const [spelling, address] of Object.entries(routes["cli"]!).sort(([a], [b]) => a.localeCompare(b))) {
    const door = spelling.split(/\s+/)[0]!;
    const entry = (doors[door] ??= { addresses: [], brief: "", help: [] });
    if (!entry.addresses.includes(address)) entry.addresses.push(address);
  }
  for (const [door, entry] of Object.entries(doors)) {
    if (entry.addresses.length === 1) {
      const c = carriers[entry.addresses[0]!]!;
      entry.brief = c.role;
      entry.help = [...c.renders["cli"]!["whole"]!];
    } else {
      entry.brief = briefOf(door, entry.addresses.map((a) => carriers[a]!.role), spellingsOf(routes["cli"]!, entry.addresses));
      // AN `also` SPELLING STANDS IN THE DOOR'S ACCOUNT: the index lists each address by its own spelling, so a second word for
      // one act (`shore keep-records` beside `shore take-records`) names itself here, or the door answers a verb its help never says.
      const also = Object.entries(routes["cli"]!)
        .filter(([s, a]) => entry.addresses.includes(a) && ownCli.get(a) !== s)
        .sort(([x], [y]) => x.localeCompare(y))
        .map(([s, a]) => `  lares ${s}  (${ownCli.get(a) ?? bareAddressOf(a)!})`);
      entry.help = [
        ...lines(engine.wiki.renderTiddler("text/plain", INDEX, { variables: { surface: "cli", pattern: sharedPattern(entry.addresses) } })),
        ...(also.length > 0 ? ["", "Also spelled:", ...also] : []),
        "",
        `Read one: lares ${door} <verb> --help`,
      ];
    }
  }
  const index = { cli: lines(engine.wiki.renderTiddler("text/plain", INDEX, { variables: { surface: "cli", pattern: "" } })) };

  const body = { title: PACK_TITLE, carriers, routes, doors, index };
  const hash = `sha256-${createHash("sha256").update(canonicalJson(body)).digest("hex")}`;
  return { title: PACK_TITLE, hash, carriers, routes, doors, index };
}

/**
 * What a door's index lists: the wildcard its addresses share (their common leading terms, then `*`: `engine.law.*`,
 * `oracle.*`) where they share both t1 and t2; otherwise the addresses themselves, named one by one, so a door whose verbs
 * reach several facets (`act`: `carriage.record.*`, `carriage.bag.*`) never lists a carrier another door will own.
 */
function sharedPattern(addresses: readonly string[]): string {
  const terms = addresses.map((a) => bareAddressOf(a)!.split("."));
  const shared: string[] = [];
  for (let i = 0; i < 2; i++) {
    const t = terms[0]![i]!;
    if (!terms.every((x) => x[i] === t)) break;
    shared.push(t);
  }
  return shared.length === 2 ? `${shared.join(".")}.*` : addresses.map((a) => bareAddressOf(a)!).join(" ");
}

/** Every cli spelling that routes to one of the addresses, sorted. */
function spellingsOf(cli: Readonly<Record<string, string>>, addresses: readonly string[]): string[] {
  return Object.entries(cli).filter(([, a]) => addresses.includes(a)).map(([s]) => s).sort();
}

/** The top-level line's width for a door's brief: the list fits one screen, each line within 100 columns. */
const BRIEF_WIDTH = 78;

/**
 * A door's brief: its carriers' roles joined where they fit the list's line, else the verbs the door answers (the spellings'
 * tails, sorted), cut at the last whole verb that fits and closed with an ellipsis.
 */
export function briefOf(door: string, roles: readonly string[], spellings: readonly string[]): string {
  const joined = roles.join(" · ");
  if (joined.length <= BRIEF_WIDTH) return joined;
  const verbs = [...new Set(spellings.map((s) => s.slice(door.length).trim()).filter(Boolean))];
  let out = "";
  for (const v of verbs) {
    const next = out === "" ? v : `${out} · ${v}`;
    if (next.length > BRIEF_WIDTH - 4) return `${out} · …`;
    out = next;
  }
  return out;
}

/** JSON with every object's keys sorted, two-space indent, one trailing newline: the pack's canonical bytes. */
export function canonicalJson(value: unknown): string {
  const sort = (v: unknown): unknown =>
    Array.isArray(v) ? v.map(sort)
      : v !== null && typeof v === "object" ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, sort((v as Record<string, unknown>)[k])]))
        : v;
  return `${JSON.stringify(sort(value), null, 2)}\n`;
}

/** The carrier texts a bake reads: every `.mem` under the canon source naming the type tag, then the named extra files. */
export function canonTexts(bags: string, extra: readonly string[] = []): string[] {
  return [...memFiles(bags), ...extra].map((f) => readFileSync(f, "utf8")).filter((t) => t.includes(AFFORDANCE_TAG));
}

async function main(argv: readonly string[]): Promise<number> {
  const flag = (name: string): string[] => argv.flatMap((a, i) => (a === name && argv[i + 1] ? [argv[i + 1]!] : []));
  const bags = flag("--bags")[0] ?? path.join(REPO, "bags");
  const out = flag("--out")[0] ?? PACK_PATH;
  // THE TRACKED PACK SERVES A TREE WITH NO VENDORED CORE: the bake boots a TW5 test wiki, and a build that carries no
  // tw5-core (the image's build, which never runs build:tw5-vendor) keeps the committed pack the floor's bake wrote.
  const core = path.join(PACKAGE, "tw5-core", TW5_CORE_SCRIPT_FILENAME);
  if (!existsSync(core) && existsSync(out) && !argv.includes("--check")) {
    console.log(`build-affordance-pack: no vendored TW5 core here (${path.relative(REPO, core)}); the tracked ${path.relative(REPO, out)} stands`);
    return 0;
  }
  const pack = await bakeAffordancePack(canonTexts(bags, flag("--carrier")));
  const bytes = canonicalJson(pack);
  if (argv.includes("--check")) {
    const tracked = existsSync(out) ? readFileSync(out, "utf8") : "";
    if (tracked === bytes) { console.log(`build-affordance-pack: ${out} matches a fresh bake (${pack.hash.slice(0, 19)})`); return 0; }
    console.error(`build-affordance-pack: affordance-pack-stale: ${out} differs from a fresh bake of ${Object.keys(pack.carriers).length} carrier(s); re-bake: pnpm --filter @lararium/tw5 build`);
    return 1;
  }
  writeFileSync(out, bytes, "utf8");
  console.log(`build-affordance-pack: baked ${Object.keys(pack.carriers).length} carrier(s) → ${path.relative(REPO, out)} (${pack.hash.slice(0, 19)})`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (err) => { console.error("build-affordance-pack threw:", err); process.exit(1); });
}
