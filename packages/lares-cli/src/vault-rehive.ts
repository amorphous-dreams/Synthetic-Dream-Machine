/**
 * `lares vault rehive --face N` — a SHUT face whose veil-archive row holds ANOTHER identity's Archive stands its hive again from
 * its own seed.
 *
 * The verb runs from the operator's terminal alone: it reads the face's own route on a TTY (no flag, variable or pipe carries
 * one) and hands it to the standing vessel's custody door in a `rehive` frame. The door refuses a face worn or lit, opens the
 * face's key for this act alone, moves the foreign row aside (never deleted) and, where no own generation stands back, leaves
 * the face to stand from its seed at its next wear (`face-rehive` in the node package). The answer says what moved, what was
 * lost, and the acts that come next: wear the face, then land again the reach that named it.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/custody
 */
import { gatherCredentials } from "./custody-prompt.js";
import { sendCustodyFrame, type CustodyDoorAnswer } from "./custody-door.js";
import { emit } from "./render.js";
import { rehiveLines as sharedRehiveLines, type RehiveAnswerReading } from "@lararium/node";
import type { ParsedArgs } from "./parse-args.js";

/** What a person reads once a native rehive lands (`rehiveLines`, shared with the pūlama's hand door). */
export function rehiveLines(a: CustodyDoorAnswer): string[] {
  return sharedRehiveLines(a as unknown as RehiveAnswerReading, "native");
}

/** A rehive's usage refusal, in the vault door's own words; the caller renders it. */
export class RehiveUsage extends Error {}

/** `vault rehive --face <N>`. */
export async function vaultRehive(args: ParsedArgs): Promise<number> {
  const raw = args.options["face"];
  if (typeof raw !== "string" || !/^(0|[1-9]\d*)$/.test(raw) || !Number.isSafeInteger(Number(raw))) {
    throw new RehiveUsage("rehive names the face's handle-index: `lares vault rehive --face <N>` (indices print under `lares persona list`)");
  }
  const face = Number(raw);
  const refuse = (code: string, message: string, data?: CustodyDoorAnswer): number => {
    emit(args, { ok: false, error: { code, message }, ...(data ? { data } : {}), human: () => console.error(`lares vault rehive: ${message}`) });
    return 1;
  };
  // THE DOOR READS FIRST: a rehive runs through the standing vessel's custody door with the face shut. A cold vessel rehives
  // too (the face's own route opens its key for the act alone), so no unlock comes first: on a single-face vessel that unlock
  // would mount the very face whose row refuses, and drop the key again.
  const door = await sendCustodyFrame({ op: "custody" });
  if (door === null || door["op"] !== "custody") return refuse("daemon-unreachable", "no vessel answers its custody door: stand it (`lares vessel stand`), leaving the face to rehive shut");
  // THE FACE'S OWN ROUTE, read on this terminal alone: a person who holds the face stands at this act.
  const credentials = await gatherCredentials(`lares vault rehive --face ${face}`, { kind: "face", ordinal: face });
  const a = await sendCustodyFrame({ op: "rehive", credentials, face });
  if (a === null) return refuse("daemon-unreachable", "the vessel stopped answering before the rehive answered: read `lares vault status`, then rehive again");
  if (a["status"] === "error") {
    const reason = typeof (a["refusal"] as { reason?: unknown } | undefined)?.reason === "string" ? (a["refusal"] as { reason: string }).reason : "rehive-refused";
    return refuse(reason, typeof a["errorMessage"] === "string" ? a["errorMessage"] : `the rehive refused (${reason})`, a);
  }
  emit(args, { ok: true, data: a, human: () => { for (const line of rehiveLines(a)) console.log(line); } });
  return 0;
}
