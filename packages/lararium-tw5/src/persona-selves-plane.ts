/**
 * persona-selves-plane — read and write a human's own-persona names on the persona plane's store.
 *
 * The pet-name and the declared Handle ride the PersonaGroup's own private plane, which fleet-syncs among that
 * face's vessels and never reaches a published or federating surface. This module holds the two store-level
 * moves and nothing about who calls them: one write of ONE name's value+stamp pair, and the fold of every self
 * the plane holds.
 *
 * NOTHING HERE ANSWERS A VERB. A verb's output rests in the daemon's document as an outcome and the digest of
 * its arguments rests in a receipt, so a name on that road would leave its private plane for an unsealed
 * document. The vessel's main thread calls these moves from its custody door instead (the node package's
 * `sealed-acts`, rows `selves.read` and `selves.carry`).
 *
 * THE SEAT NEVER RIDES: no move here carries a seat claim or a chair label.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/persona-policy
 */
import {
  personaSelfTiddlerUri, PERSONA_SELVES_PREFIX,
  type LarTiddlerStore, type LarTiddlerRecord,
} from "@lararium/mesh";
import {
  foldPersonaSelves, withPersonaSelfName, withoutPersonaSelfName,
  type PersonaSelfFields, type PersonaSelfName,
} from "./persona-selves.js";

/** One own persona as the plane holds it: the two names that ride, keyed by handle-index. */
export interface PersonaSelfRow {
  readonly handleIndex: number;
  readonly petname?: string;
  readonly handle?: string;
}

/** Every own persona the plane names, ascending. Reads the selves titles alone. */
export async function readPersonaSelves(store: LarTiddlerStore): Promise<readonly PersonaSelfRow[]> {
  const prefix = `${PERSONA_SELVES_PREFIX}/`;
  const titles = (await store.listVisible()).filter((t) => t.startsWith(prefix)).sort();
  const rows: Array<{ title: string; fields: PersonaSelfFields }> = [];
  for (const title of titles) {
    const record = await store.get(title);
    if (record) rows.push({ title, fields: record.tiddler as PersonaSelfFields });
  }
  return foldPersonaSelves(rows).map(([handleIndex, self]) => ({ handleIndex, ...self }));
}

/**
 * Write ONE name onto a persona's self tiddler; an empty `value` clears it. Only that name's value+stamp pair
 * moves, so a fleet-mate's concurrent rename of the other name, or of another persona, survives the merge.
 * `stamp` orders concurrent writes of this one field and settles nothing else. Answers `written: false` where a
 * stamp the plane already holds outranks this one, so the plane keeps the newer name.
 */
export async function writePersonaSelfName(
  store: LarTiddlerStore, handleIndex: number, name: PersonaSelfName, value: string, stamp: string,
): Promise<{ readonly written: boolean }> {
  if (!Number.isSafeInteger(handleIndex) || handleIndex < 0) {
    throw new Error("a persona self names a handle-index: a whole number from 0");
  }
  const title = personaSelfTiddlerUri(handleIndex);
  const prev = ((await store.get(title))?.tiddler ?? {}) as PersonaSelfFields;
  const trimmed = value.trim();
  const fields = trimmed.length > 0
    ? withPersonaSelfName(prev, handleIndex, name, trimmed, stamp)
    : withoutPersonaSelfName(prev, handleIndex, name, stamp);
  if (fields === prev) return { written: false };
  const next: LarTiddlerRecord = {
    tiddler: { ...fields, title } as LarTiddlerRecord["tiddler"],
    meta: { authority: "lares-verb" },
  };
  await store.put(next, { kind: "lares-verb", requestId: `persona-self-${name}-${stamp}-h${handleIndex}` });
  return { written: true };
}
