import { mkdir, readFile, rename, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export interface KahuaIndexRow { relation: string; tag: string; label: string; group: string }
export function kahuaIndexToml(rows: readonly KahuaIndexRow[]): string {
  const quote = (value: string) => JSON.stringify(value).replace(/[\u0000-\u001f]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
  return [...rows].sort((a, b) => a.relation.localeCompare(b.relation)).map(row => `[faces.${quote(row.relation)}]\ntag = ${quote(row.tag)}\nlabel = ${quote(row.label)}\ngroup = ${quote(row.group)}\n`).join("\n");
}
/** The rows a previous index holds, read back from this module's own format; a missing or unreadable file holds none. */
function parseKahuaIndex(text: string): KahuaIndexRow[] {
  const rows: KahuaIndexRow[] = [];
  for (const block of text.split(/^\[faces\./m).slice(1)) {
    const head = /^("(?:[^"\\]|\\.)*")\]/.exec(block);
    const field = (name: string) => { const m = new RegExp(`^${name} = ("(?:[^"\\\\]|\\\\.)*")$`, "m").exec(block); return m ? (JSON.parse(m[1]!) as string) : ""; };
    if (head) rows.push({ relation: JSON.parse(head[1]!) as string, tag: field("tag"), label: field("label"), group: field("group") });
  }
  return rows;
}

/**
 * Write the index: the given rows MERGE by relation into the rows already standing, so a boot wearing one face never drops
 * another face's row on a shared state root. A convenience view: nothing reads it to decide anything; the merge only carries
 * unknown rows through untouched.
 */
export async function writeKahuaIndex(stateRoot: string, rows: readonly KahuaIndexRow[]): Promise<void> {
  await mkdir(stateRoot, { recursive: true });
  const target = join(stateRoot, "kahua-index.toml"), temp = `${target}.${randomUUID()}.tmp`;
  const standing = await readFile(target, "utf8").then(parseKahuaIndex, () => []);
  const byRelation = new Map(standing.map((row) => [row.relation, row] as const));
  for (const row of rows) byRelation.set(row.relation, row);
  try { await writeFile(temp, kahuaIndexToml([...byRelation.values()])); await rename(temp, target); }
  finally { await unlink(temp).catch(() => {}); }
}
