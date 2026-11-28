/**
 * build-affordance-pack — bake every canon affordance carrier through the skin templates into ONE content-addressed pack.
 *
 * THE PACK BAKES THE CANON FLOOR. A sleeping vessel (and every surface that answers before one stands) reads the pack; a
 * standing vessel reads routes, loops and cures from its own live stack, where a carrier a working layer seats above canon
 * answers in canon's place (`routesOf`, `carrierOf`, lar:///ha.ka.ba/lares/api/pono/affordance#/residency). The pack keeps its
 * bake and its content hash so the floor names itself (`bag/pack base/<hash>`) wherever it answers.
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
 * `--carrier <file>` (repeatable) adds a file outside the canon source (a test's fixture). Beside the carriers it reads every
 * library shelf's index (`library/oracles/<kind>/index.mem`), whose `method` field the consult reads (`library.oracle.speaks`).
 *
 * WHAT IT WRITES (`affordance-pack.json`, beside this package's `package.json`):
 *   carriers    per address: its frame check (`bcc`), `role`, and every render, surface × depth (line · whole · each slot),
 *               the mcp surface also per parameter; a carrier whose `#/loop` calls a law slot carries that slot's `has` rows
 *               resolved (`loop`), the act shape a vessel reads where its stack answers no loop rows
 *   routes      per surface: the skin's spelling → address (cli `oracle cast`, mcp `oracle_cast`, tw5 `action-oracle-cast`,
 *               console the bare address), each derived from the carrier's `#/skins` by `routesOf`, the rule the live stack
 *               reads by, no hand table
 *   doors       per CLI door (the spelling's first word): its addresses, the brief the top-level index prints, the lines
 *               `lares <door> --help` and its usage refusal print; a `door/part` skin (one verb of a door that keeps its
 *               own table) routes and gathers no door entry; a word several carriers share by a `by/` choice (`get`: `by/title`,
 *               `by/filter`) claims no route of its own, and its door gathers every choice, the spine each reads first
 *   index       the `lares --help` lines of every carrier, through the index template
 *   shelves     per oracle kind: the shelf index's title and the `method` it declares (`three-coins`)
 *   records     per title: the text of every record a call reads off a baked carrier (its root, each `#/slot` child, and
 *               every shared slot those call by `kahea`), the floor rung a vessel's `call` reads where its live stack holds
 *               no carrier for a spelling or address (`floorReaderOf` in `modules/call.ts`)
 *   voice       Iris-Sprite's templates (`#/answer/template`, `#/refusal/template` of lar:///ha.ka.ba/lares/spirit/iris-sprite):
 *               the floor a sleeping vessel's answers and refusals render through, where no stack seats her shrine
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
import { AFFORDANCE_TAG, AFFORD_SLOTS, AFFORD_SURFACES, addressOfTitle, bareAddressOf, kaheaTitles, type AffordSurface } from "../src/affordance-rows.js";
import { routesOf, rowsOf, skinRows, type TextOf } from "../src/affordance-read.js";
import { KIND_RE, ORACLE_SHELF_PREFIX } from "@lararium/mesh/oracle-cast";
import { kaheaTarget } from "@lararium/mesh/oracle-loop";
import { IRIS_SHRINE, VOICE_SLOTS, templateOf, voiceTitle } from "../src/modules/call.js";
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
  /** The carrier's own title: the stable seat canon gives it (`lar:///ha.ka.ba/lares/afford/library.oracle.speaks`). */
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
  /** The `has` rows of the law slot the carrier's `#/loop` calls, resolved at bake; absent where the carrier declares no loop. */
  readonly loop?: readonly string[];
}

/** One library shelf: its index record's title and the method that record declares. */
export interface AffordancePackShelf {
  readonly title: string;
  readonly method: string;
}

export interface AffordancePack {
  readonly title: string;
  readonly hash: string;
  readonly carriers: Record<string, AffordancePackCarrier>;
  readonly routes: Record<string, Record<string, string>>;
  readonly doors: Record<string, { readonly addresses: readonly string[]; readonly brief: string; readonly help: readonly string[] }>;
  readonly index: Record<string, readonly string[]>;
  readonly shelves: Record<string, AffordancePackShelf>;
  readonly records: Record<string, string>;
  /** Iris-Sprite's templates by slot (`answer`, `refusal`); absent where the bake read no shrine. */
  readonly voice?: Record<string, string>;
}

/** Iris-Sprite's shrine's path under a canon source. */
const SHRINE_FILE = /\/ha\.ka\.ba\/lares\/spirit\/iris-sprite\.mem$/;

/** A shelf index's path under a canon source: `.../library/oracles/<kind>/index.mem`. */
const SHELF_INDEX = /\/library\/oracles\/([a-z0-9]+(?:-[a-z0-9]+)*)\/index\.mem$/;

/** A `has` row line, as a law slot writes one. */
const HAS_LINE = /^<<~?\s*has\s/;

/**
 * The act shape a carrier's `#/loop` names, resolved: the `has` rows of the law slot its `kahea` calls (or its own rows, where
 * it carries them inline); empty where the carrier declares no loop or the law slot stands nowhere in the bake.
 */
function resolvedLoop(textOf: TextOf, title: string): string[] {
  const carried = textOf(`${title}#/loop`);
  if (carried === undefined) return [];
  const call = kaheaTarget(carried);
  const text = call ? textOf(`${call.uri}${call.slot ?? "#/loop"}`) ?? "" : carried;
  return lines(text).map((l) => l.trim()).filter((l) => HAS_LINE.test(l));
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
  /** THE CALL'S FLOOR RUNG: each record a call reads off a baked carrier, by title, its text as canon wrote it. */
  const records: Record<string, string> = {};
  const keep = (title: string): string | undefined => {
    const text = textOf(title);
    if (text !== undefined) records[title] = text;
    return text;
  };
  // THE ROUTES READ BY THE ONE RULE THE LIVE STACK READS BY (`routesOf`): the bake runs it over canon's carriers, so the floor a
  // sleeping vessel answers from and a standing vessel's own stack derive spelling to address alike.
  const derived = routesOf(textOf, tagged, {
    has: (t) => textOf(t) !== undefined,
    tagged: (address) => engine.wiki.filterTiddlers(`[all[tiddlers]tag[${AFFORDANCE_TAG}]tag[${address}]]`),
  });
  // ONE DOOR, ONE ADDRESS: two carriers claiming one spelling refuse the bake by name (witness W1's red, at the source).
  const twice = derived.twice[0];
  if (twice !== undefined) {
    throw new Error(`affordance-door-claimed-twice: ${twice.surface} \`${twice.spelling}\` skins both ${twice.addresses[0]} and ${twice.addresses[1]}; one door names one address`);
  }
  const routes: Record<string, Record<string, string>> = derived.routes;
  /** Each address's own cli spelling (its skin row's `spells/`), apart from the `also/` spellings routed beside it. */
  const ownCli = new Map<string, string>(Object.entries(derived.own));
  /** The cli spellings whose skin row reads `door/part`: one verb of a door whose other verbs keep the door's own table. */
  const partCli = new Set<string>(derived.part);
  for (const title of tagged) {
    const address = addressOfTitle(title)!;
    // THE CARRIER THAT ANSWERS: where two titles carry one address, the one `carrierOf` seats bakes.
    if (derived.carriers[address] !== title) continue;
    // ONE CLOSED SLOT SET: a carrier slot the set never names would bake silently unrendered, so it refuses the bake by name.
    const children = engine.wiki.filterTiddlers(`[prefix[${title}#/]]`);
    for (const child of children) {
      const slot = `#/${child.slice(title.length + 2).split("/")[0]}`;
      if (!(AFFORD_SLOTS as readonly string[]).includes(slot)) {
        throw new Error(`affordance-slot-unknown: ${title} holds ${slot}, outside the closed slot set (${AFFORD_SLOTS.join(" · ")}); rename the slot or name it in lar:///ha.ka.ba/lares/api/pono/affordance and AFFORD_SLOTS together`);
      }
    }
    // The root, each slot, and every shared slot a slot calls by `kahea`, read in place by the call as the stack would read them.
    for (const held of [title, ...children]) for (const called of kaheaTitles(keep(held) ?? "")) keep(called);
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
    for (const row of skinRows(textOf, title)) {
      const surface = row.name as AffordSurface;
      if (!(surface in routes)) continue;
      // A positional arg (`seat/N`) rides no flag: the door row's `accepts` names flags alone, so W2 reads these apart.
      takes[surface] = rowsOf(textOf, title, "#/takes", surface).filter((r) => r["entity"] === "arg" && r["positional"] !== true).map((r) => String(r["spell"]));
      calls[surface] = [
        ...rowsOf(textOf, title, "#/shows", surface).flatMap((r) => (typeof r["call"] === "string" && r["foreign"] !== true ? [r["call"]] : [])),
        ...rowsOf(textOf, title, "#/refuses", surface).flatMap((r) => (typeof r["cure"] === "string" && r["foreign"] !== true ? [r["cure"]] : [])),
      ];
    }
    const loop = resolvedLoop(textOf, title);
    carriers[address] = { title, bcc: bccs.get(title) ?? null, role, renders, params, takes, calls, ...(loop.length > 0 ? { loop } : {}) };
  }

  // A CLI door gathers every address whose cli skin spells beneath it: one address renders its whole, several an index. A
  // spelling whose skin row reads `door/part` routes to its carrier (its own `--help` reads the carrier's whole) and gathers no
  // door entry: the door's other verbs keep the door's own table, and the door flips whole once every verb holds a carrier.
  const doors: Record<string, { addresses: string[]; brief: string; help: string[] }> = {};
  for (const [spelling, address] of Object.entries(routes["cli"]!).sort(([a], [b]) => a.localeCompare(b))) {
    if (partCli.has(spelling)) continue;
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
  // A WORD SEVERAL CARRIERS SHARE BY A `by/` CHOICE (`get`: `by/title`, `by/filter`) claims no route, yet it stands one door whose
  // every affordance holds a carrier: the door gathers each choice, its help leading with the spine each choice reads (the
  // default's first), then each carrier's whole, so `lares get --help` reads its carriers and holds no registry entry.
  for (const [spelling, choices] of Object.entries(derived.chosen.cli).sort(([a], [b]) => a.localeCompare(b))) {
    const door = spelling.split(/\s+/)[0]!;
    if (spelling !== door || doors[door] !== undefined) continue;
    const present = [...choices]
      .filter((c) => carriers[c.address] !== undefined)
      .sort((a, b) => Number(b.default === true) - Number(a.default === true) || a.address.localeCompare(b.address));
    if (present.length === 0) continue;
    const spines = present.map((c) => `${door} ${c.by}=<${c.by}>`);
    doors[door] = {
      addresses: present.map((c) => c.address),
      brief: briefOf(door, present.map((c) => carriers[c.address]!.role), spines),
      help: [`usage: ${spines.map((s) => `lares ${s} [name=value…]`).join("  ·  ")}`, ...present.flatMap((c) => ["", ...carriers[c.address]!.renders["cli"]!["whole"]!])],
    };
  }
  const index = { cli: lines(engine.wiki.renderTiddler("text/plain", INDEX, { variables: { surface: "cli", pattern: "" } })) };

  // THE LIBRARY SHELVES: each shelf index the bake read, keyed by its kind, with the method its record declares.
  const shelves: Record<string, AffordancePackShelf> = {};
  for (const title of bccs.keys()) {
    const kind = title.startsWith(ORACLE_SHELF_PREFIX) && title.endsWith("/index") ? title.slice(ORACLE_SHELF_PREFIX.length, -"/index".length) : "";
    if (!KIND_RE.test(kind)) continue;
    const method = String((engine.wiki.getTiddler(title) as { fields?: Record<string, unknown> } | undefined)?.fields?.["method"] ?? "").trim();
    if (method !== "") shelves[kind] = { title, method };
  }

  // THE MACHINA'S VOICE: each template her shrine carries, the floor every answer and refusal renders through with no stack.
  const voice: Record<string, string> = {};
  for (const slot of VOICE_SLOTS) { const t = templateOf(textOf(voiceTitle(slot))); if (t !== null) voice[slot] = t; }
  const voiced = Object.keys(voice).length > 0 ? { voice } : {};

  const body = { title: PACK_TITLE, carriers, routes, doors, index, shelves, records, ...voiced };
  const hash = `sha256-${createHash("sha256").update(canonicalJson(body)).digest("hex")}`;
  return { title: PACK_TITLE, hash, carriers, routes, doors, index, shelves, records, ...voiced };
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

/** The carrier's width law (api/pono/affordance#/residency): a role holds 72 characters or fewer, so its line reads whole. */
const ROLE_WIDTH = 72;

/**
 * A door's brief, the list's one line for the door (progressive display: one line per door, depth per unfold, no screen
 * budget): its carriers' roles joined where the join holds the role's width law, else every verb the door answers (the
 * spellings' tails, sorted), named whole; `lares <door> --help` unfolds the rest.
 */
export function briefOf(door: string, roles: readonly string[], spellings: readonly string[]): string {
  const joined = roles.join(" · ");
  if (joined.length <= ROLE_WIDTH) return joined;
  return [...new Set(spellings.map((s) => s.slice(door.length).trim()).filter(Boolean))].join(" · ");
}

/** JSON with every object's keys sorted, two-space indent, one trailing newline: the pack's canonical bytes. */
export function canonicalJson(value: unknown): string {
  const sort = (v: unknown): unknown =>
    Array.isArray(v) ? v.map(sort)
      : v !== null && typeof v === "object" ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, sort((v as Record<string, unknown>)[k])]))
        : v;
  return `${JSON.stringify(sort(value), null, 2)}\n`;
}

/**
 * The texts a bake reads: every `.mem` under the canon source naming the type tag, then the named extra files, then every
 * library shelf's index (whose `method` the consult reads).
 */
export function canonTexts(bags: string, extra: readonly string[] = []): string[] {
  const files = memFiles(bags);
  const carriers = [...files, ...extra].map((f) => readFileSync(f, "utf8")).filter((t) => t.includes(AFFORDANCE_TAG));
  const shelves = files.filter((f) => SHELF_INDEX.test(f.split(path.sep).join("/"))).map((f) => readFileSync(f, "utf8")).filter((t) => !t.includes(AFFORDANCE_TAG));
  // Iris-Sprite's shrine rides the bake for her templates alone (the pack's `voice`): one file, found by its path, read once.
  const shrine = files.filter((f) => SHRINE_FILE.test(f.split(path.sep).join("/"))).map((f) => readFileSync(f, "utf8")).filter((t) => headUriOf(t) === IRIS_SHRINE);
  return [...carriers, ...shelves, ...shrine];
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
