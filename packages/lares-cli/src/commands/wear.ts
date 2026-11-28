/**
 * `lares wear N` — UNLOCK OPENS CUSTODY; WEAR CHOOSES THE FACE.
 *
 * The vessel's mount moves to face hN, a face already standing open (under a pūlama, one the pūlama lends), and the vessel
 * composes again on it. A wear asks no route and carries none: its frame names the face and nothing beside it, so nothing here
 * reaches for a prompt. A vessel holding no key names the one act that opens it (`lares vault unlock`) and sends no wear.
 *
 * A wear that lands replays the share landing (`share-apply`), as an unlock does: a grant's rows carried for the face now worn
 * lift into its own catalog half, the face already worn among them (its mount stood before the grant landed), and the wear
 * names what moved and what still waits on a shut face.
 *
 * A WEAR THAT TURNS THE FACE FLUSHES EVERY SHORE FIRST, inside the vessel (the composition's whole-island flush, the one its
 * teardown runs), while the face it leaves still stands mounted, and its answer carries the reading (`shore`), printed here one
 * line per island. Where the flush leaves a record unwritten, or an island gives no answer, the vessel refuses
 * `shore-unwritten` and names each one; a person at a terminal is asked whether to turn anyway, and an agent carries `yes=true`
 * (the frame's `yes: true`), as every confirm in this CLI reads.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/the-worn-house
 */
import { sendCustodyFrame, type CustodyDoorAnswer } from "../custody-door.js";
import { helpLines } from "../command-help.js";
import { createInterface } from "node:readline/promises";
import { emit, proseFirst, refuseUsage, wantsJson } from "../render.js";
import type { ParsedArgs } from "../parse-args.js";
import { LIVE_SHARE_DOORS, landShares, unhandedLine } from "../share-doors.js";
import { readOwnHand, type HandReading } from "@lararium/node";

/**
 * HOW THIS COMMAND READS THE HAND THAT RUNS IT: the house hand gate (`readOwnHand`), off its own branch, never a harness mark
 * alone (a chain that reads nothing carries no mark). A reading of `hand-act-only` names the frame's `seat: "ai"`, a word that
 * only NARROWS what the vessel reads: it reads the line's peer again and decides. A test names another reading.
 */
export type WearHand = () => HandReading;
let readHandOfWear: WearHand = () => readOwnHand({ proveRoute: false });
export function setWearHand(read: WearHand): void { readHandOfWear = read; }

/** The face the line names: the positional, else `face=N`; null where neither names a handle index. */
function faceNamed(args: ParsedArgs): number | null {
  const raw = args.positional[0] ?? args.options["face"];
  if (typeof raw !== "string" || !/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) ? n : null;
}

/** One line per island of the shore's flush the wear asked: what each wrote, and each record it left unwritten. */
export function shoreLines(shore: unknown): string[] {
  const islands = (shore as { islands?: unknown } | null)?.islands;
  if (!Array.isArray(islands)) return [];
  return (islands as Array<Record<string, unknown>>).map((p) => p["answered"] !== true
    ? `shore: ${String(p["island"])} did not answer: ${typeof p["refusal"] === "string" ? `${p["refusal"]}: ` : ""}${String(p["why"])}`
    : `shore: ${String(p["island"])} wrote ${Number(p["writtenCount"] ?? 0)} owed carrier(s)${Number(p["unwrittenCount"] ?? 0) > 0
      ? `; ${Number(p["unwrittenCount"])} left unwritten: ${(Array.isArray(p["unwritten"]) ? (p["unwritten"] as Array<Record<string, unknown>>) : []).map((u) => `${String(u["state"])} ${String(u["uri"])} (${String(u["why"])})`).join("; ")}`
      : ""}`);
}

/** What a wear's answer means to a person. */
function wearLine(a: CustodyDoorAnswer): string {
  const standing = typeof a["standing"] === "string" ? a["standing"] : "?";
  if (a["already"] === true) return `face h${String(a["face"])} stands worn already; the vessel stands as ${standing}.`;
  if (typeof a["switchRefused"] === "string" && a["held"] === false) {
    return `the composition wearing h${String(a["face"])} did not stand (${a["switchRefused"]}), and the face it left would not stand again either: the vessel dropped its key and stands as ${standing}; open it again (\`lares vault unlock\`).`;
  }
  if (typeof a["switchRefused"] === "string") {
    const again = typeof a["wornAgain"] === "number" ? `h${String(a["wornAgain"])} worn again` : "no face worn";
    return `the composition wearing h${String(a["face"])} did not stand: h${String(a["face"])} did not stand (${a["switchRefused"]}); ${again}, and the vessel key stays held.`;
  }
  return `wearing h${String(a["face"])}: the vessel stands as ${standing}. This verb asked for no route.`;
}

export async function cmdWear(given: ParsedArgs): Promise<number> {
  // A WEAR ANSWERS A PIPE IN PROSE (render.ts `proseFirst`): the shim's `up` chain runs it detached, and one sentence reads
  // where the frame read; `json=true` answers the envelope.
  const args = proseFirst(given);
  const face = faceNamed(args);
  if (face === null) {
    return refuseUsage(args, "wear", helpLines("wear"), "name the face to wear");
  }
  const refuse = (code: string, message: string, data?: CustodyDoorAnswer): number => {
    emit(args, { ok: false, error: { code, message }, ...(data ? { data } : {}), human: () => console.error(`lares wear: ${message}`) });
    return 1;
  };
  // THE DOOR READS FIRST: a vessel holding no key takes no wear, and its one opening act stays the unlock.
  const door = await sendCustodyFrame({ op: "custody" });
  if (door === null || door["op"] !== "custody") return refuse("daemon-unreachable", "no vessel answers its custody door: stand it (`lares vessel stand`), then unlock and wear");
  if (door["unlocked"] !== true) return refuse("custody-locked", "this vessel holds no key: open it first (`lares vault unlock`); a wear opens nothing");
  return await wearOpenFace(args, face, "wear");
}

/**
 * The wear frame and its answer, over a vessel already read holding its key. `vault unlock face=N` rides it where N stands
 * open on a held key, so that unlock asks no route either (`verb` names the command the refusal speaks for).
 */
export async function wearOpenFace(args: ParsedArgs, face: number, verb: string): Promise<number> {
  const refuse = (code: string, message: string, data?: CustodyDoorAnswer): number => {
    emit(args, { ok: false, error: { code, message }, ...(data ? { data } : {}), human: () => console.error(`lares ${verb}: ${message}`) });
    return 1;
  };
  // The gate reads the branch once: an AI harness on the branch names the frame's seat, a word that only narrows.
  const hand = readHandOfWear();
  const seatAi = "refusal" in hand && hand.refusal === "hand-act-only";
  const send = (yes: boolean): Promise<CustodyDoorAnswer | null> => sendCustodyFrame({ op: "wear", face, ...(seatAi ? { seat: "ai" as const } : {}), ...(yes ? { yes: true as const } : {}) });
  let a = await send(args.flags["yes"] === true);
  // THE SHORE'S FLUSH LEFT RECORDS UNWRITTEN: a person at a terminal answers whether to turn anyway; an agent carries yes=true.
  if (a !== null && a["status"] === "error" && (a["refusal"] as { reason?: unknown } | undefined)?.reason === "shore-unwritten") {
    const named = shoreLines((a["refusal"] as { shore?: unknown }).shore).join("\n  ");
    if (!wantsJson(args) && process.stdin.isTTY === true && process.stdout.isTTY === true) {
      console.error(`lares ${verb}: the shore's flush left records unwritten on the face this wear turns away from:\n  ${named}`);
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      const word = await rl.question("they rest in the store, and their mirrors stay behind until that face is worn again; turn anyway? [y/N] ");
      rl.close();
      if (!/^y(es)?$/i.test(word.trim())) { console.log("aborted; the face worn stays worn"); return 1; }
      a = await send(true);
    } else {
      return refuse("shore-unwritten", `the shore's flush left records unwritten on the face this wear turns away from; they rest in the store, and their mirrors stay behind until a hand wears that face again:\n  ${named}\nturn anyway: lares wear ${face} yes=true`, a);
    }
  }
  if (a === null) return refuse("daemon-unreachable", "the vessel stopped answering before the wear landed — check `lares vault status`, then wear again");
  const refusal = a["refusal"] as { reason?: unknown } | undefined;
  if (a["status"] === "error") {
    const reason = typeof refusal?.reason === "string" ? refusal.reason : "wear-refused";
    return refuse(reason, typeof a["errorMessage"] === "string" ? a["errorMessage"] : `the wear refused (${reason})`, a);
  }
  if (typeof a["switchRefused"] === "string") return refuse("wear-refused", wearLine(a), a);
  // A WEAR REPLAYS THE SHARE LANDING (sealed-store#/the-share-config), as an unlock does: the rows a grant carried for the face
  // now worn lift into its own catalog half, and a grant that waited on a face this vessel now holds lit lands. A wear onto
  // the face already worn remounts nothing, so this replay alone reaches a grant landed since that face's mount. A replay over
  // a landed share moves nothing.
  const shares = await replayShares();
  emit(args, {
    ok: true, data: { ...a, ...(shares.landed ? { shares: shares.landed } : {}), ...(shares.waits ? { sharesWait: shares.waits } : {}), ...(shares.unhanded ? { sharesUnhanded: shares.unhanded } : {}) },
    human: () => {
      console.log(wearLine(a));
      for (const line of shoreLines(a["shore"])) console.log(line);
      for (const line of sharesLines(shares.landed, face)) console.log(line);
      if (shares.unhanded) console.error(shares.unhanded);
      if (shares.waits) console.error(`shares: the share config waits (${shares.waits}); \`lares wiki share list=true\` reads it`);
    },
  });
  return 0;
}

/** What a share landing moved, as the wear names it: nothing where it moved nothing. */
function sharesLines(landed: { granted: number; lifted: number; pending: number } | null, face: number): string[] {
  if (!landed) return [];
  return [
    ...(landed.lifted > 0 ? [`shares: ${landed.lifted} granted row(s) now stand in h${face}'s catalog`] : []),
    ...(landed.granted > 0 ? [`shares: ${landed.granted} grant(s) landed for the faces this vessel holds lit`] : []),
    ...(landed.pending > 0 ? [`shares: ${landed.pending} grant(s) wait for a shut face (\`lares vault unlock face=N\`)`] : []),
  ];
}

async function replayShares(): Promise<{ landed: { granted: number; lifted: number; pending: number } | null; waits?: string; unhanded?: string }> {
  try {
    const faces = await LIVE_SHARE_DOORS.faces();
    const landed = await landShares(LIVE_SHARE_DOORS, faces);
    const unhanded = unhandedLine(landed, faces);
    return { landed: landed === null ? null : { granted: Number(landed["granted"] ?? 0), lifted: Number(landed["lifted"] ?? 0), pending: Number(landed["pending"] ?? 0) }, ...(unhanded !== null ? { unhanded } : {}) };
  } catch (e) {
    return { landed: null, waits: e instanceof Error ? e.message : String(e) };
  }
}
