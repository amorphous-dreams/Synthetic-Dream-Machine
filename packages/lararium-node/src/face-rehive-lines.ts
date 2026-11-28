/**
 * face-rehive-lines — what a person reads once a rehive lands: what moved, what was lost, and the acts that come next, in
 * order, for the seat the rehive ran at (`native`: `lares vault rehive` at a vessel holding its own custody; `pulama`: the
 * pūlama's hand door, `tools/lares-container.sh pulama rehive`, whose wear rides the pūlama).
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/custody
 */

/** The answer's own fields a reading needs. */
export interface RehiveAnswerReading {
  readonly face: unknown;
  readonly outcome?: unknown;
  readonly foreignIdentity?: unknown;
  readonly ownIdentity?: unknown;
  readonly aside?: unknown;
  readonly personaGroup?: unknown;
  readonly resumed?: unknown;
}

export type RehiveSeat = "native" | "pulama";

/** The wear line for the seat the rehive ran at. */
function wearSteps(face: number, seat: RehiveSeat): string[] {
  return seat === "pulama"
    ? [
      `  1. wear the face, through the pūlama: tools/lares-container.sh pulama light (the route opens every face it fits; h${face}'s hive stands from its seed at its next wear),`,
      `     then tools/lares-container.sh vault unlock (the vessel asks its pūlama again), then tools/lares-container.sh wear ${face}. The archive floor writes the face's own new Archive at that first boot.`,
    ]
    : [`  1. wear the face: lares vault unlock all=true face=${face}. Its first boot stands the hive from the seed, and the archive floor writes the face's own new Archive. (A native rehive runs only on a vessel holding its own custody, so this unlock reads both selectors.)`];
}

export function rehiveLines(a: RehiveAnswerReading, seat: RehiveSeat): string[] {
  const face = Number(a.face);
  const group = typeof a.personaGroup === "string" ? a.personaGroup : "<its PersonaGroup>";
  const lines = [
    `face h${face} rehived${a.resumed === true ? " (an earlier run's act, finished or read again)" : ""}: its veil-archive row restored identity ${String(a.foreignIdentity)}… (another identity's Archive), not the face's own ${String(a.ownIdentity)}….`,
    `the row's bytes rest aside at ${String(a.aside)} in the face's own directory, under the face's own key, on this house; nothing was deleted.`,
  ];
  const carry = `lares kahua carry all=true face=${face} stands every earlier item again under the face's root (or name the revision cids instead of all=true; carry is a person's hand at the face's kahua stage and needs its stage access)`;
  if (a.outcome === "restored-prev") {
    lines.push(
      "the face's previous generation (veil-archive .prev) restores the face's own identity, and it stands as the face's row again: only the last overwrite is lost.",
      "",
      "next:",
      ...wearSteps(face, seat),
      `  2. read its reach: lares wiki status recipe=default face=${face}. Where a shared bag or the kahua stage refuses to open, land that reach again as a rehive from the seed does (lares bag share list=true json=true first, which prints each row as written, then each row granted again under that same policy, with no mechanical round trip promised; ${carry}).`,
    );
    return lines;
  }
  lines.push(
    "the face's next wear stands its hive from its intact seed: the same identity, the same PersonaGroup, and every delegation that names it stand.",
    "LOST with the old Archive: the prekey secrets and the card the face last presented, and its key-agreement (CGKA) and membership state. Content keys sealed to those prekeys (shares this face received, lockboxes it wrapped) may not open again until their reach lands again.",
    "",
    "next, in order:",
    ...wearSteps(face, seat),
    `  2. list its shares and grant each again under the same policy. First keep the rows: lares bag share list=true json=true > shares-before.json prints each row as written (its read and write title lists with * kept, its note, workspace and owner; config/share.tid holds the same rows).`,
    `     For each row whose read or write names h${face}'s pet-name or *: lares <bag|wiki> share <slug> remove=true, then lares <bag|wiki> share <slug> read='<its read>' [write='<its write>'] [note='<its note>'] [workspace=<its workspace>, a wiki row only], each value copied from that row as written.`,
    `     A row that named an owner loses it at remove=true, and the grant writes none back until a landing names it: where the owner does not stand again in lares bag share list=true json=true, write its owner back into config/share.tid by hand (the file wins at the next boot).`,
    `     This grants each row again; it promises no mechanical round trip. Compare lares bag share list=true json=true against shares-before.json, and read the face's reach (lares wiki status recipe=default face=${face}) once it wears.`,
    `  3. the kahu share: lares nexus cabal standing ${group} reads whether the face's PersonaGroup still stands in the Kahu cabal. The group did not change, so its admission stands unless that reading says otherwise.`,
    `     Then lares kahua get face=${face}: items that read mean the kahu share holds and nothing more is owed. Items that refuse to open (a key the face no longer holds) mean the kahu share needs granting again: ${carry}, and a Kahu chair re-admits the group where the standing reads it out (lares nexus cabal admit ${group}).`,
  );
  return lines;
}
