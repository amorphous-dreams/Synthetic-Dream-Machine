import { mkdir, rename, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export interface KahuaIndexRow { relation: string; tag: string; label: string; group: string }
export function kahuaIndexToml(rows: readonly KahuaIndexRow[]): string {
  const quote = (value: string) => JSON.stringify(value).replace(/[\u0000-\u001f]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
  return [...rows].sort((a, b) => a.relation.localeCompare(b.relation)).map(row => `[faces.${quote(row.relation)}]\ntag = ${quote(row.tag)}\nlabel = ${quote(row.label)}\ngroup = ${quote(row.group)}\n`).join("\n");
}
export async function writeKahuaIndex(stateRoot: string, rows: readonly KahuaIndexRow[]): Promise<void> {
  await mkdir(stateRoot, { recursive: true });
  const target = join(stateRoot, "kahua-index.toml"), temp = `${target}.${randomUUID()}.tmp`;
  try { await writeFile(temp, kahuaIndexToml(rows)); await rename(temp, target); }
  finally { await unlink(temp).catch(() => {}); }
}
