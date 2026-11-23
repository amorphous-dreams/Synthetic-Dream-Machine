/**
 * browser-veil-archive-route — the ONE gate a browser vessel holds over whose Archive it rests.
 *
 * A browser vessel routes no sibling's session (its book seats its own unlocked session alone), so only the worn face's
 * Archive rests here, named by its own PersonaGroup. The island's writer and the archive floor's routing word both read
 * this one predicate: the floor asks it BEFORE any export (a sibling's export would mint that stand's card, which no row
 * here keeps), and the writer refuses any face it answers false for. Two copies of the rule could drift; one cannot.
 */

/** Whether this browser vessel rests `face`'s Archive: the worn face's alone. */
export function browserRoutesVeilArchive(wornGroup: string | null | undefined): (face: string) => boolean {
  return (face) => typeof wornGroup === "string" && wornGroup !== "" && face === wornGroup;
}

/** The island's archive writers, each reading the same route: the floor's routing word and the write that keeps it. */
export function browserVeilArchiveWriters(wornGroup: string | null | undefined, write: (bytes: Uint8Array, face: string) => Promise<void>): {
  readonly persistVeilArchive: (bytes: Uint8Array, face: string) => Promise<void>;
  readonly routesVeilArchive: (face: string) => boolean;
} {
  const routesVeilArchive = browserRoutesVeilArchive(wornGroup);
  return {
    routesVeilArchive,
    persistVeilArchive: (bytes, face) => routesVeilArchive(face)
      ? write(bytes, face)
      : Promise.reject(new Error("face-archive-unrouted: this browser vessel rests no sibling's Archive")),
  };
}
