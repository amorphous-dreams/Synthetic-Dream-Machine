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
import type { ParsedArgs } from "./parse-args.js";

/** What a person reads once a rehive lands: what moved, what was lost, and what to do next, in order. */
export function rehiveLines(a: CustodyDoorAnswer): string[] {
  const face = Number(a["face"]);
  const group = typeof a["personaGroup"] === "string" ? a["personaGroup"] : "<its PersonaGroup>";
  const restored = a["outcome"] === "restored-prev";
  const lines = [
    `face h${face} rehived: its veil-archive row restored identity ${String(a["foreignIdentity"])}… (another identity's Archive), not the face's own ${String(a["ownIdentity"])}….`,
    `the row moved aside to ${String(a["aside"])} in the face's own directory, under the face's own key, on this vessel; nothing was deleted.`,
  ];
  if (restored) {
    lines.push(
      "the face's previous generation (veil-archive .prev) restores the face's own identity, and it stands as the face's row again: only the last overwrite is lost.",
      "",
      "next:",
      `  1. wear the face: lares vault unlock --all --face ${face}`,
      `  2. read its reach: lares wiki status --recipe default --face ${face}. Where a shared bag or the kahua stage refuses to open, land that reach again (step 3 of a rehive from the seed below).`,
    );
    return lines;
  }
  lines.push(
    "the face's next wear stands its hive from its intact seed: the same identity, the same PersonaGroup, and every delegation that names it stand.",
    "LOST with the old Archive: the prekey secrets and the card the face last presented, and its key-agreement (CGKA) and membership state. Content keys sealed to those prekeys (shares this face received, lockboxes it wrapped) may not open again until their reach lands again.",
    "",
    "next, in order:",
    `  1. wear the face: lares vault unlock --all --face ${face}. Its first boot stands the hive from the seed, and the archive floor writes the face's own new Archive.`,
    `  2. land its reach again: lares bag share --list names each row that names h${face}; for each one, lares bag share <bag> --remove, then lares bag share <bag> --read <the same names> [--write <the same names>]. A wiki share lands again the same way through lares wiki share.`,
    `  3. the kahu share: lares nexus cabal standing ${group} reads whether the face's PersonaGroup still stands in the Kahu cabal. The group did not change, so its admission stands unless that reading says otherwise.`,
    `     Then lares kahua list --face ${face}: items that read mean the kahu share holds and nothing more is owed. Items that refuse to open (a key the face no longer holds) mean the kahu share needs granting again: lares kahua carry --face ${face} stands the earlier items again under the face's root, and a Kahu chair re-admits the group where the standing reads it out (lares nexus cabal admit ${group}).`,
  );
  return lines;
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
  // THE DOOR READS FIRST: a rehive runs through the standing vessel's custody door, with its key open and the face shut.
  const door = await sendCustodyFrame({ op: "custody" });
  if (door === null || door["op"] !== "custody") return refuse("daemon-unreachable", "no vessel answers its custody door: stand it (`lares vessel stand`) and open it (`lares vault unlock`), leaving the face to rehive shut");
  if (door["unlocked"] !== true) return refuse("custody-locked", "this vessel holds no key: open it first (`lares vault unlock`), leaving the face to rehive shut");
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
