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
 * Meme: lar:///ha.ka.ba/lares/docs/pono/the-worn-house
 */
import { sendCustodyFrame, type CustodyDoorAnswer } from "../custody-door.js";
import { helpLines } from "../command-help.js";
import { emit, proseFirst, refuseUsage } from "../render.js";
import type { ParsedArgs } from "../parse-args.js";
import { LIVE_SHARE_DOORS, landShares } from "../share-doors.js";

/**
 * The harness's own marks, as each AI harness sets them in the shells it runs (Claude Code, Codex's sandbox). A wear sent under
 * one carries `seat: "ai"`, and the vessel answers it as it answers the operator's own: a seat wears on the operator's word. Swap for local-connector's HARNESS_SEAT_MARKS once
 * that list lands (#231), which reads these same names.
 */
const SEAT_MARKS = ["CLAUDECODE", "CODEX_SANDBOX", "CODEX_SANDBOX_NETWORK_DISABLED"] as const;
const seatMarked = (env: NodeJS.ProcessEnv = process.env): boolean => SEAT_MARKS.some((k) => (env[k] ?? "") !== "");

/** The face the line names: the positional, else `--face N`; null where neither names a handle index. */
function faceNamed(args: ParsedArgs): number | null {
  const raw = args.positional[0] ?? args.options["face"];
  if (typeof raw !== "string" || !/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) ? n : null;
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
  return `wearing h${String(a["face"])}: the vessel stands as ${standing}. No route was asked.`;
}

export async function cmdWear(given: ParsedArgs): Promise<number> {
  // A WEAR ANSWERS A PIPE IN PROSE (render.ts `proseFirst`): the shim's `up` chain runs it detached, and one sentence reads
  // where the frame read; `--json` answers the envelope.
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
 * The wear frame and its answer, over a vessel already read holding its key. `vault unlock --face N` rides it where N stands
 * open on a held key, so that unlock asks no route either (`verb` names the command the refusal speaks for).
 */
export async function wearOpenFace(args: ParsedArgs, face: number, verb: string): Promise<number> {
  const refuse = (code: string, message: string, data?: CustodyDoorAnswer): number => {
    emit(args, { ok: false, error: { code, message }, ...(data ? { data } : {}), human: () => console.error(`lares ${verb}: ${message}`) });
    return 1;
  };
  const a = await sendCustodyFrame({ op: "wear", face, ...(seatMarked() ? { seat: "ai" as const } : {}) });
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
    ok: true, data: { ...a, ...(shares.landed ? { shares: shares.landed } : {}), ...(shares.waits ? { sharesWait: shares.waits } : {}) },
    human: () => {
      console.log(wearLine(a));
      for (const line of sharesLines(shares.landed, face)) console.log(line);
      if (shares.waits) console.error(`shares: the share config waits (${shares.waits}); \`lares wiki share --list\` reads it`);
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
    ...(landed.pending > 0 ? [`shares: ${landed.pending} grant(s) wait for a shut face (\`lares vault unlock --face N\`)`] : []),
  ];
}

async function replayShares(): Promise<{ landed: { granted: number; lifted: number; pending: number } | null; waits?: string }> {
  try {
    const landed = await landShares(LIVE_SHARE_DOORS, await LIVE_SHARE_DOORS.faces());
    return { landed: landed === null ? null : { granted: Number(landed["granted"] ?? 0), lifted: Number(landed["lifted"] ?? 0), pending: Number(landed["pending"] ?? 0) } };
  } catch (e) {
    return { landed: null, waits: e instanceof Error ? e.message : String(e) };
  }
}
