// rite-walk/carry-seed — the carry leg's seed, as data: what the source house holds before its export, generated from a seed
// string alone, so a re-run writes the same bytes. Pure: no Docker, no disk, no clock.
//
// THE SOURCE GATE. At the source revision the memory stage keys every row by its `row-key` meta field, and the row stands at
// `STAGE_PREFIX` + key alone (`row-key-missing`, `row-key-title`, `row-key-shape`). So every stage meme here carries
// `row-key = "<class>/<slug>"`, equal to its title path. The new house reads no such field; the leg's sweep (`sweepRowKey`)
// strips it after the parity reads par.
//
// WHAT THE PLAN HOLDS, per face (the three-face rite's pet-names):
//   steward   the six `stage/index` rows the handoff names, `count` stage rows across five classes, a working copy over a
//             canon meme that held still between the revisions and one over a canon meme that moved (the one stand-off the
//             import owes: `expectedStandoff`), and one row outside NFC;
//   engineer  stage rows, a personal margin of `lares`, a page in `notes`;
//   referee   stage rows, a personal margin of `notes`;
// and the acts that are no meme put (`edges`): the shared wikis and their seats, a house-minted bag shared by pet-name, a
// lifted and a staged-only kahua row, a kāpae shadow over canon, temp consent, a library collection, sensorium files.
import { createHash } from "node:crypto";
import { FACES, memeText } from "./steps.mjs";

export const STAGE_PREFIX = "lar:///ha.ka.ba/kahua/memory/";
export const STAGE_CLASSES = Object.freeze(["project", "reference", "feedback", "state", "research"]);
export const PETNAMES = Object.freeze([FACES.steward, FACES.engineer, FACES.referee]);
/** The wikis the seed shares, and the one it mints to stand cold until the hold wakes it. */
export const SHARED_WIKIS = Object.freeze(["lares", "notes", "cold-shelf"]);

/** The handoff's six cold-boot rows: key, class tag, description. */
export const INDEX_ROWS = Object.freeze([
  { key: "project/house-laws", tag: "stage/semantic", description: "the operator's seven house laws, verbatim" },
  { key: "ruling/2026-11-13", tag: "stage/semantic", description: "the standing ruling of 2026-11-13" },
  { key: "ruling/2026-11-14", tag: "stage/semantic", description: "the standing ruling of 2026-11-14" },
  { key: "state/open-ledger", tag: "stage/working", description: "the open loops and the lanes in flight" },
  { key: "state/standing-orders", tag: "stage/working", description: "the lane law's headlines" },
  { key: "reference/where-things-live", tag: "stage/reference", description: "the road, the handoff, the map, the bridge cards" },
]);

const CLASS_TAG = { project: "stage/semantic", reference: "stage/reference", feedback: "stage/feedback", state: "stage/working", research: "stage/semantic" };
/** Body sizes in KiB the stage rows cycle through, small ones weighted. */
const SIZES_KIB = [1, 1, 1, 2, 2, 4, 4, 8, 16, 32, 64, 128, 200];
const EDGE_KIB = 480;
const WORDS = "lararium hearth libation shrine crossroads ward seat face wiki bag carry census stage row ledger road lane loop tide bearing island mirror layer canon kahua kapae library sensorium projection".split(" ");
const NON_ASCII = "Hawaiʻi, kūpuna, ʻohana, mālama, pōhaku: the ʻokina and the kahakō ride whole.";

/** A deterministic stream of 32-bit words from a seed string. */
function stream(seed) {
  let counter = 0, pool = [];
  return () => {
    if (pool.length === 0) {
      const d = createHash("sha256").update(`${seed}:${counter++}`).digest();
      pool = Array.from({ length: 8 }, (_, i) => d.readUInt32BE(i * 4));
    }
    return pool.shift();
  };
}

/** Lines a body may borrow from a tracked carrier: prose alone, never a mark that would open a block. */
export function proseOf(text) {
  return String(text).split("\n").map((l) => l.trim()).filter((l) => l.length > 40 && !/^(<<|```|\\|!|\||\$|<|>|-->|\{\{)/.test(l) && !l.includes("```") && !/<<|>>/.test(l));
}

function body(next, kib, borrowed) {
  const target = kib * 1024;
  const out = [];
  let size = 0;
  while (size < target) {
    const line = borrowed.length > 0 && next() % 2 === 0
      ? borrowed[next() % borrowed.length]
      : Array.from({ length: 12 + (next() % 12) }, () => WORDS[next() % WORDS.length]).join(" ") + ".";
    out.push(line);
    size += Buffer.byteLength(line) + 2;
  }
  return out.join("\n\n");
}

const tomlString = (s) => `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

/** One stage meme: the carrier with `row-key`, its tags and an optional description in the meta. */
export function stageMemeText(key, text, { tags = [], description } = {}) {
  const meta = [`row-key = ${tomlString(key)}`, `tags = [${tags.map(tomlString).join(", ")}]`];
  if (description !== undefined) meta.push(`description = ${tomlString(description)}`);
  return memeText(`${STAGE_PREFIX}${key}`, text, meta);
}

const ROW_KEY_LINE = /^row-key = "([^"\n]*)"\n/m;
/** The row key a carrier's meta names, or null where it names none. */
export function rowKeyOf(text) { return ROW_KEY_LINE.exec(String(text))?.[1] ?? null; }

/** The sweep's one transform: strip the single `row-key` meta line, every other byte kept. */
export function sweepRowKey(text) {
  const s = String(text);
  const hits = s.match(new RegExp(ROW_KEY_LINE.source, "gm")) ?? [];
  if (hits.length !== 1) throw new Error(hits.length === 0 ? "the carrier carries no row-key line" : `the carrier carries ${hits.length} row-key lines`);
  return { key: rowKeyOf(s), text: s.replace(ROW_KEY_LINE, "") };
}

/** A working copy forked over canon: the canon bytes with one paragraph the rehearsal adds before the close. */
function workingCopy(canonText, why) {
  const add = `\n\nThe carry rehearsal forked this working copy over canon (${why}).\n`;
  const close = canonText.indexOf("\n<<^ code=`&#x0003;`");
  return close < 0 ? `${canonText}${add}` : `${canonText.slice(0, close)}${add}${canonText.slice(close)}`;
}

/** Extra ahu slots for a body, so a row carries more than its entry. */
const withSlots = (text, n) => text.replace("\n<<^ code=`&#x0003;`", Array.from({ length: n }, (_, i) => `\n<<~ ahu slot=\`#/note-${i + 1}\`>>\n\nslot ${i + 1} of the rehearsal row.\n\n<<~/ahu>>\n`).join("") + "\n<<^ code=`&#x0003;`");

/**
 * The whole seed. `canon` names three canon memes of the source revision: `still` (unchanged to the pinned head), `moved`
 * (changed), each with its old text, and `kapae` (a title to shadow). `bodies` lends prose lines from tracked carriers.
 */
export function seedPlan({ seed = "carry-rehearsal", count = 300, canon, bodies = [] } = {}) {
  if (!canon?.still?.uri || !canon?.moved?.uri || !canon?.kapae?.uri) throw new Error("the seed names no canon memes (still, moved, kapae)");
  const next = stream(seed);
  const borrowed = proseOf(bodies.join("\n"));
  const faces = { 0: [], 1: [], 2: [] };
  const row = (face, recipe, uri, text, kind) => faces[face].push({ face, recipe, uri, text, kind });
  let serial = 0;
  const stageRows = (face, who, n) => {
    for (let i = 0; i < n; i++) {
      serial += 1;
      const cls = STAGE_CLASSES[i % STAGE_CLASSES.length];
      const key = `${cls}/${who}-${String(i + 1).padStart(4, "0")}`;
      const kib = face === 0 && i === 0 ? EDGE_KIB : SIZES_KIB[next() % SIZES_KIB.length];
      let text = body(next, kib, borrowed);
      if (serial % 9 === 0) text = `${text}\n\n${NON_ASCII}`;
      if (serial % 11 === 0) text = `${text}\n\nThe row names \`lares export\` and \`lares import\` in backticks.`;
      let carrier = stageMemeText(key, text, { tags: [CLASS_TAG[cls]], description: `${who} rehearsal row ${i + 1}` });
      if (serial % 5 === 0) carrier = withSlots(carrier, 1 + (serial % 3));
      row(face, "default", `${STAGE_PREFIX}${key}`, carrier, "stage");
    }
  };
  // The steward: the index first, then the bulk, the non-NFC row and the working copies over canon.
  for (const ix of INDEX_ROWS) {
    row(0, "default", `${STAGE_PREFIX}${ix.key}`, stageMemeText(ix.key, `${ix.description}. ${NON_ASCII}`, { tags: [ix.tag, "stage/index"], description: ix.description }), "index");
  }
  stageRows(0, "steward", count);
  row(0, "default", `${STAGE_PREFIX}research/non-nfc`, stageMemeText("research/non-nfc", "Café and kāhakō: a decomposed mark the export must name or carry."), "non-nfc");
  row(0, "lares", canon.still.uri, workingCopy(canon.still.text, "canon held still"), "working-still");
  row(0, "lares", canon.moved.uri, workingCopy(canon.moved.text, "canon moved"), "working-moved");
  // The engineer: stage rows, a personal margin of `lares`, a page in `notes`.
  stageRows(1, "engineer", 15);
  for (let i = 1; i <= 3; i++) {
    const uri = `lar:///ha.ka.ba/carry-rehearsal/margin/engineer-${i}`;
    row(1, "lares", uri, memeText(uri, `the engineer's margin ${i} of the lares wiki`), "margin");
  }
  row(1, "notes", "lar:///ha.ka.ba/carry-rehearsal/notes/engineer", memeText("lar:///ha.ka.ba/carry-rehearsal/notes/engineer", "the engineer wrote this page in notes"), "page");
  // The referee: stage rows and a personal margin of `notes`.
  stageRows(2, "referee", 10);
  for (let i = 1; i <= 3; i++) {
    const uri = `lar:///ha.ka.ba/carry-rehearsal/margin/referee-${i}`;
    row(2, "notes", uri, memeText(uri, `the referee's margin ${i} of the notes wiki`), "margin");
  }
  row(0, "cold-shelf", "lar:///ha.ka.ba/carry-rehearsal/cold/steward", memeText("lar:///ha.ka.ba/carry-rehearsal/cold/steward", "the steward wrote this page in a wiki left cold"), "page");

  const edges = [
    { kind: "wiki-init", face: 0, slug: "notes" },
    { kind: "wiki-init", face: 0, slug: "cold-shelf" },
    { kind: "wiki-share", face: 0, slug: "lares", write: [FACES.engineer], read: [FACES.referee] },
    { kind: "wiki-share", face: 0, slug: "notes", write: [FACES.engineer], read: [FACES.referee] },
    { kind: "wiki-share", face: 0, slug: "cold-shelf", write: [], read: [FACES.referee] },
    { kind: "bag-share", face: 0, bag: "cold-shelf", read: [FACES.engineer, FACES.referee] },
    { kind: "kahua-lift", face: 1, title: "lar:///ha.ka.ba/kahua/law/carry-rehearsal-lifted", text: "the engineer staged and lifted this row" },
    { kind: "kahua-staged", face: 1, title: "lar:///ha.ka.ba/kahua/law/carry-rehearsal-staged", text: "the engineer staged this row and never lifted it" },
    { kind: "kapae", face: 0, recipe: "lares", title: canon.kapae.uri },
    { kind: "temp-consent", slug: "notes", expiryDays: 30 },
    { kind: "library", collection: "rehearsal-shelf", files: [{ name: "field-notes.txt", text: body(next, 4, borrowed) }] },
    { kind: "sensorium", files: [{ name: "rehearsal/2026-11-16.txt", text: body(next, 2, borrowed) }, { name: "rehearsal/2026-11-15.txt", text: body(next, 1, borrowed) }] },
  ];
  return { seed, count, faces, edges, expectedStandoff: [canon.moved.uri] };
}

/** The files the bulk put reads inside the container: one directory per face, each row a `.mem` beside its `.uri` and `.recipe`. */
export function seedFiles(plan) {
  const out = [];
  for (const [face, rows] of Object.entries(plan.faces)) {
    rows.forEach((r, i) => {
      if (r.kind === "non-nfc") return; // put alone: its refusal reads by name, never as a bulk failure
      const stem = `f${face}/${String(i + 1).padStart(4, "0")}`;
      out.push({ path: `${stem}.mem`, text: r.text }, { path: `${stem}.mem.uri`, text: r.uri }, { path: `${stem}.mem.recipe`, text: r.recipe });
    });
  }
  return out;
}

/** Pick the canon memes the plan forks over, from the tracked `bags/lares` carriers at the source revision and the moved set. */
export function pickCanon({ carriers, moved }) {
  const movedSet = new Set(moved);
  const memes = [...carriers].filter((p) => /^bags\/lares\/ha\.ka\.ba\/lares\/docs\/[a-z0-9-]+\.mem$/.test(p)).sort();
  const uri = (p) => `lar:///${p.replace(/^bags\/lares\//, "").replace(/\.mem$/, "")}`;
  const still = memes.filter((p) => !movedSet.has(p));
  const changed = memes.filter((p) => movedSet.has(p));
  if (still.length < 2 || changed.length < 1) throw new Error(`the canon offers ${still.length} still and ${changed.length} moved carriers; the seed needs two and one`);
  return { still: { path: still[0], uri: uri(still[0]) }, kapae: { path: still[1], uri: uri(still[1]) }, moved: { path: changed[0], uri: uri(changed[0]) } };
}
