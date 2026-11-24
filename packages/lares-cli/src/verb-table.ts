/**
 * verb-table — the shape a door's sub-verbs take in the command registry.
 *
 * A door that answers sub-verbs (`lares vessel request`, `lares meme offer promote`) names them in ONE exported table its own
 * dispatcher reads, and the command row carries that table as `verbs`. A flat list names one level; a tree names a sub-door's
 * own verbs under its branch (`{ offer: ["show", "promote"] }`), so `meme offer promote` reads three words deep. A door with no
 * table takes arguments, never sub-verbs (`lares wear 2`, `lares flow <petname>`).
 *
 * Every law that asks "does this door answer that verb" reads these tables, never a list kept beside them
 * (`tests/laws/harness.ts#verbTables`).
 */
export type VerbTable = readonly string[] | { readonly [verb: string]: VerbTable | null };

/** The verbs one level of a table names. */
export function verbsOf(table: VerbTable): readonly string[] {
  return Array.isArray(table) ? table : Object.keys(table);
}

/** Every level of a door's table, keyed by its path (`meme`, `meme offer`). */
export function flattenVerbs(door: string, table: VerbTable): Array<{ door: string; verbs: readonly string[] }> {
  const out = [{ door, verbs: verbsOf(table) }];
  if (!Array.isArray(table)) {
    for (const [verb, sub] of Object.entries(table as { readonly [verb: string]: VerbTable | null })) {
      if (sub !== null) out.push(...flattenVerbs(`${door} ${verb}`, sub));
    }
  }
  return out;
}

/**
 * A switch over a table's verbs reaches its `default` with the verb typed `never` only when every verb the table names
 * holds a case, so a verb added to the table without a handler fails the typecheck. A case the table does not name fails
 * it too (the switch reads the verb as the table's own union). At run time the default still meets every unknown word.
 */
export function tableCovers(verb: never): string {
  return String(verb);
}
