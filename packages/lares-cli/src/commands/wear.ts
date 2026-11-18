/**
 * `lares wear N` — UNLOCK OPENS CUSTODY; WEAR CHOOSES THE FACE.
 *
 * The vessel's mount moves to face hN, a face already standing open (under a pūlama, one the pūlama lends), and the vessel
 * composes again on it. A wear asks no route and carries none: its frame names the face and nothing beside it, so nothing here
 * reaches for a prompt. A vessel holding no key names the one act that opens it (`lares vault unlock`) and sends no wear.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/the-worn-house
 */
import { sendCustodyFrame, type CustodyDoorAnswer } from "../custody-door.js";
import { emit, exitFor } from "../render.js";
import type { ParsedArgs } from "../parse-args.js";

/**
 * The harness's own marks, as each AI harness sets them in the shells it runs (Claude Code, Codex's sandbox). A wear sent under
 * one carries `seat: "ai"`, and the vessel refuses it: a seat never wears. Swap for local-connector's HARNESS_SEAT_MARKS once
 * that list lands (#231), which reads these same names.
 */
const SEAT_MARKS = ["CLAUDECODE", "CODEX_SANDBOX", "CODEX_SANDBOX_NETWORK_DISABLED"] as const;
const seatMarked = (env: NodeJS.ProcessEnv = process.env): boolean => SEAT_MARKS.some((k) => (env[k] ?? "") !== "");

const USAGE = "usage: lares wear <N>   (N names a face standing open, a whole number from 0; `--face N` reads the same)";

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

export async function cmdWear(args: ParsedArgs): Promise<number> {
  const face = faceNamed(args);
  if (face === null) {
    emit(args, { ok: false, error: { code: "usage", message: `lares wear: name the face to wear. ${USAGE}` }, human: () => console.error(`lares wear: name the face to wear.\n${USAGE}`) });
    return exitFor("usage");
  }
  const refuse = (code: string, message: string, data?: CustodyDoorAnswer): number => {
    emit(args, { ok: false, error: { code, message }, ...(data ? { data } : {}), human: () => console.error(`lares wear: ${message}`) });
    return 1;
  };
  // THE DOOR READS FIRST: a vessel holding no key takes no wear, and its one opening act stays the unlock.
  const door = await sendCustodyFrame({ op: "custody" });
  if (door === null || door["op"] !== "custody") return refuse("daemon-unreachable", "no vessel answers its custody door: stand it (`lares vessel stand`), then unlock and wear");
  if (door["unlocked"] !== true) return refuse("custody-locked", "this vessel holds no key: open it first (`lares vault unlock`); a wear opens nothing");
  const a = await sendCustodyFrame({ op: "wear", face, ...(seatMarked() ? { seat: "ai" as const } : {}) });
  if (a === null) return refuse("daemon-unreachable", "the vessel stopped answering before the wear landed — check `lares vault status`, then wear again");
  const refusal = a["refusal"] as { reason?: unknown } | undefined;
  if (a["status"] === "error") {
    const reason = typeof refusal?.reason === "string" ? refusal.reason : "wear-refused";
    return refuse(reason, typeof a["errorMessage"] === "string" ? a["errorMessage"] : `the wear refused (${reason})`, a);
  }
  if (typeof a["switchRefused"] === "string") return refuse("wear-refused", wearLine(a), a);
  emit(args, { ok: true, data: a, human: () => console.log(wearLine(a)) });
  return 0;
}
