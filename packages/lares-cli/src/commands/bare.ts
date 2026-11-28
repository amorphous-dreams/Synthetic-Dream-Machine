/**
 * The bare `lares` — THE HOUSE SPEAKS (lar:///ha.ka.ba/kahua/memory/course/comms-ux-enacts "The bare `lares` speaks the house";
 * the keyword head). Bare `lares` reads `lares mu=00 aperture=beat`, the CLI spelling of the canon carrier
 * lar:///lares.lararium.status (`bags/lares/ha.ka.ba/lares/afford/lares.lararium.status.mem`, whose cells and default rows name
 * every view below as testimony; the code here walks them, as every host door's code decides what it walks).
 *
 *   THE STATUS LINE, shared by every caller: the revision the checkout stands at against develop's head (N behind) · lit or
 *   dark (with the standing the vessel published) · lit by · faces · canon lag and pending removals · keep due · a begun
 *   half. A field this door cannot read in one cheap step names the door that reads it, never a guess.
 *
 *   THE PINS, layered as TiddlyWiki stacks layers: the house list (canon, lar:///ha.ka.ba/lares/lararium/pins) → the worn
 *   face's own (its daemon wiki, lar:///ha.ka.ba/kahua/lararium/pins) → a mandate's (`mandate=<title>` or LARES_MANDATE: the
 *   mandate record's `pins` field). Every pin a runnable call sigil, one per line: a person reads it, a spirit runs it.
 *
 *   THE KEYS: one line naming the act keywords a call may name (`keys: get= put= … rite= bag= …`). The full door list moved
 *   behind `lares help`.
 *
 * READ-ONLY: it moves nothing; where an act waits it names the door that takes it. A dark house answers as a REPORT ("the
 * house stands dark"), never a refusal, and exits 0, except under the Sword (`mu=!0`), whose verdict rides the exit code.
 *
 * THE LENS (`mu`), each view naming the door it runs today, until the carriers of [10 + 23] fold them into one call:
 *   00 rest       the ground: the status line, the pins, the keys
 *   *0 wand       every lit wiki and its islands (`lares wiki status`)
 *   ?0 cup        the relation map: who holds each face and seat (`lares vessel roster`)
 *   !0 sword      one verdict with an exit code for three: the hearth (the vessel's socket answers), the worn face's daemon
 *                 wiki (a read through it answers), and the asker's own face (the call riding `face=` answers); dark reads 1
 *   _0 pentacle   the hidden residue: owed mirrors and pending removals (`lares shore`), begun halves (`lares rite receipts`)
 *   *! detail     the board verified: the wand, then the sword's verdict
 *   *? relation   the live graph: the wand beside the cup
 *   _! precision  the pre-restand checklist: the residue, then the sword's verdict and its exit
 *   _? overview   what the residue would block: the residue, each line naming the act it holds back
 *   *_ signal-jam an explicit debug dump: the wand and the residue, every door at once
 *   ?! dubious-move  the cup answered with a warning: relations read on trust, the verdict named as the next call
 *
 * THE RANGE (`aperture`, default `beat`): pulse the status line alone · beat the status line, the pins and the keys · measure
 * each status field on its own line, explained · arc the views' doors whole beside it · theme the full door list too.
 *
 * Meme: lar:///ha.ka.ba/lares/afford/lares.lararium.status
 */
import { execFileSync } from "node:child_process";
import { isApertureFault, isMuFault, muWordsOf, readAperture, readMu, apertureWords, type ApertureRank } from "@lararium/tw5";
import { udsAlive } from "../local-connector.js";
import { readStandingMarker } from "../standing-report.js";
import { tryDoor } from "./door-call.js";
import type { ParsedArgs } from "../parse-args.js";

/** The carrier the bare door spells, and its pin records. */
export const BARE_ADDRESS = "lar:///lares.lararium.status";
export const HOUSE_PINS = "lar:///ha.ka.ba/lares/lararium/pins";
export const FACE_PINS = "lar:///ha.ka.ba/kahua/lararium/pins";

/** What the bare door reads of the world; a test seats its own. */
export interface HouseReaders {
  /** The checkout's revision against develop's head, or null where no git checkout answers. */
  readonly revision: () => { readonly sha: string; readonly behind: number | null } | null;
  /** True where the vessel's verb socket answers. */
  readonly lit: () => Promise<boolean>;
  /** The standing the running vessel published beside its socket, or null. */
  readonly marker: () => string | null;
  /** One silent call through the call door (`{verb, params}`), its output, or null where it refused or nothing answered. */
  readonly call: (verb: string, params: Readonly<Record<string, string>>) => Promise<Record<string, unknown> | null>;
  /** The environment (the mandate a summons names). */
  readonly env: Readonly<Record<string, string | undefined>>;
  /** Runs another door's line (a view's door), answering its exit. */
  readonly run: (argv: readonly string[]) => Promise<number>;
  /** Writes one line of the answer. */
  readonly say: (line: string) => void;
}

function gitRevision(): { readonly sha: string; readonly behind: number | null } | null {
  const git = (...a: string[]): string => execFileSync("git", a, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 3_000 }).trim();
  try {
    const sha = git("rev-parse", "--short", "HEAD");
    let behind: number | null = null;
    try { behind = Number(git("rev-list", "--count", "HEAD..origin/develop")); } catch { behind = null; }
    return { sha, behind: Number.isFinite(behind) ? behind : null };
  } catch { return null; }
}

/** The readers a live terminal holds: git for the revision, the socket, the call door; the views run through `run`. */
export function liveReaders(run: (argv: readonly string[]) => Promise<number>): HouseReaders {
  const args: ParsedArgs = { command: "call", positional: [], options: {}, flags: { json: true } };
  return {
    revision: gitRevision,
    lit: () => udsAlive(),
    marker: readStandingMarker,
    call: async (verb, params) => {
      try {
        const answer = await tryDoor(args, { verb: "call", args: { verb, params, surface: "cli" } });
        return answer.ok ? answer.output : null;
      } catch { return null; }
    },
    env: process.env,
    run,
    say: (line) => console.log(line),
  };
}

/** One bare-door line read: its lens, its range, the face it rides, the mandate it names. */
export interface BareAsk {
  readonly carry: string;
  readonly rank: ApertureRank;
  readonly n: number;
  readonly face: string | null;
  readonly mandate: string | null;
}

/** The bare door's dials read from its params; a fault answers its message (exit 2). */
export function bareAsk(params: Readonly<Record<string, string>>): BareAsk | { readonly fault: string } {
  const mu = readMu(params["mu"] ?? "00");
  if (isMuFault(mu)) return { fault: `${mu.reason}: ${mu.message}${mu.cure === null ? "" : `; run: lares mu=${mu.cure}`}` };
  const aperture = readAperture(params["aperture"] ?? "beat");
  if (isApertureFault(aperture)) return { fault: `${aperture.reason}: ${aperture.message}${aperture.cure === null ? "" : `; run: lares aperture=${aperture.cure}`}` };
  return { carry: mu.carry, rank: aperture.rank, n: aperture.n, face: params["face"] ?? null, mandate: params["mandate"] ?? null };
}

/** The call sigils a record's text carries, one per line (`<<~ get title=… >>`, `<<~ lar:///… …>>`). */
export function pinsOf(text: string | undefined): string[] {
  if (typeof text !== "string") return [];
  return text.split("\n").map((l) => l.trim()).filter((l) => /^<<~ (?!has\b|set\b|ahu\b|\/ahu\b|kahea\b|kanawai\b|oracle\b)[^\s>]+[^\n]*>>$/.test(l));
}

/** The text a get answered: a carrier's whole text, a record's text, or a named field. */
function textOf(output: Record<string, unknown> | null, field = "text"): string | undefined {
  if (output === null) return undefined;
  const meme = output["meme"] as { text?: unknown } | undefined;
  if (field === "text" && typeof meme?.text === "string") return meme.text;
  const tiddler = output["tiddler"] as { fields?: Record<string, unknown> } | null | undefined;
  const value = tiddler?.fields?.[field];
  return typeof value === "string" ? value : undefined;
}

/** The act keywords a call may name: the call door's, then every door word. */
export function keysLine(doors: readonly string[]): string {
  const calls = ["get", "put", "delete", "rename", "filter", "act"];
  return `keys: ${[...calls, ...doors.filter((d) => !calls.includes(d))].map((k) => `${k}=`).join(" ")}  (lares help: every door · lares help mu=?0)`;
}

/** The status line's fields, each a reading or the door that reads it. */
export interface StatusFields {
  readonly revision: string;
  readonly lit: string;
  readonly litBy: string;
  readonly faces: string;
  readonly canon: string;
  readonly keep: string;
  readonly begun: string;
  readonly dark: boolean;
}

/** READ THE STATUS: one cheap step per field (git, the socket, the published standing); the rest name their doors. */
export async function readStatus(readers: HouseReaders, face: string | null): Promise<StatusFields> {
  const rev = readers.revision();
  const revision = rev === null ? "revision unread (no git checkout here)" : `checkout ${rev.sha}${rev.behind === null ? " · develop unread" : rev.behind === 0 ? " · even with develop" : ` · ${rev.behind} behind develop`}`;
  let lit = false;
  try { lit = await readers.lit(); } catch { lit = false; }
  const marker = lit ? readers.marker() : null;
  const standing = marker === null ? "" : ` (${marker.trim().split("\n")[0]!.slice(0, 60)})`;
  return {
    revision,
    lit: lit ? `lit${standing}` : "dark: the vessel's socket answers no connect",
    litBy: lit ? "lit by: unread (`lares vessel read` names it)" : "lit by: none",
    faces: lit ? `faces: ${face === null ? "the worn face" : `face ${face}`} (\`lares vessel roster\` names every seat)` : "faces: none lit",
    canon: "canon lag: unread (`lares shore` names the lag and each pending removal)",
    keep: "keep due: unread (`lares rite receipts` names the keep line)",
    begun: "begun half: unread (`lares rite receipts` names each begun half)",
    dark: !lit,
  };
}

/** The status line in one line (beat and below), or one field per line (measure and wider). */
function statusLines(s: StatusFields, rank: ApertureRank): string[] {
  const head = s.dark ? `the house stands dark · ${s.revision}` : `the house stands ${s.lit} · ${s.revision}`;
  if (rank === "pulse") return [head];
  // At beat each field keeps its reading and leaves the door that explains it to measure.
  if (rank === "beat") return [[head, ...[s.litBy, s.faces, s.canon, s.keep, s.begun].map((f) => f.split(" (")[0]!)].join(" · ")];
  return [head, `  ${s.litBy}`, `  ${s.faces}`, `  ${s.canon}`, `  ${s.keep}`, `  ${s.begun}`];
}

/** THE PINS, LAYERED: house → face → mandate, each line a runnable call sigil under its layer's name. */
export interface PinLayers {
  readonly layers: ReadonlyArray<{ readonly layer: string; readonly pins: readonly string[] }>;
  /** True where the daemon wiki answered the pins read (the sword's verdict reuses it). */
  readonly answered: boolean;
}

/**
 * ONE CALL READS THE HOUSE AND FACE LAYERS: a filter over both lists' `#/pins` slots, each row carrying its text (a house
 * that stands wedged costs one call's wait, never two); a named mandate costs one more.
 */
export async function readPins(readers: HouseReaders, face: string | null, mandate: string | null): Promise<PinLayers> {
  const where: Record<string, string> = face === null ? { recipe: "default" } : { recipe: "default", face };
  const page = await readers.call("get", { filter: `[[${HOUSE_PINS}#/pins]] [[${FACE_PINS}#/pins]]`, ...where, aperture: "arc" });
  const rows = (page?.["rows"] as Array<{ title?: unknown; fields?: Record<string, unknown> }> | undefined) ?? [];
  const rowText = (title: string): string | undefined => {
    const text = rows.find((r) => r.title === `${title}#/pins`)?.fields?.["text"];
    return typeof text === "string" ? text : undefined;
  };
  const layers: Array<{ layer: string; pins: readonly string[] }> = [{ layer: "house", pins: pinsOf(rowText(HOUSE_PINS)) }, { layer: "face", pins: pinsOf(rowText(FACE_PINS)) }];
  const named = mandate ?? readers.env["LARES_MANDATE"] ?? null;
  if (named !== null && named !== "") {
    const record = await readers.call("get", { title: named, ...where });
    layers.push({ layer: `mandate ${named}`, pins: pinsOf(textOf(record, "pins")) });
  }
  return { layers, answered: page !== null };
}

/** The views each lens runs, in order: a door line, or the sword's verdict. */
const VIEWS: Readonly<Record<string, ReadonlyArray<readonly string[] | "verdict" | "warn">>> = Object.freeze({
  "00": [],
  "*0": [["wiki", "status"]],
  "?0": [["vessel", "roster"]],
  "!0": ["verdict"],
  "_0": [["shore"], ["rite", "receipts"]],
  "*!": [["wiki", "status"], "verdict"],
  "*?": [["wiki", "status"], ["vessel", "roster"]],
  "_!": [["shore"], ["rite", "receipts"], "verdict"],
  "_?": [["shore"], ["rite", "receipts"]],
  "*_": [["wiki", "status"], ["shore"], ["rite", "receipts"]],
  "?!": [["vessel", "roster"], "warn"],
});

/** The doors a lens runs (for the carrier's testimony and the cost a reader weighs). */
export const viewDoors = (carry: string): string[] => (VIEWS[carry] ?? []).filter((v): v is readonly string[] => typeof v !== "string").map((v) => `lares ${v.join(" ")}`);

/**
 * THE SWORD'S VERDICT for three: the hearth (the socket), the worn face's daemon wiki (a read through it answers), and the
 * asker's own face (the same read riding `face=`, where one rides). Exit 0 where all three stand lit, 1 where any reads dark.
 */
export async function verdict(readers: HouseReaders, status: StatusFields, face: string | null, pinsAnswered: boolean | null = null): Promise<{ readonly lines: string[]; readonly exit: number }> {
  if (status.dark) return { lines: ["verdict: dark · hearth dark · daemon wiki dark · your face dark (the house stands dark: wait on its next event, fire no calls)"], exit: 1 };
  // The worn wiki answered the pins read already (no face named): that answer stands as its verdict, and no second call goes out.
  const wiki = face === null && pinsAnswered !== null ? pinsAnswered : (await readers.call("get", { title: HOUSE_PINS, recipe: "default", aperture: "pulse" })) !== null;
  const asker = face === null ? wiki : pinsAnswered !== null ? pinsAnswered : (await readers.call("get", { title: HOUSE_PINS, recipe: "default", face, aperture: "pulse" })) !== null;
  const who = face === null ? "your face" : `face ${face}`;
  const parts = ["hearth lit", wiki ? "daemon wiki lit" : "daemon wiki dark", asker ? `${who} lit` : `${who} dark`];
  const ok = wiki && asker;
  return { lines: [`verdict: ${ok ? "lit" : "dark"} · ${parts.join(" · ")}`], exit: ok ? 0 : 1 };
}

/** THE BARE DOOR: the status line, the pins, the keys, then the lens's views, at the asked range. */
export async function cmdBare(params: Readonly<Record<string, string>>, readers: HouseReaders, doors: readonly string[], helpRun?: () => Promise<number>): Promise<number> {
  const ask = bareAsk(params);
  if ("fault" in ask) { console.error(`lares: ${ask.fault}`); return 2; }
  const { carry, rank, face, mandate } = ask;
  const status = await readStatus(readers, face);
  readers.say(`<<~ has name=\`${BARE_ADDRESS}\` params=\`mu/${carry} aperture/${apertureWords(ask)} ~ ${muWordsOf(carry)} at ${rank}\`>>`);
  for (const line of statusLines(status, rank)) readers.say(line);
  let pinsAnswered: boolean | null = null;
  if (rank !== "pulse") {
    if (status.dark) readers.say("pins: unread while the house stands dark (`lares rite kukulu` raises it)");
    else {
      const read = await readPins(readers, face, mandate);
      pinsAnswered = read.answered;
      for (const { layer, pins } of read.layers) {
        if (pins.length === 0) continue;
        readers.say(`pins (${layer}):`);
        for (const pin of pins) readers.say(`  ${pin}`);
      }
    }
    readers.say(keysLine(doors));
  }
  let exit = 0;
  for (const view of VIEWS[carry] ?? []) {
    if (view === "verdict") {
      const v = await verdict(readers, status, face, pinsAnswered);
      for (const line of v.lines) readers.say(line);
      exit = Math.max(exit, v.exit);
      continue;
    }
    if (view === "warn") { readers.say("⚠ relations read on trust (unknown until verified): `lares mu=!0` names the verdict"); continue; }
    if (status.dark) { readers.say(`${`lares ${view.join(" ")}`}: unread while the house stands dark`); continue; }
    readers.say(`── lares ${view.join(" ")}`);
    // A view's own exit never fails the read: the bare door reports, and the sword alone answers by its exit.
    // The rite door asks which face it acts as where several stand lit: the asker's face rides it.
    await readers.run(view[0] === "rite" && face !== null ? [...view, `--face=${face}`] : [...view]);
  }
  if (rank === "theme" && helpRun !== undefined) { readers.say("── lares help"); await helpRun(); }
  return exit;
}
