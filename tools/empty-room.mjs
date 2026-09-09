// empty-room — a carrier another carrier CITES must answer when the reader arrives.
//
// The address laws already hold: every open resolves, every coordinate names a carrier that stands.
// A stub satisfies all of them. It carries a DOCTYPE, a well-formed frame, a valid block check and a
// registered uri-path — so doctype, frame-shape, bcc and the address gates all read it green, and the
// one thing wrong with it lives where none of them look: the body says nothing.
//
// That costs nothing while nobody walks there. It costs a reader the moment some OTHER carrier cites
// the address as though it answered — the citation reads as a promise, and the room does not keep it.
//
// So this gate binds the two facts no single carrier holds alone: whether a room stands EMPTY, and
// whether anyone SENT a reader to it. An uncited stub owes nobody and reports as slack, never as a
// fault. A cited stub is a broken promise and fails.
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const REPO = process.env["REPO"] ?? process.cwd();
// THE ONE FINDER of the corpus. A hardcoded glob answers a question about PATHS; the law asks about
// DECLARATIONS, and the two disagreed on the runtime kernel face for three rulings.
const DIST_CARRIERS = join(REPO, "packages/lararium-tw5/dist/carrier-files.js");
if (!existsSync(DIST_CARRIERS)) {
  console.error(`[empty-room] no built shore at ${DIST_CARRIERS}\n  cure: pnpm --filter @lararium/tw5 build`);
  process.exit(2);
}
const { currentCarrierFiles } = await import(DIST_CARRIERS);


const carriers = currentCarrierFiles(REPO);

// SPACING IS NOT THE LAW. A key written `role = ` and one written `role      = ` state the same fact,
// and a probe that binds one spelling reports the other as absent — measured, twice, in one night.
const key = (text, name) => {
  const m = new RegExp(`^[ \\t]*${name}[ \\t]*=[ \\t]*"([^"]*)"`, "m").exec(text);
  return m ? m[1] : null;
};

/**
 * The body a reader actually meets: between the STX head and the ETX check.
 *
 * THE MARK IS THE CONTROL HEAD, NEVER THE ENTITY. A carrier may NAME `&#x0002;` in its meta — the
 * grammar spec lists all six control glyphs in a `control-glyphs` array — and binding the bare entity
 * opens the body inside the toml fence, which hands the fence's own closing backticks to a code-span
 * strip and swallows the prose behind it.
 */
const bodyOf = (text) => {
  const head = /<<\^[^>\n]*code="&#x0002;"[^>\n]*>>/.exec(text);
  const tail = /<<\^[^>\n]*code="&#x0003;"/.exec(text);
  if (!head || !tail || tail.index < head.index) return "";
  return text.slice(head.index + head[0].length, tail.index);
};

/**
 * A room reads EMPTY on either tell, never on one alone — a hand-filled body under a stub role and a
 * stub body under a hand-written role both occur, and binding a single tell would miss one of them.
 */
function emptiness(text) {
  const role = key(text, "role") ?? "";
  const body = bodyOf(text);
  const roleTell = /self-documentation:\s*TODO/i.test(role);
  // strip the frame marks, the slot opens/closes and the edges — what remains is prose the room owes
  const prose = body
    .replace(/<<(?:[^>]|>(?!>))*>>/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const bodyTell = /^TODO\b/i.test(prose) || prose.length < 80;
  if (roleTell && bodyTell) return "stub";
  if (roleTell) return "role-only";   // the body grew; the role never caught up
  if (bodyTell) return "body-only";   // a room named in earnest that never got written
  return null;
}

const rooms = new Map();   // uri-path -> { file, empty }
const texts = new Map();
for (const f of carriers) {
  const text = readFileSync(join(REPO, f), "utf8");
  texts.set(f, text);
  const uri = key(text, "uri-path");
  if (uri) rooms.set(uri, { file: f, empty: emptiness(text) });
}

// WHO SENT A READER THERE. A carrier citing its OWN address points at the page you already stand on.
const CITE_END = "[^A-Za-z0-9._~/-]|$";
const citesRe = (uri) => new RegExp(`lar:///${uri.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=${CITE_END})`);

const inbound = new Map();
for (const [f, text] of texts) {
  const self = key(text, "uri-path");
  for (const [uri, room] of rooms) {
    if (uri === self || room.file === f) continue;
    // A BARE PREFIX IS NOT A CITATION. `lar:///…/pono/meme` sits inside `lar:///…/pono/memetic-wikitext`,
    // which every carrier names in its DOCTYPE — so the unbounded test read one spec carrier as cited
    // by all 699 and reported the busiest room in the house as unanswered.
    if (citesRe(uri).test(text)) {
      if (!inbound.has(uri)) inbound.set(uri, []);
      inbound.get(uri).push(f);
    }
  }
}

const broken = [], slack = [], stale = [];
for (const [uri, room] of rooms) {
  if (!room.empty) continue;
  const cites = inbound.get(uri) ?? [];
  if (room.empty === "role-only") { stale.push([uri, room.file]); continue; }
  if (cites.length) broken.push([uri, room.file, cites]);
  else slack.push([uri, room.file]);
}

broken.sort((a, b) => b[2].length - a[2].length);

console.log(`[empty-room] ${rooms.size} rooms · ${broken.length} cited-but-empty · ${slack.length} uncited · ${stale.length} role stale`);

if (broken.length) {
  console.log(`\n  BROKEN PROMISES — a carrier sends a reader here and the room says nothing:`);
  for (const [uri, file, cites] of broken) {
    console.log(`    ${uri}  (${cites.length} inbound)`);
    console.log(`      room  ${file}`);
    console.log(`      cited by  ${cites.map((c) => c.split("/").pop()).join(" · ")}`);
  }
}
if (stale.length) {
  console.log(`\n  ROLE STALE — the body answers, the role still reads TODO (${stale.length}):`);
  for (const [uri] of stale) console.log(`    ${uri}`);
}
if (slack.length) {
  console.log(`\n  slack — empty and uncited, owed to nobody (${slack.length}):`);
  console.log(`    ${slack.map(([u]) => u.split("/").pop()).join(" · ")}`);
}
if (!broken.length && !stale.length) console.log(`  every cited room answers when the reader arrives`);

process.exit(broken.length || stale.length ? 1 : 0);
