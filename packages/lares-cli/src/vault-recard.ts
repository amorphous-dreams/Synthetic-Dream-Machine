/**
 * `lares vault recard --face N` — a face whose Archive fell behind its own cards lights again under its own identity.
 *
 * A face that restored a stale Archive light after light walked its live prekeys past every secret it held: its light refuses
 * `FaceHoldsNoPrekeySecret`, and the vessel holds it served and dark. The recard proves the vessel's own route on a TTY (no flag,
 * variable or pipe carries one) and hands it to the standing vessel's custody door in a `recard` frame. The door refuses any face
 * whose last light here did not refuse for want of a prekey secret, then arms that face's next light: the stand mints its card
 * BEFORE its bags, so every Document it mints rides a prekey whose secret it holds, and its Archive rests after that card.
 *
 * WHAT IT KEEPS: the face's identity (its atom key, PersonaGroup, KEL and edges), and every seal it can still reach by replay.
 * WHAT IT CANNOT RECOVER: content a peer sealed to a card whose prekey secret no kept Archive held (`ContentKeyNotHeld`), and
 * content under a recorded Document the stand could not hold (reminted; `SealedUnderLostDocument`). The vessel's log names each.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/custody
 */
import { gatherCredentials } from "./custody-prompt.js";
import { sendCustodyFrame, type CustodyDoorAnswer } from "./custody-door.js";
import { emit } from "./render.js";
import type { ParsedArgs } from "./parse-args.js";

/** A recard's usage refusal, in the vault door's own words; the caller renders it. */
export class RecardUsage extends Error {}

/** What a person reads once a recard lands. */
export function recardLines(face: number): string[] {
  return [
    `face h${face} recarded: it lit again under its own identity, its card minted before its bags and its Archive rests after that card.`,
    "  kept: the face's identity and every seal its stand still reaches.",
    "  lost: content a peer sealed to a card whose secret no kept Archive held (ContentKeyNotHeld) and content under any Document the stand reminted; the vessel's log names each bag. The stand that holds such content shares it anew (`lares bag share <bag> --read <this face>` there).",
    `  next: \`lares vault status\` reads face h${face} lit.`,
  ];
}

/** `vault recard --face <N>`. */
export async function vaultRecard(args: ParsedArgs): Promise<number> {
  const raw = args.options["face"];
  if (typeof raw !== "string" || !/^(0|[1-9]\d*)$/.test(raw) || !Number.isSafeInteger(Number(raw))) {
    throw new RecardUsage("recard names the face's handle-index: `lares vault recard --face <N>` (indices print under `lares vessel roster`)");
  }
  const face = Number(raw);
  const refuse = (code: string, message: string, data?: CustodyDoorAnswer): number => {
    emit(args, { ok: false, error: { code, message }, ...(data ? { data } : {}), human: () => console.error(`lares vault recard: ${message}`) });
    return 1;
  };
  const door = await sendCustodyFrame({ op: "custody" });
  if (door === null || door["op"] !== "custody") return refuse("daemon-unreachable", "no vessel answers its custody door: stand it (`lares vessel stand`) and unlock it (`lares vault unlock`), then recard");
  // THE VESSEL'S OWN ROUTE, read on this terminal alone: a person who holds the vessel stands at this act.
  const credentials = await gatherCredentials(`lares vault recard --face ${face}`, { kind: "vessel" });
  const a = await sendCustodyFrame({ op: "recard", credentials, face });
  if (a === null) return refuse("daemon-unreachable", "the vessel stopped answering before the recard answered: read `lares vault status`, then recard again");
  if (a["status"] === "error") {
    const reason = typeof (a["refusal"] as { reason?: unknown } | undefined)?.reason === "string" ? (a["refusal"] as { reason: string }).reason : "recard-refused";
    return refuse(reason, typeof a["errorMessage"] === "string" ? a["errorMessage"] : `the recard refused (${reason})`, a);
  }
  emit(args, { ok: true, data: a, human: () => { for (const line of recardLines(face)) console.log(line); } });
  return 0;
}
