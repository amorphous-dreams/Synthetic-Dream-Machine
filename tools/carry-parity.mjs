#!/usr/bin/env node
// carry-parity — the QA proof of a carry: read two houses (`--old`, the house an export read, and `--new`, the brand-new house an
// import filled) and answer `par`, or name every difference, per class, as missing (the exporting house holds it, the new one
// does not), changed (both hold it, the bytes differ) or extra (the new house holds it, and neither the exporting house nor the
// new house's own founding does).
//
// WHERE IT READS FROM: THE HOUSE'S OWN READ DOORS. Every meme, index row, plain record and kahua head comes back through the
// `lares` CLI (`persona list`, `kahua list`, `wiki list`, `meme list`, `wiki filter`, and `tiddler get` for a record too large
// for one filter page), the doors a person reads
// with. So it reads the store through the same gate on an old image and a new one, and never parses a store format that a
// later image may move (a raw store read would compare one image's layout against another's, and the house never promised
// that layout). Two classes stand behind no read door, and those it reads from the house's own files, through the house's
// own parser: the share rows (`config/share.tid`, the person's hand door, which wins at boot; parsed by `@lararium/mesh`),
// and the kāpae shadows (`<projections>/**/*.kapae`, the marker the mirror writes where a raised kāpae stands; no verb lists
// them).
//
// WHAT IT READS, for the face the house WEARS (a census reads one worn face; wear each face in turn for the others):
//   memes   every root each recipe the face reads lists (`default` is its daemon wiki), keyed `<recipe> <uri>`, valued by
//           `canonicalHash`; a bag the listing names unreached reads as its own row, so an asymmetry in reach reads red;
//   index   the `stage/index` rows of the daemon wiki: title -> description;
//   plain   each non-system record of the daemon wiki carrying no `uri-path`, outside the house plumbing (`PLAIN_FILTER`):
//           `default <title>` -> sha256(text) (`wiki filter` answers the daemon recipe alone in this phase);
//   kahua   the face's kahua heads: title -> sha256(text) (the cid is recorded, never compared);
//   kapae   each kāpae shadow under the projections: `<layer> <title>`, the face relation in the layer named by pet-name;
// and house-wide:
//   shares  each share row: `<kind> <slug>` -> owner, readers and writers by pet-name;
//   wikis   each wiki the catalog lists (`wiki list`): slug -> kind, so a wiki that holds no page still reads, and a carry that
//           leaves one behind reads red by name.
//
// WHAT MAY DIFFER, BY NAME (`MAY_DIFFER`): what a founding re-mints and the carry never carries. The census records the face
// relations and kahua cids under `allowed` so a person sees them; nothing there decides the verdict.
//
// USAGE
//   node tools/carry-parity.mjs --old <root|census.json> --new <root|census.json> [--old-port N] [--new-port N]
//                               [--base <census.json>] [--imports <import.json>]... [--stand-off <uri>]...
//                               [--json] [--out <receipt.json>] [--lares <cmd>]
//       both houses standing (or a census taken earlier on either side): census each, then compare.
//   node tools/carry-parity.mjs census --root <LAR_ROOT> [--port N] [--label L] [--out <census.json>] [--lares <cmd>]
//       one reading of the standing house's worn face, for a rite where the two houses never stand at once.
//   node tools/carry-parity.mjs compare --old <census.json>... --new <census.json>... [--base <census.json>...]
//                               [--imports <import.json>]... [--stand-off <uri>]... [--manifest <manifest.json>] [--json] [--out F]
//       several readings per side merge by face pet-name (one census per worn face).
// `--lares <cmd>` names the CLI to call (a host shim, e.g. `lares`); by default the built CLI under this checkout, with
// LAR_ROOT (and LAR_PORT where named) set to the house read. `--base` is a census of the new house taken after its founding
// and seed and before the import: its rows leave `extra`, so a red never hides behind the new house's own genesis, and a
// `changed` row whose new value equals its reading reads `moved` (canon the image under proof moved; `moved` in the receipt,
// named, never red). `--manifest <manifest.json>` names the bundle's manifest: a row it carried never reads as moved, so a
// working copy that lands as plain canon stays red.
// THE RITE'S ORDER: the exporting house goes down before the new one stands (one image tag, one port), so take its census
// with `census --out` while it stands and hand that file to `--old` afterwards.
// `--imports <file>` names each `lares import --apply --json` answer: every row it stood off (a working row forked over canon
// that moved) reads as a named may-differ (`standOffs` in the receipt) where it reads changed or missing, never as red; an
// import's exit decides nothing here. `--stand-off <uri>` names one by hand.
// Exit: 0 par · 1 red · 2 a usage error or a door that would not read.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const CENSUS_SCHEMA = "lar-carry-census/1";
export const RECEIPT_SCHEMA = "lar-carry-parity/1";
/**
 * The plain records a census reads: non-system, no `uri-path` (a meme reads in `memes`, its slot records `<uri>#/…` under its
 * root's hash), and outside the records each house mints for itself: bag plumbing under `lar:///ha.ka.ba/bags/` (descriptors,
 * persona bindings, oracle blobs, genesis cids), keyhive bag-docs, the vessel's current-wiki config, the working layer's
 * residency ledger (an import's own landing writes rows there), and the verb trail
 * `lar:///lararium.local.vm/verbs/<request>`, the volatile VM plane each house mints per call; the filter door keeps that
 * plane home, and the prefix here keeps the census naming the same set whichever door answers.
 */
export const PLAIN_FILTER = "[!is[system]!has[uri-path]!prefix[lar:///ha.ka.ba/bags/]!prefix[lar:///lararium.local.vm/]!prefix[lar:///ha.ka.ba/keyhive/]!prefix[lar:///ha.ka.ba/lararium/config/]!prefix[lar:///ha.ka.ba/wikis/daemon/working/ledger/]!regexp[#/]sort[]]";
const RELATION = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
/** A layer name with each face relation F spelled by the pet-name of the face that carries it (`<F>` where none reads). */
const byPetname = (s, relationToPetname) => s.replace(RELATION, (rel) => relationToPetname[rel] ?? "<F>");

export const FACE_CLASSES = ["memes", "unread", "index", "plain", "kahua", "kapae"];
export const HOUSE_CLASSES = ["shares", "wikis"];

/** What a founding re-mints and the carry never carries: named, recorded where a door reads it, never compared. */
export const MAY_DIFFER = [
  { name: "face relations", why: "a new founding mints each face's relation F; the carry maps faces by pet-name, and a layer named daemon-<F> reads by pet-name here" },
  { name: "actors", why: "every landed row is a new act under the new face's authority, so change actors and signers differ" },
  { name: "CRDT heads", why: "no CRDT history rides a bundle; the import writes new changes, so every document's heads differ" },
  { name: "kahua cids", why: "each head re-lifts under the new face's grant, so its signature and cid are new; heads compare by title and body digest" },
  { name: "Nexus AID", why: "the new house founds a new Nexus; the AID, the charter, the KELs and the seed card are re-minted" },
  { name: "floor pin", why: "signed control records never travel; the floor pin starts again at genesis" },
  { name: "house plumbing records", why: "bag descriptors, persona bindings, oracle blobs and genesis cids (`lar:///ha.ka.ba/bags/…`), keyhive bag-docs, the current-wiki config, the working layer's residency ledger (`…/wikis/daemon/working/ledger/…`, which an import's landing writes) and the verb trail (`lar:///lararium.local.vm/verbs/…`) each house mints for itself; the plain class reads around them (`PLAIN_FILTER`)" },
  { name: "image and revision", why: "the new house stands on the image under proof, which is the point of the carry" },
];

const sha256 = (s) => createHash("sha256").update(s).digest("hex");

// ── the comparison ────────────────────────────────────────────────────────────────────────────────────────────

/** Merge several census readings of one side: faces by pet-name (a later reading of one face wins), house rows unioned. */
export function mergeReadings(readings) {
  const out = { faces: [], face: {}, house: Object.fromEntries(HOUSE_CLASSES.map((c) => [c, {}])), allowed: { relations: {}, kahuaCids: {} }, labels: [] };
  for (const r of readings) {
    if (r?.schema !== CENSUS_SCHEMA) throw new Error(`a reading names schema ${JSON.stringify(r?.schema)}, not ${CENSUS_SCHEMA}`);
    out.labels.push(r.label ?? "");
    for (const f of r.faces ?? []) if (!out.faces.some((g) => g.petname === f.petname)) out.faces.push(f);
    for (const [pet, classes] of Object.entries(r.face ?? {})) out.face[pet] = classes;
    for (const c of HOUSE_CLASSES) Object.assign(out.house[c], r.house?.[c] ?? {});
    for (const [k, v] of Object.entries(r.allowed ?? {})) out.allowed[k] = { ...(out.allowed[k] ?? {}), ...v };
  }
  return out;
}

function compareMap(scope, cls, old, fresh, base, differences) {
  for (const [key, value] of Object.entries(old)) {
    if (!(key in fresh)) differences.push({ scope, class: cls, kind: "missing", key, old: value });
    else if (fresh[key] !== value) differences.push({ scope, class: cls, kind: "changed", key, old: value, new: fresh[key], ...(base && key in base && base[key] === fresh[key] ? { baseEqual: true } : {}) });
  }
  for (const [key, value] of Object.entries(fresh)) {
    if (key in old) continue;
    if (base && key in base && base[key] === value) continue;
    differences.push({ scope, class: cls, kind: "extra", key, new: value });
  }
}

/**
 * Compare the `--old` side's readings with the `--new` side's, taking the new-base readings' rows out of `extra`.
 * Answers the receipt body: the verdict, every difference by scope, class, kind and key, the counts the `--old` side held,
 * and the may-differ list.
 */
export function compareCensus(oldReadings, newReadings, baseReadings = [], { standOffs = [], carried = [] } = {}) {
  const old = mergeReadings(oldReadings), fresh = mergeReadings(newReadings);
  const base = baseReadings.length > 0 ? mergeReadings(baseReadings) : null;
  const found = [];
  const differences = found;
  for (const [pet, classes] of Object.entries(old.face)) {
    const scope = `face:${pet}`;
    const theirs = fresh.face[pet];
    if (!theirs) { differences.push({ scope, class: "face", kind: "missing", key: pet }); continue; }
    for (const c of FACE_CLASSES) compareMap(scope, c, classes[c] ?? {}, theirs[c] ?? {}, base?.face[pet]?.[c] ?? null, differences);
  }
  for (const pet of Object.keys(fresh.face)) {
    if (!(pet in old.face) && !(base && pet in base.face)) differences.push({ scope: `face:${pet}`, class: "face", kind: "extra", key: pet });
  }
  for (const c of HOUSE_CLASSES) compareMap("house", c, old.house[c], fresh.house[c], base?.house[c] ?? null, differences);
  // AN IMPORT'S STAND-OFF IS A NAMED MAY-DIFFER: the gate kept the new house's row and wrote nothing over it, so that one
  // uri may read changed or missing. It never excuses an extra row, and a uri the imports never named stays red.
  const named = new Set(standOffs);
  const keyUri = (key) => key.slice(key.indexOf(" ") + 1);
  const stoodOff = found.filter((d) => d.kind !== "extra" && (d.class === "memes" || d.class === "plain") && named.has(keyUri(d.key)));
  // CANON THE IMAGE MOVED IS A NAMED MAY-DIFFER: a changed row whose new value equals the new house's own founding reading
  // holds the canon the image under proof ships, so it reads `moved`, never red. A row the bundle carried (a working copy,
  // a margin, a page) stays red when it lands equal to that canon: the carry dropped what the house wrote over it.
  const carriedUris = new Set(carried);
  const moved = found.filter((d) => d.baseEqual === true && !stoodOff.includes(d) && !carriedUris.has(keyUri(d.key)));
  for (const d of found) delete d.baseEqual;
  const red = found.filter((d) => !stoodOff.includes(d) && !moved.includes(d));
  const counts = { faces: Object.keys(old.face).length };
  for (const c of FACE_CLASSES) counts[c] = Object.values(old.face).reduce((n, f) => n + Object.keys(f[c] ?? {}).length, 0);
  for (const c of HOUSE_CLASSES) counts[c] = Object.keys(old.house[c]).length;
  return {
    schema: RECEIPT_SCHEMA,
    verdict: red.length === 0 ? "par" : "red",
    from: { labels: old.labels }, to: { labels: fresh.labels }, ...(base ? { base: { labels: base.labels } } : {}),
    counts, differences: red, standOffs: stoodOff, moved,
    allowed: { old: old.allowed, new: fresh.allowed },
    mayDiffer: MAY_DIFFER,
  };
}

const standOffLines = (receipt) => [
  ...(receipt.standOffs ?? []).map((d) => `  stood off by the import (may differ): ${d.scope} · ${d.class}: ${d.kind} ${d.key}`),
  ...(receipt.moved ?? []).map((d) => `  moved canon (may differ): ${d.scope} · ${d.class}: ${d.kind} ${d.key} (old ${d.old} · new ${d.new}, the new-base reading)`),
];

/** The uris a carry bundle carried, read from its `manifest.json` (each row's title): those rows never read as moved canon. */
export function carriedUris(manifestText) {
  const rows = JSON.parse(String(manifestText)).rows ?? [];
  return [...new Set(rows.map((r) => r?.title).filter((t) => typeof t === "string" && t.length > 0))];
}

/**
 * The uris an import stood off, read from its `--json` answer (`data.tallies.<class>.stoodOff`, each `<uri> (<why>)`). The
 * answer counts, never the exit: an import exits 1 on an expected stand-off and still prints the whole answer.
 */
export function stoodOffUris(importText) {
  const out = [];
  for (const line of String(importText).trim().split("\n")) {
    let answer;
    try { answer = JSON.parse(line); } catch { continue; }
    for (const tally of Object.values(answer?.data?.tallies ?? {})) {
      for (const row of Array.isArray(tally?.stoodOff) ? tally.stoodOff : []) out.push(String(row).replace(/ \([^()]*\)$/, ""));
    }
  }
  return out;
}

/** The receipt as a person reads it: one verdict line, then one line per difference. */
export function receiptLines(receipt) {
  const c = receipt.counts;
  if (receipt.verdict === "par") {
    return [`carry-parity: par — ${c.faces} face(s): ${c.memes} memes, ${c.index} index rows, ${c.plain} plain records, ${c.kahua} kahua heads, ${c.kapae} kāpae, ${c.shares} share rows, ${c.wikis} wikis read equal`, ...standOffLines(receipt)];
  }
  const lines = [`carry-parity: red — ${receipt.differences.length} difference(s)`];
  for (const d of receipt.differences) {
    const values = d.kind === "changed" ? ` (old ${d.old} · new ${d.new})` : "";
    lines.push(`  ${d.scope} · ${d.class}: ${d.kind} ${d.key}${values}`);
  }
  return [...lines, ...standOffLines(receipt)];
}

// ── the census: one reading of a standing house, through its read doors ──────────────────────────────────────

const repo = fileURLToPath(new URL("../", import.meta.url));
const builtCli = join(repo, "packages/lares-cli/dist/src/bin/lares.js");

class DoorRefused extends Error {}

/** A `lares` caller for one house: the named CLI, or the built one with LAR_ROOT (and LAR_PORT) set. */
export function laresFor({ root, port, lares }) {
  const env = { ...process.env, ...(root ? { LAR_ROOT: root } : {}), ...(port ? { LAR_PORT: String(port) } : {}) };
  const [cmd, ...pre] = lares ? lares.split(/\s+/).filter(Boolean) : [process.execPath, builtCli];
  return (args) => {
    const r = spawnSync(cmd, [...pre, ...args], { cwd: repo, encoding: "utf8", env, maxBuffer: 512 * 1024 * 1024 });
    let json = null;
    for (const line of (r.stdout ?? "").trim().split("\n").reverse()) {
      try { json = JSON.parse(line); break; } catch { /* not json */ }
    }
    return { code: r.status ?? -1, stdout: r.stdout ?? "", stderr: r.stderr ?? "", json };
  };
}

/** Run a read door and answer its data, or refuse by name. */
function read(lares, args, { raw = false } = {}) {
  const r = lares(args);
  if (r.code !== 0 || r.json === null) throw new DoorRefused(`lares ${args.join(" ")} answered ${r.code}: ${(r.json?.error?.message ?? r.stderr ?? r.stdout).toString().trim().slice(0, 600)}`);
  return raw ? r.json : r.json.data;
}

/** A paged filter whose wiki moved mid-walk refuses `filter-cursor-stale`; read it again from the first page. */
function readFilter(lares, args) {
  for (let attempt = 0; ; attempt++) {
    try { return read(lares, args); }
    catch (e) { if (attempt >= 5 || !/filter-cursor-stale/.test(e.message)) throw e; }
  }
}

function kapaeShadows(root, relationToPetname) {
  const projections = join(root, "projections");
  const out = {};
  if (!existsSync(projections)) return out;
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      let st;
      try { st = statSync(p); } catch { continue; }
      if (st.isDirectory()) { walk(p); continue; }
      if (!name.endsWith(".kapae")) continue;
      let title;
      try { title = JSON.parse(readFileSync(p, "utf8")).title; } catch { title = `(unreadable ${name})`; }
      // The layer: the mirror folder the shadow stands under (`wikis/daemon-<F>`, `bags/<slug>`, `personal/<F>/<slug>`, …).
      const parts = relative(projections, p).split(sep);
      const at = parts.findIndex((s) => s === "ha.ka.ba" || s === "recovery" || s === "temp");
      const layer = parts.slice(0, at > 0 ? at : parts.length - 1)
        .map((s) => byPetname(s, relationToPetname))
        .join("/");
      out[`${layer} ${title}`] = "raised";
    }
  };
  walk(projections);
  return out;
}

async function shareRows(root) {
  const mesh = await import(pathToFileURL(join(repo, "packages/lararium-mesh/dist/index.js")).href);
  const file = join(root, "config", mesh.SHARE_CONFIG_FILE);
  const out = {};
  if (!existsSync(file)) return out;
  const names = (s) => mesh.parseShareFilter(s ?? "");
  const list = (s) => { const p = names(s); return [...(p.all ? ["*"] : []), ...[...p.names].sort()].join(","); };
  for (const row of mesh.parseShareFile(readFileSync(file, "utf8"))) {
    out[`${row.kind} ${row.slug}`] = `owner=${row.owner ?? ""} read=${list(row.read)} write=${list(row.write)}${row.workspace ? ` workspace=${row.workspace}` : ""}`;
  }
  return out;
}

/** One census of the standing house: its faces, the worn face's classes, the house-wide rows. */
export async function census({ root, port, lares: laresCmd, label = "" }) {
  const lares = laresFor({ root, port, lares: laresCmd });
  const personas = read(lares, ["persona", "list", "--json"]).personas ?? [];
  const faces = [];
  const relations = {}, kahuaCids = {};
  let mounted = null;
  for (const p of personas) {
    const r = lares(["kahua", "list", "--face", String(p.handleIndex)]);
    let answer = null;
    try { answer = JSON.parse(r.stdout.trim().split("\n").pop() ?? ""); } catch { /* the face stands shut */ }
    const face = { petname: p.petname, handleIndex: p.handleIndex, mounted: answer?.mounted === true, relation: answer?.relation ?? null, ...(answer ? {} : { unread: (r.stderr || r.stdout).trim().slice(0, 300) }) };
    faces.push(face);
    if (face.relation && face.petname) relations[face.petname] = face.relation;
    if (face.mounted) mounted = { face, items: Array.isArray(answer.items) ? answer.items : [] };
  }
  const relationToPetname = Object.fromEntries(Object.entries(relations).map(([pet, rel]) => [rel, pet]));
  const reading = { schema: CENSUS_SCHEMA, label, faces, face: {}, house: {}, allowed: { relations, kahuaCids } };
  const wikis = read(lares, ["wiki", "list", "--json"]).wikis ?? [];
  if (mounted) {
    const pet = mounted.face.petname ?? `h${mounted.face.handleIndex}`;
    const classes = { memes: {}, unread: {}, index: {}, plain: {}, kahua: {}, kapae: {} };
    const unreadDetail = {};
    const slugs = wikis.map((w) => String(w.slug)).filter((s) => s !== "daemon").sort();
    for (const recipe of ["default", ...slugs]) {
      // A wiki whose listing refuses reads as a row of its own (`unread`), never as an empty listing: the door's code
      // compares across the houses, and the receipt names every wiki that stood unread on either side.
      let listing;
      try { listing = read(lares, ["meme", "list", "--recipe", recipe, "--json"]); }
      catch (e) {
        if (!(e instanceof DoorRefused) || recipe === "default") throw e;
        classes.unread[recipe] = /\[([a-z-]+)\]|\b([a-z]+(?:-[a-z]+)+):/.exec(e.message)?.slice(1).find(Boolean) ?? "refused";
        unreadDetail[recipe] = e.message;
        continue;
      }
      for (const root of listing.roots ?? []) classes.memes[`${recipe} ${root.uri}`] = root.canonicalHash;
      for (const bag of listing.unreached ?? []) classes.memes[`${recipe} !unreached ${bag}`] = "unreached";
    }
    // PLAIN RECORDS READ OVER THE DAEMON WIKI ALONE: `wiki filter` answers recipe `default` only in this phase
    // (`wiki-not-anchored`, wiki-surface-scout #/phases), so a named wiki's non-meme records have no listing door yet.
    {
      const recipe = "default";
      // The text rides the filter's own rows; a row too large for one page sheds it (`omitted`), and that one record reads
      // whole through `tiddler get`.
      const plain = readFilter(lares, ["wiki", "filter", PLAIN_FILTER, "--recipe", recipe, "--all", "--fields", "text", "--max-bytes", "262144", "--json"]);
      for (const row of plain.rows ?? []) {
        let hash = `sha256:${sha256(String(row.fields?.text ?? ""))}`;
        if ((row.omitted ?? []).includes("text")) {
          const got = read(lares, ["tiddler", "get", row.title, "--recipe", recipe, "--json"]);
          hash = `sha256:${sha256(String(got.tiddler?.fields?.text ?? ""))}`;
        }
        classes.plain[`${recipe} ${row.title}`] = hash;
      }
    }
    for (const row of readFilter(lares, ["wiki", "filter", "[tag[stage/index]sort[]]", "--recipe", "default", "--all", "--fields", "description", "--json"]).rows ?? []) {
      classes.index[row.title] = String(row.fields?.description ?? "");
    }
    for (const item of mounted.items) {
      for (const head of Array.isArray(item.heads) ? item.heads : []) {
        classes.kahua[head.title] = `sha256:${sha256(String(head.text ?? ""))}`;
        kahuaCids[head.title] = head.cid;
      }
    }
    if (root) classes.kapae = kapaeShadows(root, relationToPetname);
    reading.face[pet] = classes;
    if (Object.keys(unreadDetail).length > 0) reading.unread = { [pet]: unreadDetail };
  }
  reading.house.shares = root ? await shareRows(root) : {};
  reading.house.wikis = Object.fromEntries(wikis.map((w) => [String(w.slug), String(w.kind ?? "")]).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  return reading;
}

// ── the command ───────────────────────────────────────────────────────────────────────────────────────────────

function parse(argv) {
  const opts = { _: [], old: [], new: [], base: [], imports: [], "stand-off": [] };
  const many = new Set(["old", "new", "base", "imports", "stand-off"]);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) { opts._.push(a); continue; }
    const [k, inline] = a.slice(2).split(/=(.*)/s, 2);
    if (k === "json" || k === "help") { opts[k] = true; continue; }
    const v = inline ?? argv[++i];
    if (v === undefined) throw new Error(`--${k} takes a value`);
    if (many.has(k)) opts[k].push(v); else opts[k] = v;
  }
  return opts;
}

const USAGE = [
  "usage: node tools/carry-parity.mjs --old <root|census.json> --new <root|census.json> [--old-port N] [--new-port N] [--base <census.json>] [--imports <import.json>]... [--stand-off <uri>]... [--json] [--out <receipt.json>] [--lares <cmd>]",
  "       node tools/carry-parity.mjs census --root <LAR_ROOT> [--port N] [--label L] [--out <census.json>] [--lares <cmd>]",
  "       node tools/carry-parity.mjs compare --old <census.json>... --new <census.json>... [--base <census.json>...] [--imports <import.json>]... [--stand-off <uri>]... [--manifest <manifest.json>] [--json] [--out <receipt.json>]",
];

const isCensusFile = (p) => existsSync(p) && statSync(p).isFile();
const loadCensus = (p) => JSON.parse(readFileSync(p, "utf8"));

async function side(paths, port, laresCmd, label) {
  if (paths.length === 0) throw new Error(`name the ${label} house (--${label})`);
  const out = [];
  for (const p of paths) out.push(isCensusFile(p) ? loadCensus(p) : await census({ root: resolve(p), port, lares: laresCmd, label: `${label} ${resolve(p)}` }));
  return out;
}

export async function main(argv) {
  let opts;
  try { opts = parse(argv); } catch (e) { console.error(`carry-parity: ${e.message}`); console.error(USAGE.join("\n")); return 2; }
  if (opts.help) { console.log(USAGE.join("\n")); return 0; }
  const verb = opts._[0];
  try {
    if (verb === "census") {
      if (!opts.root) throw new Error("census names the house it reads (--root <LAR_ROOT>)");
      const reading = await census({ root: resolve(opts.root), port: opts.port, lares: opts.lares, label: opts.label ?? "" });
      const text = `${JSON.stringify(reading, null, 2)}\n`;
      if (opts.out) { writeFileSync(opts.out, text); console.error(`carry-parity: census of ${Object.keys(reading.face).join(", ") || "no worn face"} written to ${opts.out}`); }
      else process.stdout.write(text);
      return 0;
    }
    if (verb !== undefined && verb !== "compare") throw new Error(`unknown verb ${JSON.stringify(verb)}`);
    if (verb === "compare" && [...opts.old, ...opts.new].some((p) => !isCensusFile(p))) throw new Error("compare reads census files; to read a standing house, drop the verb");
    const old = await side(opts.old, opts["old-port"], opts.lares, "old");
    const fresh = await side(opts.new, opts["new-port"], opts.lares, "new");
    const base = opts.base.map(loadCensus);
    const standOffs = [...opts["stand-off"], ...opts.imports.flatMap((f) => stoodOffUris(readFileSync(f, "utf8")))];
    const carried = opts.manifest ? carriedUris(readFileSync(opts.manifest, "utf8")) : [];
    const receipt = compareCensus(old, fresh, base, { standOffs, carried });
    if (opts.out) writeFileSync(opts.out, `${JSON.stringify(receipt, null, 2)}\n`);
    if (opts.json) process.stdout.write(`${JSON.stringify(receipt)}\n`);
    else for (const line of receiptLines(receipt)) console.log(line);
    return receipt.verdict === "par" ? 0 : 1;
  } catch (e) {
    console.error(`carry-parity: ${e instanceof Error ? e.message : String(e)}`);
    if (!(e instanceof DoorRefused)) console.error(USAGE.join("\n"));
    return 2;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) process.exitCode = await main(process.argv.slice(2));
