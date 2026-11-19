// rite-walk/steps — the step table of the three-face rite, and the join that binds each step to its runbook line.
//
// THE BINDING. The founding runbook's slot `#/the-three-face-rite` instructs in two inks: `lares …` lines inside `sh`
// fences, and prose that names an act (a memory put, a lift, a browser crossing). A step binds one of them:
//   fence   one command of one fence line (a line holding `a && b` carries two commands), named by its text and its
//           occurrence in the slot (`lares up` stands three times; `nth` counts from zero);
//   prose   a phrase the slot's prose carries, quoted here whole.
// `bindSteps` reads the runbook's bytes and answers each step's line. A fence command no step claims reads `unmapped`;
// a step whose command or phrase the slot dropped reads `orphan`; an expected answer the step says the runbook quotes
// (`quoted`) and the slot does not carry reads `unquoted`. Any of the three refuses the walk before an act.
//
// THE OUTCOMES. A step reads `pass`, `fail` or `unreached`. `via` names the stand-in a pass rode (`staged-custody` for
// every passphrase ward the test custody answered, `seat-stdio` for the MCP seat spoken over its own stdio), so such a
// step prints `pass (staged-custody)` and never a bare `pass`. `unreached` always carries its cause.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, realpathSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";

export const RUNBOOK = "bags/lararium/ha.ka.ba/lararium/mesh/founding-runbook.mem";
export const RITE_SLOT = "#/the-three-face-rite";
export const RITE_URI = `lar:///ha.ka.ba/lararium/mesh/founding-runbook${RITE_SLOT}`;

/** What the walk cannot reach, by cause. `blocked:<step>` joins these at run time for a step whose ground never stood. */
export const CAUSES = Object.freeze({
  "host-shim": "the host shim alone answers this verb (tools/lares-container.sh), at a terminal, on the operator's house",
  image: "the walk runs the checkout's built dist; the product image builds and walks elsewhere",
  browser: "the page's carriage door and its two ceremonies take a browser profile this walk does not stand",
  "seat-interpreter": "no interpreter resolves for the MCP seat on this box",
});
export const VIAS = Object.freeze(["staged-custody", "seat-stdio"]);

export class RiteWalkRefusal extends Error {
  constructor(message) { super(`RiteWalkRefusal: ${message}`); this.name = "RiteWalkRefusal"; }
}

// ── the runbook join ────────────────────────────────────────────────────────────────────────────────────────────────

/** The rite slot's lines, each with its 1-based line in the carrier. A carrier holding no such slot refuses. */
export function riteSlot(text) {
  const lines = text.split("\n");
  const open = lines.findIndex((l) => l.includes("<<~ ahu slot=`" + RITE_SLOT + "`>>"));
  if (open < 0) throw new RiteWalkRefusal(`the runbook carries no slot ${RITE_SLOT}`);
  const span = lines.slice(open).findIndex((l) => l.trim() === "<<~/ahu>>");
  if (span < 0) throw new RiteWalkRefusal(`the slot ${RITE_SLOT} never closes`);
  return lines.slice(open, open + span + 1).map((textOf, i) => ({ line: open + 1 + i, text: textOf }));
}

/** Every `lares …` command the slot's `sh` fences instruct, in order: `{ line, command, nth }`. */
export function riteCommands(text) {
  const out = [];
  const seen = new Map();
  let fenced = false;
  for (const { line, text: raw } of riteSlot(text)) {
    const t = raw.trim();
    if (t.startsWith("```")) { fenced = !fenced && t === "```sh"; continue; }
    if (!fenced || !t.startsWith("lares ")) continue;
    for (const part of t.replace(/\s+#\s.*$/, "").split(/\s+&&\s+/)) {
      const command = part.trim().replace(/\s+/g, " ");
      const nth = seen.get(command) ?? 0;
      seen.set(command, nth + 1);
      out.push({ line, command, nth });
    }
  }
  return out;
}

/**
 * Join the step table to the runbook's bytes. Answers `{ bound, unmapped, orphans, unquoted }`: each bound step carries
 * its `line`; the three lists name every drift, and a walk refuses while any holds an entry.
 */
export function bindSteps(text, steps = STEPS) {
  const slot = riteSlot(text);
  const prose = slot.filter((l) => !l.text.trim().startsWith("lares "));
  const commands = riteCommands(text);
  const claimed = new Set();
  const bound = [], orphans = [], unquoted = [];
  for (const step of steps) {
    let line = null;
    if (step.fence !== undefined) {
      const at = commands.findIndex((c) => c.command === step.fence && c.nth === (step.nth ?? 0));
      if (at >= 0) { claimed.add(at); line = commands[at].line; }
    } else if (step.prose !== undefined) {
      line = prose.find((l) => l.text.includes(step.prose))?.line ?? null;
    }
    if (line === null) { orphans.push({ step: step.id, names: step.fence ?? step.prose }); continue; }
    for (const q of step.quoted ?? []) {
      if (!slot.some((l) => l.text.includes(q))) unquoted.push({ step: step.id, expect: q });
    }
    bound.push({ ...step, line });
  }
  const unmapped = commands.filter((_, i) => !claimed.has(i)).map((c) => ({ line: c.line, command: c.command, nth: c.nth }));
  return { bound, unmapped, orphans, unquoted };
}

/** Throw by name where the join carries any drift; answer the bound steps where it holds. */
export function assertBound(join_) {
  const faults = [
    ...join_.unmapped.map((u) => `unmapped: runbook line ${u.line} instructs \`${u.command}\` and no step walks it`),
    ...join_.orphans.map((o) => `orphan: step ${o.step} names \`${o.names}\`, which the rite slot does not carry`),
    ...join_.unquoted.map((u) => `unquoted: step ${u.step} expects \`${u.expect}\`, which the rite slot does not quote`),
  ];
  if (faults.length > 0) throw new RiteWalkRefusal(`the step table and the runbook disagree\n  ${faults.join("\n  ")}`);
  return join_.bound;
}

// ── the scratch guard ───────────────────────────────────────────────────────────────────────────────────────────────

const within = (outer, inner) => inner === outer || inner.startsWith(outer + sep);
/** Resolve a path that may not stand yet: the nearest standing ancestor's real path, plus the tail. */
function physical(path) {
  let head = resolve(path);
  const tail = [];
  while (!existsSync(head)) { const up = dirname(head); if (up === head) break; tail.unshift(head.slice(up.length).replace(/^[\\/]/, "")); head = up; }
  return resolve(realpathSync(head), ...tail);
}

/**
 * THE SCRATCH GUARD: the one root a walk may found. It stands under a scratch prefix (the OS temp dir, or the stage
 * dir the caller names), outside the checkout, outside every home the box names, and either empty or already marked
 * `.lar-test-scratch` by a harness. Refuses by name before any act; answers the physical root.
 */
export function assertScratchRoot(root, { checkout, home, prefixes, env = process.env } = {}) {
  if (!root) throw new RiteWalkRefusal("no root named");
  for (const name of ["LAR_BAGS", "LAR_GENESIS"]) {
    if (env[name]) throw new RiteWalkRefusal(`${name} stands set (${env[name]}); a walk reads its canon and genesis under its own scratch root alone`);
  }
  const at = physical(root);
  const bases = (prefixes ?? []).filter(Boolean).map(physical);
  if (bases.length === 0) throw new RiteWalkRefusal("no scratch prefix named");
  if (!bases.some((b) => within(b, at) && at !== b)) throw new RiteWalkRefusal(`${at} stands outside every scratch prefix (${bases.join(", ")})`);
  if (checkout && (within(physical(checkout), at) || within(at, physical(checkout)))) throw new RiteWalkRefusal(`${at} overlaps the checkout ${checkout}`);
  if (home) {
    const h = physical(home);
    if (within(at, h)) throw new RiteWalkRefusal(`${at} holds the home ${h}`);
    for (const house of [join(h, ".lares"), join(h, ".claude"), join(h, ".config")]) {
      if (within(house, at)) throw new RiteWalkRefusal(`${at} stands inside ${house}`);
    }
  }
  if (existsSync(at)) {
    const held = readdirSync(at);
    if (held.length > 0 && !held.includes(".lar-test-scratch")) throw new RiteWalkRefusal(`${at} holds entries and no .lar-test-scratch marker; no harness staged it`);
  }
  return at;
}

// ── the receipt ─────────────────────────────────────────────────────────────────────────────────────────────────────

const ANSWER_BYTES = 400;
/** Quote an answer: one line, at most 400 bytes. */
export function quote(answer) {
  const flat = String(answer ?? "").replace(/\s+/g, " ").trim();
  return Buffer.byteLength(flat) <= ANSWER_BYTES ? flat : Buffer.from(flat).subarray(0, ANSWER_BYTES).toString("utf8").replace(/�$/, "");
}
/** The line of `text` that carries `needle`, else the last line that says anything. */
export function lineOf(text, needle) {
  const lines = String(text ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  return (needle && lines.find((l) => l.includes(needle))) || lines.at(-1) || "";
}
/** What a refused act said: its first line that names a fault, never a stack frame. */
export function refusalOf(r) {
  const lines = `${r.stderr}\n${r.stdout}`.split("\n").map((l) => l.trim()).filter((l) => l && !/^at /.test(l) && !/^(file|node):/.test(l) && l !== "^");
  return `exit ${r.code}: ${lines.find((l) => /error|refus|lares |cannot|never|unknown|no /i.test(l)) ?? lines[0] ?? ""}`;
}
/**
 * The words a refused act carried, whole: the `switchRefused` or `refused` an answer's JSON names (a wear whose switch
 * refused, a composition that refused), else its `errorMessage`. The answer's cut never reaches them.
 */
export function refusalIn(answer) {
  const text = String(answer ?? "");
  for (let at = text.indexOf("{"); at !== -1; at = text.indexOf("{", at + 1)) {
    let a;
    try { a = JSON.parse(text.slice(at)); } catch { continue; }
    const words = a?.switchRefused ?? a?.refused ?? a?.errorMessage;
    return typeof words === "string" ? words : null;
  }
  return null;
}
export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** One step's verdict as a word: `pass`, `pass (staged-custody)`, `fail`, `unreached: host-shim`. */
export function verdict(row) {
  if (row.outcome === "unreached") return `unreached: ${row.cause}`;
  return row.outcome === "pass" && row.via ? `pass (${row.via})` : row.outcome;
}

/**
 * Hold a receipt's rows to the outcome law: every row names its runbook line; `unreached` carries a cause; a step the
 * table marks unreachable never reads `pass` or `fail`; a step that rides a stand-in never reads a bare `pass`.
 * Answers the faults by name (empty where the receipt holds).
 */
export function receiptFaults(rows, steps = STEPS) {
  const table = new Map(steps.map((s) => [s.id, s]));
  const faults = [];
  for (const row of rows) {
    const step = table.get(row.step);
    if (!step) { faults.push(`${row.step}: no such step in the table`); continue; }
    if (!/:\d+$/.test(row.runbook ?? "")) faults.push(`${row.step}: names no runbook line`);
    if (!["pass", "fail", "unreached"].includes(row.outcome)) faults.push(`${row.step}: outcome ${JSON.stringify(row.outcome)}`);
    if (row.outcome === "unreached" && !row.cause) faults.push(`${row.step}: unreached and names no cause`);
    if (step.unreached && row.outcome !== "unreached") faults.push(`${row.step}: the table marks it unreached (${step.unreached}) and the receipt reads ${row.outcome}`);
    if (step.unreached && row.cause !== step.unreached) faults.push(`${row.step}: unreached by ${row.cause}, and the table names ${step.unreached}`);
    if (step.via && row.outcome === "pass" && row.via !== step.via) faults.push(`${row.step}: a bare pass over a ${step.via} stand-in`);
  }
  for (const step of steps) if (!rows.some((r) => r.step === step.id)) faults.push(`${step.id}: the receipt carries no row`);
  return faults;
}

/**
 * THE RECEIPT. `inputs` names what a replay must hold equal (the head, the runbook's bytes, the walker's bytes);
 * `outcomes` digests what a replay compares (each step's line, command, outcome, stand-in and cause, never an answer
 * or a duration: a founding mints new ids every run). A vessel's signature, where one later stands, signs those two.
 */
export function receipt({ head, dirty, runbook, walker, rows, legs }) {
  const tally = { pass: 0, fail: 0, unreached: 0 };
  for (const r of rows) tally[r.outcome] += 1;
  const compared = rows.map((r) => [r.step, r.runbook, r.command, r.outcome, r.via ?? null, r.cause ?? null]);
  return {
    kind: "rite-walk-receipt",
    rite: RITE_URI,
    inputs: { head, dirty, runbook, walker },
    ...(legs ? { legs } : {}),
    tally: { ...tally, firstFail: rows.find((r) => r.outcome === "fail")?.step ?? null },
    outcomes: `sha256:${sha256(JSON.stringify(compared))}`,
    steps: rows,
  };
}

/**
 * Walk bound steps in order. `run(step)` performs one and answers `{ ok, answer }` (a throw reads as a fail carrying
 * the error's words). A step the table marks unreached never runs: its `standIn`, where it names one, keeps the ground
 * the later steps stand on, and the row still reads `unreached`. A step whose `needs` did not pass reads
 * `unreached: blocked:<step>`. `passed` names the steps an earlier leg
 * already passed. `now` answers monotonic milliseconds.
 */
export async function walk(bound, { run, standIn = async () => {}, now = () => performance.now(), say = () => {}, carrier = "founding-runbook.mem", passed: before = [] }) {
  const rows = [];
  const passed = new Set(before);
  for (const step of bound) {
    const base = { step: step.id, runbook: `${carrier}:${step.line}`, command: step.command ?? step.fence ?? step.prose, expect: step.expect ?? null };
    const from = now();
    let row;
    const blocker = (step.needs ?? []).find((id) => !passed.has(id));
    if (step.unreached) {
      let note = CAUSES[step.unreached] ?? "";
      if (step.standIn && !blocker) { try { note = `${note}; ${await standIn(step)}`; } catch (e) { note = `${note}; the stand-in refused: ${e?.message ?? e}`; } }
      row = { ...base, outcome: "unreached", cause: step.unreached, answer: quote(note) };
      if (step.standIn && !blocker) passed.add(step.id);
    } else if (blocker) {
      row = { ...base, outcome: "unreached", cause: `blocked:${blocker}`, answer: "" };
    } else {
      let result;
      try { result = await run(step); } catch (e) { result = { ok: false, answer: e?.message ?? String(e) }; }
      if (result?.unreached) row = { ...base, outcome: "unreached", cause: result.unreached, answer: quote(result.answer ?? CAUSES[result.unreached] ?? "") };
      else if (result?.ok) { row = { ...base, outcome: "pass", ...(step.via ? { via: step.via } : {}), answer: quote(result.answer) }; passed.add(step.id); }
      else {
        const refusal = refusalIn(result?.answer);
        row = { ...base, outcome: "fail", answer: quote(result?.answer), ...(refusal ? { refusal } : {}) };
      }
    }
    row.ms = Math.round(now() - from);
    rows.push(row);
    say(row);
  }
  return rows;
}

// ── the step table ──────────────────────────────────────────────────────────────────────────────────────────────────

export const FACES = Object.freeze({ steward: "joshua-fontany", engineer: "joshua-fontany-engineer", referee: "joshua-fontany-referee" });
const NOTE = (face) => `lar:///ha.ka.ba/rite-walk/notes/${face}`;
const MEMORY = "lar:///ha.ka.ba/kahua/memory/project/rite-walk";
const OFFERED = "lar:///ha.ka.ba/lares/docs/rite-walk-offered";
const STAGED = "lar:///ha.ka.ba/kahua/law/rite-walk";

/** A meme carrier body for `uri`, with optional extra toml meta lines. */
export function memeText(uri, body, meta = []) {
  const path = uri.replace(/^lar:\/\/\//, "");
  return "<<^ code=`&#x0001;` from=`?` to=`" + uri + "`>>\n<<^ code=`&#x0002;`>>\n\n```toml meta\n" +
    [...meta, `uri-path = "${path}"`].join("\n") + "\n```\n\n<<~ ahu slot=`#/entry`>>\n\n! " + body + "\n\n<<~/ahu>>\n\n<<^ code=`&#x0003;`>>\n\n<<^ code=`&#x0004;` to=`?`>>\n";
}

/** A CLI act: exit 0 and the expected text in its answer. */
const cli = (args, expect) => async (ctx) => {
  const r = await ctx.cli(typeof args === "function" ? args(ctx) : args);
  const text = `${r.stdout}\n${r.stderr}`;
  const wants = [expect].flat().filter(Boolean);
  if (r.code !== 0) return { ok: false, answer: refusalOf(r) };
  return { ok: wants.every((w) => text.includes(w)), answer: [...new Set(wants.map((w) => lineOf(text, w)))].join(" · ") || lineOf(text) };
};
/** Where a put landed, as its receipt names it: `layer: working in <bag>`. */
const landing = (put) => `layer: ${put.json?.data?.layer ?? "(unnamed)"} in ${put.json?.data?.bag ?? "(no bag)"}`;
/** Wear a face through the staged custody's unlock door: a switch that refused wears the face it left, and fails the step. */
const wear = (face, all = false) => async (ctx) => {
  const a = await ctx.wear(face);
  const lit = (a?.faceReadings ?? []).filter((f) => f.reading === "opened").length;
  return { ok: a?.held !== false && a?.switchRefused === undefined && a?.wears === face && (!all || lit === 3), answer: JSON.stringify(a) };
};
const lay = async (ctx) => {
  const r = await ctx.cli(["vessel", "lay", "--apply", "--yes", "--no-json"]);
  const text = `${r.stdout}\n${r.stderr}`;
  // The count the WORN face's lay previewed; an item waiting on another face's wear names no count here.
  const preview = /kahua: (\d+) item\(s\) stand pending/.exec(text);
  ctx.vars.liftKahua = preview ? Number(preview[1]) : 0;
  // Every wait the mirror leg names and every row it refused rides the answer beside the holdings line, so a folder that laid
  // nowhere reads in the receipt by name.
  const waits = text.split("\n").filter((l) => /^mirrors: |^\s+refused: /.test(l)).map((l) => l.trim());
  return r.code === 0 ? { ok: true, answer: [lineOf(text, "lay:"), preview ? lineOf(text, "stand pending") : "", ...waits].filter(Boolean).join(" · ") } : { ok: false, answer: refusalOf(r) };
};
const liftKahua = async (ctx) => {
  const n = ctx.vars.liftKahua ?? 0;
  if (n === 0) return { ok: true, answer: "the worn face's lay previewed no kahua item; nothing to lift" };
  return await cli(["vessel", "lay", "--apply", "--lift-kahua", String(n), "--no-json"])(ctx);
};
const found = cli((ctx) => ["vessel", "found", "--hearth", "--name", FACES.steward, "--chair", "dreamnet-kahu-0", "--root", ctx.root, "--skip-build", "--no-json"], "the hearth stands");
const up = async (ctx) => ({ ok: true, answer: await ctx.up() });
const down = async (ctx) => ({ ok: true, answer: await ctx.down() });
const persona = (n, name) => cli(["persona", "new", String(n), "--name", name, "--no-json"], `persona h${n} minted`);
const hold = cli(["wiki", "hold", "notes", "--no-json"]);

const FOUND = "lares found --hearth --name 'joshua-fontany' --chair 'dreamnet-kahu-0'";
const LAY = "lares vessel lay --apply --yes";
const LIFT = "lares vessel lay --apply --lift-kahua <N>";
const P1 = "lares persona new 1 --name 'joshua-fontany-engineer'";
const P2 = "lares persona new 2 --name 'joshua-fontany-referee'";
const SC = "staged-custody";
const MEMORY_LINE = "the rite walk wrote this stage meme through the seat";

export const STEPS = Object.freeze([
  { id: "image", prose: "stamps the image at that head", unreached: "image" },

  // Stand.
  { id: "found", fence: FOUND, via: SC, expect: "the hearth stands", run: found },
  { id: "up", fence: "lares up", via: SC, needs: ["found"], expect: "phase → live, then the unlock", run: up },
  { id: "lay", fence: LAY, needs: ["up"], run: lay },
  { id: "floor-status", fence: "lares vessel floor status", needs: ["up"], expect: "genesis floor", quoted: ["the pin reads the genesis floor"], run: cli(["vessel", "floor", "status", "--no-json"], "genesis floor") },
  { id: "persona-engineer", fence: P1, via: SC, needs: ["up"], expect: "persona h1 minted", run: persona(1, FACES.engineer) },
  { id: "persona-referee", fence: P2, via: SC, needs: ["up"], expect: "persona h2 minted", run: persona(2, FACES.referee) },
  { id: "unlock-all", fence: "lares vault unlock --all --face 1", via: SC, needs: ["persona-engineer", "persona-referee"], expect: "wears 1", run: wear(1, true) },
  { id: "wear-steward", fence: "lares vault unlock --face 0", via: SC, needs: ["unlock-all"], expect: "wears 0", run: wear(0) },
  { id: "share-lares", fence: "lares wiki share lares --write joshua-fontany-engineer --read joshua-fontany-referee", needs: ["wear-steward"],
    expect: "workbench: wiki lares rides realm … (2 member face(s))", quoted: ["workbench: wiki lares rides realm … (2 member face(s))"],
    run: cli(["wiki", "share", "lares", "--write", FACES.engineer, "--read", FACES.referee, "--no-json"], ["workbench: wiki lares rides realm", "(2 member face(s))"]) },

  // Memory, the lift, another face.
  { id: "memory", prose: "''Memory.''", via: "seat-stdio", needs: ["wear-steward"], expect: "meme_put lands a stage meme; meme_get reads it back",
    run: async (ctx) => {
      const text = memeText(MEMORY, MEMORY_LINE);
      const seat = await ctx.seat([
        { name: "meme_put", arguments: { uri: MEMORY, text, recipe: "default" } },
        { name: "meme_get", arguments: { uri: MEMORY, recipe: "default" } },
      ]);
      if (seat.unreached) return seat;
      const back = JSON.stringify(seat.results[1] ?? null);
      return { ok: back.includes(MEMORY_LINE), answer: `meme_put → ${JSON.stringify(seat.results[0])}` };
    } },
  { id: "lift", prose: "''The lift.''", via: SC, needs: ["unlock-all"], expect: "the stage answers the row digest; the lift signs under the face's root",
    run: async (ctx) => {
      const worn = await ctx.wear(1);
      if (worn?.wears !== 1) return { ok: false, answer: `the engineer never stood worn: ${JSON.stringify(worn)}` };
      const staged = await ctx.cli(["kahua", "stage", STAGED, "--face", "1", "--text", "the rite walk staged this row", "--json"]);
      const digest = /"digest"\s*:\s*"(?:sha256:)?([0-9a-f]{8,})"/.exec(staged.stdout)?.[1];
      if (staged.code !== 0 || !digest) return { ok: false, answer: `kahua stage: ${staged.code === 0 ? "answered no digest" : refusalOf(staged)}` };
      const lifted = await ctx.cli(["kahua", "lift", STAGED, "--face", "1", "--taint", "none", "--digest", digest, "--no-json"]);
      return lifted.code === 0 ? { ok: true, answer: `staged ${digest.slice(0, 8)} · ${lineOf(lifted.stdout, "lift")}` } : { ok: false, answer: refusalOf(lifted) };
    } },
  { id: "wear-referee", prose: "''Wearing another face.''", via: SC, needs: ["unlock-all"], expect: "wears 2", run: wear(2) },

  // A shared workbench.
  { id: "notes-init", fence: "lares wiki init notes", needs: ["unlock-all"], expect: "status: minted",
    run: async (ctx) => { await ctx.wear(0); return await cli(["wiki", "init", "notes", "--no-json"], "minted")(ctx); } },
  { id: "notes-share", fence: "lares wiki share notes --write joshua-fontany-engineer --read joshua-fontany-referee --face 0", needs: ["notes-init"], expect: "workbench: wiki notes rides realm",
    run: cli(["wiki", "share", "notes", "--write", FACES.engineer, "--read", FACES.referee, "--face", "0", "--no-json"], "workbench: wiki notes rides realm") },
  { id: "notes-list", fence: "lares wiki share notes --list", needs: ["notes-share"], expect: "wiki notes:", run: cli(["wiki", "share", "notes", "--list", "--no-json"], "wiki notes:") },
  { id: "two-face-put", prose: "Write from two faces and watch one merged working layer", via: SC, needs: ["notes-share"],
    expect: "layer: working · layer: personal", quoted: ["`layer: working` for a seated writer", "`layer: personal` for the referee"],
    run: async (ctx) => {
      const said = [];
      for (const [face, name, layer] of [[1, "engineer", "layer: working"], [2, "referee", "layer: personal"]]) {
        const worn = await ctx.wear(face);
        if (worn?.wears !== face) return { ok: false, answer: `face ${face} never stood worn: ${JSON.stringify(worn)}` };
        const file = ctx.file(`note-${name}.mem`, memeText(NOTE(name), `the ${name} wrote this page`));
        const put = await ctx.cli(["meme", "put", NOTE(name), "--recipe", "notes", "--file", file, "--json"]);
        said.push(`${name}: ${put.code === 0 ? landing(put) : refusalOf(put)}`);
        if (put.code !== 0 || !landing(put).startsWith(layer)) return { ok: false, answer: said.join(" · ") };
      }
      return { ok: true, answer: said.join(" · ") };
    } },

  // Offer, promote, release, accept.
  { id: "offer", prose: "''Offer, promote, release, accept.''", via: SC, needs: ["share-lares"], expect: "layer: personal, then the offer",
    quoted: ["`layer: personal` on this vessel"],
    run: async (ctx) => {
      const worn = await ctx.wear(1);
      if (worn?.wears !== 1) return { ok: false, answer: `the engineer never stood worn: ${JSON.stringify(worn)}` };
      const file = ctx.file("offered.mem", memeText(OFFERED, "the engineer offers this record to house canon"));
      const put = await ctx.cli(["meme", "put", OFFERED, "--recipe", "lares", "--file", file, "--json"]);
      if (put.code !== 0 || !landing(put).startsWith("layer: personal")) return { ok: false, answer: `meme put: ${put.code === 0 ? landing(put) : refusalOf(put)}` };
      const offer = await ctx.cli(["meme", "offer", OFFERED, "--bag", "lares", "--no-json"]);
      return { ok: offer.code === 0, answer: `${landing(put)} · ${offer.code === 0 ? lineOf(`${offer.stdout}\n${offer.stderr}`, "offer") : refusalOf(offer)}` };
    } },
  { id: "promote", prose: "Wearing the steward (`lares vault unlock --face 0`, the passphrase again)", via: SC, needs: ["offer"], expect: "the offer lists; the promotion writes the Kahu realm's standing document",
    run: async (ctx) => {
      const worn = await ctx.wear(0);
      if (worn?.wears !== 0) return { ok: false, answer: `the steward never stood worn: ${JSON.stringify(worn)}` };
      const list = await ctx.cli(["meme", "offer", "list", "--bag", "lares", "--json"]);
      const cid = /"cid"\s*:\s*"([^"]+)"/.exec(list.stdout)?.[1];
      if (list.code !== 0 || !cid) return { ok: false, answer: `meme offer list: ${list.code === 0 ? "names no offer" : refusalOf(list)}` };
      const promoted = await ctx.cli(["meme", "offer", "promote", cid, "--yes", "--no-json"]);
      return promoted.code === 0 ? { ok: true, answer: lineOf(promoted.stdout) } : { ok: false, answer: refusalOf(promoted) };
    } },
  { id: "release-cut", fence: "lares nexus release floor.json --cut", needs: ["lay", "wear-steward"], expect: "the manifest cuts from live canon",
    run: cli((ctx) => ["nexus", "release", ctx.path("floor.json"), "--cut", "--no-json"]) },
  { id: "down-to-sign", fence: "lares down", needs: ["up"], expect: "the vessel stops", run: down },
  { id: "promote-open", fence: "lares nexus promote open floor.json --purpose floor-release --surface floor-release --class high-impact --out approval.json", via: SC, needs: ["release-cut", "down-to-sign"],
    expect: "ok — 1 of 1 seats", quoted: ["ok — 1 of 1 seats"],
    run: cli((ctx) => ["nexus", "promote", "open", ctx.path("floor.json"), "--purpose", "floor-release", "--surface", "floor-release", "--class", "high-impact", "--out", ctx.path("approval.json"), "--no-json"], "1 of 1 seats") },
  { id: "up-to-release", fence: "lares up", nth: 1, via: SC, needs: ["down-to-sign"], expect: "phase → live, then the unlock", run: up },
  { id: "release-land", fence: "lares nexus release floor.json --approval approval.json", needs: ["promote-open", "up-to-release"], expect: "the release lands on the publication board",
    run: cli((ctx) => ["nexus", "release", ctx.path("floor.json"), "--approval", ctx.path("approval.json"), "--no-json"]) },
  { id: "floor-accept", prose: "Then `lares vessel floor accept`", needs: ["release-land"], expect: "the pin walks to the release", run: cli(["vessel", "floor", "accept", "--yes", "--no-json"]) },

  { id: "browser", prose: "''A browser crosses in.''", unreached: "browser" },

  // Carry across a re-founding.
  { id: "hold-wear-referee", fence: "lares vault unlock --face 2", via: SC, needs: ["up-to-release"], expect: "wears 2", run: wear(2) },
  { id: "hold-referee", fence: "lares wiki hold notes", needs: ["hold-wear-referee", "notes-share"], run: hold },
  { id: "hold-wear-steward", fence: "lares vault unlock --face 0", nth: 1, via: SC, needs: ["up-to-release"], expect: "wears 0", run: wear(0) },
  { id: "hold-steward", fence: "lares wiki hold notes", nth: 1, needs: ["hold-wear-steward", "notes-share"], run: hold },
  { id: "export", fence: "lares export ~/.lares/config/carry-2", needs: ["hold-wear-steward"], expect: "the bundle reads back against its manifest",
    run: cli((ctx) => ["export", ctx.carry(), "--no-json"]) },
  { id: "down-to-refound", fence: "lares down", nth: 1, needs: ["up-to-release"], expect: "the vessel stops", run: down },
  { id: "reset", fence: "lares reset", unreached: "host-shim", standIn: true, needs: ["down-to-refound"] },
  { id: "refound", fence: FOUND, nth: 1, via: SC, needs: ["reset"], expect: "the hearth stands", run: found },
  { id: "up-refounded", fence: "lares up", nth: 2, via: SC, needs: ["refound"], expect: "phase → live, then the unlock", run: up },
  { id: "persona-engineer-again", fence: P1, nth: 1, via: SC, needs: ["up-refounded"], expect: "persona h1 minted", run: persona(1, FACES.engineer) },
  { id: "persona-referee-again", fence: P2, nth: 1, via: SC, needs: ["up-refounded"], expect: "persona h2 minted", run: persona(2, FACES.referee) },
  { id: "unlock-all-again", fence: "lares vault unlock --all --face 1", nth: 1, via: SC, needs: ["persona-engineer-again", "persona-referee-again"], expect: "wears 1", run: wear(1, true) },
  { id: "lay-wear-steward", fence: "lares vault unlock --face 0", nth: 2, via: SC, needs: ["unlock-all-again"], expect: "wears 0", run: wear(0) },
  { id: "lay-steward", fence: LAY, nth: 1, needs: ["lay-wear-steward"], run: lay },
  { id: "lift-kahua-steward", fence: LIFT, via: SC, needs: ["lay-steward"], run: liftKahua },
  { id: "lay-wear-engineer", fence: "lares vault unlock --face 1", via: SC, needs: ["unlock-all-again"], expect: "wears 1", run: wear(1) },
  { id: "lay-engineer", fence: LAY, nth: 2, needs: ["lay-wear-engineer"], run: lay },
  { id: "lift-kahua-engineer", fence: LIFT, nth: 1, via: SC, needs: ["lay-engineer"], run: liftKahua },
  { id: "lay-wear-referee", fence: "lares vault unlock --face 2", nth: 1, via: SC, needs: ["unlock-all-again"], expect: "wears 2", run: wear(2) },
  { id: "lay-referee", fence: LAY, nth: 3, needs: ["lay-wear-referee"], run: lay },

  // The read-backs.
  { id: "read-back", prose: "Read back per face", via: SC, needs: ["lay-referee", "two-face-put"], expect: "each face reads its own personal layer of the shared wiki",
    run: async (ctx) => {
      const said = [];
      for (const [face, name] of [[1, "engineer"], [2, "referee"]]) {
        const worn = await ctx.wear(face);
        if (worn?.wears !== face) return { ok: false, answer: `face ${face} never stood worn: ${JSON.stringify(worn)}` };
        const got = await ctx.cli(["meme", "get", NOTE(name), "--recipe", "notes", "--no-json"]);
        const ok = got.code === 0 && got.stdout.includes(`the ${name} wrote this page`);
        said.push(`${name}: ${ok ? "its page reads back" : refusalOf(got)}`);
        if (!ok) return { ok: false, answer: said.join(" · ") };
      }
      return { ok: true, answer: said.join(" · ") };
    } },
  { id: "import", prose: "Then `lares import ~/.lares/config/carry-2 --apply`", needs: ["export", "lay-referee"], expect: "lands nothing and counts every record as `already` or `waiting`",
    quoted: ["lands nothing and counts every record as `already`"],
    run: async (ctx) => {
      const r = await ctx.cli(["import", ctx.carry(), "--apply", "--no-json"]);
      if (r.code !== 0) return { ok: false, answer: refusalOf(r) };
      const counts = r.stdout.split("\n").map((l) => l.trim()).filter((l) => /\blanded \d+/.test(l));
      return { ok: counts.length > 0 && counts.every((l) => /\blanded 0\b/.test(l)), answer: counts.join(" · ") || lineOf(r.stdout) };
    } },
  { id: "pin-at-genesis", prose: "''The floor pin starts again at genesis.''", needs: ["up-refounded"], expect: "pinSource: genesis · board: absent",
    quoted: ["`pinSource: genesis`, `board: absent`"],
    run: async (ctx) => {
      const r = await ctx.cli(["vessel", "floor", "status", "--json"]);
      const pin = /"pinSource"\s*:\s*"([^"]+)"/.exec(r.stdout)?.[1];
      const board = /"board"\s*:\s*"([^"]+)"/.exec(r.stdout)?.[1];
      return { ok: r.code === 0 && pin === "genesis" && board === "absent", answer: `pinSource: ${pin} · board: ${board}` };
    } },
]);
