/**
 * NO SILENT SKIPS — every file a mirror holds either reads back into the house or names why it does not.
 *
 * The scratch-house walk (tideline-surface#/rehearsal, points 1, 2, 6) confirmed a data loss: a hand-made or plain-title
 * working tiddler (`My Notes.tid`, `Room 4.tid`, `Time_ dusk.tid`, `$__config_Foo.tid`) in a face's daemon mirror never
 * read back, and after a re-found every plain-title working tiddler dropped, with no line said. These vectors hold:
 *
 *   S1  the mirror seed's lay reads plain-title files back under their in-band titles (`Time: dusk`, not `Time_ dusk`)
 *   S2  every skip carries its file and its reason, and `skipped + rows == files` holds over a scan
 *   S3  the seed's lines print each skip, file and reason
 *   S4  a personal-margin file under `lares watch` (`fileToUriForSource`) derives its title: a loci `.mem` and a plain one
 *   S5  `lares watch` prints its skips even when no candidate rides the wave
 *   S6  the mirror walk honours HOUSE_IGNORED: no `.git/`, `.vscode/`, `.shore/`, atomic temp or `.orphans/` file rides
 */
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { SyncedTree } from "@lararium/node";
import { liveLay, mirrorFiles, mirrorLines, type MirrorSeedResult, type MirrorWave } from "../src/seed-mirrors.js";
import { scanFiles, fileToUriForSource, skipLines } from "../src/ingest-core.js";

const WORKING = "lar:///ha.ka.ba/wikis/daemon/working";
let root: string;
const P = (rel: string): string => join(root, "projections", ...rel.split("/"));
const put = (rel: string, text: string): string => { const p = P(rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text); return p; };
const tid = (title: string, body = "a body"): string => `title: ${title}\ntype: text/vnd.tiddlywiki\n\n${body}\n`;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "lar-no-silent-skips-"));
  writeFileSync(join(root, ".lar-test-scratch"), "no-silent-skips suite\n");
  process.env["LAR_ROOT"] = root;
});
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

/** A daemon mirror holding one loci carrier, four plain-title working tiddlers, and one file no rule reads. */
function daemonMirror(): void {
  put(`faces/hearth-one/wiki/ha.ka.ba/notes/pond.tid`, tid("lar:///ha.ka.ba/notes/pond"));
  put(`faces/hearth-one/wiki/My Notes.tid`, tid("My Notes"));
  put(`faces/hearth-one/wiki/Time_ dusk.tid`, tid("Time: dusk"));
  put(`faces/hearth-one/wiki/$__config_Foo.tid`, tid("$:/config/Foo"));
  put(`faces/hearth-one/wiki/Room 4.tid`, tid("Room 4", "a hand edited this projected tiddler"));
  put(`faces/hearth-one/wiki/$__state_fold.tid`, tid("$:/state/fold"));
}

const probe = (asked: string[]) => async (o: { candidates: readonly { uri: string }[] }) => {
  asked.push(...o.candidates.map((c) => c.uri));
  return { status: "error" as const, requestId: "probe", errorMessage: "probe: the vessel stands nowhere" };
};

describe("no silent skips", () => {
  test("S1 — the mirror seed's lay reads every plain-title working tiddler back under its in-band title", async () => {
    daemonMirror();
    const asked: string[] = [];
    const wave: MirrorWave = { source: P(`faces/hearth-one/wiki`), uriDir: P("faces/hearth-one"), toBag: WORKING, skipTop: ["temp"] };
    const laid = await liveLay(wave, true, { did: async () => "0xprobe", submit: probe(asked) });
    expect([...asked].sort()).toEqual(["$:/config/Foo", "My Notes", "Room 4", "Time: dusk", "lar:///ha.ka.ba/notes/pond"]);
    expect([...laid.planned].sort()).toEqual([...asked].sort());
    // The one file no rule reads names itself and its reason.
    expect(laid.skipped.map((s) => s.file)).toEqual([P(`faces/hearth-one/wiki/$__state_fold.tid`)]);
    expect(laid.skipped[0]!.why).toMatch(/projection filter/);
  });

  test("S2 — every skip carries its file and its reason, and skipped + rows == files", () => {
    daemonMirror();
    put(`faces/hearth-one/wiki/README`, "no extension");
    const source = P(`faces/hearth-one/wiki`);
    const files = mirrorFiles(source, ["temp"]).map((r) => join(source, ...r.split("/")));
    const scan = scanFiles(source, files, WORKING, new SyncedTree(null), fileToUriForSource(root, source, { bags: join(root, "bags"), wikis: join(root, "wikis"), projections: P("") }));
    expect(scan.skipped.length + scan.rows.length).toBe(files.length);
    expect(scan.skipped.map((s) => s.file).sort()).toEqual([join(source, "$__state_fold.tid"), join(source, "README")]);
    for (const s of scan.skipped) expect(s.why.length).toBeGreaterThan(0);
    expect(skipLines(scan.skipped)).toEqual(scan.skipped.map((s) => expect.stringContaining(s.file)));
  });

  test("S3 — the seed's lines print each skip, file and reason", () => {
    const r: MirrorSeedResult = {
      applied: true, minted: [], any: true, benchWaiting: [],
      kahua: { preview: [], lifted: [], pending: [], waiting: [], refused: [] }, waiting: [], refusals: [],
      layers: [{ mirror: "working hearth-one", toBag: WORKING, planned: 0, landed: 0, kapae: 0, stoodOff: [], refused: [], skipped: [{ file: "/m/README", why: "carries no filetype extension" }] }],
    };
    const { out, err } = mirrorLines(r);
    expect(out.join("\n")).toMatch(/skipped 1/);
    expect(err).toContain("    skips: /m/README (carries no filetype extension)");
  });

  test("S4 — a personal-margin file under `lares watch` derives its title", () => {
    const margin = P("faces/hearth-one/margins/notes");
    const loci = put("faces/hearth-one/margins/notes/ha.ka.ba/notes/heron.mem", "```toml meta\ntitle = \"lar:///ha.ka.ba/notes/heron\"\n```\n");
    const plain = put("faces/hearth-one/margins/notes/Margin Note.tid", tid("Margin: a note"));
    const site = fileToUriForSource(root, margin, { bags: join(root, "bags"), wikis: join(root, "wikis"), projections: P("") });
    expect(site(root, loci)).toBe("lar:///ha.ka.ba/notes/heron");
    expect(site(root, plain)).toBe("Margin: a note");
  });

  test("S5 — `lares watch` prints its skips before the drain returns on a wave no candidate rides", () => {
    const src = readFileSync(new URL("../src/commands/watch.ts", import.meta.url), "utf8");
    const drain = src.slice(src.indexOf("const drain = async"), src.indexOf("// Serialize: a settle arriving mid-drain"));
    const printsSkips = drain.indexOf("skipLines(skipped)");
    const quietReturn = drain.indexOf("if (candidates.length === 0 && ride.length === 0)");
    expect(printsSkips).toBeGreaterThan(-1);
    expect(quietReturn).toBeGreaterThan(-1);
    expect(printsSkips).toBeLessThan(quietReturn);
  });

  test("S6 — the mirror walk honours HOUSE_IGNORED", () => {
    daemonMirror();
    put(`faces/hearth-one/wiki/.git/config`, "[core]\n");
    put(`faces/hearth-one/wiki/.git/objects/ab/cdef`, "blob");
    put(`faces/hearth-one/wiki/.vscode/settings.json`, "{}");
    put(`faces/hearth-one/wiki/.shore/ha.ka.ba/notes/pond.tid`, tid("lar:///ha.ka.ba/notes/pond"));
    put(`faces/hearth-one/wiki/ha.ka.ba/notes/pond.orphans/part.mem`, "x");
    put(`faces/hearth-one/wiki/ha.ka.ba/notes/pond.tid.4242.00000000-0000-4000-8000-000000000000.tmp`, "x");
    const rels = mirrorFiles(P(`faces/hearth-one/wiki`));
    expect(rels.filter((r) => r.startsWith(".") || r.includes(".orphans/") || r.endsWith(".tmp"))).toEqual([]);
    expect(rels).toContain("My Notes.tid");
  });
});
