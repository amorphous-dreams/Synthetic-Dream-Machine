// frame-shape — every carrier's frame marks stand on the CONTROL head, and the frame closes.
//
// `round-trip` catches a malformed frame, but it reports the damage as a LINE DIFF against a render —
// a reader meets seven lines of unified diff and has to infer that a mark rode the wrong opener. It is
// the right instrument for "this carrier does not survive a projection" and the wrong one for "this
// carrier's frame is malformed", which is a different fault with a different repair.
//
// THE SPLIT THE HEADS MAKE. `<<^` opens the control set; `<<~` opens the speaking set. A frame mark on
// the speaking head names a MALFORMED carrier, never an older one — the sets divide by capability, and
// merging them would re-fuse the domains the split exists to hold apart.
//
// Reported per carrier, per mark, so a repair reads off the finding instead of out of a diff.
import { readFileSync } from "fs";
import { readCarrier, vanishedNote, distCarrierFiles, distModule } from "./corpus-read.mjs";

import { execSync } from "child_process";

const REPO = process.env["REPO"] ?? process.cwd();

// THE SHORE ANSWERS FOR THE FRAMING ENDS. This gate held its own spelling of that question and read
// 1395 torn frames the day the corpus quoted its control values — the corpus had not moved.
// The head reader, the marks and the fence mask are the FRAME PACKAGE — one built shore for all three.
const { carrierHeadPattern, carrierReleasePattern, FRAME_MARKS, frameAlt, maskedExecAll } = await distModule(
  REPO, "packages/lararium-memetic-frame/dist/index.js", "frame-shape", "pnpm --filter @lararium/memetic-frame build");

const { carrierFiles } = await distCarrierFiles(REPO, "frame-shape");

// The CODE + NAME set — the frame package's own declaration, never a second hand-kept copy.
const MARKS = FRAME_MARKS.map((m) => [m.code, m.name]);

// Interpolated ONCE, at module scope (the declaration's own guidance — these run on hot parse paths).
const SOH_LINE_RE = new RegExp(`^<<\\^[^>\\n]*${frameAlt("SOH")}[^\\n]*$`, "gm");
const EOT_LINE_RE = new RegExp(`^<<\\^[^>\\n]*${frameAlt("EOT")}[^\\n]*$`, "gm");
const ETX_OR_EOT_LINE_RE = new RegExp(`^<<\\^[^>\\n]*${frameAlt("ETX", "EOT")}[^\\n]*$`, "gm");
const STX_LINE_RE = new RegExp(`^<<\\^[^>\\n]*${frameAlt("STX")}[^\\n]*$`, "gm");
const ETX_LINE_RE = new RegExp(`^<<\\^[^>\\n]*${frameAlt("ETX")}[^\\n]*$`, "gm");
const ETX_CODE = FRAME_MARKS.find((m) => m.name === "ETX").code;

const files = carrierFiles(REPO);

const faults = [];
for (const f of files) {
  const t = readCarrier(REPO, f);
  // The enumeration read it; a parallel commit may have removed it since. Counted, never silent.
  if (t === null) continue;
  for (const [code, name] of MARKS) {
    // A mark riding the SPEAKING head. A quotation sits inside prose or a fence, so only a mark
    // standing at the start of its own line OUTSIDE the fence mask counts.
    const wrong = new RegExp(`^<<~[^>\\n]*${code}`, "gm");
    if ([...maskedExecAll(t, wrong)].length > 0) faults.push([f, `${name} rides <<~ — the frame takes <<^`]);
  }
  // THE BEARING ARROW IS STRUCTURE, so a frame that lost it is malformed rather than terse.
  //
  // `from="?" -> to=uri` at the heading and `-> to="?"` at the close carry ONE relation read from two ends — source
  // unresolved and target known, then source known and target unresolved. A named parameter would state
  // a PROPERTY; the arrow states a RELATION, and the control-soh scan captures its target as a group.
  // Drop it and the capture returns nothing while every other check here still reads the frame as sound.
  const masked = (re) => [...maskedExecAll(t, re)];
  const soh = masked(SOH_LINE_RE).length > 0;
  if (soh && masked(carrierHeadPattern("gm")).length === 0) {
    faults.push([f, "SOH carries no `from=\"?\" -> to=uri` — the heading states no bearing"]);
  }
  // THE CLOSE NAMES ITS SLOT. The frame's ends took `from=` and `to=`, so an EOT reads `-> to="?"`.
  const eot = masked(EOT_LINE_RE).length > 0;
  if (eot && masked(carrierReleasePattern("gm")).length === 0) {
    faults.push([f, "EOT carries no `-> to=\"?\"` — the close resolves a bearing it cannot know"]);
  }
  // EARLY ALPHA, NO BACK-COMPAT: the bare `-> to=?` spelling is retired outright. TiddlyWiki reads
  // `to=?` and `to="?"` as the same value, but this gate now names the unquoted spelling a fault on
  // its own, additive to whatever the shared frame package's own pattern still tolerates.
  const BARE_EOT_BEARING_RE = /->\s*to=\?(?!")/;
  for (const line of masked(EOT_LINE_RE)) {
    if (BARE_EOT_BEARING_RE.test(line[0])) {
      faults.push([f, "EOT closes on a bare `-> to=?` — the retired unquoted spelling, never a tolerated one"]);
      break;
    }
  }

  // AN OPENED BODY CLOSES — and a carrier that never opens one carries no fault. The frame acts as a
  // FIELD OF THE TEXT BODY (operator ruling), so a bag manifest or a library index whose whole content
  // IS its meta block stands with a heading and nothing to bracket. Demanding ETX there would report ten
  // correct carriers as broken, which is how a witness teaches a reader to ignore it.
  // THE CLOSES COME IN ORDER. Three carriers stood `EOT · ETX · EOT` — an end-of-transmission before
  // the text had ended — and every other check here passed them.
  //
  // THE MASK DECIDES WHAT COUNTS. A frame mark inside a code fence or a backtick span belongs to a
  // lesson: memes that TEACH the frame carry whole example carriers, and a documentation table shows the
  // marks in a row. Reading raw text took those for frames — and an earlier version of this rule carried
  // a shape-specific guard invented to route around exactly that. One mask retires the guard.
  const owned = [...maskedExecAll(t, ETX_OR_EOT_LINE_RE)];
  const lastEtx = owned.filter((m) => m[0].includes(ETX_CODE)).pop();
  const firstEot = owned.find((m) => !m[0].includes(ETX_CODE));
  if (lastEtx && firstEot && firstEot.index < lastEtx.index) {
    faults.push([f, "an EOT stands before the text ends — the closes run out of order"]);
  }

  if (masked(STX_LINE_RE).length > 0) {
    if (masked(ETX_LINE_RE).length === 0) faults.push([f, "opens a body on STX and never closes it on ETX"]);
    if (masked(EOT_LINE_RE).length === 0) faults.push([f, "closes on ETX and never ends on EOT"]);
  }
}

console.log(`[frame-shape] ${files.length} carriers, ${faults.length} malformed frame(s)${vanishedNote()}`);
if (faults.length === 0) {
  console.log("  every frame mark stands on the control head, and every opened carrier closes");
  process.exit(0);
}
for (const [f, why] of faults) console.log(`  ${f}\n     ${why}`);
process.exit(1);
